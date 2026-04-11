# Multi-stage build for koduck-memory

FROM docker.m.daocloud.io/library/rust:1.88-slim-bookworm AS builder

WORKDIR /app
ENV CARGO_HOME=/usr/local/cargo

RUN mkdir -p /usr/local/cargo && \
    printf '[source.crates-io]\nreplace-with = "rsproxy"\n\n[source.rsproxy]\nregistry = "sparse+https://rsproxy.cn/index/"\n' > /usr/local/cargo/config.toml

RUN sed -i 's|http://deb.debian.org/debian|https://mirrors.tuna.tsinghua.edu.cn/debian|g' /etc/apt/sources.list.d/debian.sources \
 && sed -i 's|http://deb.debian.org/debian-security|https://mirrors.tuna.tsinghua.edu.cn/debian-security|g' /etc/apt/sources.list.d/debian.sources \
 && apt-get update \
 && apt-get install -y --no-install-recommends protobuf-compiler \
 && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml ./
COPY build.rs ./
COPY proto ./proto

RUN mkdir -p src && echo "fn main() {}" > src/main.rs

RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    cargo generate-lockfile && cargo fetch --locked

COPY config ./config
COPY src ./src

RUN cargo build --release --locked && \
    cp /app/target/release/koduck-memory /app/koduck-memory && \
    strip --strip-all /app/koduck-memory

FROM docker.m.daocloud.io/library/debian:bookworm-slim

WORKDIR /app

RUN sed -i 's|http://deb.debian.org/debian|http://mirrors.tuna.tsinghua.edu.cn/debian|g' /etc/apt/sources.list.d/debian.sources \
 && sed -i 's|http://deb.debian.org/debian-security|http://mirrors.tuna.tsinghua.edu.cn/debian-security|g' /etc/apt/sources.list.d/debian.sources \
 && apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates wget \
 && rm -rf /var/lib/apt/lists/*

RUN groupadd -g 1000 koduck && \
    useradd -u 1000 -g 1000 -m -s /usr/sbin/nologin koduck

COPY --from=builder /app/koduck-memory /usr/local/bin/koduck-memory
COPY --from=builder /app/config ./config

USER koduck

EXPOSE 50051 9090

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:9090/healthz || exit 1

ENTRYPOINT ["koduck-memory"]
