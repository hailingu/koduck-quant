//! Audit log repository

use crate::{
    error::{AppError, Result},
    model::AuditLog,
};
use serde_json::Value;
use sqlx::PgPool;

/// Audit log repository
#[derive(Debug, Clone)]
pub struct AuditLogRepository {
    pool: PgPool,
}

impl AuditLogRepository {
    /// Create new audit log repository
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Persist one audit event.
    pub async fn create(
        &self,
        tenant_id: &str,
        user_id: Option<i64>,
        action: &str,
        resource: &str,
        resource_id: Option<&str>,
        ip_address: Option<&str>,
        user_agent: Option<&str>,
        details: Option<Value>,
    ) -> Result<AuditLog> {
        let audit_log = sqlx::query_as::<_, AuditLog>(
            r#"
            INSERT INTO audit_logs (
                tenant_id,
                user_id,
                action,
                resource,
                resource_id,
                ip_address,
                user_agent,
                details
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING
                id,
                tenant_id,
                user_id,
                action,
                resource,
                resource_id,
                ip_address,
                user_agent,
                details,
                created_at
            "#,
        )
        .bind(tenant_id)
        .bind(user_id)
        .bind(action)
        .bind(resource)
        .bind(resource_id)
        .bind(ip_address)
        .bind(user_agent)
        .bind(details)
        .fetch_one(&self.pool)
        .await
        .map_err(AppError::Database)?;

        Ok(audit_log)
    }
}
