"""Tests for incremental K-line updater."""

import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.incremental_kline_updater import (
    IncrementalKlineUpdater,
    IncrementalUpdateResult,
)


class TestIncrementalKlineUpdater:
    """Test cases for IncrementalKlineUpdater class."""

    @pytest.fixture
    def updater(self):
        """Create an updater instance for testing."""
        return IncrementalKlineUpdater()

    def test_map_timeframe_to_db(self, updater):
        """Test timeframe mapping to database format."""
        assert updater._map_timeframe_to_db("1D") == "1D"
        assert updater._map_timeframe_to_db("1W") == "1W"
        assert updater._map_timeframe_to_db("1M") == "1M"
        assert updater._map_timeframe_to_db("daily") == "1D"
        assert updater._map_timeframe_to_db("weekly") == "1W"
        assert updater._map_timeframe_to_db("monthly") == "1M"
        assert updater._map_timeframe_to_db("unknown") == "unknown"

    def test_map_timeframe_to_akshare(self, updater):
        """Test timeframe mapping to AKShare format."""
        assert updater._map_timeframe_to_akshare("1D") == "daily"
        assert updater._map_timeframe_to_akshare("1W") == "weekly"
        assert updater._map_timeframe_to_akshare("1M") == "monthly"

    @pytest.mark.asyncio
    async def test_get_local_data_range_with_data(self, updater):
        """Test getting local data range when data exists."""
        mock_result = {
            "min_date": datetime(2024, 1, 1),
            "max_date": datetime(2024, 12, 31),
        }

        with patch("app.services.incremental_kline_updater.Database") as MockDatabase:
            MockDatabase.fetchrow = AsyncMock(return_value=mock_result)

            min_date, max_date = await updater.get_local_data_range(
                "000001", "1D", "AShare"
            )

            assert min_date == datetime(2024, 1, 1)
            assert max_date == datetime(2024, 12, 31)

    @pytest.mark.asyncio
    async def test_get_local_data_range_no_data(self, updater):
        """Test getting local data range when no data exists."""
        with patch("app.services.incremental_kline_updater.Database") as MockDatabase:
            MockDatabase.fetchrow = AsyncMock(return_value=None)

            min_date, max_date = await updater.get_local_data_range(
                "000001", "1D", "AShare"
            )

            assert min_date is None
            assert max_date is None

    @pytest.mark.asyncio
    async def test_incremental_update_no_existing_data(self, updater):
        """Test incremental update with no existing data."""
        mock_klines = [
            {
                "timestamp": 1704067200,  # 2024-01-01
                "open": 10.0,
                "high": 11.0,
                "low": 9.5,
                "close": 10.5,
                "volume": 1000000,
                "amount": 10000000,
            }
        ]

        with patch("app.services.incremental_kline_updater.Database") as MockDatabase:
            # First call: no existing data
            MockDatabase.fetchrow = AsyncMock(side_effect=[
                None,  # get_local_data_range returns None
                "INSERT 0 1",  # insert result
            ])

            with patch.object(updater.client, "get_kline_data", return_value=mock_klines):
                result = await updater.incremental_update(
                    symbol="000001",
                    start_date="20240101",
                    end_date="20240131",
                    timeframe="1D",
                )

                assert result.symbol == "000001"
                assert result.timeframe == "1D"
                assert result.records_added >= 0

    @pytest.mark.asyncio
    async def test_incremental_update_dry_run(self, updater):
        """Test incremental update in dry-run mode."""
        mock_klines = [
            {
                "timestamp": 1704067200,
                "open": 10.0,
                "high": 11.0,
                "low": 9.5,
                "close": 10.5,
                "volume": 1000000,
                "amount": 10000000,
            }
        ]

        with patch("app.services.incremental_kline_updater.Database") as MockDatabase:
            MockDatabase.fetchrow = AsyncMock(return_value=None)

            with patch.object(updater.client, "get_kline_data", return_value=mock_klines):
                result = await updater.incremental_update(
                    symbol="000001",
                    start_date="20240101",
                    end_date="20240131",
                    timeframe="1D",
                    dry_run=True,
                )

                # In dry run mode, should not execute insert
                assert result.records_added == len(mock_klines)

    @pytest.mark.asyncio
    async def test_incremental_update_no_new_data(self, updater):
        """Test incremental update when no new data is available."""
        with patch("app.services.incremental_kline_updater.Database") as MockDatabase:
            MockDatabase.fetchrow = AsyncMock(
                return_value={
                    "min_date": datetime(2024, 1, 1),
                    "max_date": datetime(2024, 12, 31),
                }
            )

            with patch.object(updater.client, "get_kline_data", return_value=[]):
                result = await updater.incremental_update(
                    symbol="000001",
                    timeframe="1D",
                )

                assert result.records_added == 0
                assert result.data == []


class TestIncrementalUpdateResult:
    """Test cases for IncrementalUpdateResult dataclass."""

    def test_to_dict(self):
        """Test converting result to dictionary."""
        result = IncrementalUpdateResult(
            symbol="000001",
            timeframe="1D",
            records_added=10,
            records_updated=0,
            csv_records_added=10,
            date_range={"start": "2024-01-01", "end": "2024-12-31"},
            data=[],
        )

        result_dict = result.to_dict()

        assert result_dict["symbol"] == "000001"
        assert result_dict["timeframe"] == "1D"
        assert result_dict["records_added"] == 10
        assert result_dict["records_updated"] == 0
        assert result_dict["csv_records_added"] == 10
        assert result_dict["date_range"]["start"] == "2024-01-01"
        assert result_dict["date_range"]["end"] == "2024-12-31"
        assert result_dict["data"] == []
