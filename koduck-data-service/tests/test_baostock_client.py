"""BaoStock client tests."""

import pytest
import pandas as pd

from app.services.baostock_client import (
    BaoStockClient,
    BaoStockLoginError,
    BaoStockQueryError,
    _convert_symbol_to_baostock,
    _convert_symbol_from_baostock,
    ADJUST_NONE,
    ADJUST_FORWARD,
    ADJUST_BACKWARD,
)


class TestSymbolConversion:
    """Tests for symbol format conversion utilities."""

    def test_shanghai_code(self):
        """Shanghai stocks (6xx) should get 'sh.' prefix."""
        assert _convert_symbol_to_baostock("600000") == "sh.600000"

    def test_shenzhen_code_000(self):
        """Shenzhen stocks (000xxx) should get 'sz.' prefix."""
        assert _convert_symbol_to_baostock("000001") == "sz.000001"

    def test_shenzhen_code_002(self):
        """Shenzhen stocks (002xxx) should get 'sz.' prefix."""
        assert _convert_symbol_to_baostock("002326") == "sz.002326"

    def test_shenzhen_code_300(self):
        """Shenzhen stocks (300xxx) should get 'sz.' prefix."""
        assert _convert_symbol_to_baostock("300750") == "sz.300750"

    def test_already_baostock_format(self):
        """Codes already in BaoStock format should pass through."""
        assert _convert_symbol_to_baostock("sh.600000") == "sh.600000"
        assert _convert_symbol_to_baostock("sz.000001") == "sz.000001"

    def test_baostock_format_uppercase(self):
        """Uppercase BaoStock format should be normalized to lowercase."""
        assert _convert_symbol_to_baostock("SH.600000") == "sh.600000"

    def test_short_code_padded(self):
        """Short codes should be zero-padded to 6 digits."""
        assert _convert_symbol_to_baostock("1") == "sz.000001"

    def test_from_baostock_sh(self):
        """Convert BaoStock 'sh.' format back to plain code."""
        assert _convert_symbol_from_baostock("sh.600000") == "600000"

    def test_from_baostock_sz(self):
        """Convert BaoStock 'sz.' format back to plain code."""
        assert _convert_symbol_from_baostock("sz.000001") == "000001"

    def test_from_baostock_plain(self):
        """Plain codes pass through unchanged."""
        assert _convert_symbol_from_baostock("600000") == "600000"


class TestBaoStockClientHelpers:
    """Tests for BaoStockClient helper methods."""

    def setup_method(self):
        """Create a client instance for each test."""
        self.client = BaoStockClient()

    def test_safe_float_valid(self):
        """Valid numeric strings should convert to float."""
        assert self.client._safe_float("3.14") == 3.14
        assert self.client._safe_float(2.5) == 2.5
        assert self.client._safe_float(0) == 0.0

    def test_safe_float_invalid(self):
        """Invalid values should return default."""
        assert self.client._safe_float("") is None
        assert self.client._safe_float(None) is None
        assert self.client._safe_float("abc") is None

    def test_safe_float_default(self):
        """Default value should be used for invalid input."""
        assert self.client._safe_float("", default=0.0) == 0.0
        assert self.client._safe_float(None, default=-1.0) == -1.0

    def test_safe_int_valid(self):
        """Valid integers should convert properly."""
        assert self.client._safe_int("100") == 100
        assert self.client._safe_int(50) == 50
        assert self.client._safe_int("100.5") == 100  # Truncates

    def test_safe_int_invalid(self):
        """Invalid values should return default."""
        assert self.client._safe_int("") is None
        assert self.client._safe_int(None) is None
        assert self.client._safe_int("abc") is None

    def test_safe_int_default(self):
        """Default value should be used for invalid input."""
        assert self.client._safe_int("", default=0) == 0
        assert self.client._safe_int(None, default=-1) == -1

    def test_normalize_empty_df(self):
        """Empty DataFrame should return empty list."""
        df = pd.DataFrame()
        assert self.client._normalize_kline_df(df) == []

    def test_normalize_valid_df(self):
        """Valid DataFrame should normalize correctly."""
        df = pd.DataFrame([
            {
                "date": "2024-01-01",
                "open": "10.5",
                "high": "11.0",
                "low": "10.0",
                "close": "10.8",
                "volume": "100000",
                "amount": "1050000.0",
                "turn": "1.5",
                "pctChg": "2.86",
            }
        ])
        result = self.client._normalize_kline_df(df)
        assert len(result) == 1
        kline = result[0]
        assert kline["open"] == 10.5
        assert kline["close"] == 10.8
        assert kline["high"] == 11.0
        assert kline["low"] == 10.0
        assert kline["volume"] == 100000
        assert kline["turn"] == 1.5
        assert kline["pct_chg"] == 2.86
        assert "timestamp" in kline
        assert kline["date"] == "2024-01-01"

    def test_normalize_zero_open(self):
        """Zero open price should be replaced with close price."""
        df = pd.DataFrame([
            {
                "date": "2024-01-01",
                "open": "",
                "high": "11.0",
                "low": "10.0",
                "close": "10.8",
                "volume": "100000",
                "amount": "1050000.0",
            }
        ])
        result = self.client._normalize_kline_df(df)
        assert len(result) == 1
        # Open should default to 0.0, then be replaced with close
        assert result[0]["open"] == 10.8

    def test_normalize_skip_empty_date(self):
        """Rows with empty date should be skipped."""
        df = pd.DataFrame([
            {
                "date": "",
                "open": "10.5",
                "high": "11.0",
                "low": "10.0",
                "close": "10.8",
                "volume": "100000",
                "amount": "1050000.0",
            }
        ])
        result = self.client._normalize_kline_df(df)
        assert len(result) == 0

    def test_normalize_optional_fields_omitted(self):
        """Missing optional fields should not appear in output."""
        df = pd.DataFrame([
            {
                "date": "2024-01-01",
                "open": "10.5",
                "high": "11.0",
                "low": "10.0",
                "close": "10.8",
                "volume": "100000",
                "amount": "1050000.0",
            }
        ])
        result = self.client._normalize_kline_df(df)
        assert "turn" not in result[0]
        assert "pct_chg" not in result[0]
        assert "preclose" not in result[0]


