use sqlx::PgPool;
use uuid::Uuid;

use crate::Result;

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct TaskAttempt {
    pub id: Uuid,
    pub tenant_id: String,
    pub session_id: Uuid,
    pub task_type: String,
    pub attempt: i32,
    pub status: String,
    pub error_message: Option<String>,
    pub request_id: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Clone)]
pub struct TaskAttemptRepository {
    pool: PgPool,
}

impl TaskAttemptRepository {
    pub fn new(pool: &PgPool) -> Self {
        Self {
            pool: pool.clone(),
        }
    }

    pub async fn insert_attempt(
        &self,
        tenant_id: &str,
        session_id: Uuid,
        task_type: &str,
        attempt: i32,
        request_id: &str,
    ) -> Result<Uuid> {
        let id = Uuid::new_v4();
        sqlx::query(
            r#"
            INSERT INTO memory_task_attempts (
                id, tenant_id, session_id, task_type, attempt,
                status, request_id, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, 'running', $6, now(), now())
            "#,
        )
        .bind(id)
        .bind(tenant_id)
        .bind(session_id)
        .bind(task_type)
        .bind(attempt)
        .bind(request_id)
        .execute(&self.pool)
        .await?;

        Ok(id)
    }

    pub async fn mark_succeeded(&self, id: Uuid) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE memory_task_attempts
            SET status = 'succeeded', updated_at = now()
            WHERE id = $1
            "#,
        )
        .bind(id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn mark_failed(&self, id: Uuid, error_message: &str) -> Result<()> {
        let truncated = truncate_error(error_message, 2000);
        sqlx::query(
            r#"
            UPDATE memory_task_attempts
            SET status = 'failed', error_message = $2, updated_at = now()
            WHERE id = $1
            "#,
        )
        .bind(id)
        .bind(&truncated)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn list_failed(
        &self,
        task_type: Option<&str>,
        limit: i64,
    ) -> Result<Vec<TaskAttempt>> {
        let rows = if let Some(task_type) = task_type {
            sqlx::query_as::<_, TaskAttempt>(
                r#"
                SELECT id, tenant_id, session_id, task_type, attempt, status,
                       error_message, request_id, created_at, updated_at
                FROM memory_task_attempts
                WHERE status = 'failed' AND task_type = $1
                ORDER BY created_at DESC
                LIMIT $2
                "#,
            )
            .bind(task_type)
            .bind(limit)
            .fetch_all(&self.pool)
            .await?
        } else {
            sqlx::query_as::<_, TaskAttempt>(
                r#"
                SELECT id, tenant_id, session_id, task_type, attempt, status,
                       error_message, request_id, created_at, updated_at
                FROM memory_task_attempts
                WHERE status = 'failed'
                ORDER BY created_at DESC
                LIMIT $1
                "#,
            )
            .bind(limit)
            .fetch_all(&self.pool)
            .await?
        };

        Ok(rows)
    }

    pub async fn list_by_request_id(&self, request_id: &str) -> Result<Vec<TaskAttempt>> {
        let rows = sqlx::query_as::<_, TaskAttempt>(
            r#"
            SELECT id, tenant_id, session_id, task_type, attempt, status,
                   error_message, request_id, created_at, updated_at
            FROM memory_task_attempts
            WHERE request_id = $1
            ORDER BY created_at ASC
            "#,
        )
        .bind(request_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }
}

fn truncate_error(error: &str, max_len: usize) -> String {
    if error.len() <= max_len {
        error.to_string()
    } else {
        let end = error
            .char_indices()
            .nth(max_len)
            .map(|(i, _)| i)
            .unwrap_or(error.len());
        format!("{}...", &error[..end])
    }
}
