# syntax=docker/dockerfile:1.7
# Multi-stage build for koduck-auth

# Stage 1: Builder
# Use a recent stable toolchain so Cargo can parse edition2024 crates.
FROM rust:bookworm AS builder

WORKDIR /app
ENV CARGO_HOME=/usr/local/cargo

# Install dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    protobuf-compiler \
    && rm -rf /var/lib/apt/lists/*

# Copy manifests
# Cargo.lock is intentionally not committed in this repo, so copy Cargo.toml only.
COPY Cargo.toml ./
COPY build.rs ./
COPY proto ./proto
COPY benches ./benches

# Create minimal source tree for dependency caching build.
# build.rs writes generated proto files into src/grpc/proto.
RUN mkdir -p src/grpc/proto && echo "fn main() {}" > src/main.rs

# Resolve and fetch deps with persistent cache (only new deps will download).
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    --mount=type=cache,target=/app/target \
    cargo generate-lockfile && cargo fetch --locked

# Build dependencies (cached layer)
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    --mount=type=cache,target=/app/target \
    cargo build --release --locked && rm -rf src

# Copy source code
COPY src ./src
COPY migrations ./migrations

# Build application
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    --mount=type=cache,target=/app/target \
    touch src/main.rs && \
    cargo build --release --locked && \
    cp /app/target/release/koduck-auth /app/koduck-auth

# Stage 2: Runtime
FROM debian:bookworm-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r koduck && useradd -r -g koduck koduck

# Copy binary from builder
COPY --from=builder /app/koduck-auth /usr/local/bin/koduck-auth

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
