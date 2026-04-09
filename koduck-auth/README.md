# Koduck Auth

Koduck authentication service - Rust + gRPC implementation.

## Features

- **Dual Protocol**: HTTP REST API (8081) + gRPC (50051)
- **High Performance**: Rust async runtime for sub-millisecond responses
- **API Compatible**: 100% compatible with existing Java version APIs
- **Type-Safe SQL**: Compile-time SQL validation with sqlx
- **Modern Security**: Argon2 password hashing, RS256 JWT tokens

## Quick Start

### Prerequisites

- Rust 1.75+
- PostgreSQL 14+
- Redis 6+

### Setup

```bash
# Clone and enter directory
cd koduck-auth

# Copy environment config
cp .env.example .env

# Run database migrations
cargo sqlx migrate run

# Start the service
cargo run
```

### Development

```bash
# Run tests
cargo test

# Run with hot reload
cargo watch -x run

# Build release
cargo build --release
```

## Architecture

```
koduck-auth/
├── src/
│   ├── main.rs           # Service entry point
│   ├── lib.rs            # Library entry point
│   ├── config.rs         # Configuration management
│   ├── error.rs          # Error handling
│   ├── state.rs          # Application state
│   ├── model/            # Data models
│   ├── repository/       # Data access layer
│   ├── service/          # Business logic
│   ├── http/             # HTTP REST API
│   ├── grpc/             # gRPC services
│   ├── jwt/              # JWT utilities
│   ├── crypto/           # Cryptographic utilities
│   ├── client/           # External service clients
│   └── util/             # Utilities
├── proto/                # Protobuf definitions
├── migrations/           # Database migrations
├── tests/                # Integration tests
├── benches/              # Benchmarks
└── k8s/                  # Kubernetes manifests
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/login` | User login |
| POST | `/api/v1/auth/register` | User registration |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| POST | `/api/v1/auth/logout` | User logout |
| GET | `/api/v1/auth/security-config` | Get security config |
| POST | `/api/v1/auth/forgot-password` | Forgot password |
| POST | `/api/v1/auth/reset-password` | Reset password |
| GET | `/.well-known/jwks.json` | JWKS endpoint |
| GET | `/health` | Health check |
| GET | `/metrics` | Prometheus metrics |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `KODUCK_AUTH__SERVER__HTTP_ADDR` | HTTP server address | `0.0.0.0:8081` |
| `KODUCK_AUTH__SERVER__GRPC_ADDR` | gRPC server address | `0.0.0.0:50051` |
| `KODUCK_AUTH__DATABASE__URL` | PostgreSQL connection string | - |
| `KODUCK_AUTH__REDIS__URL` | Redis connection string | - |
| `KODUCK_AUTH__JWT__PRIVATE_KEY_PATH` | Path to RSA private key | `./keys/private.pem` |
| `KODUCK_AUTH__JWT__PUBLIC_KEY_PATH` | Path to RSA public key | `./keys/public.pem` |

## License

MIT
