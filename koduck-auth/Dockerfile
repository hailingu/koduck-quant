# Multi-stage build for koduck-auth

# Stage 1: Builder
FROM rust:1.75-slim-bookworm as builder

WORKDIR /app

# Install dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    protobuf-compiler \
    && rm -rf /var/lib/apt/lists/*

# Copy manifests
COPY Cargo.toml Cargo.lock ./
COPY build.rs ./
COPY proto ./proto

# Create dummy main.rs to cache dependencies
RUN mkdir -p src && echo "fn main() {}" > src/main.rs

# Build dependencies (cached layer)
RUN cargo build --release && rm -rf src

# Copy source code
COPY src ./src
COPY migrations ./migrations

# Build application
RUN touch src/main.rs && cargo build --release

# Stage 2: Runtime
FROM debian:bookworm-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r koduck && useradd -r -g koduck koduck

# Copy binary from builder
COPY --from=builder /app/target/release/koduck-auth /usr/local/bin/koduck-auth

# Copy migrations
COPY --from=builder /app/migrations ./migrations

# Create keys directory
RUN mkdir -p /app/keys && chown -R koduck:koduck /app

USER koduck

# Expose ports
EXPOSE 8081 50051 9090

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:8081/health || exit 1

ENTRYPOINT ["koduck-auth"]
