use sqlx::PgPool;
use tracing::info;
use uuid::Uuid;

use crate::index::model::{InsertMemoryIndexRecord, MemoryIndexRecord};
use crate::Result;

/// DAO for `memory_index_records` table.
#[derive(Clone)]
pub struct MemoryIndexRepository {
    pool: PgPool,
}

impl MemoryIndexRepository {
    pub fn new(pool: &PgPool) -> Self {
        Self {
            pool: pool.clone(),
        }
    }

    /// Insert a single memory index record.
    ///
    /// Returns the inserted record with generated timestamps.
    pub async fn insert(&self, record: &InsertMemoryIndexRecord) -> Result<MemoryIndexRecord> {
        let row = sqlx::query_as::<_, MemoryIndexRecord>(
            r#"
            INSERT INTO memory_index_records (
                id, tenant_id, session_id, memory_unit_id, entry_id,
                memory_kind, domain_class, summary, snippet,
                source_uri, score_hint, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CAST($11 AS NUMERIC), now(), now()
            )
            RETURNING 
                id, tenant_id, session_id, memory_unit_id, entry_id,
                memory_kind, domain_class, summary, snippet,
                source_uri, score_hint::text AS score_hint,
                created_at, updated_at
            "#,
        )
        .bind(record.id)
        .bind(&record.tenant_id)
        .bind(record.session_id)
        .bind(record.memory_unit_id)
        .bind(record.entry_id)
        .bind(&record.memory_kind)
        .bind(&record.domain_class)
        .bind(&record.summary)
        .bind(&record.snippet)
        .bind(&record.source_uri)
        .bind(&record.score_hint)
        .fetch_one(&self.pool)
        .await?;

        info!(
            record_id = %row.id,
            session_id = %row.session_id,
            memory_kind = %row.memory_kind,
            domain_class = %row.domain_class,
            "memory index record inserted"
        );

        Ok(row)
    }

