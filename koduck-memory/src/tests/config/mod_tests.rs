use super::{mask_connection_string, mask_secret, AppConfig};

fn sample_config() -> AppConfig {
    toml::from_str(
        r#"
        [app]
        name = "koduck-memory"
        env = "test"
        version = "0.1.0"

        [server]
        grpc_addr = "127.0.0.1:50051"
        metrics_addr = "127.0.0.1:9090"

        [postgres]
        dsn = "postgresql://koduck:supersecret@postgres:5432/koduck_memory"

        [object_store]
        endpoint = "http://minio:9000"
        bucket = "koduck-memory"
        access_key = "minioadmin"
        secret_key = "supersecret"
        region = "ap-east-1"

        [index]
        mode = "domain-first"

        [capabilities]
        ttl_secs = 60

        [summary]
        async_enabled = true
        llm_enabled = false
        llm_provider = "minimax"
        llm_api_key = ""
        llm_base_url = "https://api.minimax.chat/v1"
        llm_model = "MiniMax-M2.7"
        llm_timeout_ms = 15000

        [retry]
        max_attempts = 3
        initial_delay_ms = 500
        "#,
    )
    .expect("valid test config")
}

#[test]
fn redacted_summary_hides_secrets() {
    let summary = sample_config().redacted_summary();
    assert!(summary.contains("mi***in"));
    assert!(summary.contains("su***et"));
    assert!(!summary.contains("supersecret@postgres"));
    assert!(!summary.contains("\"secret_key\":\"supersecret\""));
}

#[test]
fn secret_masking_is_stable() {
    assert_eq!(mask_secret("abcd"), "****");
    assert_eq!(mask_secret("abcdef"), "ab***ef");
    assert_eq!(
        mask_connection_string("postgresql://koduck:supersecret@postgres:5432/koduck_memory"),
        "postgresql://koduck:***@postgres:5432/koduck_memory"
    );
}
