use std::sync::atomic::{AtomicU64, Ordering};

use serde::Serialize;
use strum::{Display, IntoStaticStr};

use crate::reliability::{
    degrade::DegradeRoute,
    error::ErrorCode,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Display, IntoStaticStr, Serialize)]
#[strum(serialize_all = "snake_case")]
pub enum MemoryOperation {
    GetSession,
    UpsertSessionMeta,
    QueryMemory,
    AppendMemory,
}

#[derive(Debug, Serialize)]
pub struct MemoryObserveSnapshot {
    pub failures_total: u64,
    pub fallbacks_total: u64,
    pub routes: MemoryRouteFailureSnapshot,
    pub operations: MemoryOperationFailureSnapshot,
}

#[derive(Debug, Serialize)]
pub struct MemoryRouteFailureSnapshot {
    pub chat: u64,
    pub chat_stream: u64,
}

#[derive(Debug, Serialize)]
pub struct MemoryOperationFailureSnapshot {
    pub get_session: u64,
    pub upsert_session_meta: u64,
    pub query_memory: u64,
    pub append_memory: u64,
}

pub struct MemoryObservePolicy {
    failures_total: AtomicU64,
    fallbacks_total: AtomicU64,
    route_chat: AtomicU64,
    route_chat_stream: AtomicU64,
    op_get_session: AtomicU64,
    op_upsert_session_meta: AtomicU64,
    op_query_memory: AtomicU64,
    op_append_memory: AtomicU64,
}

impl Default for MemoryObservePolicy {
    fn default() -> Self {
        Self::new()
    }
}

impl MemoryObservePolicy {
    pub fn new() -> Self {
        Self {
            failures_total: AtomicU64::new(0),
            fallbacks_total: AtomicU64::new(0),
            route_chat: AtomicU64::new(0),
            route_chat_stream: AtomicU64::new(0),
            op_get_session: AtomicU64::new(0),
            op_upsert_session_meta: AtomicU64::new(0),
            op_query_memory: AtomicU64::new(0),
            op_append_memory: AtomicU64::new(0),
        }
    }

    pub fn record_failure(
        &self,
        route: DegradeRoute,
        operation: MemoryOperation,
        _code: ErrorCode,
        fallback_applied: bool,
    ) {
        self.failures_total.fetch_add(1, Ordering::Relaxed);
        if fallback_applied {
            self.fallbacks_total.fetch_add(1, Ordering::Relaxed);
        }

        match route {
            DegradeRoute::Chat => {
                self.route_chat.fetch_add(1, Ordering::Relaxed);
            }
            DegradeRoute::ChatStream => {
                self.route_chat_stream.fetch_add(1, Ordering::Relaxed);
            }
        }

        match operation {
            MemoryOperation::GetSession => {
                self.op_get_session.fetch_add(1, Ordering::Relaxed);
            }
            MemoryOperation::UpsertSessionMeta => {
                self.op_upsert_session_meta.fetch_add(1, Ordering::Relaxed);
            }
            MemoryOperation::QueryMemory => {
                self.op_query_memory.fetch_add(1, Ordering::Relaxed);
            }
            MemoryOperation::AppendMemory => {
                self.op_append_memory.fetch_add(1, Ordering::Relaxed);
            }
        }
    }

    pub fn snapshot(&self) -> MemoryObserveSnapshot {
        MemoryObserveSnapshot {
            failures_total: self.failures_total.load(Ordering::Relaxed),
            fallbacks_total: self.fallbacks_total.load(Ordering::Relaxed),
            routes: MemoryRouteFailureSnapshot {
                chat: self.route_chat.load(Ordering::Relaxed),
                chat_stream: self.route_chat_stream.load(Ordering::Relaxed),
            },
            operations: MemoryOperationFailureSnapshot {
                get_session: self.op_get_session.load(Ordering::Relaxed),
                upsert_session_meta: self.op_upsert_session_meta.load(Ordering::Relaxed),
                query_memory: self.op_query_memory.load(Ordering::Relaxed),
                append_memory: self.op_append_memory.load(Ordering::Relaxed),
            },
        }
    }
}
