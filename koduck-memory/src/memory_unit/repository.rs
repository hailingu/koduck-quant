use sqlx::PgPool;
use tracing::info;
use uuid::Uuid;

use crate::Result;
use crate::memory_unit::model::{InsertMemoryUnit, MemoryUnit, MemoryUnitKind, MemoryUnitRow};

#[derive(Clone)]
pub struct MemoryUnitRepository {
    pool: PgPool,
}

impl MemoryUnitRepository {
    pub fn new(pool: &PgPool) -> Self {
        Self { pool: pool.clone() }
    }

    pub async fn insert(&self, params: &InsertMemoryUnit) -> Result<MemoryUnit> {
        params.validate()?;

        let row = sqlx::query_as::<_, MemoryUnitRow>(
            r#"
            INSERT INTO memory_units (
                memory_unit_id, tenant_id, session_id, entry_range_start, entry_range_end,
                memory_kind, domain_class_primary, summary, snippet, source_uri,
                summary_status, salience_score, time_bucket, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, $10,
                $11, CAST($12 AS NUMERIC(5, 4)), $13, now(), now()
            )
            RETURNING
                memory_unit_id, tenant_id, session_id, entry_range_start, entry_range_end,
                memory_kind, domain_class_primary, summary, snippet, source_uri,
                summary_status, salience_score::DOUBLE PRECISION AS salience_score,
                time_bucket, created_at, updated_at
            "#,
        )
        .bind(params.memory_unit_id)
        .bind(&params.tenant_id)
        .bind(params.session_id)
        .bind(params.entry_range_start)
        .bind(params.entry_range_end)
        .bind(params.memory_kind.as_db_value())
        .bind(&params.domain_class_primary)
        .bind(&params.summary_state.summary)
        .bind(&params.snippet)
        .bind(&params.source_uri)
        .bind(&params.summary_state.summary_status)
        .bind(params.salience_score)
        .bind(&params.time_bucket)
        .fetch_one(&self.pool)
        .await?;

        let model = MemoryUnit::try_from(row)?;
        info!(
            memory_unit_id = %model.memory_unit_id,
            session_id = %model.session_id,
            summary_status = %model.summary_state.summary_status,
            "memory unit inserted"
        );
        Ok(model)
    }

    pub async fn upsert(&self, params: &InsertMemoryUnit) -> Result<MemoryUnit> {
        params.validate()?;

        let row = sqlx::query_as::<_, MemoryUnitRow>(
            r#"
            INSERT INTO memory_units (
                memory_unit_id, tenant_id, session_id, entry_range_start, entry_range_end,
                memory_kind, domain_class_primary, summary, snippet, source_uri,
                summary_status, salience_score, time_bucket, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, $10,
                $11, CAST($12 AS NUMERIC(5, 4)), $13, now(), now()
            )
            ON CONFLICT (memory_unit_id) DO UPDATE SET
                tenant_id = EXCLUDED.tenant_id,
                session_id = EXCLUDED.session_id,
                entry_range_start = EXCLUDED.entry_range_start,
                entry_range_end = EXCLUDED.entry_range_end,
                memory_kind = EXCLUDED.memory_kind,
                domain_class_primary = EXCLUDED.domain_class_primary,
                summary = EXCLUDED.summary,
                snippet = EXCLUDED.snippet,
                source_uri = EXCLUDED.source_uri,
                summary_status = EXCLUDED.summary_status,
                salience_score = EXCLUDED.salience_score,
                time_bucket = EXCLUDED.time_bucket,
                updated_at = now()
            RETURNING
                memory_unit_id, tenant_id, session_id, entry_range_start, entry_range_end,
                memory_kind, domain_class_primary, summary, snippet, source_uri,
                summary_status, salience_score::DOUBLE PRECISION AS salience_score,
                time_bucket, created_at, updated_at
            "#,
        )
        .bind(params.memory_unit_id)
        .bind(&params.tenant_id)
        .bind(params.session_id)
        .bind(params.entry_range_start)
        .bind(params.entry_range_end)
        .bind(params.memory_kind.as_db_value())
        .bind(&params.domain_class_primary)
        .bind(&params.summary_state.summary)
        .bind(&params.snippet)
        .bind(&params.source_uri)
        .bind(&params.summary_state.summary_status)
        .bind(params.salience_score)
        .bind(&params.time_bucket)
        .fetch_one(&self.pool)
        .await?;

        MemoryUnit::try_from(row)
    }

