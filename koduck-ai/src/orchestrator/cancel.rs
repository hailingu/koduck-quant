use std::{
    future::Future,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    time::Duration,
};

use tokio::sync::{watch, Mutex};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AbortReason {
    Superseded,
    TimedOut,
}

#[derive(Debug, Clone)]
pub struct AbortSignal {
    receiver: watch::Receiver<bool>,
}

impl AbortSignal {
    pub async fn cancelled(&mut self) {
        if *self.receiver.borrow() {
            return;
        }

        while self.receiver.changed().await.is_ok() {
            if *self.receiver.borrow() {
                return;
            }
        }
    }

    pub fn is_cancelled(&self) -> bool {
        *self.receiver.borrow()
    }
}

#[derive(Debug)]
struct AbortSwitch {
    sender: watch::Sender<bool>,
}

impl AbortSwitch {
    fn new() -> (Self, AbortSignal) {
        let (sender, receiver) = watch::channel(false);
        (Self { sender }, AbortSignal { receiver })
    }

    fn abort(&self) {
        let _ = self.sender.send(true);
    }
}

#[derive(Debug)]
struct GenerationState {
    request_id: String,
    abort_switch: AbortSwitch,
}

#[derive(Debug)]
pub struct RequestGenerationController {
    generation: AtomicU64,
    state: Mutex<GenerationState>,
}

#[derive(Debug, Clone)]
pub struct RequestGenerationGuard {
    controller: Arc<RequestGenerationController>,
    request_id: String,
    generation: u64,
    abort_signal: AbortSignal,
}

impl RequestGenerationController {
    pub fn new(request_id: impl Into<String>) -> Arc<Self> {
        let request_id = request_id.into();
        let (abort_switch, _) = AbortSwitch::new();
        Arc::new(Self {
            generation: AtomicU64::new(1),
            state: Mutex::new(GenerationState {
                request_id,
                abort_switch,
            }),
        })
    }

    pub async fn guard(self: &Arc<Self>) -> RequestGenerationGuard {
        let state = self.state.lock().await;
        let generation = self.generation.load(Ordering::SeqCst);
        let abort_signal = AbortSignal {
            receiver: state.abort_switch.sender.subscribe(),
        };
        RequestGenerationGuard {
            controller: Arc::clone(self),
            request_id: state.request_id.clone(),
            generation,
            abort_signal,
        }
    }

    pub async fn supersede(&self, request_id: impl Into<String>) -> u64 {
        let mut state = self.state.lock().await;
        state.abort_switch.abort();
        let generation = self.generation.fetch_add(1, Ordering::SeqCst) + 1;
        let request_id = request_id.into();
        let (abort_switch, _) = AbortSwitch::new();
        state.request_id = request_id;
        state.abort_switch = abort_switch;
        generation
    }

    pub async fn is_current(&self, request_id: &str, generation: u64) -> bool {
        let current_generation = self.generation.load(Ordering::SeqCst);
        if current_generation != generation {
            return false;
        }

        let state = self.state.lock().await;
        state.request_id == request_id
    }
}

impl RequestGenerationGuard {
    pub fn request_id(&self) -> &str {
        &self.request_id
    }

    pub fn generation(&self) -> u64 {
        self.generation
    }

    pub async fn is_current(&self) -> bool {
        self.controller
            .is_current(&self.request_id, self.generation)
            .await
    }

    pub async fn cancelled(&self) {
        let mut signal = self.abort_signal.clone();
        signal.cancelled().await;
    }

    pub async fn is_cancelled(&self) -> bool {
        self.abort_signal.is_cancelled()
    }
}

pub async fn run_abortable_with_cleanup<F, T, Cleanup, CleanupFuture>(
    guard: RequestGenerationGuard,
    timeout: Duration,
    work: F,
    cleanup: Cleanup,
) -> Result<T, AbortReason>
where
    F: Future<Output = T> + Send,
    Cleanup: FnOnce(AbortReason) -> CleanupFuture,
    CleanupFuture: Future<Output = ()> + Send,
    T: Send,
{
    let mut work = std::pin::pin!(work);
    let outcome = tokio::select! {
        biased;
        _ = guard.cancelled() => Err(AbortReason::Superseded),
        result = &mut work => Ok(result),
        _ = tokio::time::sleep(timeout) => Err(AbortReason::TimedOut),
    };

    if let Err(reason) = outcome {
        cleanup(reason).await;
        return Err(reason);
    }

    outcome
}

#[cfg(test)]
mod tests {
    use std::{sync::Arc, time::Duration};

    use tokio::sync::Barrier;

    use super::{run_abortable_with_cleanup, AbortReason, RequestGenerationController};

    #[tokio::test]
    async fn superseded_generation_is_no_longer_current() {
        let controller = RequestGenerationController::new("req-1");
        let guard = controller.guard().await;

        controller.supersede("req-2").await;

        assert!(!guard.is_current().await);
        assert_eq!(guard.request_id(), "req-1");
        assert_eq!(guard.generation(), 1);
    }

    #[tokio::test]
    async fn abortable_wrapper_runs_cleanup_once_when_superseded() {
        let controller = RequestGenerationController::new("req-1");
        let guard = controller.guard().await;
        let barrier = Arc::new(Barrier::new(2));
        let barrier_for_cleanup = Arc::clone(&barrier);

        let task = tokio::spawn(async move {
            run_abortable_with_cleanup(
                guard,
                Duration::from_secs(1),
                async {
                    tokio::time::sleep(Duration::from_secs(5)).await;
                },
                move |_| {
                    let barrier_for_cleanup = Arc::clone(&barrier_for_cleanup);
                    async move {
                        barrier_for_cleanup.wait().await;
                    }
                },
            )
            .await
        });

        controller.supersede("req-2").await;
        barrier.wait().await;

        let result = task.await.expect("abortable task should join");
        assert_eq!(result, Err(AbortReason::Superseded));
    }

    #[tokio::test]
    async fn abortable_wrapper_times_out_and_cleans_up() {
        let controller = RequestGenerationController::new("req-1");
        let guard = controller.guard().await;

        let result = run_abortable_with_cleanup(
            guard,
            Duration::from_millis(20),
            async {
                tokio::time::sleep(Duration::from_secs(1)).await;
            },
            |_| async {},
        )
        .await;

        assert_eq!(result, Err(AbortReason::TimedOut));
    }
}
