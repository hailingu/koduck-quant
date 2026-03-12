"""Realtime data updater.

Fetches market data from Eastmoney and persists it to a PostgreSQL
backend.  Designed for use within the ``koduck-data-service`` microservice.
"""

import asyncio
import logging
from datetime import datetime
from typing import Any, Optional, Tuple

from app.db import Database, stock_db, tick_history_db
from app.config import settings
from app.services.eastmoney_client import eastmoney_client
from app.utils.trading_hours import is_a_share_trading_time

logger = logging.getLogger(__name__)

# Test symbol: 工商银行 (Industrial and Commercial Bank of China)
TEST_SYMBOL = "601398"
TEST_SYMBOL_NAME = "工商银行"
PRICE_FIELDS = (
    "price",
    "open",
    "high",
    "low",
    "prev_close",
    "bid_price",
    "ask_price",
    "change",
)
MAX_TICK_HISTORY = 100

StockPayload = dict[str, Any]


class DataUpdater:
    """Component responsible for pulling and storing stock quotes.

    The updater encapsulates both single-symbol operations (used by the API
    layer) and longer-running test/loop methods that can drive continuous data
    ingestion.  Internal helpers normalise the raw Eastmoney payload and manage
    a simple tick history for debugging.
    """
    
    def __init__(self) -> None:
        self._running = False
        self._update_count = 0
        self._tick_history_count = 0
        # Per-symbol last observed realtime price (for logs/debug only)
        self._last_observed_price_by_symbol: dict[str, float] = {}
        # Per-symbol last persisted tick price (for change-event persistence)
        self._last_persisted_price_by_symbol: dict[str, float] = {}
        self._tick_history: list[dict[str, Any]] = []  # Store recent ticks for verification
        self._tick_buffer: list[dict[str, Any]] = []   # Buffer for batch insert
        # Per-symbol last persisted tick time (for optional throttling)
        self._last_tick_time_by_symbol: dict[str, datetime] = {}

    def _normalize_market_data(self, data: StockPayload) -> StockPayload:
        """Convert raw Eastmoney values to human-readable units.

        Eastmoney returns prices and percentages scaled by 100.  This helper
        divides the relevant fields and mutates the input dictionary in-place.

        Additionally, when the API returns price=0 (outside trading hours),
        use prev_close as the reference price.

        Args:
            data: Raw payload returned by :class:`eastmoney_client`.

        Returns:
            The same dictionary with numeric fields adjusted.
        """
        # Convert price fields from Eastmoney units (x100) to standard units
        for field in PRICE_FIELDS:
            if data.get(field) is not None:
                data[field] = data[field] / 100

        if data.get("change_percent") is not None:
            data["change_percent"] = data["change_percent"] / 100

        # Handle after-hours price: when Eastmoney returns price=0,
        # use prev_close as the reference price
        if data.get("price") == 0 and data.get("prev_close") is not None:
            if not is_a_share_trading_time():
                logger.debug(
                    f"After-hours data for {data.get('symbol')}: "
                    f"price=0, using prev_close={data['prev_close']}"
                )
                data["price"] = data["prev_close"]
                data["change"] = 0
                data["change_percent"] = 0
                data["_data_source"] = "after_hours"  # Mark data source

        return data

    @staticmethod
    def _resolve_secid_prefix(symbol: str) -> str:
        """Resolve Eastmoney secid prefix from stock symbol.

        Eastmoney uses:
        - "1" for Shanghai market symbols (commonly starting with 5/6)
        - "0" for Shenzhen and Beijing symbols (e.g. 0/2/3/4/8/9)
        """
        normalized = (symbol or "").strip()
        if normalized.startswith(("6", "5")):
            return "1"
        return "0"
    
    def _should_store_tick(self, symbol: str, data: StockPayload) -> bool:
        """Check whether a tick should be persisted.

        Tick design:
        - Default behavior stores on every *price change* event per symbol.
        - Optional `TICK_SAMPLING_INTERVAL > 0` works as a throttle layer.
        """
        if not settings.TICK_HISTORY_ENABLED:
            return False

        price = data.get("price")
        if price is None:
            return False

        try:
            current_price = float(price)
        except (TypeError, ValueError):
            return False

        last_price = self._last_persisted_price_by_symbol.get(symbol)
        # Store first tick for symbol; afterwards only on price change.
        if last_price is not None and current_price == last_price:
            return False

        # Optional additional throttle by interval.
        if settings.TICK_SAMPLING_INTERVAL > 0:
            now = datetime.now()
            last_tick_time = self._last_tick_time_by_symbol.get(symbol)
            if last_tick_time is not None:
                elapsed = (now - last_tick_time).total_seconds()
                if elapsed < settings.TICK_SAMPLING_INTERVAL:
                    return False

        return True

    async def _is_symbol_in_watchlist(self, symbol: str) -> bool:
        """Return whether symbol exists in A-share watchlist."""
        if not symbol:
            return False

        row = await Database.fetchrow(
            """
            SELECT 1
            FROM watchlist_items
            WHERE symbol = $1
              AND market IN ('AShare', 'SSE', 'SZSE')
            LIMIT 1
            """,
            symbol,
        )
        return row is not None

    async def _should_persist_tick(
        self, symbol: str, data: StockPayload | None = None
    ) -> bool:
        """Tick persistence guard: watchlist + trading time + price-change event."""
        if not settings.TICK_HISTORY_ENABLED:
            return False

        if not is_a_share_trading_time():
            return False

        if not await self._is_symbol_in_watchlist(symbol):
            return False

        if data is None:
            return True

        return self._should_store_tick(symbol, data)

    async def _save_tick_history(self, data: StockPayload) -> bool:
        """Save tick data to history table.
        
        Args:
            data: Normalized stock data dictionary
            
        Returns:
            True if successful, False otherwise
        """
        symbol = str(data.get("symbol", "")).strip()
        try:
            should_persist = await self._should_persist_tick(symbol, data)
        except TypeError:
            # Keep compatibility with older monkeypatches in tests that define
            # a one-argument guard function.
            should_persist = await self._should_persist_tick(symbol)

        if not should_persist:
            return True

        try:
            now = datetime.now()
            current_price = float(data["price"])

            # Use async insert
            if settings.TICK_WRITE_ASYNC:
                # Add to buffer for batch insert
                payload = dict(data)
                payload["_tick_time"] = now.isoformat()
                self._tick_buffer.append(payload)
                
                # Flush buffer if it reaches batch size
                if len(self._tick_buffer) >= settings.TICK_BATCH_SIZE:
                    await self._flush_tick_buffer()
                
                self._tick_history_count += 1
                self._last_persisted_price_by_symbol[symbol] = current_price
                self._last_tick_time_by_symbol[symbol] = now
                return True
            else:
                # Direct insert
                success = await tick_history_db.insert_tick_from_dict(data, tick_time=now)
                if success:
                    self._tick_history_count += 1
                    self._last_persisted_price_by_symbol[symbol] = current_price
                    self._last_tick_time_by_symbol[symbol] = now
                return success
        except Exception as e:
            logger.warning(f"Failed to save tick history for {data.get('symbol')}: {e}")
            return False
    
    async def _flush_tick_buffer(self) -> Tuple[int, int]:
        """Flush the tick buffer to database.
        
        Returns:
            Tuple of (success_count, fail_count)
        """
        if not self._tick_buffer:
            return 0, 0
        
        from app.db import TickHistoryRecord
        
        records = []
        for data in self._tick_buffer:
            event_time_raw = data.get("_tick_time")
            tick_time = datetime.now()
            if isinstance(event_time_raw, str):
                try:
                    tick_time = datetime.fromisoformat(event_time_raw)
                except ValueError:
                    tick_time = datetime.now()

            raw_data = dict(data)
            raw_data.pop("_tick_time", None)
            record = TickHistoryRecord(
                symbol=data.get('symbol', ''),
                tick_time=tick_time,
                price=data.get('price'),
                open_price=data.get('open'),
                high=data.get('high'),
                low=data.get('low'),
                prev_close=data.get('prev_close'),
                volume=data.get('volume'),
                amount=data.get('amount'),
                change_amount=data.get('change'),
                change_percent=data.get('change_percent'),
                bid_price=data.get('bid_price'),
                bid_volume=data.get('bid_volume'),
                ask_price=data.get('ask_price'),
                ask_volume=data.get('ask_volume'),
                raw_data=raw_data,
            )
            records.append(record)
        
        success_count, fail_count = await tick_history_db.insert_ticks_batch(records)
        
        # Clear buffer
        self._tick_buffer.clear()
        
        if success_count > 0:
            logger.debug(f"Flushed {success_count} tick records to history")
        
        return success_count, fail_count

    async def _update_symbols_batch(self, symbols: list[str]) -> int:
        """Fetch and persist multiple symbols in parallel.

        This helper is used by ``run_realtime_loop`` to avoid sequential
        network calls.  Exceptions are caught per-symbol so a failure for one
        ticker does not abort the entire batch.

        Args:
            symbols: Ticker symbols to refresh.

        Returns:
            Number of symbols successfully updated (non-``None`` result).
        """
        tasks = [self.update_single_stock(symbol) for symbol in symbols]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        success_count = 0
        for symbol, result in zip(symbols, results):
            if isinstance(result, Exception):
                logger.warning("Failed to update %s", symbol, exc_info=True)
                continue
            if result is not None:
                success_count += 1
        return success_count
    
    async def update_single_stock(self, symbol: str) -> Optional[StockPayload]:
        """Refresh one instrument and upsert the result into the database.

        The method calls ``eastmoney_client.fetch_single_stock`` and performs a
        small amount of post‑processing before delegating to the storage layer.
        It maintains internal counters and tick history for later inspection.

        Args:
            symbol: Stock ticker (e.g. ``"601398"``).

        Returns:
            A dictionary containing the normalized market data when the write
            succeeded, or ``None`` on failure.

        Raises:
            Any exception thrown by the underlying client or database will be
            caught and logged; the method itself never propagates an exception.
        """
        try:
            # Outside trading hours, avoid repeated provider calls.
            # If realtime row already exists, reuse it directly.
            if not is_a_share_trading_time():
                existing = await stock_db.get_stock(symbol)
                if existing:
                    return dict(existing)

            # Fetch from Eastmoney
            data = eastmoney_client.fetch_single_stock(
                symbol,
                secid_prefix=self._resolve_secid_prefix(symbol),
            )
            
            if not data:
                logger.warning(f"No data returned from Eastmoney for {symbol}")

                # Keep stock_realtime aligned with watchlist symbols even when
                # the upstream quote provider temporarily has no data.
                basic = await Database.fetchrow(
                    "SELECT name FROM stock_basic WHERE symbol = $1",
                    symbol,
                )
                fallback_name = basic["name"] if basic and basic.get("name") else symbol
                fallback_data: StockPayload = {
                    "symbol": symbol,
                    "name": fallback_name,
                }

                fallback_saved = await stock_db.upsert_stock(fallback_data)
                if fallback_saved:
                    await stock_db.upsert_stock_basic(symbol, fallback_name, "AShare")
                    logger.info(
                        "Inserted placeholder realtime row for %s due to missing provider quote",
                        symbol,
                    )
                    return fallback_data

                return None
            
            # Ensure symbol and name are set
            data['symbol'] = symbol
            if not data.get('name'):
                data['name'] = TEST_SYMBOL_NAME if symbol == TEST_SYMBOL else symbol
            
            # Normalize price data (Eastmoney returns price * 100)
            # Also handles after-hours price=0 case
            data = self._normalize_market_data(data)
            
            # Save to realtime database (UPSERT)
            success = await stock_db.upsert_stock(data)
            
            if success:
                # Save to history table (INSERT)
                await self._save_tick_history(data)
                
                # Also update basic info
                await stock_db.upsert_stock_basic(
                    symbol, 
                    data.get('name', ''), 
                    "AShare"
                )
                
                self._update_count += 1
                
                # Log tick update if price changed
                current_price = data.get('price')
                previous_price = self._last_observed_price_by_symbol.get(symbol)
                if current_price is not None and current_price != previous_price:
                    tick_info = {
                        "timestamp": datetime.now().isoformat(),
                        "symbol": symbol,
                        "old_price": previous_price,
                        "new_price": current_price,
                        "change": data.get('change', 0),
                        "change_percent": data.get('change_percent', 0)
                    }
                    self._tick_history.append(tick_info)
                    # Keep only last 100 ticks
                    if len(self._tick_history) > MAX_TICK_HISTORY:
                        self._tick_history = self._tick_history[-MAX_TICK_HISTORY:]
                    
                    logger.info(
                        "Tick update: %s | Price: %s -> %s | Change: %s%%",
                        symbol,
                        previous_price,
                        current_price,
                        data.get('change_percent', 0),
                    )
                    self._last_observed_price_by_symbol[symbol] = float(current_price)
                
                return data
            else:
                logger.error("Failed to save %s to database", symbol)
                return None
                
        except Exception:
            logger.error("Error updating %s", symbol, exc_info=True)
            return None
    
    async def update_icbc(self) -> Optional[StockPayload]:
        """Convenience wrapper for :meth:`update_single_stock` using the
        dedicated test symbol.

        Returns:
            See :meth:`update_single_stock`.
        """
        return await self.update_single_stock(TEST_SYMBOL)
    
    async def run_icbc_test(
        self,
        duration_seconds: int = 300,
        interval_seconds: int = 10,
    ) -> None:
        """Periodically fetch ICBC quotes for diagnostic purposes.

        This method loops until either the requested duration elapses or
        ``stop()`` is called.  Results are logged and a summary is produced at
        the end.

        Args:
            duration_seconds: Total time to run the test (default 5 minutes).
            interval_seconds: Delay between fetches (default 10 seconds).

        Raises:
            asyncio.CancelledError: propagated so callers can cancel the task.
        """
        logger.info(
            f"Starting ICBC (601398) test: "
            f"duration={duration_seconds}s, interval={interval_seconds}s"
        )
        
        self._running = True
        self._update_count = 0
        self._tick_history = []
        
        start_time = datetime.now()
        iteration = 0
        
        try:
            while self._running:
                iteration += 1
                elapsed = (datetime.now() - start_time).total_seconds()
                
                if elapsed >= duration_seconds:
                    logger.info(f"Test completed after {elapsed:.1f} seconds")
                    break
                
                # Update ICBC
                data = await self.update_icbc()
                
                if data:
                    price = data.get('最新价') or data.get('price')
                    logger.info(
                        f"[{iteration}] ICBC Update OK | "
                        f"Price: {price} | "
                        f"Total updates: {self._update_count}"
                    )
                else:
                    logger.warning(f"[{iteration}] ICBC Update FAILED")
                
                # Wait for next interval
                await asyncio.sleep(interval_seconds)
                
        except asyncio.CancelledError:
            logger.info("Test cancelled")
            raise
        except Exception:
            logger.error("Test error", exc_info=True)
        finally:
            self._running = False
            # Flush any remaining tick data
            await self.flush_remaining_ticks()
            await self.print_test_summary()
    
    async def print_test_summary(self) -> None:
        """Emit a summary report for the most recent ICBC test run.

        The method logs counts, recent tick changes, and performs a simple
        database verification using the test symbol.
        """
        logger.info("=" * 60)
        logger.info("ICBC (601398) Test Summary")
        logger.info("=" * 60)
        logger.info(f"Total realtime updates: {self._update_count}")
        logger.info(f"Total history ticks: {self._tick_history_count}")
        logger.info(f"Price changes: {len(self._tick_history)}")
        
        if self._tick_history:
            logger.info("Recent price changes:")
            for tick in self._tick_history[-10:]:
                logger.info(
                    f"  {tick['timestamp']}: "
                    f"{tick['old_price']} -> {tick['new_price']} "
                    f"({tick['change_percent']:+}%)"
                )
        
        # Verify realtime data in database
        db_data = await stock_db.get_stock(TEST_SYMBOL)
        if db_data:
            logger.info("Realtime database verification: OK")
            logger.info(f"  Symbol: {db_data['symbol']}")
            logger.info(f"  Name: {db_data['name']}")
            logger.info(f"  Price: {db_data['price']}")
            logger.info(f"  Updated at: {db_data['updated_at']}")
        else:
            logger.warning("Realtime database verification: FAILED - No data found")
        
        # Verify history data in database
        if settings.TICK_HISTORY_ENABLED:
            from datetime import timedelta
            end_time = datetime.now()
            start_time = end_time - timedelta(hours=1)
            history_data = await tick_history_db.get_ticks_by_time_range(
                TEST_SYMBOL, start_time, end_time, limit=5
            )
            if history_data:
                logger.info("History database verification: OK")
                logger.info(f"  History records in last hour: {len(history_data)}")
                if history_data:
                    latest = history_data[-1]
                    logger.info(f"  Latest tick: {latest['price']} @ {latest['tick_time']}")
            else:
                logger.warning("History database verification: No recent data found")
        
        logger.info("=" * 60)
    
    async def run_realtime_loop(
        self,
        symbols: list[str],
        interval_seconds: int = 30,
    ) -> None:
        """Continuously refresh a set of symbols until stopped.

        Args:
            symbols: A list of ticker symbols to poll.
            interval_seconds: Seconds to wait between iterations (defaults to
                30).

        Raises:
            asyncio.CancelledError: if the caller cancels the running task.
        """
        logger.info(
            f"Starting realtime update loop for {len(symbols)} symbols: "
            f"interval={interval_seconds}s"
        )
        
        self._running = True
        iteration = 0
        
        try:
            while self._running:
                iteration += 1
                
                # Update all symbols
                success_count = await self._update_symbols_batch(symbols)

                logger.info(
                    "[%s] Realtime update completed: %s/%s symbols",
                    iteration,
                    success_count,
                    len(symbols),
                )
                
                # Wait for next interval
                await asyncio.sleep(interval_seconds)
                
        except asyncio.CancelledError:
            logger.info("Realtime update loop cancelled")
            raise
        except Exception:
            logger.error("Realtime update loop error", exc_info=True)
        finally:
            self._running = False
            # Flush any remaining tick data
            await self.flush_remaining_ticks()
    
    async def flush_remaining_ticks(self) -> Tuple[int, int]:
        """Flush any remaining tick data in buffer.
        
        Returns:
            Tuple of (success_count, fail_count)
        """
        if self._tick_buffer:
            return await self._flush_tick_buffer()
        return 0, 0
    
    def stop(self) -> None:
        """Halt any in-progress loop operations.

        Calling ``stop()`` sets an internal flag that causes ``run_icbc_test``
        or ``run_realtime_loop`` to exit at the next opportunity.  This method
        is safe to call repeatedly.
        """
        self._running = False


# Global updater instance
data_updater = DataUpdater()


async def test_icbc_update() -> bool:
    """Quick test function for ICBC update."""
    updater = DataUpdater()
    
    # Single update test
    logger.info("Testing single ICBC update...")
    data = await updater.update_icbc()
    
    if data:
        logger.info("Single update test: PASSED")
        logger.info(f"Data: {data}")
    else:
        logger.error("Single update test: FAILED")
    
    # Database verification
    db_data = await stock_db.get_stock(TEST_SYMBOL)
    if db_data:
        logger.info("Database read test: PASSED")
        logger.info(f"DB Data: {db_data}")
    else:
        logger.error("Database read test: FAILED")
    
    return data is not None and db_data is not None


if __name__ == "__main__":
    # Run quick test
    asyncio.run(test_icbc_update())
