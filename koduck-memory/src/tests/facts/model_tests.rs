use super::InsertMemoryFact;

use uuid::Uuid;

#[test]
fn insert_fact_builder_works() {
    let session_id = Uuid::new_v4();
    let params = InsertMemoryFact::new(
        "tenant-1",
        session_id,
        "preference",
        "chat",
        "User prefers concise rollout summaries.",
        0.91,
    );

    assert_eq!(params.tenant_id, "tenant-1");
    assert_eq!(params.session_id, session_id);
    assert_eq!(params.fact_type, "preference");
    assert_eq!(params.domain_class, "chat");
    assert_eq!(params.fact_text, "User prefers concise rollout summaries.");
    assert!((params.confidence - 0.91).abs() < f64::EPSILON);
}