class TestBaoStockClientIntegration:
    """Integration tests that call the real BaoStock server.

    These tests are marked with `@pytest.mark.integration` and require
    network access. They can be skipped in CI/offline environments.
    """

    @pytest.fixture
    def client(self):
        """Create a BaoStock client instance."""
        return BaoStockClient()

    @pytest.mark.integration
    def test_monthly_kline_icbc(self, client):
        """Fetch monthly K-line for ICBC (601398) and verify structure."""
        data = client.get_monthly_kline("601398", start_date="2024-01-01")
        assert isinstance(data, list)
        assert len(data) > 0

        kline = data[0]
        assert "timestamp" in kline
        assert "date" in kline
        assert "open" in kline
        assert "high" in kline
        assert "low" in kline
        assert "close" in kline
        assert kline["close"] > 0

    @pytest.mark.integration
    def test_monthly_kline_shanghai(self, client):
        """Fetch monthly K-line for a Shanghai stock using plain code."""
        data = client.get_monthly_kline("600000", start_date="2024-01-01")
        assert isinstance(data, list)
        assert len(data) > 0

    @pytest.mark.integration
    def test_monthly_kline_shenzhen(self, client):
        """Fetch monthly K-line for a Shenzhen stock."""
        data = client.get_monthly_kline("000001", start_date="2024-01-01")
        assert isinstance(data, list)
        assert len(data) > 0

    @pytest.mark.integration
    def test_monthly_kline_baostock_format(self, client):
        """Fetch using BaoStock-format symbol."""
        data = client.get_monthly_kline("sh.601398", start_date="2024-01-01")
        assert isinstance(data, list)
        assert len(data) > 0

    @pytest.mark.integration
    def test_monthly_kline_forward_adjust(self, client):
        """Fetch forward-adjusted monthly K-line."""
        data = client.get_monthly_kline(
            "601398", start_date="2024-01-01", adjustflag=ADJUST_FORWARD
        )
        assert isinstance(data, list)
        assert len(data) > 0

    @pytest.mark.integration
    def test_weekly_kline(self, client):
        """Fetch weekly K-line data."""
        data = client.get_weekly_kline("601398", start_date="2024-01-01")
        assert isinstance(data, list)
        assert len(data) > 0

    @pytest.mark.integration
    def test_daily_kline(self, client):
        """Fetch daily K-line data."""
        data = client.get_daily_kline("601398", start_date="2024-06-01")
        assert isinstance(data, list)
        assert len(data) > 0

    @pytest.mark.integration
    def test_daily_kline_includes_preclose(self, client):
        """Daily K-line should include preclose field."""
        data = client.get_daily_kline("601398", start_date="2024-06-01")
        assert len(data) > 0
        # Daily data includes preclose
        assert "preclose" in data[0]

    @pytest.mark.integration
    def test_empty_result_for_future_dates(self, client):
        """Future date range should return empty list."""
        data = client.get_monthly_kline(
            "601398", start_date="2099-01-01", end_date="2099-12-31"
        )
        assert isinstance(data, list)
        assert len(data) == 0

    @pytest.mark.integration
    def test_health_check(self, client):
        """Health check should return ok status."""
        result = client.check_health()
        assert result["status"] == "ok"
        assert "message" in result

    @pytest.mark.integration
    def test_date_range_filtering(self, client):
        """Date range should filter results correctly."""
        data = client.get_monthly_kline(
            "601398", start_date="2024-01-01", end_date="2024-06-30"
        )
        assert isinstance(data, list)
        # Should have ~6 months of data
        assert 1 <= len(data) <= 6
        # All dates should be within range
        for kline in data:
            assert kline["date"] >= "2024-01-01"
            assert kline["date"] <= "2024-06-30"
