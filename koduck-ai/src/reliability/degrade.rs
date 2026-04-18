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
#[path = "../tests/reliability/degrade_tests.rs"]
mod tests;