    pub async fn get_by_id(&self, tenant_id: &str, memory_unit_id: Uuid) -> Result<Option<MemoryUnit>> {
        let row = sqlx::query_as::<_, MemoryUnitRow>(
            r#"
            SELECT
                memory_unit_id, tenant_id, session_id, entry_range_start, entry_range_end,
                memory_kind, domain_class_primary, summary, snippet, source_uri,
                summary_status, salience_score::DOUBLE PRECISION AS salience_score,
                time_bucket, created_at, updated_at
            FROM memory_units
            WHERE tenant_id = $1 AND memory_unit_id = $2
            "#,
        )
        .bind(tenant_id)
        .bind(memory_unit_id)
        .fetch_optional(&self.pool)
        .await?;

        row.map(MemoryUnit::try_from).transpose()
    }

    pub async fn list_by_session(
        &self,
        tenant_id: &str,
        session_id: Uuid,
        limit: i64,
    ) -> Result<Vec<MemoryUnit>> {
        let rows = sqlx::query_as::<_, MemoryUnitRow>(
            r#"
            SELECT
                memory_unit_id, tenant_id, session_id, entry_range_start, entry_range_end,
                memory_kind, domain_class_primary, summary, snippet, source_uri,
                summary_status, salience_score::DOUBLE PRECISION AS salience_score,
                time_bucket, created_at, updated_at
            FROM memory_units
            WHERE tenant_id = $1 AND session_id = $2
            ORDER BY created_at DESC
            LIMIT $3
            "#,
        )
        .bind(tenant_id)
        .bind(session_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        rows.into_iter().map(MemoryUnit::try_from).collect()
    }

    pub async fn list_by_session_and_kind(
        &self,
        tenant_id: &str,
        session_id: Uuid,
        memory_kind: MemoryUnitKind,
    ) -> Result<Vec<MemoryUnit>> {
        let rows = match memory_kind {
            MemoryUnitKind::GenericConversation => {
                sqlx::query_as::<_, MemoryUnitRow>(
                    r#"
                    SELECT
                        memory_unit_id, tenant_id, session_id, entry_range_start, entry_range_end,
                        memory_kind, domain_class_primary, summary, snippet, source_uri,
                        summary_status, salience_score::DOUBLE PRECISION AS salience_score,
                        time_bucket, created_at, updated_at
                    FROM memory_units
                    WHERE tenant_id = $1 AND session_id = $2 AND memory_kind IS NULL
                    ORDER BY created_at DESC
                    "#,
                )
                .bind(tenant_id)
                .bind(session_id)
                .fetch_all(&self.pool)
                .await?
            }
            _ => {
                sqlx::query_as::<_, MemoryUnitRow>(
                    r#"
                    SELECT
                        memory_unit_id, tenant_id, session_id, entry_range_start, entry_range_end,
                        memory_kind, domain_class_primary, summary, snippet, source_uri,
                        summary_status, salience_score::DOUBLE PRECISION AS salience_score,
                        time_bucket, created_at, updated_at
                    FROM memory_units
                    WHERE tenant_id = $1 AND session_id = $2 AND memory_kind = $3
                    ORDER BY created_at DESC
                    "#,
                )
                .bind(tenant_id)
                .bind(session_id)
                .bind(memory_kind.as_db_value())
                .fetch_all(&self.pool)
                .await?
            }
        };

        rows.into_iter().map(MemoryUnit::try_from).collect()
    }

    pub async fn delete_by_id(&self, tenant_id: &str, memory_unit_id: Uuid) -> Result<u64> {
        let result = sqlx::query(
            r#"
            DELETE FROM memory_units
            WHERE tenant_id = $1 AND memory_unit_id = $2
            "#,
        )
        .bind(tenant_id)
        .bind(memory_unit_id)
        .execute(&self.pool)
        .await?;

        Ok(result.rows_affected())
    }
}
