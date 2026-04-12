//! L0 (Layer 0) raw material storage models.
//!
//! L0 represents the raw, immutable source of truth for memory entries,
//! stored in object storage (S3/MinIO) for durability and auditability.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Schema version for L0 entry format.
pub const L0_SCHEMA_VERSION: &str = "1.0";

/// Content of an L0 entry stored in object storage.
///
/// This struct represents the complete, immutable record of a memory entry
/// as stored in S3/MinIO. It includes all metadata needed for replay,
/// audit, and offline analysis.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct L0EntryContent {
    /// Schema version for forward compatibility.
    pub schema_version: String,

    /// The session this entry belongs to.
    pub session_id: Uuid,

    /// Tenant identifier for isolation.
    pub tenant_id: String,

    /// Unique entry identifier.
    pub entry_id: Uuid,

    /// Monotonic sequence number within the session.
    pub sequence_num: i64,

    /// Role of the message sender (user, assistant, system).
    pub role: String,

    /// Message content.
    pub content: String,

    /// Message timestamp (Unix timestamp in milliseconds).
    pub timestamp: i64,

    /// Additional metadata (message_id, turn_id, model, etc.).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,

    /// Request ID from the original append request.
    pub request_id: String,

    /// Trace ID for distributed tracing.
    pub trace_id: String,

    /// Timestamp when this L0 entry was stored.
    pub stored_at: chrono::DateTime<chrono::Utc>,
}

impl L0EntryContent {
    /// Create a new L0 entry content.
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        session_id: Uuid,
        tenant_id: impl Into<String>,
        entry_id: Uuid,
        sequence_num: i64,
        role: impl Into<String>,
        content: impl Into<String>,
        timestamp: i64,
        metadata: Option<serde_json::Value>,
        request_id: impl Into<String>,
        trace_id: impl Into<String>,
    ) -> Self {
        Self {
            schema_version: L0_SCHEMA_VERSION.to_string(),
            session_id,
            tenant_id: tenant_id.into(),
            entry_id,
            sequence_num,
            role: role.into(),
            content: content.into(),
            timestamp,
            metadata,
            request_id: request_id.into(),
            trace_id: trace_id.into(),
            stored_at: chrono::Utc::now(),
        }
    }

    /// Serialize to JSON bytes.
    pub fn to_json_bytes(&self) -> crate::Result<Vec<u8>> {
        Ok(serde_json::to_vec_pretty(self)?)
    }

    /// Build the object key for this entry.
    ///
    /// Format: `tenants/{tenant_id}/sessions/{session_id}/entries/{sequence_num}-{entry_id}.json`
    pub fn build_object_key(&self) -> String {
        format!(
            "tenants/{}/sessions/{}/entries/{:010}-{}.json",
            self.tenant_id,
            self.session_id,
            self.sequence_num,
            self.entry_id
        )
    }
}

/// Build an S3 URI for a given bucket and object key.
///
/// Format: `s3://{bucket}/{key}`
pub fn build_l0_uri(bucket: &str, key: &str) -> String {
    format!("s3://{}/{}", bucket, key)
}

#[cfg(test)]
mod tests {
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
}
