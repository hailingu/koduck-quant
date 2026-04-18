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
