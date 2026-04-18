use super::{DegradePolicy, DegradeReason, DegradeRoute};
use crate::{
    config::DegradeConfig,
    reliability::error::{AppError, ErrorCode},
};

#[test]
fn evaluates_only_when_global_and_route_switches_are_on() {
    let policy = DegradePolicy::new(DegradeConfig {
        enabled: true,
        chat_enabled: true,
        chat_stream_enabled: false,
        ..DegradeConfig::default()
    });

    assert!(policy
        .evaluate(DegradeRoute::Chat, DegradeReason::UpstreamTimeout)
        .is_some());
    assert!(policy
        .evaluate(DegradeRoute::ChatStream, DegradeReason::UpstreamTimeout)
        .is_none());
}

#[test]
fn supports_all_required_trigger_reasons() {
    let policy = DegradePolicy::new(DegradeConfig {
        enabled: true,
        chat_enabled: true,
        chat_stream_enabled: true,
        ..DegradeConfig::default()
    });

    assert!(policy
        .evaluate(DegradeRoute::Chat, DegradeReason::UpstreamTimeout)
        .is_some());
    assert!(policy
        .evaluate(DegradeRoute::Chat, DegradeReason::BudgetExhausted)
        .is_some());
    assert!(policy
        .evaluate(DegradeRoute::Chat, DegradeReason::CircuitOpen)
        .is_some());
}

#[test]
fn classifies_retry_budget_and_circuit_like_errors() {
    let policy = DegradePolicy::new(DegradeConfig::default());

    assert_eq!(
        policy.classify_error(&AppError::new(ErrorCode::RateLimited, "retry budget exhausted")),
        Some(DegradeReason::BudgetExhausted)
    );
    assert_eq!(
        policy.classify_error(&AppError::new(ErrorCode::ServerBusy, "circuit open")),
        Some(DegradeReason::CircuitOpen)
    );
}

#[test]
fn snapshot_exposes_hit_rate() {
    let policy = DegradePolicy::new(DegradeConfig {
        enabled: true,
        chat_enabled: true,
        chat_stream_enabled: true,
        ..DegradeConfig::default()
    });

    policy.record_request(DegradeRoute::Chat);
    policy.record_request(DegradeRoute::Chat);
    policy
        .evaluate(DegradeRoute::Chat, DegradeReason::UpstreamTimeout)
        .unwrap();

    let snapshot = policy.snapshot();
    assert_eq!(snapshot.requests.chat, 2);
    assert_eq!(snapshot.hits.chat.hits, 1);
    assert_eq!(snapshot.hits.reasons.upstream_timeout, 1);
    assert!((snapshot.hits.chat.hit_rate - 0.5).abs() < f64::EPSILON);
}

#[test]
fn non_degradable_errors_do_not_fallback() {
    let policy = DegradePolicy::new(DegradeConfig {
        enabled: true,
        chat_enabled: true,
        chat_stream_enabled: true,
        ..DegradeConfig::default()
    });

    let err = AppError::new(ErrorCode::InvalidArgument, "bad request");
    assert!(policy.evaluate_error(DegradeRoute::Chat, &err).is_none());
}
