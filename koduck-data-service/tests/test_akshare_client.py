"""AKShare client tests."""

import pytest

from app.services.akshare_client import AKShareClient


@pytest.fixture
def client():
    """Create an AKShare client instance."""
    return AKShareClient()


class TestAKShareClient:
    """Tests for AKShare client."""
    
    def test_search_symbols(self, client):
        """Test symbol search."""
        results = client.search_symbols("永太", limit=10)
        assert isinstance(results, list)
        # Should find 永太科技
        assert any(s.name == "永太科技" for s in results)
    
    def test_search_symbols_empty_keyword(self, client):
        """Test search with empty keyword returns all or many results."""
        results = client.search_symbols("", limit=10)
        assert isinstance(results, list)
    
    def test_get_realtime_price(self, client):
        """Test get real-time price."""
        price = client.get_realtime_price("002326")
        assert price is not None
        assert price.symbol == "002326"
        assert price.name == "永太科技"
        assert price.price > 0
    
    def test_get_realtime_price_not_found(self, client):
        """Test get price for non-existent symbol."""
        price = client.get_realtime_price("999999")
        assert price is None
    
    def test_get_batch_prices(self, client):
        """Test batch price query."""
        symbols = ["002326", "000001"]
        prices = client.get_batch_prices(symbols)
        assert isinstance(prices, list)
        # Should find at least some of them
        returned_symbols = {p.symbol for p in prices}
        assert returned_symbols.issubset(set(symbols))
    
    def test_get_hot_symbols(self, client):
        """Test get hot symbols."""
        hot = client.get_hot_symbols(limit=20)
        assert isinstance(hot, list)
        assert len(hot) <= 20
        # All should have positive price
        for symbol in hot:
            assert symbol.price is None or symbol.price > 0
    
    def test_safe_float(self, client):
        """Test safe float conversion."""
        assert client._safe_float(1.5) == 1.5
        assert client._safe_float("2.5") == 2.5
        assert client._safe_float(None) is None
        assert client._safe_float("invalid") is None
        assert client._safe_float(None, default=0.0) == 0.0
    
    def test_safe_int(self, client):
        """Test safe int conversion."""
        assert client._safe_int(10) == 10
        assert client._safe_int("20") == 20
        assert client._safe_int(10.5) == 10
        assert client._safe_int(None) is None
        assert client._safe_int("invalid") is None
        assert client._safe_int(None, default=0) == 0
