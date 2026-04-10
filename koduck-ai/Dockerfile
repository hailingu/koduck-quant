# Multi-stage build for koduck-ai

# Stage 1: Builder
FROM docker.m.daocloud.io/library/rust:1.88-slim-bookworm AS builder

WORKDIR /app
ENV CARGO_HOME=/usr/local/cargo

# Configure Cargo to use rsproxy.cn (China mirror) for crates index/downloads
RUN mkdir -p /usr/local/cargo && \
    printf '[source.crates-io]\nreplace-with = "rsproxy"\n\n[source.rsproxy]\nregistry = "sparse+https://rsproxy.cn/index/"\n' > /usr/local/cargo/config.toml

# Install dependencies (use Tsinghua mirror for Debian repositories)
RUN sed -i 's|http://deb.debian.org/debian|https://mirrors.tuna.tsinghua.edu.cn/debian|g' /etc/apt/sources.list.d/debian.sources \
 && sed -i 's|http://deb.debian.org/debian-security|https://mirrors.tuna.tsinghua.edu.cn/debian-security|g' /etc/apt/sources.list.d/debian.sources \
 && apt-get update \
 && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    protobuf-compiler \
    libprotobuf-dev \
 && rm -rf /var/lib/apt/lists/*

# Copy manifests
COPY Cargo.toml ./
COPY build.rs ./
COPY proto ./proto

# Create minimal source tree for dependency caching build.
RUN mkdir -p src && echo "fn main() {}" > src/main.rs

# Resolve and fetch deps with persistent cache (only new deps will download).
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    cargo generate-lockfile && cargo fetch --locked

# Copy source code
COPY src ./src

# Build application
RUN cargo build --release --locked && \
    cp /app/target/release/koduck-ai /app/koduck-ai && \
    strip --strip-all /app/koduck-ai

# Stage 2: Runtime
FROM docker.m.daocloud.io/library/debian:bookworm-slim

WORKDIR /app

# Install minimal runtime dependencies
RUN sed -i 's|http://deb.debian.org/debian|http://mirrors.tuna.tsinghua.edu.cn/debian|g' /etc/apt/sources.list.d/debian.sources \
 && sed -i 's|http://deb.debian.org/debian-security|http://mirrors.tuna.tsinghua.edu.cn/debian-security|g' /etc/apt/sources.list.d/debian.sources \
 && apt-get update \
 && apt-get install -y --no-install-recommends \
    ca-certificates \
    libssl3 \
    wget \
 && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -g 1000 koduck && \
    useradd -u 1000 -g 1000 -m -s /usr/sbin/nologin koduck

# Copy binary from builder
COPY --from=builder /app/koduck-ai /usr/local/bin/koduck-ai

USER koduck

# Expose ports
EXPOSE 8083 50051 9090

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:8083/healthz || exit 1

ENTRYPOINT ["koduck-ai"]
