"""Unit tests for 1-minute K-line data tool."""

import tempfile
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

from app.services.kline_1m import (
    DataGap,
    Minute1KlineResult,
    Minute1KlineTool,
)


class TestMinute1KlineResult:
    """Tests for Minute1KlineResult dataclass."""

    def test_to_dict(self) -> None:
        """Test conversion to dictionary."""
        result = Minute1KlineResult(
            symbol="000001",
            records_added=100,
            records_updated=0,
            csv_records_added=100,
            date_range={
                "start": "2024-01-01 09:30:00",
                "end": "2024-01-01 15:00:00",
            },
            trading_days=1,
            data=[{"timestamp": 1704088200, "close": 10.5}],
        )

        d = result.to_dict()
        assert d["symbol"] == "000001"
        assert d["records_added"] == 100
        assert d["trading_days"] == 1
        assert len(d["data"]) == 1


class TestDataGap:
    """Tests for DataGap dataclass."""

    def test_to_dict(self) -> None:
        """Test conversion to dictionary."""
        start = datetime(2024, 1, 1, 9, 30)
        end = datetime(2024, 1, 1, 10, 0)
        gap = DataGap(start=start, end=end)

        d = gap.to_dict()
        assert d["start"] == "2024-01-01T09:30:00"
        assert d["end"] == "2024-01-01T10:00:00"


