use super::*;

#[test]
fn combine_scores_uses_frozen_weights() {
    let score = combine_scores(1.0, 1.0, 1.0, 1.0, 1.0, 1.0);
    assert!((score - 1.0).abs() < f32::EPSILON);
}

#[test]
fn intent_score_does_not_double_count_relation_signal() {
    let mut signal = CandidateSignal::new();
    signal
        .reasons
        .insert(match_reason::RELATION_HIT.to_string());

    apply_intent_signal(&mut signal, 1.0);

    assert_eq!(signal.intent_score, 0.0);
    assert!(!signal
        .reasons
        .contains(match_reason::DISCOURSE_ACTION_HIT));
}

#[test]
fn time_bucket_participates_only_through_recency_score() {
    let now = chrono::DateTime::parse_from_rfc3339("2026-04-14T00:00:00Z")
        .unwrap()
        .with_timezone(&Utc);
    let stale_updated_at = chrono::DateTime::parse_from_rfc3339("2026-01-01T00:00:00Z")
        .unwrap()
        .with_timezone(&Utc);

    let with_bucket = recency_score(stale_updated_at, Some("2026-04"), now);
    let without_bucket = recency_score(stale_updated_at, None, now);

    assert!(with_bucket > without_bucket);
    assert_eq!(without_bucket, 0.0);
}

#[test]
fn recall_target_fact_types_maps_supported_targets() {
    assert_eq!(recall_target_fact_types(Some("person")), &["person"]);
    assert_eq!(recall_target_fact_types(Some("preference")), &["preference"]);
    assert_eq!(recall_target_fact_types(Some("fact")), &["fact"]);
    assert!(recall_target_fact_types(Some("general")).is_empty());
}