    /// List index records by tenant_id + domain_class.
    ///
    /// Used for DOMAIN_FIRST retrieval strategy.
    /// Results are ordered by updated_at DESC (most recent first).
    pub async fn list_by_domain(
        &self,
        tenant_id: &str,
        domain_class: &str,
        limit: i64,
    ) -> Result<Vec<MemoryIndexRecord>> {
        let rows = sqlx::query_as::<_, MemoryIndexRecord>(
            r#"
            SELECT 
                id, tenant_id, session_id, memory_unit_id, entry_id,
                memory_kind, domain_class, summary, snippet,
                source_uri, score_hint::text AS score_hint,
                created_at, updated_at
            FROM memory_index_records
            WHERE tenant_id = $1
              AND domain_class = $2
              AND memory_kind = 'summary'
            ORDER BY updated_at DESC
            LIMIT $3
            "#,
        )
        .bind(tenant_id)
        .bind(domain_class)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    /// List index records by tenant_id + session_id + optional domain_class.
    ///
    /// Used for session-scoped memory retrieval.
    /// Results are ordered by updated_at DESC (most recent first).
    pub async fn list_by_session(
        &self,
        tenant_id: &str,
        session_id: Uuid,
        domain_class: Option<&str>,
        limit: i64,
    ) -> Result<Vec<MemoryIndexRecord>> {
        let rows = if let Some(dc) = domain_class {
            sqlx::query_as::<_, MemoryIndexRecord>(
                r#"
                SELECT 
                    id, tenant_id, session_id, memory_unit_id, entry_id,
                    memory_kind, domain_class, summary, snippet,
                    source_uri, score_hint::text AS score_hint,
                    created_at, updated_at
                FROM memory_index_records
                WHERE tenant_id = $1
                  AND session_id = $2
                  AND domain_class = $3
                  AND memory_kind = 'summary'
                ORDER BY updated_at DESC
                LIMIT $4
                "#,
            )
            .bind(tenant_id)
            .bind(session_id)
            .bind(dc)
            .bind(limit)
            .fetch_all(&self.pool)
            .await?
        } else {
            sqlx::query_as::<_, MemoryIndexRecord>(
                r#"
                SELECT 
                    id, tenant_id, session_id, memory_unit_id, entry_id,
                    memory_kind, domain_class, summary, snippet,
                    source_uri, score_hint::text AS score_hint,
                    created_at, updated_at
                FROM memory_index_records
                WHERE tenant_id = $1
                  AND session_id = $2
                  AND memory_kind = 'summary'
                ORDER BY updated_at DESC
                LIMIT $3
                "#,
            )
            .bind(tenant_id)
            .bind(session_id)
            .bind(limit)
            .fetch_all(&self.pool)
            .await?
        };

        Ok(rows)
    }

    /// List recent summary index records across all sessions for a tenant.
    ///
    /// Used by explicit recall-intent queries that should review global session summaries
    /// instead of running anchor-based retrieval.
    pub async fn list_recent_summaries(
        &self,
        tenant_id: &str,
        limit: i64,
    ) -> Result<Vec<MemoryIndexRecord>> {
        let rows = sqlx::query_as::<_, MemoryIndexRecord>(
            r#"
            SELECT
                id, tenant_id, session_id, memory_unit_id, entry_id,
                memory_kind, domain_class, summary, snippet,
                source_uri, score_hint::text AS score_hint,
                created_at, updated_at
            FROM memory_index_records
            WHERE tenant_id = $1
              AND memory_kind = 'summary'
            ORDER BY updated_at DESC
            LIMIT $2
            "#,
        )
        .bind(tenant_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    /// Search index records by tenant_id + domain_class + summary text match.
    ///
    /// Used for SUMMARY_FIRST retrieval strategy.
    /// Uses PostgreSQL full-text search on summary field.
    /// Results are ordered by updated_at DESC.
    pub async fn search_by_summary(
        &self,
        tenant_id: &str,
        domain_class: &str,
        query_text: &str,
        limit: i64,
    ) -> Result<Vec<MemoryIndexRecord>> {
        let like_query = format!("%{}%", query_text.trim());
        
        let rows = sqlx::query_as::<_, MemoryIndexRecord>(
            r#"
            SELECT 
                id, tenant_id, session_id, memory_unit_id, entry_id,
                memory_kind, domain_class, summary, snippet,
                source_uri, score_hint::text AS score_hint,
                created_at, updated_at
            FROM memory_index_records
            WHERE tenant_id = $1 
              AND domain_class = $2
              AND memory_kind = 'summary'
              AND (
                    to_tsvector('simple', summary) @@ plainto_tsquery('simple', $3)
                 OR summary ILIKE $4
                 OR COALESCE(snippet, '') ILIKE $4
              )
            ORDER BY updated_at DESC
            LIMIT $5
            "#,
        )
        .bind(tenant_id)
        .bind(domain_class)
        .bind(query_text.trim())
        .bind(&like_query)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    /// Search index records by tenant_id + optional session_id + domain_class + summary text match.
    ///
    /// Used for session-scoped SUMMARY_FIRST retrieval strategy so summary filtering
    /// stays inside the already selected domain/session candidate set.
    pub async fn search_by_summary_in_scope(
        &self,
        tenant_id: &str,
        session_id: Option<Uuid>,
        domain_class: &str,
        query_text: &str,
        limit: i64,
    ) -> Result<Vec<MemoryIndexRecord>> {
        let like_query = format!("%{}%", query_text.trim());
        let normalized_domain_class = domain_class.trim();

        let rows = if let Some(session_id) = session_id {
            if normalized_domain_class.is_empty() {
                sqlx::query_as::<_, MemoryIndexRecord>(
                    r#"
                    SELECT
                        id, tenant_id, session_id, memory_unit_id, entry_id,
                        memory_kind, domain_class, summary, snippet,
                        source_uri, score_hint::text AS score_hint,
                        created_at, updated_at
                    FROM memory_index_records
                    WHERE tenant_id = $1
                      AND session_id = $2
                      AND memory_kind = 'summary'
                      AND (
                            to_tsvector('simple', summary) @@ plainto_tsquery('simple', $3)
                         OR summary ILIKE $4
                         OR COALESCE(snippet, '') ILIKE $4
                      )
                    ORDER BY updated_at DESC
                    LIMIT $5
                    "#,
                )
                .bind(tenant_id)
                .bind(session_id)
                .bind(query_text.trim())
                .bind(&like_query)
                .bind(limit)
                .fetch_all(&self.pool)
                .await?
            } else {
                sqlx::query_as::<_, MemoryIndexRecord>(
                    r#"
                    SELECT
                        id, tenant_id, session_id, memory_unit_id, entry_id,
                        memory_kind, domain_class, summary, snippet,
                        source_uri, score_hint::text AS score_hint,
                        created_at, updated_at
                    FROM memory_index_records
                    WHERE tenant_id = $1
                      AND session_id = $2
                      AND domain_class = $3
                      AND memory_kind = 'summary'
                      AND (
                            to_tsvector('simple', summary) @@ plainto_tsquery('simple', $4)
                         OR summary ILIKE $5
                         OR COALESCE(snippet, '') ILIKE $5
                      )
                    ORDER BY updated_at DESC
                    LIMIT $6
                    "#,
                )
                .bind(tenant_id)
                .bind(session_id)
                .bind(normalized_domain_class)
                .bind(query_text.trim())
                .bind(&like_query)
                .bind(limit)
                .fetch_all(&self.pool)
                .await?
            }
        } else {
            if normalized_domain_class.is_empty() {
                Vec::new()
            } else {
                self.search_by_summary(tenant_id, normalized_domain_class, query_text, limit)
                    .await?
            }
        };

        Ok(rows)
    }

    /// Get a single record by ID.
    pub async fn get_by_id(&self, id: Uuid) -> Result<Option<MemoryIndexRecord>> {
        let row = sqlx::query_as::<_, MemoryIndexRecord>(
            r#"
                SELECT
                    id, tenant_id, session_id, memory_unit_id, entry_id,
                    memory_kind, domain_class, summary, snippet,
                    source_uri, score_hint::text AS score_hint,
                    created_at, updated_at
                FROM memory_index_records
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row)
    }

    /// Delete records by session_id (useful for session cleanup).
    pub async fn delete_by_session(
        &self,
        tenant_id: &str,
        session_id: Uuid,
    ) -> Result<u64> {
        let result = sqlx::query(
            r#"
            DELETE FROM memory_index_records
            WHERE tenant_id = $1 AND session_id = $2
            "#,
        )
        .bind(tenant_id)
        .bind(session_id)
        .execute(&self.pool)
        .await?;

        let deleted = result.rows_affected();
        info!(
            session_id = %session_id,
            deleted_count = deleted,
            "memory index records deleted for session"
        );

        Ok(deleted)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Note: Integration tests would require a test database.
    // For now, we verify the repository structure compiles correctly.

    #[test]
    fn repository_new_works() {
        // This is a compile-time check
        // Actual functionality requires a database connection
    }
}
