use sqlx::PgPool;
use tracing::info;
use uuid::Uuid;

use crate::Result;

/// DAO for `memory_idempotency_keys` table.
#[derive(Clone)]
pub struct IdempotencyRepository {
    pool: PgPool,
}

impl IdempotencyRepository {
    pub fn new(pool: &PgPool) -> Self {
        Self {
            pool: pool.clone(),
        }
    }

    /// Try to record a new idempotency key.
    /// Returns `true` if this is a new key (first request), `false` if duplicate.
    ///
    /// Uses `INSERT ... ON CONFLICT DO NOTHING` + `RETURNING` to atomically
    /// check-and-insert in a single round trip.
    pub async fn try_record(
        &self,
        idempotency_key: &str,
        tenant_id: &str,
        session_id: Uuid,
        operation: &str,
        request_id: &str,
    ) -> Result<bool> {
        let now = chrono::Utc::now();
        let expires_at = now + chrono::Duration::hours(24);

        let row = sqlx::query_scalar::<_, String>(
            r#"
            INSERT INTO memory_idempotency_keys (
                idempotency_key, tenant_id, session_id,
                operation, request_id, created_at, expires_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (idempotency_key) DO NOTHING
            RETURNING idempotency_key
            "#,
        )
        .bind(idempotency_key)
        .bind(tenant_id)
        .bind(session_id)
        .bind(operation)
        .bind(request_id)
        .bind(now)
        .bind(expires_at)
        .fetch_optional(&self.pool)
        .await?;

        let is_new = row.is_some();
        if is_new {
            info!(
                idempotency_key = %idempotency_key,
                "new idempotency key recorded"
            );
        } else {
            info!(
                idempotency_key = %idempotency_key,
                "duplicate idempotency key detected"
            );
        }

        Ok(is_new)
    }
}
