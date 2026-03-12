"""Unit tests for trading hours utility."""

from datetime import datetime

import pytest
import pytz

from app.utils.trading_hours import (
    is_a_share_trading_time,
    is_market_open,
    MORNING_START,
    MORNING_END,
    AFTERNOON_START,
    AFTERNOON_END,
)


class TestIsAShareTradingTime:
    """Tests for is_a_share_trading_time function."""

    def test_morning_trading_hours(self):
        """Test that morning trading hours are correctly identified."""
        # Wednesday 10:00 - should be trading
        dt = datetime(2024, 3, 6, 10, 0, 0)
        assert is_a_share_trading_time(dt) is True

    def test_afternoon_trading_hours(self):
        """Test that afternoon trading hours are correctly identified."""
        # Wednesday 14:00 - should be trading
        dt = datetime(2024, 3, 6, 14, 0, 0)
        assert is_a_share_trading_time(dt) is True

    def test_trading_hours_boundary_morning_start(self):
        """Test boundary at morning start (09:15)."""
        # Wednesday 09:15 - should be trading
        dt = datetime(2024, 3, 6, 9, 15, 0)
        assert is_a_share_trading_time(dt) is True

    def test_trading_hours_boundary_morning_end(self):
        """Test boundary at morning end (11:30)."""
        # Wednesday 11:30 - should be trading
        dt = datetime(2024, 3, 6, 11, 30, 0)
        assert is_a_share_trading_time(dt) is True

    def test_trading_hours_boundary_afternoon_start(self):
        """Test boundary at afternoon start (13:00)."""
        # Wednesday 13:00 - should be trading
        dt = datetime(2024, 3, 6, 13, 0, 0)
        assert is_a_share_trading_time(dt) is True

    def test_trading_hours_boundary_afternoon_end(self):
        """Test boundary at afternoon end (15:00)."""
        # Wednesday 15:00 - should be trading
        dt = datetime(2024, 3, 6, 15, 0, 0)
        assert is_a_share_trading_time(dt) is True

    def test_before_market_open(self):
        """Test before market opens (09:14)."""
        # Wednesday 09:14 - should NOT be trading
        dt = datetime(2024, 3, 6, 9, 14, 0)
        assert is_a_share_trading_time(dt) is False

    def test_midday_break(self):
        """Test during midday break (12:30)."""
        # Wednesday 12:30 - should NOT be trading
        dt = datetime(2024, 3, 6, 12, 30, 0)
        assert is_a_share_trading_time(dt) is False

    def test_after_market_close(self):
        """Test after market closes (20:00)."""
        # Wednesday 20:00 - should NOT be trading
        dt = datetime(2024, 3, 6, 20, 0, 0)
        assert is_a_share_trading_time(dt) is False

    def test_saturday(self):
        """Test Saturday - should NOT be trading."""
        dt = datetime(2024, 3, 9, 10, 0, 0)  # Saturday
        assert is_a_share_trading_time(dt) is False

    def test_sunday(self):
        """Test Sunday - should NOT be trading."""
        dt = datetime(2024, 3, 10, 10, 0, 0)  # Sunday
        assert is_a_share_trading_time(dt) is False

    def test_with_timezone(self):
        """Test with timezone-aware datetime."""
        # Wednesday 10:00 in Beijing
        beijing_tz = pytz.timezone('Asia/Shanghai')
        dt = beijing_tz.localize(datetime(2024, 3, 6, 10, 0, 0))
        assert is_a_share_trading_time(dt) is True

    def test_default_now(self):
        """Test default behavior (no datetime provided)."""
        # Just verify it doesn't throw an exception
        result = is_a_share_trading_time()
        assert isinstance(result, bool)


class TestIsMarketOpen:
    """Tests for is_market_open function (alias)."""

    def test_is_market_open_alias(self):
        """Test that is_market_open is an alias for is_a_share_trading_time."""
        dt = datetime(2024, 3, 6, 10, 0, 0)
        assert is_market_open(dt) == is_a_share_trading_time(dt)


class TestTradingHoursConstants:
    """Tests for trading hours constants."""

    def test_morning_start(self):
        """Test morning start time is 09:15."""
        assert MORNING_START.hour == 9
        assert MORNING_START.minute == 15

    def test_morning_end(self):
        """Test morning end time is 11:30."""
        assert MORNING_END.hour == 11
        assert MORNING_END.minute == 30

    def test_afternoon_start(self):
        """Test afternoon start time is 13:00."""
        assert AFTERNOON_START.hour == 13
        assert AFTERNOON_START.minute == 0

    def test_afternoon_end(self):
        """Test afternoon end time is 15:00."""
        assert AFTERNOON_END.hour == 15
        assert AFTERNOON_END.minute == 0
