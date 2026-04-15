use sqlx::PgPool;
use tracing::info;
use uuid::Uuid;

use crate::session::model::{Session, UpsertSession};
use crate::Result;

/// DAO for `memory_sessions` table.
#[derive(Clone)]
pub struct SessionRepository {
    pool: PgPool,
}

impl SessionRepository {
    pub fn new(pool: &PgPool) -> Self {
        Self {
            pool: pool.clone(),
        }
    }

    /// Get a session by tenant_id + session_id. Returns `None` if not found.
    pub async fn get_by_id(
        &self,
        tenant_id: &str,
        session_id: Uuid,
    ) -> Result<Option<Session>> {
        let row = sqlx::query_as::<_, Session>(
            r#"
            SELECT session_id, tenant_id, user_id,
                   parent_session_id, forked_from_session_id,
                   title, status, created_at, updated_at, last_message_at,
                   extra_json AS extra
            FROM memory_sessions
            WHERE tenant_id = $1 AND session_id = $2
            "#,
        )
        .bind(tenant_id)
        .bind(session_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row)
    }

    /// Create or update a session. Uses `ON CONFLICT (session_id) DO UPDATE` for idempotent upsert.
    ///
    /// - On INSERT: sets `created_at` and `updated_at` to `now()`.
    /// - On UPDATE: preserves original `created_at`, refreshes `updated_at`.
    pub async fn upsert(&self, params: &UpsertSession) -> Result<Session> {
        let row = sqlx::query_as::<_, Session>(
            r#"
            INSERT INTO memory_sessions (
                session_id, tenant_id, user_id,
                parent_session_id, forked_from_session_id,
                title, status, created_at, updated_at, last_message_at,
                extra_json
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                now(), now(), $8, $9
            )
            ON CONFLICT (session_id) DO UPDATE SET
                tenant_id = EXCLUDED.tenant_id,
                user_id = EXCLUDED.user_id,
                parent_session_id = EXCLUDED.parent_session_id,
                forked_from_session_id = EXCLUDED.forked_from_session_id,
                title = EXCLUDED.title,
                status = EXCLUDED.status,
                updated_at = now(),
                last_message_at = EXCLUDED.last_message_at,
                extra_json = EXCLUDED.extra_json
            RETURNING session_id, tenant_id, user_id,
                      parent_session_id, forked_from_session_id,
                      title, status, created_at, updated_at, last_message_at,
                      extra_json AS extra
            "#,
        )
        .bind(params.session_id)
        .bind(&params.tenant_id)
        .bind(&params.user_id)
        .bind(params.parent_session_id)
        .bind(params.forked_from_session_id)
        .bind(&params.title)
        .bind(&params.status)
        .bind(params.last_message_at)
        .bind(&params.extra)
        .fetch_one(&self.pool)
        .await?;

        info!(
            session_id = %row.session_id,
            tenant_id = %row.tenant_id,
            "session upserted"
        );

        Ok(row)
    }

    /// List all session ids for a tenant, newest updated first.
    pub async fn list_all_session_ids(&self, tenant_id: &str, limit: i64) -> Result<Vec<Uuid>> {
        let rows = sqlx::query_scalar::<_, Uuid>(
            r#"
            SELECT session_id
            FROM memory_sessions
            WHERE tenant_id = $1
            ORDER BY updated_at DESC, session_id
            LIMIT $2
            "#,
        )
        .bind(tenant_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }
}
