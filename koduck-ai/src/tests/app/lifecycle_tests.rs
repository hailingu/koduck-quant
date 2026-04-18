use std::{sync::Arc, time::Duration};

use super::{LifecycleConfig, LifecycleManager};

#[tokio::test]
async fn wait_for_drain_finishes_after_stream_release() {
    let manager = Arc::new(LifecycleManager::new(LifecycleConfig {
        shutdown_drain_timeout: Duration::from_millis(100),
        shutdown_cleanup_timeout: Duration::from_millis(50),
    }));
    let lease = manager.register_stream();
    let manager_for_wait = Arc::clone(&manager);

    let waiter = tokio::spawn(async move {
        manager_for_wait.begin_shutdown();
        manager_for_wait
            .wait_for_drain(Duration::from_millis(80))
            .await
    });

    tokio::time::sleep(Duration::from_millis(10)).await;
    lease.release();

    assert!(waiter.await.expect("wait task should finish"));
    assert_eq!(manager.active_streams(), 0);
}
