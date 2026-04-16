use super::{validate_meta, validate_write_meta};

use crate::api::RequestMeta;

fn valid_meta() -> RequestMeta {
    RequestMeta {
        request_id: "req-1".to_string(),
        session_id: "session-1".to_string(),
        user_id: "user-1".to_string(),
        tenant_id: "tenant-1".to_string(),
        trace_id: "trace-1".to_string(),
        idempotency_key: "idem-1".to_string(),
        deadline_ms: 5000,
        api_version: "memory.v1".to_string(),
    }
}

#[test]
fn validate_meta_rejects_missing_tenant_id() {
    let mut meta = valid_meta();
    meta.tenant_id.clear();

    let error = validate_meta(&meta).unwrap_err();

    assert_eq!(error.code(), tonic::Code::InvalidArgument);
    assert_eq!(error.message(), "tenant_id is required");
}

#[test]
fn validate_write_meta_requires_idempotency_key() {
    let mut meta = valid_meta();
    meta.idempotency_key.clear();

    let error = validate_write_meta(&meta).unwrap_err();

    assert_eq!(error.code(), tonic::Code::InvalidArgument);
    assert_eq!(error.message(), "idempotency_key is required");
}
