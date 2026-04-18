use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::api::SessionInfo;

/// Domain model for `memory_sessions` table.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Session {
    pub session_id: Uuid,
    pub tenant_id: String,
    pub user_id: String,
    pub parent_session_id: Option<Uuid>,
    pub forked_from_session_id: Option<Uuid>,
    pub title: String,
    pub status: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub last_message_at: chrono::DateTime<chrono::Utc>,
    pub extra: serde_json::Value,
}

/// Parameters for creating or updating a session.
pub struct UpsertSession {
    pub session_id: Uuid,
    pub tenant_id: String,
    pub user_id: String,
    pub parent_session_id: Option<Uuid>,
    pub forked_from_session_id: Option<Uuid>,
    pub title: String,
    pub status: String,
    pub last_message_at: chrono::DateTime<chrono::Utc>,
    pub extra: serde_json::Value,
}

/// Parameters for partial session metadata update.
pub struct UpdateSessionMeta {
    pub tenant_id: String,
    pub session_id: Uuid,
    pub title: Option<String>,
    pub status: Option<String>,
    pub last_message_at: Option<chrono::DateTime<chrono::Utc>>,
    pub extra: Option<serde_json::Value>,
}

// ---------------------------------------------------------------------------
// Proto <-> Domain conversions
// ---------------------------------------------------------------------------

impl Session {
    /// Convert domain `Session` to proto `SessionInfo`.
    pub fn to_proto(&self) -> SessionInfo {
        let extra_map = self
            .extra
            .as_object()
            .map(|obj| {
                obj.iter()
                    .filter_map(|(k, v)| v.as_str().map(|sv| (k.clone(), sv.to_string())))
                    .collect()
            })
            .unwrap_or_default();

        SessionInfo {
            session_id: self.session_id.to_string(),
            tenant_id: self.tenant_id.clone(),
            user_id: self.user_id.clone(),
            parent_session_id: self
                .parent_session_id
                .map(|id| id.to_string())
                .unwrap_or_default(),
            forked_from_session_id: self
                .forked_from_session_id
                .map(|id| id.to_string())
                .unwrap_or_default(),
            title: self.title.clone(),
            status: self.status.clone(),
            created_at: self.created_at.timestamp_millis(),
            updated_at: self.updated_at.timestamp_millis(),
            last_message_at: self.last_message_at.timestamp_millis(),
            extra: extra_map,
        }
    }
}

/// Parse an optional UUID from a proto string field.
/// Empty strings are treated as `None`.
pub fn parse_optional_uuid(s: &str) -> Option<Uuid> {
    if s.trim().is_empty() {
        None
    } else {
        Uuid::parse_str(s.trim()).ok()
    }
}

/// Parse a required UUID from a proto string field.
pub fn parse_uuid(s: &str) -> std::result::Result<Uuid, uuid::Error> {
    Uuid::parse_str(s.trim())
}

/// Convert an optional proto `map<string, string>` to JSONB value.
pub fn extra_to_jsonb(extra: &std::collections::HashMap<String, String>) -> serde_json::Value {
    serde_json::to_value(extra).unwrap_or(serde_json::Value::Object(serde_json::Map::new()))
}

#[cfg(test)]
#[path = "../tests/session/model_tests.rs"]
mod tests;
