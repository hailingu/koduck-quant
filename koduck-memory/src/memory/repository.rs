use sqlx::PgPool;
use tracing::info;
use uuid::Uuid;

use crate::memory::model::{InsertMemoryEntry, MemoryEntry};
use crate::Result;

/// DAO for `memory_entries` table.
#[derive(Clone)]
pub struct MemoryEntryRepository {
    pool: PgPool,
}

impl MemoryEntryRepository {
    pub fn new(pool: &PgPool) -> Self {
        Self {
            pool: pool.clone(),
        }
    }

    /// Get the current max `sequence_num` for a given session.
    /// Returns 0 if no entries exist for the session.
    ///
    /// Callers that need concurrency-safe allocation should take a transaction-scoped
    /// advisory lock before invoking this query.
    pub async fn get_max_sequence_num(
        &self,
        tenant_id: &str,
        session_id: Uuid,
    ) -> Result<i64> {
        let max_seq = sqlx::query_scalar::<_, i64>(
            r#"
            SELECT COALESCE(MAX(sequence_num), 0)
            FROM memory_entries
            WHERE tenant_id = $1 AND session_id = $2
            "#,
        )
        .bind(tenant_id)
        .bind(session_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(max_seq)
    }

    /// Insert a single memory entry.
    ///
    /// Relies on DB UNIQUE constraint `(tenant_id, session_id, sequence_num)`
    /// to reject duplicate sequence numbers.
    pub async fn insert(&self, entry: &InsertMemoryEntry) -> Result<MemoryEntry> {
        let row = sqlx::query_as::<_, MemoryEntry>(
            r#"
            INSERT INTO memory_entries (
                id, tenant_id, session_id, sequence_num,
                role, raw_content_ref, message_ts, metadata_json,
                l0_uri, created_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, now()
            )
            RETURNING id, tenant_id, session_id, sequence_num,
                      role, raw_content_ref, message_ts,
                      metadata_json,
                      l0_uri, created_at
            "#,
        )
        .bind(entry.id)
        .bind(&entry.tenant_id)
        .bind(entry.session_id)
        .bind(entry.sequence_num)
        .bind(&entry.role)
        .bind(&entry.raw_content_ref)
        .bind(entry.message_ts)
        .bind(&entry.metadata_json)
        .bind(&entry.l0_uri)
        .fetch_one(&self.pool)
        .await?;

        info!(
            entry_id = %row.id,
            session_id = %row.session_id,
            sequence_num = row.sequence_num,
            role = %row.role,
            "memory entry inserted"
        );

        Ok(row)
    }

    /// List entries by tenant_id + session_id, optionally filtered by a minimum created_at timestamp.
    /// Results are ordered by created_at DESC.
    pub async fn list_by_session(
        &self,
        tenant_id: &str,
        session_id: Uuid,
        since: Option<chrono::DateTime<chrono::Utc>>,
    ) -> Result<Vec<MemoryEntry>> {
        let rows = if let Some(since_ts) = since {
            sqlx::query_as::<_, MemoryEntry>(
                r#"
                SELECT id, tenant_id, session_id, sequence_num,
                       role, raw_content_ref, message_ts,
                       metadata_json,
                       l0_uri, created_at
                FROM memory_entries
                WHERE tenant_id = $1 AND session_id = $2 AND created_at >= $3
                ORDER BY created_at DESC
                "#,
            )
            .bind(tenant_id)
            .bind(session_id)
            .bind(since_ts)
            .fetch_all(&self.pool)
            .await?
        } else {
            sqlx::query_as::<_, MemoryEntry>(
                r#"
                SELECT id, tenant_id, session_id, sequence_num,
                       role, raw_content_ref, message_ts,
                       metadata_json,
                       l0_uri, created_at
                FROM memory_entries
                WHERE tenant_id = $1 AND session_id = $2
                ORDER BY created_at DESC
                "#,
            )
            .bind(tenant_id)
            .bind(session_id)
            .fetch_all(&self.pool)
            .await?
        };

        Ok(rows)
    }
}
