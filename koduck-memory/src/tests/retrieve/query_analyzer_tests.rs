use super::*;

#[test]
fn analyze_returns_structured_context() {
    let analyzer = QueryAnalyzer::new();

    let analysis = analyzer
        .analyze(
            "Do you remember whether Karl Marx or Friedrich Engels was mentioned before?",
            "history",
            "",
        )
        .unwrap();

    assert_eq!(analysis.domain_classes, vec!["history".to_string()]);
    assert_eq!(analysis.intent_type, "recall");
    assert!(analysis.entities.contains(&"Karl".to_string()));
    assert!(analysis.entities.contains(&"Marx".to_string()));
    assert!(analysis.entities.contains(&"Friedrich".to_string()));
    assert!(analysis.entities.contains(&"Engels".to_string()));
    assert!(analysis.intent_aux.contains(&"cross_session_scope".to_string()));
    assert_eq!(analysis.recall_target_type.as_deref(), Some("general"));
}

#[test]
fn analyze_detects_relation_without_dup_aux() {
    let analyzer = QueryAnalyzer::new();

    let analysis = analyzer
        .analyze("Compare Rust vs Go for backend services", "technology", "")
        .unwrap();

    assert_eq!(analysis.intent_type, "compare");
    assert_eq!(analysis.relation_types, vec!["comparison".to_string()]);
    assert!(analysis.intent_aux.is_empty());
}

#[test]
fn analyze_rejects_invalid_session_id() {
    let analyzer = QueryAnalyzer::new();

    let result = analyzer.analyze("remember this", "chat", "not-a-uuid");
    assert!(result.is_err());
}

#[test]
fn analyze_infers_literature_person_recall_from_chinese_name() {
    let analyzer = QueryAnalyzer::new();

    let analysis = analyzer.analyze("之前有聊过舒庆春吗？", "", "").unwrap();

    assert!(analysis.domain_classes.contains(&"literature".to_string()));
    assert!(analysis.entities.contains(&"舒庆春".to_string()));
    assert_eq!(analysis.recall_target_type.as_deref(), Some("person"));
}

#[test]
fn fallback_keeps_unknown_recall_domain_unscoped() {
    let fallback = QueryAnalysis::fallback("not-real", "之前有聊过美食吗？");

    assert!(fallback.domain_classes.is_empty());
    assert_eq!(fallback.intent_type, "none");
    assert_eq!(fallback.recall_target_type.as_deref(), Some("general"));
}

#[test]
fn fallback_preserves_inferred_person_domain() {
    let fallback = QueryAnalysis::fallback("not-real", "Need the latest preference");
    assert!(fallback.domain_classes.is_empty());
    assert_eq!(fallback.intent_type, "none");
    assert_eq!(fallback.recall_target_type.as_deref(), Some("preference"));
}

#[test]
fn analyze_infers_food_domain_from_steak_query() {
    let analyzer = QueryAnalyzer::new();

    let analysis = analyzer.analyze("之前聊过牛排和熟度吗？", "", "").unwrap();

    assert!(analysis.domain_classes.contains(&"food".to_string()));
    assert_eq!(analysis.recall_target_type.as_deref(), Some("general"));
}
