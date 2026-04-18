use super::*;

fn summary_config_for_tests() -> SummarySection {
    SummarySection {
        async_enabled: true,
        llm_enabled: false,
        llm_provider: "minimax".to_string(),
        llm_api_key: String::new(),
        llm_base_url: "https://api.minimax.chat/v1".to_string(),
        llm_model: "MiniMax-M2.5".to_string(),
        llm_timeout_ms: 15_000,
        llm_max_concurrency: 1,
    }
}

#[test]
fn build_summary_uri_formats_stably() {
    let uri = build_summary_uri(
        "tenant-1",
        Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap(),
        3,
    );
    assert_eq!(
        uri,
        "memory-summary://tenants/tenant-1/sessions/550e8400-e29b-41d4-a716-446655440000/versions/3"
    );
}

#[tokio::test]
async fn build_fact_candidates_fails_when_llm_disabled() {
    let transcript = vec!["user: extract people from this transcript".to_string()];

    let result = build_fact_candidates(
        &transcript,
        Some("People session"),
        domain_class::UNKNOWN,
        &summary_config_for_tests(),
        Arc::new(Semaphore::new(1)),
    )
    .await;

    assert!(result.is_err());
}

#[tokio::test]
async fn build_fact_candidates_fails_when_api_key_missing() {
    let transcript = vec!["user: extract people from this transcript".to_string()];
    let mut cfg = summary_config_for_tests();
    cfg.llm_enabled = true;
    cfg.llm_api_key = String::new();

    let result = build_fact_candidates(
        &transcript,
        Some("People session"),
        domain_class::UNKNOWN,
        &cfg,
        Arc::new(Semaphore::new(1)),
    )
    .await;

    assert!(result.is_err());
}
