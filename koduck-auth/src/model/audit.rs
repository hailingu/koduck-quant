//! Audit log model definitions

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Audit log record stored in auth security tables.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AuditLog {
    pub id: i64,
    pub tenant_id: String,
    pub user_id: Option<i64>,
    pub action: String,
    pub resource: String,
    pub resource_id: Option<String>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub details: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}
