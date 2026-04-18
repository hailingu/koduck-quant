use super::*;

#[test]
fn retriever_new_works() {
    // Compile-time smoke test; real functionality requires a database connection.
}

#[test]
fn quality_summary_heuristic_works() {
    assert!(!is_quality_summary("summary task already accepted for session 123"));
    assert!(!is_quality_summary("todo"));
    assert!(!is_quality_summary(
        "Session 'untitled' summary (history, 8 messages): user: foo | assistant: bar"
    ));
    assert!(is_quality_summary(
        "The user asked for rollout checklist details and follow-up milestones."
    ));
}
