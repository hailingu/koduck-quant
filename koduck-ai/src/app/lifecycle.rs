use std::{
    sync::{
        atomic::{AtomicBool, AtomicUsize, Ordering},
        Arc,
    },
    time::Duration,
};

use tokio::sync::Notify;
use tracing::{error, info, warn};

use crate::stream::sse::StreamRegistry;

#[derive(Debug, Clone)]
pub struct LifecycleConfig {
    pub shutdown_drain_timeout: Duration,
    pub shutdown_cleanup_timeout: Duration,
}

pub struct LifecycleManager {
    accepting_requests: AtomicBool,
    active_streams: AtomicUsize,
    drain_notify: Notify,
    config: LifecycleConfig,
}

impl LifecycleManager {
    pub fn new(config: LifecycleConfig) -> Self {
        Self {
            accepting_requests: AtomicBool::new(true),
            active_streams: AtomicUsize::new(0),
            drain_notify: Notify::new(),
            config,
        }
    }

    pub fn is_accepting_requests(&self) -> bool {
        self.accepting_requests.load(Ordering::SeqCst)
    }

    pub fn begin_shutdown(&self) {
        let was_accepting = self.accepting_requests.swap(false, Ordering::SeqCst);
        if was_accepting {
            info!("koduck-ai lifecycle entered draining mode");
        }
    }

    pub fn register_stream(self: &Arc<Self>) -> ActiveStreamLease {
        self.active_streams.fetch_add(1, Ordering::SeqCst);
        ActiveStreamLease {
            manager: Arc::clone(self),
            released: AtomicBool::new(false),
        }
    }

    pub fn active_streams(&self) -> usize {
        self.active_streams.load(Ordering::SeqCst)
    }

    async fn wait_for_drain(&self, timeout: Duration) -> bool {
        if self.active_streams() == 0 {
            return true;
        }

        tokio::time::timeout(timeout, async {
            loop {
                if self.active_streams() == 0 {
                    break;
                }
                self.drain_notify.notified().await;
            }
        })
        .await
        .is_ok()
    }

    fn release_stream(&self) {
        let previous = self.active_streams.fetch_sub(1, Ordering::SeqCst);
        if previous <= 1 {
            self.drain_notify.notify_waiters();
        }
    }

    pub async fn execute_shutdown(&self, registry: &StreamRegistry) {
        self.begin_shutdown();

        if self.wait_for_drain(self.config.shutdown_drain_timeout).await {
            info!("all active streams drained before shutdown");
            return;
        }

        warn!(
            active_streams = self.active_streams(),
            "stream drain timeout reached; forcing active sessions to terminate"
        );
        registry
            .force_shutdown_active(
                "STREAM_TIMEOUT",
                "graceful shutdown timed out while draining active streams",
            )
            .await;

        if self
            .wait_for_drain(self.config.shutdown_cleanup_timeout)
            .await
        {
            info!("active streams terminated during cleanup window");
            return;
        }

        error!(
            active_streams = self.active_streams(),
            "shutdown cleanup exceeded failsafe window; continuing process termination"
        );
    }
}

pub struct ActiveStreamLease {
    manager: Arc<LifecycleManager>,
    released: AtomicBool,
}

impl ActiveStreamLease {
    pub fn release(&self) {
        if !self.released.swap(true, Ordering::SeqCst) {
            self.manager.release_stream();
        }
    }
}

impl Drop for ActiveStreamLease {
    fn drop(&mut self) {
        self.release();
    }
}

#[cfg(test)]
#[path = "../tests/app/lifecycle_tests.rs"]
mod tests;
