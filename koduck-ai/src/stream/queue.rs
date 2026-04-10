use std::time::Duration;

use tokio::sync::mpsc;

#[derive(Clone, Debug)]
pub struct StreamQueueConfig {
    pub capacity: usize,
    pub enqueue_timeout: Duration,
}

#[derive(Debug)]
pub enum StreamQueueError {
    Closed,
    Timeout,
}

#[derive(Clone)]
pub struct StreamQueue<T> {
    tx: mpsc::Sender<T>,
    config: StreamQueueConfig,
}

impl<T> StreamQueue<T> {
    pub fn new(config: StreamQueueConfig) -> (Self, mpsc::Receiver<T>) {
        let (tx, rx) = mpsc::channel(config.capacity);
        (Self { tx, config }, rx)
    }

    pub async fn enqueue(&self, item: T) -> Result<(), StreamQueueError> {
        match tokio::time::timeout(self.config.enqueue_timeout, self.tx.send(item)).await {
            Ok(Ok(())) => Ok(()),
            Ok(Err(_)) => Err(StreamQueueError::Closed),
            Err(_) => Err(StreamQueueError::Timeout),
        }
    }

    pub fn capacity(&self) -> usize {
        self.config.capacity
    }

    pub fn available_permits(&self) -> usize {
        self.tx.capacity()
    }
}

#[cfg(test)]
mod tests {
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
}