class TestMinute1KlineTool:
    """Tests for Minute1KlineTool class."""

    @pytest.fixture
    def temp_cache_dir(self) -> Path:
        """Create a temporary cache directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            yield Path(tmpdir)

    @pytest.fixture
    def tool(self, temp_cache_dir: Path) -> Minute1KlineTool:
        """Create a Minute1KlineTool instance with temp cache."""
        return Minute1KlineTool(cache_dir=temp_cache_dir)

    @pytest.fixture
    def mock_akshare_client(self) -> MagicMock:
        """Create a mock AKShare client."""
        with patch("app.services.kline_1m.akshare_client") as mock:
            yield mock

    def test_init(self, tool: Minute1KlineTool, temp_cache_dir: Path) -> None:
        """Test tool initialization."""
        assert tool._cache_dir == temp_cache_dir
        assert tool._progress_callback is None

    def test_get_csv_path(self, tool: Minute1KlineTool) -> None:
        """Test CSV path generation."""
        path = tool._get_csv_path("000001")
        assert path.name == "000001.csv"
        assert "000001" in str(path)

    def test_ensure_cache_dir(
        self, tool: Minute1KlineTool, temp_cache_dir: Path
    ) -> None:
        """Test cache directory creation."""
        new_dir = temp_cache_dir / "subdir"
        tool._cache_dir = new_dir
        tool._ensure_cache_dir()
        assert new_dir.exists()

    def test_count_trading_days(self, tool: Minute1KlineTool) -> None:
        """Test trading day counting."""
        # Monday to Friday (5 trading days)
        start = datetime(2024, 1, 1)  # Monday
        end = datetime(2024, 1, 5)  # Friday
        count = tool._count_trading_days(start, end)
        assert count == 5

        # Including weekend (still 5 trading days)
        end = datetime(2024, 1, 7)  # Sunday
        count = tool._count_trading_days(start, end)
        assert count == 5

    def test_count_trading_days_none_input(
        self, tool: Minute1KlineTool
    ) -> None:
        """Test trading day counting with None input."""
        assert tool._count_trading_days(None, None) == 0
        assert tool._count_trading_days(datetime.now(), None) == 0
        assert tool._count_trading_days(None, datetime.now()) == 0

    def test_get_local_data_range_empty(self, tool: Minute1KlineTool) -> None:
        """Test getting data range when no data exists."""
        min_dt, max_dt = tool._get_local_data_range("000001")
        assert min_dt is None
        assert max_dt is None

    def test_get_local_data_range_with_data(
        self, tool: Minute1KlineTool, temp_cache_dir: Path
    ) -> None:
        """Test getting data range with existing data."""
        # Create test CSV file
        csv_path = tool._get_csv_path("000001")
        now = datetime.now()
        data = {
            "timestamp": [
                int((now - timedelta(hours=2)).timestamp()),
                int((now - timedelta(hours=1)).timestamp()),
                int(now.timestamp()),
            ],
            "close": [10.0, 10.5, 11.0],
        }
        df = pd.DataFrame(data)
        df.to_csv(csv_path, index=False)

        min_dt, max_dt = tool._get_local_data_range("000001")
        assert min_dt is not None
        assert max_dt is not None
        assert min_dt < max_dt

    def test_save_to_cache_empty(self, tool: Minute1KlineTool) -> None:
        """Test saving empty data to cache."""
        result = tool._save_to_cache("000001", [])
        assert result == 0

    def test_save_to_cache_new_data(
        self, tool: Minute1KlineTool, temp_cache_dir: Path
    ) -> None:
        """Test saving new data to cache."""
        now = datetime.now()
        klines = [
            {
                "timestamp": int(now.timestamp()),
                "open": 10.0,
                "high": 10.5,
                "low": 9.8,
                "close": 10.2,
                "volume": 1000000,
                "amount": 10100000,
            }
        ]

        result = tool._save_to_cache("000001", klines)
        assert result == 1

        # Verify file was created
        csv_path = tool._get_csv_path("000001")
        assert csv_path.exists()

        # Verify content
        df = pd.read_csv(csv_path)
        assert len(df) == 1
        assert df["close"].iloc[0] == 10.2

    def test_save_to_cache_dedup(
        self, tool: Minute1KlineTool, temp_cache_dir: Path
    ) -> None:
        """Test deduplication when saving to cache."""
        now = datetime.now()
        ts = int(now.timestamp())

        # First save
        klines1 = [
            {
                "timestamp": ts,
                "open": 10.0,
                "high": 10.5,
                "low": 9.8,
                "close": 10.2,
                "volume": 1000000,
                "amount": 10100000,
            }
        ]
        tool._save_to_cache("000001", klines1)

        # Second save with same timestamp but different data
        klines2 = [
            {
                "timestamp": ts,
                "open": 10.1,
                "high": 10.6,
                "low": 9.9,
                "close": 10.3,
                "volume": 1100000,
                "amount": 11100000,
            }
        ]
        result = tool._save_to_cache("000001", klines2)
        assert result == 0  # No new records (dedup)

        # Verify only one record exists
        csv_path = tool._get_csv_path("000001")
        df = pd.read_csv(csv_path)
        assert len(df) == 1

    def test_detect_gaps_no_data(self, tool: Minute1KlineTool) -> None:
        """Test gap detection when no data exists."""
        gaps = tool.detect_gaps("000001")
        assert gaps == []

    def test_get_cached_data_empty(self, tool: Minute1KlineTool) -> None:
        """Test getting cached data when no data exists."""
        data = tool.get_cached_data("000001")
        assert data == []

    def test_get_cached_data_with_data(
        self, tool: Minute1KlineTool, temp_cache_dir: Path
    ) -> None:
        """Test getting cached data with existing data."""
        # Create test CSV file
        csv_path = tool._get_csv_path("000001")
        now = datetime.now()
        df = pd.DataFrame({
            "timestamp": [int(now.timestamp())],
            "close": [10.0],
        })
        df.to_csv(csv_path, index=False)

        data = tool.get_cached_data("000001")
        assert len(data) == 1
        assert data[0]["close"] == 10.0

    def test_validate_data_continuity(
        self, tool: Minute1KlineTool, temp_cache_dir: Path
    ) -> None:
        """Test data continuity validation."""
        # Create test data
        csv_path = tool._get_csv_path("000001")
        base_time = datetime(2024, 1, 2, 9, 30)  # Tuesday

        timestamps = []
        for i in range(10):
            timestamps.append(
                int((base_time + timedelta(minutes=i)).timestamp())
            )

        df = pd.DataFrame({"timestamp": timestamps, "close": [10.0] * 10})
        df.to_csv(csv_path, index=False)

        result = tool.validate_data_continuity(
            "000001",
            start_date="2024-01-02",
            end_date="2024-01-02",
        )

        assert result["symbol"] == "000001"
        assert "is_continuous" in result
        assert "gap_count" in result
        assert "total_records" in result

    @pytest.mark.asyncio
    async def test_incremental_update_up_to_date(
        self, tool: Minute1KlineTool, mock_akshare_client: MagicMock
    ) -> None:
        """Test incremental update when data is up to date."""
        # Create CSV with recent data
        csv_path = tool._get_csv_path("000001")
        now = datetime.now()
        df = pd.DataFrame({
            "timestamp": [int(now.timestamp())],
            "close": [10.0],
        })
        df.to_csv(csv_path, index=False)

        result = await tool.incremental_update("000001", days_back=7)

        assert result.records_added == 0
        mock_akshare_client.get_kline_minutes.assert_not_called()
