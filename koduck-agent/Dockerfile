# Koduck Agent - LLM API Gateway
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy all files
COPY . .

# Install Python dependencies
RUN pip install --no-cache-dir "."

# Expose port
EXPOSE 8000

# Run the server
CMD ["python", "-c", "from koduck.server import run_server; run_server()"]
