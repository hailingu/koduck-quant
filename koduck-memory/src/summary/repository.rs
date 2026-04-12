use sqlx::PgPool;
use tracing::info;
use uuid::Uuid;

use crate::summary::model::{InsertMemorySummary, MemorySummary};
use crate::Result;

/// DAO for `memory_summaries`.
#[derive(Clone)]
pub struct MemorySummaryRepository {
    pool: PgPool,
}

impl MemorySummaryRepository {
    pub fn new(pool: &PgPool) -> Self {
        Self { pool: pool.clone() }
    }

    pub async fn next_version(&self, tenant_id: &str, session_id: Uuid) -> Result<i32> {
        let version = sqlx::query_scalar::<_, i32>(
            r#"
            SELECT COALESCE(MAX(version), 0) + 1
            FROM memory_summaries
            WHERE tenant_id = $1 AND session_id = $2
            "#,
        )
        .bind(tenant_id)
        .bind(session_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(version)
    }

    pub async fn insert(&self, params: &InsertMemorySummary) -> Result<MemorySummary> {
        let row = sqlx::query_as::<_, MemorySummary>(
            r#"
            INSERT INTO memory_summaries (
                id, tenant_id, session_id, domain_class, summary, strategy, version, created_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, now()
            )
            RETURNING
                id, tenant_id, session_id, domain_class, summary, strategy, version, created_at
            "#,
        )
        .bind(params.id)
        .bind(&params.tenant_id)
        .bind(params.session_id)
        .bind(&params.domain_class)
        .bind(&params.summary)
        .bind(&params.strategy)
        .bind(params.version)
        .fetch_one(&self.pool)
        .await?;

        info!(
            summary_id = %row.id,
            session_id = %row.session_id,
            version = row.version,
            domain_class = %row.domain_class,
            "memory summary inserted"
        );

        Ok(row)
    }

    pub async fn latest_by_session(
        &self,
        tenant_id: &str,
        session_id: Uuid,
    ) -> Result<Option<MemorySummary>> {
        let row = sqlx::query_as::<_, MemorySummary>(
            r#"
            SELECT
                id, tenant_id, session_id, domain_class, summary, strategy, version, created_at
            FROM memory_summaries
            WHERE tenant_id = $1 AND session_id = $2
            ORDER BY version DESC
            LIMIT 1
            "#,
        )
        .bind(tenant_id)
        .bind(session_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row)
    }
}
