# Koduck Data Service

Python-based data service for quantitative trading system.

## Features

- **A-Share Market Data**: Real-time quotes, search, hot stocks via AKShare
- **REST API**: FastAPI-powered HTTP interface
- **Caching**: Built-in memory cache with configurable TTL
- **Docker Support**: Easy deployment with Docker Compose

## Quick Start

### Local Development

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run server
uvicorn app.main:app --reload
```

### Docker Deployment

```bash
# Start with Docker Compose
docker-compose up -d

# Check logs
docker-compose logs -f data-service
```

## API Endpoints

### Health
- `GET /health` - Health check

### A-Share Market
- `GET /api/v1/a-share/search?keyword={kw}&limit=20` - Search stocks
- `GET /api/v1/a-share/price/{symbol}` - Get real-time price
- `POST /api/v1/a-share/price/batch` - Batch prices
- `GET /api/v1/a-share/hot?limit=20` - Hot stocks

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | 0.0.0.0 | Server host |
| `PORT` | 8000 | Server port |
| `REDIS_URL` | redis://localhost:6379/0 | Redis connection |
| `LOG_LEVEL` | INFO | Logging level |

## Testing

```bash
pytest tests/ -v
```

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Client    │────▶│  Java API    │────▶│   Redis Cache   │
└─────────────┘     │  (Koduck)    │◀────│  (热点数据缓存)  │
                    └──────┬───────┘     └─────────────────┘
                           │
                           │ HTTP/JSON
                           ▼
                    ┌─────────────┐
                    │ Python Data │     ┌─────────────┐
                    │  Service    │────▶│   AKShare   │
                    │  (FastAPI)  │     │   (A股数据)  │
                    └─────────────┘     └─────────────┘
```
