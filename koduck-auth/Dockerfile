# Multi-stage build for koduck-auth

# Stage 1: Builder
# Use a recent stable toolchain so Cargo can parse edition2024 crates.
FROM rust:1.86-slim-bookworm AS builder

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
    cargo generate-lockfile && cargo fetch --locked

# Copy source code
COPY src ./src
COPY migrations ./migrations

# Build application
# Note: We don't cache target directory because build.rs generates koduck.bin
# which needs to be included in the binary
RUN cargo build --release --locked && \
    cp /app/target/release/koduck-auth /app/koduck-auth && \
    strip --strip-all /app/koduck-auth

# Stage 2: Runtime
# Use Alpine for minimal image size (~7MB base vs ~30MB for debian-slim)
FROM alpine:3.19

WORKDIR /app

# Install minimal runtime dependencies
# ca-certificates: Required for TLS/HTTPS connections
# libgcc: Required for Rust binaries built with glibc
RUN apk add --no-cache ca-certificates libgcc

# Create non-root user
# Alpine uses addgroup/adduser instead of groupadd/useradd
RUN addgroup -g 1000 -S koduck && \
    adduser -u 1000 -S koduck -G koduck

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
# Alpine's busybox wget supports the required options
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:8081/health || exit 1

ENTRYPOINT ["koduck-auth"]
