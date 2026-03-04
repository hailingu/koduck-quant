"""Realtime data updater.

Fetches market data from Eastmoney and persists it to a PostgreSQL
backend.  Designed for use within the ``koduck-data-service`` microservice.
"""

import asyncio
import logging
from datetime import datetime
from typing import Any, Optional

from app.db import stock_db
from app.services.eastmoney_client import eastmoney_client

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
        self._last_price: Optional[float] = None
        self._tick_history: list[dict[str, Any]] = []  # Store recent ticks for verification

    def _normalize_market_data(self, data: StockPayload) -> StockPayload:
        """Convert raw Eastmoney values to human-readable units.

        Eastmoney returns prices and percentages scaled by 100.  This helper
        divides the relevant fields and mutates the input dictionary in-place.

        Args:
            data: Raw payload returned by :class:`eastmoney_client`.

        Returns:
            The same dictionary with numeric fields adjusted.
        """
        for field in PRICE_FIELDS:
            if data.get(field) is not None:
                data[field] = data[field] / 100

        if data.get("change_percent") is not None:
            data["change_percent"] = data["change_percent"] / 100

        return data

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
            # Fetch from Eastmoney
            data = eastmoney_client.fetch_single_stock(symbol)
            
            if not data:
                logger.warning(f"No data returned from Eastmoney for {symbol}")
                return None
            
            # Ensure symbol and name are set
            data['symbol'] = symbol
            if not data.get('name'):
                data['name'] = TEST_SYMBOL_NAME if symbol == TEST_SYMBOL else symbol
            
            # Normalize price data (Eastmoney returns price * 100)
            data = self._normalize_market_data(data)
            
            # Save to database
            success = await stock_db.upsert_stock(data)
            
            if success:
                # Also update basic info
                await stock_db.upsert_stock_basic(
                    symbol, 
                    data.get('name', ''), 
                    "AShare"
                )
                
                self._update_count += 1
                
                # Log tick update if price changed
                current_price = data.get('price')
                if current_price and current_price != self._last_price:
                    tick_info = {
                        "timestamp": datetime.now().isoformat(),
                        "symbol": symbol,
                        "old_price": self._last_price,
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
                        self._last_price,
                        current_price,
                        data.get('change_percent', 0),
                    )
                    self._last_price = current_price
                
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
            await self.print_test_summary()
    
    async def print_test_summary(self) -> None:
        """Emit a summary report for the most recent ICBC test run.

        The method logs counts, recent tick changes, and performs a simple
        database verification using the test symbol.
        """
        logger.info("=" * 60)
        logger.info("ICBC (601398) Test Summary")
        logger.info("=" * 60)
        logger.info(f"Total updates: {self._update_count}")
        logger.info(f"Tick changes: {len(self._tick_history)}")
        
        if self._tick_history:
            logger.info("Recent ticks:")
            for tick in self._tick_history[-10:]:
                logger.info(
                    f"  {tick['timestamp']}: "
                    f"{tick['old_price']} -> {tick['new_price']} "
                    f"({tick['change_percent']:+}%)"
                )
        
        # Verify data in database
        db_data = await stock_db.get_stock(TEST_SYMBOL)
        if db_data:
            logger.info("Database verification: OK")
            logger.info(f"  Symbol: {db_data['symbol']}")
            logger.info(f"  Name: {db_data['name']}")
            logger.info(f"  Price: {db_data['price']}")
            logger.info(f"  Updated at: {db_data['updated_at']}")
        else:
            logger.warning("Database verification: FAILED - No data found")
        
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
