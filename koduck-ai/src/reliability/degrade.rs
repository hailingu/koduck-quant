use std::sync::atomic::{AtomicU64, Ordering};

use serde::Serialize;
use strum::{Display, IntoStaticStr};
use tracing::info;

use crate::{
    config::DegradeConfig,
    reliability::error::{AppError, ErrorCode},
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Display, IntoStaticStr, Serialize)]
#[strum(serialize_all = "snake_case")]
pub enum DegradeRoute {
    Chat,
    ChatStream,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Display, IntoStaticStr, Serialize)]
#[strum(serialize_all = "snake_case")]
pub enum DegradeReason {
    UpstreamTimeout,
    BudgetExhausted,
    CircuitOpen,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DegradeDecision {
    pub route: DegradeRoute,
    pub reason: DegradeReason,
}

#[derive(Debug, Serialize)]
pub struct DegradeSnapshot {
    pub enabled: bool,
    pub routes: DegradeRouteConfigSnapshot,
    pub requests: DegradeRequestSnapshot,
    pub hits: DegradeHitSnapshot,
}

#[derive(Debug, Serialize)]
pub struct DegradeRouteConfigSnapshot {
    pub chat_enabled: bool,
    pub chat_stream_enabled: bool,
}

#[derive(Debug, Serialize)]
pub struct DegradeRequestSnapshot {
    pub chat: u64,
    pub chat_stream: u64,
}

#[derive(Debug, Serialize)]
pub struct DegradeHitSnapshot {
    pub total: u64,
    pub chat: DegradeRouteHitSnapshot,
    pub chat_stream: DegradeRouteHitSnapshot,
    pub reasons: DegradeReasonHitSnapshot,
}

#[derive(Debug, Serialize)]
pub struct DegradeRouteHitSnapshot {
    pub hits: u64,
    pub hit_rate: f64,
}

#[derive(Debug, Serialize)]
pub struct DegradeReasonHitSnapshot {
    pub upstream_timeout: u64,
    pub budget_exhausted: u64,
    pub circuit_open: u64,
}

pub struct DegradePolicy {
    config: DegradeConfig,
    requests_chat: AtomicU64,
    requests_chat_stream: AtomicU64,
    hits_chat: AtomicU64,
    hits_chat_stream: AtomicU64,
    hits_upstream_timeout: AtomicU64,
    hits_budget_exhausted: AtomicU64,
    hits_circuit_open: AtomicU64,
}

impl DegradePolicy {
    pub fn new(config: DegradeConfig) -> Self {
        Self {
            config,
            requests_chat: AtomicU64::new(0),
            requests_chat_stream: AtomicU64::new(0),
            hits_chat: AtomicU64::new(0),
            hits_chat_stream: AtomicU64::new(0),
            hits_upstream_timeout: AtomicU64::new(0),
            hits_budget_exhausted: AtomicU64::new(0),
            hits_circuit_open: AtomicU64::new(0),
        }
    }

    pub fn record_request(&self, route: DegradeRoute) {
        self.counter_for_route(route)
            .fetch_add(1, Ordering::Relaxed);
    }

    pub fn classify_error(&self, err: &AppError) -> Option<DegradeReason> {
        match err.code {
            ErrorCode::UpstreamUnavailable | ErrorCode::StreamTimeout => {
                Some(DegradeReason::UpstreamTimeout)
            }
            ErrorCode::DependencyFailed => Some(DegradeReason::UpstreamTimeout),
            ErrorCode::RateLimited => Some(DegradeReason::BudgetExhausted),
            ErrorCode::ServerBusy => Some(DegradeReason::CircuitOpen),
            _ => None,
        }
    }

    pub fn evaluate_error(&self, route: DegradeRoute, err: &AppError) -> Option<DegradeDecision> {
        let reason = self.classify_error(err)?;
        if !err.code.degradable() {
            return None;
        }
        self.evaluate(route, reason)
    }

