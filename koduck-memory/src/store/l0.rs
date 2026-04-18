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
#[path = "../tests/store/l0_tests.rs"]
mod tests;
