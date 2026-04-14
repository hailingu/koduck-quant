use sqlx::PgPool;
use tracing::info;
use uuid::Uuid;

use crate::Result;
use crate::memory_anchor::model::{
    InsertMemoryUnitAnchor,
    MemoryUnitAnchor,
    MemoryUnitAnchorRow,
    MemoryUnitAnchorType,
};

#[derive(Clone)]
pub struct MemoryUnitAnchorRepository {
    pool: PgPool,
}

impl MemoryUnitAnchorRepository {
    pub fn new(pool: &PgPool) -> Self {
        Self { pool: pool.clone() }
    }

    pub async fn insert(&self, params: &InsertMemoryUnitAnchor) -> Result<MemoryUnitAnchor> {
        let row = sqlx::query_as::<_, MemoryUnitAnchorRow>(
            r#"
            INSERT INTO memory_unit_anchors (
                id, memory_unit_id, tenant_id, anchor_type, anchor_key,
                anchor_value, weight, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, CAST($7 AS NUMERIC(5, 4)), now(), now()
            )
            RETURNING
                id, memory_unit_id, tenant_id, anchor_type, anchor_key,
                anchor_value, weight::DOUBLE PRECISION AS weight, created_at, updated_at
            "#,
        )
        .bind(params.id)
        .bind(params.memory_unit_id)
        .bind(&params.tenant_id)
        .bind(params.anchor_type.as_db_value())
        .bind(&params.anchor_key)
        .bind(&params.anchor_value)
        .bind(params.weight)
        .fetch_one(&self.pool)
        .await?;

        let model = MemoryUnitAnchor::try_from(row)?;
        info!(
            anchor_id = %model.id,
            memory_unit_id = %model.memory_unit_id,
            anchor_type = params.anchor_type.as_db_value(),
            "memory unit anchor inserted"
        );
        Ok(model)
    }

    pub async fn list_by_memory_unit(
        &self,
        tenant_id: &str,
        memory_unit_id: Uuid,
    ) -> Result<Vec<MemoryUnitAnchor>> {
        let rows = sqlx::query_as::<_, MemoryUnitAnchorRow>(
            r#"
            SELECT
                id, memory_unit_id, tenant_id, anchor_type, anchor_key,
                anchor_value, weight::DOUBLE PRECISION AS weight,
                created_at, updated_at
            FROM memory_unit_anchors
            WHERE tenant_id = $1 AND memory_unit_id = $2
            ORDER BY anchor_type ASC, weight DESC, anchor_key ASC
            "#,
        )
        .bind(tenant_id)
        .bind(memory_unit_id)
        .fetch_all(&self.pool)
        .await?;

        rows.into_iter().map(MemoryUnitAnchor::try_from).collect()
    }

    pub async fn list_by_anchor(
        &self,
        tenant_id: &str,
        anchor_type: MemoryUnitAnchorType,
        anchor_key: &str,
        limit: i64,
    ) -> Result<Vec<MemoryUnitAnchor>> {
        let rows = sqlx::query_as::<_, MemoryUnitAnchorRow>(
            r#"
            SELECT
                id, memory_unit_id, tenant_id, anchor_type, anchor_key,
                anchor_value, weight::DOUBLE PRECISION AS weight,
                created_at, updated_at
            FROM memory_unit_anchors
            WHERE tenant_id = $1
              AND anchor_type = $2
              AND anchor_key = $3
            ORDER BY weight DESC, anchor_key ASC, created_at DESC
            LIMIT $4
            "#,
        )
        .bind(tenant_id)
        .bind(anchor_type.as_db_value())
        .bind(anchor_key)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        rows.into_iter().map(MemoryUnitAnchor::try_from).collect()
    }

    pub async fn delete_by_memory_unit(&self, tenant_id: &str, memory_unit_id: Uuid) -> Result<u64> {
        let result = sqlx::query(
            r#"
            DELETE FROM memory_unit_anchors
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
