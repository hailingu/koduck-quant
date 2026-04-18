use std::time::Duration;

use super::{StreamQueue, StreamQueueConfig, StreamQueueError};

#[tokio::test]
async fn bounded_queue_times_out_when_full() {
    let (queue, mut rx) = StreamQueue::new(StreamQueueConfig {
        capacity: 1,
        enqueue_timeout: Duration::from_millis(20),
    });

    queue.enqueue(1_u8).await.expect("first enqueue should pass");
    let second = queue.enqueue(2_u8).await;

    assert!(matches!(second, Err(StreamQueueError::Timeout)));
    assert_eq!(rx.recv().await, Some(1));
}
