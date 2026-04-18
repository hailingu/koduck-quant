use super::*;

#[test]
fn parse_optional_uuid_handles_empty() {
    assert!(parse_optional_uuid("").is_none());
    assert!(parse_optional_uuid("  ").is_none());
}

#[test]
fn parse_optional_uuid_handles_valid() {
    let id = "550e8400-e29b-41d4-a716-446655440000";
    let parsed = parse_optional_uuid(id).unwrap();
    assert_eq!(parsed.to_string(), id);
}

#[test]
fn parse_optional_uuid_handles_invalid() {
    assert!(parse_optional_uuid("not-a-uuid").is_none());
}

#[test]
fn session_to_proto_converts_fields() {
    let session_id = Uuid::new_v4();
    let parent_id = Uuid::new_v4();
    let now = chrono::Utc::now();
    let session = Session {
        session_id,
        tenant_id: "tenant-1".to_string(),
        user_id: "user-1".to_string(),
        parent_session_id: Some(parent_id),
        forked_from_session_id: None,
        title: "Test Session".to_string(),
        status: "active".to_string(),
        created_at: now,
        updated_at: now,
        last_message_at: now,
        extra: serde_json::json!({"key": "value"}),
    };

    let proto = session.to_proto();
    assert_eq!(proto.session_id, session_id.to_string());
    assert_eq!(proto.tenant_id, "tenant-1");
    assert_eq!(proto.user_id, "user-1");
    assert_eq!(proto.parent_session_id, parent_id.to_string());
    assert_eq!(proto.forked_from_session_id, "");
    assert_eq!(proto.title, "Test Session");
    assert_eq!(proto.status, "active");
    assert_eq!(proto.extra.get("key"), Some(&"value".to_string()));
}

#[test]
fn session_to_proto_handles_empty_lineage() {
    let session_id = Uuid::new_v4();
    let now = chrono::Utc::now();
    let session = Session {
        session_id,
        tenant_id: "t1".to_string(),
        user_id: "u1".to_string(),
        parent_session_id: None,
        forked_from_session_id: None,
        title: "T".to_string(),
        status: "s".to_string(),
        created_at: now,
        updated_at: now,
        last_message_at: now,
        extra: serde_json::json!({}),
    };

    let proto = session.to_proto();
    assert_eq!(proto.parent_session_id, "");
    assert_eq!(proto.forked_from_session_id, "");
    assert!(proto.extra.is_empty());
}

#[test]
fn extra_to_jsonb_converts_map() {
    let mut map = std::collections::HashMap::new();
    map.insert("a".to_string(), "b".to_string());
    let val = extra_to_jsonb(&map);
    assert_eq!(val.get("a").and_then(|v| v.as_str()), Some("b"));
}

#[test]
fn extra_to_jsonb_handles_empty_map() {
    let map = std::collections::HashMap::new();
    let val = extra_to_jsonb(&map);
    assert!(val.is_object());
    assert!(val.as_object().expect("json object").is_empty());
}
