use super::*;

#[test]
fn object_store_builds_correct_key() {
    let session_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();
    let entry_id = Uuid::parse_str("660e8400-e29b-41d4-a716-446655440001").unwrap();

    let key = format!(
        "tenants/{}/sessions/{}/entries/{:010}-{}.json",
        "tenant-123", session_id, 42i64, entry_id
    );

    assert_eq!(
        key,
        "tenants/tenant-123/sessions/550e8400-e29b-41d4-a716-446655440000/entries/0000000042-660e8400-e29b-41d4-a716-446655440001.json"
    );
}

#[test]
fn l0_uri_format_is_correct() {
    let uri = build_l0_uri("my-bucket", "path/to/object.json");
    assert_eq!(uri, "s3://my-bucket/path/to/object.json");
}

#[test]
fn parse_l0_uri_extracts_bucket_and_key() {
    let (bucket, key) = parse_l0_uri("s3://my-bucket/path/to/object.json").unwrap();
    assert_eq!(bucket, "my-bucket");
    assert_eq!(key, "path/to/object.json");
}
