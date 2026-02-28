"""API endpoint tests."""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    """Create a test client."""
    return TestClient(app)


class TestHealthEndpoints:
    """Tests for health check endpoints."""
    
    def test_root(self, client):
        """Test root endpoint."""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == 200
        assert "Koduck Data Service" in data["data"]["name"]
    
    def test_health_check(self, client):
        """Test health check endpoint."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == 200
        assert data["data"]["status"] == "ok"


class TestAShareEndpoints:
    """Tests for A-share endpoints."""
    
    def test_search_symbols(self, client):
        """Test symbol search endpoint."""
        response = client.get("/api/v1/a-share/search?keyword=永太&limit=10")
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == 200
        assert isinstance(data["data"], list)
    
    def test_search_symbols_empty_keyword(self, client):
        """Test search with empty keyword returns error."""
        response = client.get("/api/v1/a-share/search?keyword=&limit=10")
        assert response.status_code == 422  # Validation error
    
    def test_get_price(self, client):
        """Test get price endpoint."""
        response = client.get("/api/v1/a-share/price/002326")
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == 200
        assert data["data"]["symbol"] == "002326"
        assert "price" in data["data"]
    
    def test_get_price_not_found(self, client):
        """Test get price for non-existent symbol."""
        response = client.get("/api/v1/a-share/price/999999")
        # Should return empty or 404 depending on AKShare behavior
        assert response.status_code in [200, 404]
    
    def test_get_batch_prices(self, client):
        """Test batch price endpoint."""
        response = client.post(
            "/api/v1/a-share/price/batch",
            json={"symbols": ["002326", "000001"]}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == 200
        assert isinstance(data["data"], list)
    
    def test_get_batch_prices_empty_list(self, client):
        """Test batch price with empty list returns error."""
        response = client.post(
            "/api/v1/a-share/price/batch",
            json={"symbols": []}
        )
        assert response.status_code == 422  # Validation error
    
    def test_get_hot_symbols(self, client):
        """Test hot symbols endpoint."""
        response = client.get("/api/v1/a-share/hot?limit=20")
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == 200
        assert isinstance(data["data"], list)
        assert len(data["data"]) <= 20
    
    def test_get_market_status(self, client):
        """Test market status endpoint."""
        response = client.get("/api/v1/a-share/market/status")
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == 200
        assert "market" in data["data"]


class TestErrorHandling:
    """Tests for error handling."""
    
    def test_404_handler(self, client):
        """Test 404 error handling."""
        response = client.get("/nonexistent")
        assert response.status_code == 404
