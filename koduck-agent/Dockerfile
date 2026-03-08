# Koduck Agent - LLM API Gateway
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY pyproject.toml README.md ./

# Install Python dependencies
RUN pip install --no-cache-dir -e "."

# Copy application code
COPY koduck/ ./koduck/

# Expose port
EXPOSE 8000

# Run the server
CMD ["python", "-m", "koduck.server"]
