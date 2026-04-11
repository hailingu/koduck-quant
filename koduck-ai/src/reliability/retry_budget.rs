use std::{
    sync::atomic::{AtomicU64, Ordering},
    time::{Duration, Instant},
};

use serde::Serialize;
use tracing::info;

use crate::{
    config::RetryBudgetConfig,
    reliability::error::{AppError, ErrorCode},
};

#[derive(Debug, Serialize)]
pub struct RetryBudgetSnapshot {
    pub enabled: bool,
    pub max_retries: u32,
    pub total_timeout_ms: u64,
    pub attempts: u64,
    pub retries: u64,
    pub exhausted: u64,
}

pub struct RetryBudgetPolicy {
    config: RetryBudgetConfig,
    attempts: AtomicU64,
    retries: AtomicU64,
    exhausted: AtomicU64,
}

#[derive(Clone, Debug)]
pub struct RetryBudgetSession {
    started_at: Instant,
}

#[derive(Debug)]
pub enum RetryDirective {
    RetryAfter {
        delay: Duration,
        err: AppError,
    },
    Exhausted(AppError),
    DoNotRetry(AppError),
}

impl RetryBudgetPolicy {
    pub fn new(config: RetryBudgetConfig) -> Self {
        Self {
            config,
            attempts: AtomicU64::new(0),
            retries: AtomicU64::new(0),
            exhausted: AtomicU64::new(0),
        }
    }

    pub fn begin_session(&self) -> RetryBudgetSession {
        RetryBudgetSession {
            started_at: Instant::now(),
        }
    }

    pub fn snapshot(&self) -> RetryBudgetSnapshot {
        RetryBudgetSnapshot {
            enabled: self.config.enabled,
            max_retries: self.config.max_retries,
            total_timeout_ms: self.config.total_timeout_ms,
            attempts: self.attempts.load(Ordering::Relaxed),
            retries: self.retries.load(Ordering::Relaxed),
            exhausted: self.exhausted.load(Ordering::Relaxed),
        }
    }

    pub fn deadline_ms(&self) -> u64 {
        self.config.total_timeout_ms
    }

    pub fn max_total_timeout(&self) -> Duration {
        Duration::from_millis(self.config.total_timeout_ms)
    }

    pub fn next_attempt_deadline_ms(
        &self,
        session: &RetryBudgetSession,
        per_attempt_timeout_ms: u64,
    ) -> Option<u64> {
        let remaining_ms = self.remaining_budget(session)?.as_millis() as u64;
        if remaining_ms == 0 {
            None
        } else {
            Some(remaining_ms.min(per_attempt_timeout_ms))
        }
    }

    pub fn should_retry(
        &self,
        session: &RetryBudgetSession,
        attempt_index: u32,
        err: AppError,
    ) -> RetryDirective {
        self.attempts.fetch_add(1, Ordering::Relaxed);

        if !self.config.enabled {
            return RetryDirective::DoNotRetry(err);
        }

        if !self.is_whitelisted(&err) || !err.retryable {
            return RetryDirective::DoNotRetry(err);
        }

        if attempt_index >= self.config.max_retries {
            return RetryDirective::Exhausted(self.exhausted_error(err, "max retries reached"));
        }

        let remaining = match self.remaining_budget(session) {
            Some(remaining) if !remaining.is_zero() => remaining,
            _ => {
                return RetryDirective::Exhausted(self.exhausted_error(
                    err,
                    "retry timeout budget exhausted",
                ))
            }
        };

        let delay = self.compute_delay(&err, attempt_index);
        if delay >= remaining {
            return RetryDirective::Exhausted(self.exhausted_error(
                err,
                "retry timeout budget exhausted",
            ));
        }

        self.retries.fetch_add(1, Ordering::Relaxed);
        RetryDirective::RetryAfter { delay, err }
    }

    pub fn log_retry(
        &self,
        request_id: &str,
        attempt_index: u32,
        delay: Duration,
        err: &AppError,
    ) {
        info!(
            request_id,
            retry.attempt = attempt_index + 1,
            retry.delay_ms = delay.as_millis() as u64,
            retry.code = %err.code,
            retry.retry_after_ms = ?err.retry_after_ms,
            "retry budget scheduling next attempt"
        );
    }

    fn is_whitelisted(&self, err: &AppError) -> bool {
        let code = err.code.to_string();
        self.config
            .retryable_codes
            .iter()
            .any(|allowed| allowed.eq_ignore_ascii_case(&code))
    }

