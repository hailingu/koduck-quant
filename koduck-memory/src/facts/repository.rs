use sqlx::PgPool;
use tracing::info;
use uuid::Uuid;

use crate::facts::model::{InsertMemoryFact, MemoryFact};
use crate::Result;

/// DAO for `memory_facts`.
#[derive(Clone)]
pub struct MemoryFactRepository {
    pool: PgPool,
}

impl MemoryFactRepository {
    pub fn new(pool: &PgPool) -> Self {
        Self { pool: pool.clone() }
    }

    pub async fn insert(&self, params: &InsertMemoryFact) -> Result<MemoryFact> {
        let row = sqlx::query_as::<_, MemoryFact>(
            r#"
            INSERT INTO memory_facts (
                id, tenant_id, session_id, fact_type, domain_class, fact_text, confidence, created_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, CAST($7 AS NUMERIC(5, 4)), now()
            )
            RETURNING
                id, tenant_id, session_id, fact_type, domain_class, fact_text,
                confidence::DOUBLE PRECISION AS confidence, created_at
            "#,
        )
        .bind(params.id)
        .bind(&params.tenant_id)
        .bind(params.session_id)
        .bind(&params.fact_type)
        .bind(&params.domain_class)
        .bind(&params.fact_text)
        .bind(params.confidence)
        .fetch_one(&self.pool)
        .await?;

        info!(
            fact_id = %row.id,
            session_id = %row.session_id,
            fact_type = %row.fact_type,
            domain_class = %row.domain_class,
            "memory fact inserted"
        );

        Ok(row)
    }

    pub async fn list_by_session(&self, tenant_id: &str, session_id: Uuid) -> Result<Vec<MemoryFact>> {
        let rows = sqlx::query_as::<_, MemoryFact>(
            r#"
            SELECT
                id, tenant_id, session_id, fact_type, domain_class, fact_text,
                confidence::DOUBLE PRECISION AS confidence, created_at
            FROM memory_facts
            WHERE tenant_id = $1 AND session_id = $2
            ORDER BY created_at DESC
            "#,
        )
        .bind(tenant_id)
        .bind(session_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    pub async fn get_by_id(&self, id: Uuid) -> Result<Option<MemoryFact>> {
        let row = sqlx::query_as::<_, MemoryFact>(
            r#"
            SELECT
                id, tenant_id, session_id, fact_type, domain_class, fact_text,
                confidence::DOUBLE PRECISION AS confidence, created_at
            FROM memory_facts
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row)
    }
}
