//! Memory fail-open tracking.
//!
//! Records and exposes metrics for memory service calls that failed
//! but were handled gracefully (fail-open) so the main chat flow continues.

use std::sync::atomic::{AtomicU64, Ordering};

use serde::Serialize;
use strum::{Display, IntoStaticStr};
use tracing::warn;

use crate::reliability::error::AppError;

/// The four memory RPC operations that can trigger fail-open.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Display, IntoStaticStr)]
#[strum(serialize_all = "snake_case")]
pub enum MemoryFailOpenOperation {
    GetSession,
    UpsertSessionMeta,
    QueryMemory,
    AppendMemory,
}

/// Serializable snapshot of memory fail-open counters, exposed via `/metrics`.
#[derive(Debug, Serialize)]
pub struct MemoryFailOpenSnapshot {
    pub get_session_errors: u64,
    pub upsert_session_meta_errors: u64,
    pub query_memory_errors: u64,
    pub append_memory_errors: u64,
}

/// Tracks memory fail-open events using atomic counters.
///
/// Fail-open is unconditional (no config toggle) per the design doc principle.
pub struct MemoryFailOpenTracker {
    get_session_errors: AtomicU64,
    upsert_session_meta_errors: AtomicU64,
    query_memory_errors: AtomicU64,
    append_memory_errors: AtomicU64,
}

impl MemoryFailOpenTracker {
    pub fn new() -> Self {
        Self {
            get_session_errors: AtomicU64::new(0),
            upsert_session_meta_errors: AtomicU64::new(0),
            query_memory_errors: AtomicU64::new(0),
            append_memory_errors: AtomicU64::new(0),
        }
    }

    /// Increment the counter for the given operation.
    pub fn record(&self, operation: MemoryFailOpenOperation) {
        self.counter_for(operation).fetch_add(1, Ordering::Relaxed);
    }

    /// Return a snapshot of all counters for the `/metrics` endpoint.
    pub fn snapshot(&self) -> MemoryFailOpenSnapshot {
        MemoryFailOpenSnapshot {
            get_session_errors: self.get_session_errors.load(Ordering::Relaxed),
            upsert_session_meta_errors: self
                .upsert_session_meta_errors
                .load(Ordering::Relaxed),
            query_memory_errors: self.query_memory_errors.load(Ordering::Relaxed),
            append_memory_errors: self.append_memory_errors.load(Ordering::Relaxed),
        }
    }

    /// Record the fail-open event and emit a structured warning log.
    pub fn log_fail_open(
        &self,
        operation: MemoryFailOpenOperation,
        request_id: &str,
        session_id: &str,
        err: &AppError,
    ) {
        self.record(operation);
        warn!(
            request_id = %request_id,
            session_id = %session_id,
            memory_fail_open.operation = %operation,
            error.code = %err.code,
            error.message = %err.message,
            "memory service call failed; continuing without memory (fail-open)"
        );
    }

    fn counter_for(&self, operation: MemoryFailOpenOperation) -> &AtomicU64 {
        match operation {
            MemoryFailOpenOperation::GetSession => &self.get_session_errors,
            MemoryFailOpenOperation::UpsertSessionMeta => &self.upsert_session_meta_errors,
            MemoryFailOpenOperation::QueryMemory => &self.query_memory_errors,
            MemoryFailOpenOperation::AppendMemory => &self.append_memory_errors,
        }
    }
}

#[cfg(test)]
#[path = "../tests/reliability/memory_fail_open_tests.rs"]
mod tests;
