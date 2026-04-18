use super::*;
use serde_json::json;

#[test]
fn l0_entry_builds_correct_object_key() {
    let entry = L0EntryContent::new(
        Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap(),
        "tenant-123",
        Uuid::parse_str("660e8400-e29b-41d4-a716-446655440001").unwrap(),
        42,
        "user",
        "Hello, world!",
        1700000000000,
        Some(json!({"message_id": "msg-001"})),
        "req-123",
        "trace-456",
    );

    let key = entry.build_object_key();
    assert_eq!(
        key,
        "tenants/tenant-123/sessions/550e8400-e29b-41d4-a716-446655440000/entries/0000000042-660e8400-e29b-41d4-a716-446655440001.json"
    );
}

#[test]
fn build_l0_uri_formats_correctly() {
    let uri = build_l0_uri("koduck-memory", "tenants/t1/sessions/s1/entries/1-e1.json");
    assert_eq!(uri, "s3://koduck-memory/tenants/t1/sessions/s1/entries/1-e1.json");
}

#[test]
fn l0_entry_serializes_to_valid_json() {
    let entry = L0EntryContent::new(
        Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap(),
        "tenant-123",
        Uuid::parse_str("660e8400-e29b-41d4-a716-446655440001").unwrap(),
        1,
        "assistant",
        "How can I help?",
        1700000000000,
        None,
        "req-789",
        "trace-abc",
    );

    let json = entry.to_json_bytes().unwrap();
    let json_str = String::from_utf8(json).unwrap();

    assert!(json_str.contains("\"schema_version\":\"1.0\""));
    assert!(json_str.contains("\"role\":\"assistant\""));
    assert!(json_str.contains("\"sequence_num\":1"));
}
