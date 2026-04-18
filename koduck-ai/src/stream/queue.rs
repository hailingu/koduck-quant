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
#[path = "../tests/stream/queue_tests.rs"]
mod tests;
