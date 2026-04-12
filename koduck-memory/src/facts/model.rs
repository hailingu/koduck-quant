use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Domain model for `memory_facts`.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct MemoryFact {
    pub id: Uuid,
    pub tenant_id: String,
    pub session_id: Uuid,
    pub fact_type: String,
    pub domain_class: String,
    pub fact_text: String,
    pub confidence: f64,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// Insert parameters for `memory_facts`.
#[derive(Debug, Clone)]
pub struct InsertMemoryFact {
    pub id: Uuid,
    pub tenant_id: String,
    pub session_id: Uuid,
    pub fact_type: String,
    pub domain_class: String,
    pub fact_text: String,
    pub confidence: f64,
}

impl InsertMemoryFact {
    pub fn new(
        tenant_id: impl Into<String>,
        session_id: Uuid,
        fact_type: impl Into<String>,
        domain_class: impl Into<String>,
        fact_text: impl Into<String>,
        confidence: f64,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            tenant_id: tenant_id.into(),
            session_id,
            fact_type: fact_type.into(),
            domain_class: domain_class.into(),
            fact_text: fact_text.into(),
            confidence,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
}
