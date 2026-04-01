# Koduck Data Service Dockerfile
FROM python:3.11-slim

ARG PIP_INDEX_URL=https://pypi.org/simple

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_INDEX_URL=${PIP_INDEX_URL} \
    PIP_DEFAULT_TIMEOUT=180 \
    PIP_RETRIES=10 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Set work directory
WORKDIR /app

# Install system dependencies with retries (avoid transient Debian mirror 502)
RUN set -eux; \
    export DEBIAN_FRONTEND=noninteractive; \
    apt-get update -o Acquire::Retries=5; \
    apt-get install -y --no-install-recommends --fix-missing \
      gcc \
      g++; \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN python -m pip install --upgrade pip setuptools wheel && \
    pip install --no-cache-dir \
    --retries ${PIP_RETRIES} \
    --timeout ${PIP_DEFAULT_TIMEOUT} \
    -r requirements.txt && \
    python -m playwright install --with-deps chromium

# Copy application code
COPY app/ ./app/

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app /ms-playwright
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health')" || exit 1

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
