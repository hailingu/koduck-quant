use super::*;

#[test]
fn insert_summary_builder_works() {
    let session_id = Uuid::new_v4();
    let params = InsertMemorySummary::new(
        "tenant-1",
        session_id,
        "task",
        "summary text",
        "session-rollup",
        "llm",
        "none",
        2,
    );

    assert_eq!(params.tenant_id, "tenant-1");
    assert_eq!(params.session_id, session_id);
    assert_eq!(params.domain_class, "task");
    assert_eq!(params.summary, "summary text");
    assert_eq!(params.strategy, "session-rollup");
    assert_eq!(params.summary_source, "llm");
    assert_eq!(params.llm_error_class, "none");
    assert_eq!(params.version, 2);
}
