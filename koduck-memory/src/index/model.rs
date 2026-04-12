use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Domain model for `memory_index_records` table.
/// Represents L1 structured index material for memory retrieval.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct MemoryIndexRecord {
    pub id: Uuid,
    pub tenant_id: String,
    pub session_id: Uuid,
    /// Optional reference to the originating memory entry
    pub entry_id: Option<Uuid>,
    /// Kind of memory: user, assistant, system, summary, fact, etc.
    pub memory_kind: String,
    /// Coarse domain classification for DOMAIN_FIRST filtering
    pub domain_class: String,
    /// Summary text used for negative filtering in SUMMARY_FIRST strategy
    pub summary: String,
    /// Optional snippet excerpt for display
    pub snippet: Option<String>,
    /// URI pointing to L0 raw material (e.g., s3://bucket/...)
    pub source_uri: String,
    /// Optional score hint for ranking (higher = more relevant), stored as NUMERIC in DB
    pub score_hint: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

/// Parameters for inserting a new memory index record.
pub struct InsertMemoryIndexRecord {
    pub id: Uuid,
    pub tenant_id: String,
    pub session_id: Uuid,
    pub entry_id: Option<Uuid>,
    pub memory_kind: String,
    pub domain_class: String,
    pub summary: String,
    pub snippet: Option<String>,
    pub source_uri: String,
    pub score_hint: Option<String>,
}

impl InsertMemoryIndexRecord {
    /// Create a new insert params with generated UUID and current timestamp.
    pub fn new(
        tenant_id: impl Into<String>,
        session_id: Uuid,
        memory_kind: impl Into<String>,
        domain_class: impl Into<String>,
        summary: impl Into<String>,
        source_uri: impl Into<String>,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            tenant_id: tenant_id.into(),
            session_id,
            entry_id: None,
            memory_kind: memory_kind.into(),
            domain_class: domain_class.into(),
            summary: summary.into(),
            snippet: None,
            source_uri: source_uri.into(),
            score_hint: None,
        }
    }

    /// Set the optional entry_id reference.
    pub fn with_entry_id(mut self, entry_id: Uuid) -> Self {
        self.entry_id = Some(entry_id);
        self
    }

    /// Set the optional snippet.
    pub fn with_snippet(mut self, snippet: impl Into<String>) -> Self {
        self.snippet = Some(snippet.into());
        self
    }

    /// Set the optional score_hint as string representation.
    pub fn with_score_hint(mut self, score_hint: impl Into<String>) -> Self {
        self.score_hint = Some(score_hint.into());
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn insert_params_builder_works() {
        let session_id = Uuid::new_v4();
        let entry_id = Uuid::new_v4();
        
        let params = InsertMemoryIndexRecord::new(
            "tenant-123",
            session_id,
            "user",
            "chat",
            "User asked about pricing",
            "s3://bucket/tenants/tenant-123/sessions/{session_id}/entries/1-{entry_id}.json",
        )
        .with_entry_id(entry_id)
        .with_snippet("What is the pricing?")
        .with_score_hint("0.85");

        assert_eq!(params.tenant_id, "tenant-123");
        assert_eq!(params.session_id, session_id);
        assert_eq!(params.entry_id, Some(entry_id));
        assert_eq!(params.memory_kind, "user");
        assert_eq!(params.domain_class, "chat");
        assert_eq!(params.summary, "User asked about pricing");
        assert_eq!(params.snippet, Some("What is the pricing?".to_string()));
        assert_eq!(params.score_hint, Some("0.85".to_string()));
    }

    #[test]
    fn insert_params_minimal_works() {
        let session_id = Uuid::new_v4();
        
        let params = InsertMemoryIndexRecord::new(
            "tenant-456",
            session_id,
            "assistant",
            "chat",
            "Assistant provided answer",
            "s3://bucket/object.json",
        );

        assert_eq!(params.tenant_id, "tenant-456");
        assert!(params.entry_id.is_none());
        assert!(params.snippet.is_none());
        assert!(params.score_hint.is_none());
    }
}