    pub fn evaluate(
        &self,
        route: DegradeRoute,
        reason: DegradeReason,
    ) -> Option<DegradeDecision> {
        if !self.config.enabled || !self.route_enabled(route) || !self.reason_enabled(reason) {
            return None;
        }

        self.record_hit(route, reason);
        Some(DegradeDecision { route, reason })
    }

    pub fn snapshot(&self) -> DegradeSnapshot {
        let chat_requests = self.requests_chat.load(Ordering::Relaxed);
        let chat_stream_requests = self.requests_chat_stream.load(Ordering::Relaxed);
        let chat_hits = self.hits_chat.load(Ordering::Relaxed);
        let chat_stream_hits = self.hits_chat_stream.load(Ordering::Relaxed);

        DegradeSnapshot {
            enabled: self.config.enabled,
            routes: DegradeRouteConfigSnapshot {
                chat_enabled: self.config.chat_enabled,
                chat_stream_enabled: self.config.chat_stream_enabled,
            },
            requests: DegradeRequestSnapshot {
                chat: chat_requests,
                chat_stream: chat_stream_requests,
            },
            hits: DegradeHitSnapshot {
                total: chat_hits + chat_stream_hits,
                chat: DegradeRouteHitSnapshot {
                    hits: chat_hits,
                    hit_rate: hit_rate(chat_hits, chat_requests),
                },
                chat_stream: DegradeRouteHitSnapshot {
                    hits: chat_stream_hits,
                    hit_rate: hit_rate(chat_stream_hits, chat_stream_requests),
                },
                reasons: DegradeReasonHitSnapshot {
                    upstream_timeout: self.hits_upstream_timeout.load(Ordering::Relaxed),
                    budget_exhausted: self.hits_budget_exhausted.load(Ordering::Relaxed),
                    circuit_open: self.hits_circuit_open.load(Ordering::Relaxed),
                },
            },
        }
    }

    pub fn log_hit(
        &self,
        decision: &DegradeDecision,
        request_id: &str,
        session_id: &str,
        code: ErrorCode,
    ) {
        info!(
            request_id,
            session_id,
            degrade.route = %decision.route,
            degrade.reason = %decision.reason,
            degrade.code = %code,
            "graceful degrade fallback applied"
        );
    }

    fn route_enabled(&self, route: DegradeRoute) -> bool {
        match route {
            DegradeRoute::Chat => self.config.chat_enabled,
            DegradeRoute::ChatStream => self.config.chat_stream_enabled,
        }
    }

    fn reason_enabled(&self, reason: DegradeReason) -> bool {
        match reason {
            DegradeReason::UpstreamTimeout => self.config.upstream_timeout_enabled,
            DegradeReason::BudgetExhausted => self.config.budget_exhausted_enabled,
            DegradeReason::CircuitOpen => self.config.circuit_open_enabled,
        }
    }

    fn record_hit(&self, route: DegradeRoute, reason: DegradeReason) {
        self.hit_counter_for_route(route)
            .fetch_add(1, Ordering::Relaxed);

        match reason {
            DegradeReason::UpstreamTimeout => {
                self.hits_upstream_timeout.fetch_add(1, Ordering::Relaxed);
            }
            DegradeReason::BudgetExhausted => {
                self.hits_budget_exhausted.fetch_add(1, Ordering::Relaxed);
            }
            DegradeReason::CircuitOpen => {
                self.hits_circuit_open.fetch_add(1, Ordering::Relaxed);
            }
        }
    }

    fn counter_for_route(&self, route: DegradeRoute) -> &AtomicU64 {
        match route {
            DegradeRoute::Chat => &self.requests_chat,
            DegradeRoute::ChatStream => &self.requests_chat_stream,
        }
    }

    fn hit_counter_for_route(&self, route: DegradeRoute) -> &AtomicU64 {
        match route {
            DegradeRoute::Chat => &self.hits_chat,
            DegradeRoute::ChatStream => &self.hits_chat_stream,
        }
    }
}

fn hit_rate(hits: u64, requests: u64) -> f64 {
    if requests == 0 {
        0.0
    } else {
        hits as f64 / requests as f64
    }
}

#[cfg(test)]
mod tests {
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
}
