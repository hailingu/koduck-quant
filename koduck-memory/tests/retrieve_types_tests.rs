use koduck_memory::retrieve::{RetrieveContext, RetrieveResult, domain_class, match_reason};

#[test]
fn retrieve_context_builder_works() {
    let ctx = RetrieveContext::new("tenant-1", domain_class::HISTORY, "query", 10)
        .with_session_id("session-1");

    assert_eq!(ctx.tenant_id, "tenant-1");
    assert_eq!(ctx.session_id, Some("session-1".to_string()));
    assert_eq!(ctx.domain_class, domain_class::HISTORY);
    assert!(ctx.domain_classes.is_empty());
    assert!(ctx.entities.is_empty());
    assert!(ctx.relation_types.is_empty());
    assert_eq!(ctx.intent_type, "none");
    assert!(ctx.intent_aux.is_empty());
    assert!(ctx.recall_target_type.is_none());
    assert_eq!(ctx.query_text, "query");
    assert_eq!(ctx.top_k, 10);
}

#[test]
fn retrieve_context_clamps_top_k() {
    let ctx_low = RetrieveContext::new("t", domain_class::HISTORY, "q", 0);
    assert_eq!(ctx_low.top_k, 1);

    let ctx_high = RetrieveContext::new("t", domain_class::HISTORY, "q", 200);
    assert_eq!(ctx_high.top_k, 100);
}

#[test]
fn retrieve_context_with_query_analysis_overrides_primary_domain() {
    let ctx = RetrieveContext::new("tenant-1", domain_class::UNKNOWN, "query", 10)
        .with_query_analysis(
            vec![domain_class::HISTORY.to_string()],
            vec!["Karl".to_string()],
            vec!["comparison".to_string()],
            "compare",
            vec!["recent_bias".to_string()],
            Some("general".to_string()),
        );

    assert_eq!(ctx.domain_class, domain_class::HISTORY);
    assert_eq!(ctx.domain_classes, vec![domain_class::HISTORY.to_string()]);
    assert_eq!(ctx.entities, vec!["Karl".to_string()]);
    assert_eq!(ctx.relation_types, vec!["comparison".to_string()]);
    assert_eq!(ctx.intent_type, "compare");
    assert_eq!(ctx.intent_aux, vec!["recent_bias".to_string()]);
    assert_eq!(ctx.recall_target_type.as_deref(), Some("general"));
}

#[test]
fn retrieve_result_builder_works() {
    let result = RetrieveResult::new("session-1", "s3://bucket/obj", 0.85, "snippet")
        .with_match_reason("domain_hit")
        .with_match_reason("session_scope_hit");

    assert_eq!(result.session_id, "session-1");
    assert_eq!(result.l0_uri, "s3://bucket/obj");
    assert!((result.score - 0.85).abs() < f32::EPSILON);
    assert_eq!(result.snippet, "snippet");
    assert_eq!(result.match_reasons.len(), 2);
    assert!(result.match_reasons.contains(&"domain_hit".to_string()));
}

#[test]
fn match_reason_normalization_filters_open_set_values() {
    let normalized = match_reason::normalize_output(vec![
        "domain_hit".to_string(),
        "domain_hit".to_string(),
        "keyword_hit".to_string(),
        " summary_hit ".to_string(),
    ]);

    assert_eq!(
        normalized,
        vec!["domain_hit".to_string(), "summary_hit".to_string()]
    );
}

#[test]
fn domain_class_validation_matches_current_closed_set() {
    assert!(domain_class::is_valid(domain_class::HISTORY));
    assert!(domain_class::is_valid(domain_class::COMPUTER_SCIENCE));
    assert!(domain_class::is_valid(domain_class::FINANCE));
    assert!(domain_class::is_valid(domain_class::FOOD));
    assert!(domain_class::is_valid(domain_class::UNKNOWN));

    assert!(!domain_class::is_valid("chat"));
    assert!(!domain_class::is_valid("task"));
    assert!(!domain_class::is_valid("system"));
    assert!(!domain_class::is_valid("summary"));
    assert!(!domain_class::is_valid("fact"));
    assert!(!domain_class::is_valid("invalid"));
}
