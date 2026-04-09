//! Password hashing benchmarks
//!
//! Run with: cargo bench --bench password_hash

use criterion::{black_box, criterion_group, criterion_main, Criterion};
use koduck_auth::config::SecurityConfig;
use koduck_auth::crypto::PasswordHasher;
use tokio::runtime::Runtime;

fn create_hasher() -> PasswordHasher {
    let config = SecurityConfig {
        argon2_memory_cost: 65536,
        argon2_time_cost: 3,
        argon2_parallelism: 4,
        max_login_attempts: 5,
        lockout_duration_minutes: 30,
        password_min_length: 6,
        password_max_length: 100,
        turnstile_enabled: false,
        turnstile_secret_key: secrecy::SecretString::from("".to_string()),
    };
    PasswordHasher::with_config(&config).expect("Failed to create password hasher")
}

fn bench_hash_password(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let hasher = create_hasher();

    c.bench_function("hash_password", |b| {
        b.to_async(&rt).iter(|| async {
            hasher
                .hash_password(black_box("test_password_123"))
                .await
                .expect("Failed to hash password")
        })
    });
}

fn bench_verify_password(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let hasher = create_hasher();

    // Pre-hash a password for verification benchmark
    let hash = rt
        .block_on(async { hasher.hash_password("test_password_123").await })
        .expect("Failed to hash password");

    c.bench_function("verify_password", |b| {
        b.to_async(&rt).iter(|| async {
            hasher
                .verify_password(black_box("test_password_123"), black_box(&hash))
                .await
                .expect("Failed to verify password")
        })
    });
}

fn bench_hash_password_default(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let hasher = PasswordHasher::new();

    c.bench_function("hash_password_default", |b| {
        b.to_async(&rt).iter(|| async {
            hasher
                .hash_password(black_box("test_password_123"))
                .await
                .expect("Failed to hash password")
        })
    });
}

criterion_group!(
    benches,
    bench_hash_password,
    bench_verify_password,
    bench_hash_password_default
);
criterion_main!(benches);
