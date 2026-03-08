# Koduck Agent - LLM API Gateway
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY pyproject.toml README.md ./

# Install dependencies directly (without building the package)
RUN pip install --no-cache-dir \
    pydantic>=2.0.0 \
    pyyaml>=6.0.0 \
    httpx>=0.27.0 \
    openai>=1.57.0 \
    anthropic>=0.39.0 \
    python-dotenv>=1.0.0 \
    fastapi>=0.109.0 \
    uvicorn>=0.27.0

# Copy application code
COPY koduck/ ./koduck/

# Expose port
EXPOSE 8000

# Run the server directly
CMD ["python", "-c", "import uvicorn; uvicorn.run('koduck.server:app', host='0.0.0.0', port=8000)"]
