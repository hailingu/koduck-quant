//! JWT benchmarks

use criterion::{black_box, criterion_group, criterion_main, Criterion};

fn jwt_encode_benchmark(c: &mut Criterion) {
    c.bench_function("jwt_encode", |b| {
        b.iter(|| {
            // TODO: Implement JWT encode benchmark
            black_box("test")
        })
    });
}

fn jwt_decode_benchmark(c: &mut Criterion) {
    c.bench_function("jwt_decode", |b| {
        b.iter(|| {
            // TODO: Implement JWT decode benchmark
            black_box("test")
        })
    });
}

criterion_group!(benches, jwt_encode_benchmark, jwt_decode_benchmark);
criterion_main!(benches);
