//! Retry with exponential backoff and persistent failure recording.

mod repository;

pub use repository::{TaskAttempt, TaskAttemptRepository};

use std::future::Future;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::config::RetrySection;
use crate::observe;
use crate::Result;

/// Execute an async operation with exponential backoff retry and persistent failure recording.
///
/// On each attempt, a `running` record is written to `memory_task_attempts`.
/// On success, the record is updated to `succeeded`.
/// After all retries are exhausted, the final record is updated to `failed`.
pub async fn with_retry<F, Fut, T>(
    task_type: &str,
    tenant_id: &str,
    session_id: uuid::Uuid,
    request_id: &str,
    attempt_repo: &TaskAttemptRepository,
    retry_config: &RetrySection,
    operation: F,
) -> Result<T>
where
    F: Fn() -> Fut,
    Fut: Future<Output = Result<T>>,
{
    let max_attempts = retry_config.max_attempts as usize;
    let initial_delay = Duration::from_millis(retry_config.initial_delay_ms);

    let mut last_error = String::new();

    for attempt in 1..=max_attempts {
        // Record attempt start
        let attempt_id = attempt_repo
            .insert_attempt(tenant_id, session_id, task_type, attempt as i32, request_id)
            .await
            .unwrap_or_else(|e| {
                warn!(
                    error = %e,
                    attempt,
                    task_type,
                    "failed to record task attempt, continuing anyway"
                );
                uuid::Uuid::nil()
            });

        match operation().await {
            Ok(result) => {
                attempt_repo
                    .mark_succeeded(attempt_id)
                    .await
                    .unwrap_or_else(|e| {
                        warn!(error = %e, attempt_id = %attempt_id, "failed to mark attempt as succeeded");
                    });

                if attempt > 1 {
                    observe::inc_retry_counter();
                    info!(
                        task_type,
                        tenant_id,
                        session_id = %session_id,
                        attempt,
                        "task succeeded after retry"
                    );
                }

                return Ok(result);
            }
            Err(error) => {
                last_error = error.to_string();
                debug!(
                    task_type,
                    tenant_id,
                    session_id = %session_id,
                    attempt,
                    error = %last_error,
                    "task attempt failed"
                );

                if attempt < max_attempts {
                    let delay = initial_delay * 2u32.pow((attempt - 1) as u32);
                    tokio::time::sleep(delay).await;
                }
            }
        }
    }

    // All retries exhausted — mark final attempt as failed
    let final_attempt_id = attempt_repo
        .insert_attempt(
            tenant_id,
            session_id,
            task_type,
            max_attempts as i32,
            request_id,
        )
        .await
        .unwrap_or(uuid::Uuid::nil());

    attempt_repo
        .mark_failed(final_attempt_id, &last_error)
        .await
        .unwrap_or_else(|e| {
            warn!(error = %e, "failed to record task failure");
        });

    warn!(
        task_type,
        tenant_id,
        session_id = %session_id,
        max_attempts,
        error = %last_error,
        "task failed after all retries exhausted"
    );

    observe::inc_failure_counter();

    Err(anyhow::anyhow!(
        "{task_type} task failed after {max_attempts} attempts: {last_error}"
    ))
}
