use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Domain model for `memory_summaries`.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct MemorySummary {
    pub id: Uuid,
    pub tenant_id: String,
    pub session_id: Uuid,
    pub domain_class: String,
    pub summary: String,
    pub strategy: String,
    pub summary_source: String,
    pub llm_error_class: String,
    pub version: i32,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// Insert parameters for `memory_summaries`.
#[derive(Debug, Clone)]
pub struct InsertMemorySummary {
    pub id: Uuid,
    pub tenant_id: String,
    pub session_id: Uuid,
    pub domain_class: String,
    pub summary: String,
    pub strategy: String,
    pub summary_source: String,
    pub llm_error_class: String,
    pub version: i32,
}

impl InsertMemorySummary {
    pub fn new(
        tenant_id: impl Into<String>,
        session_id: Uuid,
        domain_class: impl Into<String>,
        summary: impl Into<String>,
        strategy: impl Into<String>,
        summary_source: impl Into<String>,
        llm_error_class: impl Into<String>,
        version: i32,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            tenant_id: tenant_id.into(),
            session_id,
            domain_class: domain_class.into(),
            summary: summary.into(),
            strategy: strategy.into(),
            summary_source: summary_source.into(),
            llm_error_class: llm_error_class.into(),
            version,
        }
    }
}

#[cfg(test)]
#[path = "../tests/summary/model_tests.rs"]
mod tests;
