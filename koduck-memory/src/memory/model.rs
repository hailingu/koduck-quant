use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Domain model for `memory_entries` table.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct MemoryEntry {
    pub id: Uuid,
    pub tenant_id: String,
    pub session_id: Uuid,
    pub sequence_num: i64,
    pub role: String,
    pub raw_content_ref: String,
    pub message_ts: chrono::DateTime<chrono::Utc>,
    pub metadata_json: serde_json::Value,
    pub l0_uri: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// Parameters for inserting a new memory entry.
pub struct InsertMemoryEntry {
    pub id: Uuid,
    pub tenant_id: String,
    pub session_id: Uuid,
    pub sequence_num: i64,
    pub role: String,
    pub raw_content_ref: String,
    pub message_ts: chrono::DateTime<chrono::Utc>,
    pub metadata_json: serde_json::Value,
    pub l0_uri: String,
}

/// Convert proto metadata `map<string, string>` to JSONB value.
pub fn metadata_to_jsonb(
    metadata: &std::collections::HashMap<String, String>,
) -> serde_json::Value {
    serde_json::to_value(metadata).unwrap_or(serde_json::Value::Object(serde_json::Map::new()))
}

#[cfg(test)]
#[path = "../tests/memory/model_tests.rs"]
mod tests;