    fn remaining_budget(&self, session: &RetryBudgetSession) -> Option<Duration> {
        self.max_total_timeout()
            .checked_sub(session.started_at.elapsed())
    }

    fn compute_delay(&self, err: &AppError, attempt_index: u32) -> Duration {
        if matches!(err.code, ErrorCode::RateLimited) {
            if let Some(retry_after_ms) = err.retry_after_ms {
                return Duration::from_millis(retry_after_ms);
            }
        }

        let multiplier = 1u64 << attempt_index.min(10);
        let delay_ms = (self.config.base_backoff_ms.saturating_mul(multiplier))
            .min(self.config.max_backoff_ms);
        Duration::from_millis(delay_ms)
    }

    fn exhausted_error(&self, mut err: AppError, message: &'static str) -> AppError {
        self.exhausted.fetch_add(1, Ordering::Relaxed);
        err.message = message.to_string();
        err.retryable = false;
        err
    }
}

#[cfg(test)]
mod tests {
    use std::time::{Duration, Instant};

    use super::{RetryBudgetPolicy, RetryBudgetSession, RetryDirective};
    use crate::{
        config::RetryBudgetConfig,
        reliability::error::{AppError, ErrorCode},
    };

    #[test]
    fn retries_only_whitelisted_retryable_errors() {
        let policy = RetryBudgetPolicy::new(RetryBudgetConfig::default());
        let session = policy.begin_session();

        let directive = policy.should_retry(
            &session,
            0,
            AppError::new(ErrorCode::InvalidArgument, "bad request"),
        );

        assert!(matches!(directive, RetryDirective::DoNotRetry(_)));
    }

    #[test]
    fn rate_limited_prefers_retry_after_hint() {
        let policy = RetryBudgetPolicy::new(RetryBudgetConfig::default());
        let session = policy.begin_session();
        let err = AppError::new(ErrorCode::RateLimited, "throttled").with_retry_after_ms(1_500);

        let directive = policy.should_retry(&session, 0, err);

        match directive {
            RetryDirective::RetryAfter { delay, err } => {
                assert_eq!(delay, Duration::from_millis(1_500));
                assert_eq!(err.code, ErrorCode::RateLimited);
                assert_eq!(err.retry_after_ms, Some(1_500));
            }
            other => panic!("expected retry, got {other:?}"),
        }
    }

    #[test]
    fn budget_exhaustion_fails_fast() {
        let policy = RetryBudgetPolicy::new(RetryBudgetConfig {
            total_timeout_ms: 100,
            ..RetryBudgetConfig::default()
        });
        let session = RetryBudgetSession {
            started_at: Instant::now() - Duration::from_millis(95),
        };

        let directive = policy.should_retry(
            &session,
            0,
            AppError::new(ErrorCode::UpstreamUnavailable, "timeout"),
        );

        match directive {
            RetryDirective::Exhausted(err) => {
                assert!(!err.retryable);
                assert!(err.message.contains("budget exhausted"));
            }
            other => panic!("expected exhaustion, got {other:?}"),
        }
    }

    #[test]
    fn exponential_backoff_is_capped() {
        let policy = RetryBudgetPolicy::new(RetryBudgetConfig {
            max_retries: 3,
            base_backoff_ms: 200,
            max_backoff_ms: 500,
            ..RetryBudgetConfig::default()
        });
        let session = policy.begin_session();
        let directive = policy.should_retry(
            &session,
            2,
            AppError::new(ErrorCode::UpstreamUnavailable, "timeout"),
        );

        match directive {
            RetryDirective::RetryAfter { delay, err } => {
                assert_eq!(delay, Duration::from_millis(500));
                assert_eq!(err.code, ErrorCode::UpstreamUnavailable);
            }
            other => panic!("expected retry, got {other:?}"),
        }
    }

    #[test]
    fn reaching_max_retries_stops_retrying() {
        let policy = RetryBudgetPolicy::new(RetryBudgetConfig {
            max_retries: 1,
            ..RetryBudgetConfig::default()
        });
        let session = policy.begin_session();
        let directive = policy.should_retry(
            &session,
            1,
            AppError::new(ErrorCode::ServerBusy, "busy"),
        );

        assert!(matches!(directive, RetryDirective::Exhausted(_)));
    }
}
