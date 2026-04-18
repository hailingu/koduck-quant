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
    let directive = policy.should_retry(&session, 1, AppError::new(ErrorCode::ServerBusy, "busy"));

    assert!(matches!(directive, RetryDirective::Exhausted(_)));
}
