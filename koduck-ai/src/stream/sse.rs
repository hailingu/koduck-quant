use std::{collections::HashMap, sync::Arc, time::Duration};

use axum::response::sse::Event;
use futures::StreamExt;
use serde::Serialize;
use serde_json::{json, Value};
use tokio::sync::{broadcast, mpsc, Mutex, RwLock};
use tokio_stream::wrappers::BroadcastStream;

use crate::{
    app::lifecycle::{ActiveStreamLease, LifecycleManager},
    reliability::error::{AppError, ErrorCode},
    stream::queue::{StreamQueue, StreamQueueConfig, StreamQueueError},
};

const BROADCAST_BUFFER: usize = 128;

#[derive(Clone, Debug, Serialize, PartialEq)]
pub struct StreamEventData {
    pub event_id: String,
    pub sequence_num: u32,
    pub event_type: String,
    pub payload: Value,
    pub request_id: String,
    pub session_id: String,
}

impl StreamEventData {
    pub fn delta(
        request_id: impl Into<String>,
        session_id: impl Into<String>,
        text: impl Into<String>,
    ) -> PendingStreamEvent {
        PendingStreamEvent {
            event_type: "delta".to_string(),
            payload: json!({ "text": text.into() }),
            event_id: None,
            sequence_num: None,
            request_id: request_id.into(),
            session_id: session_id.into(),
        }
    }

    pub fn done(
        request_id: impl Into<String>,
        session_id: impl Into<String>,
        finish_reason: impl Into<String>,
    ) -> PendingStreamEvent {
        PendingStreamEvent {
            event_type: "done".to_string(),
            payload: json!({ "finish_reason": finish_reason.into() }),
            event_id: None,
            sequence_num: None,
            request_id: request_id.into(),
            session_id: session_id.into(),
        }
    }

    pub fn error(
        request_id: impl Into<String>,
        session_id: impl Into<String>,
        code: impl Into<String>,
        message: impl Into<String>,
    ) -> PendingStreamEvent {
        PendingStreamEvent {
            event_type: "error".to_string(),
            payload: json!({
                "code": code.into(),
                "message": message.into(),
            }),
            event_id: None,
            sequence_num: None,
            request_id: request_id.into(),
            session_id: session_id.into(),
        }
    }

    pub fn to_sse_event(&self) -> Event {
        let payload = serde_json::to_string(self).unwrap_or_else(|_| "{}".to_string());
        Event::default()
            .event(sse_event_name(&self.event_type))
            .id(self.event_id.clone())
            .data(payload)
    }
}

#[derive(Clone, Debug)]
pub struct PendingStreamEvent {
    pub event_type: String,
    pub payload: Value,
    pub event_id: Option<String>,
    pub sequence_num: Option<u32>,
    pub request_id: String,
    pub session_id: String,
}

#[derive(Clone, Debug, Default)]
pub struct ResumeCursor {
    pub last_event_id: Option<String>,
    pub from_sequence_num: Option<u32>,
}

impl ResumeCursor {
    pub fn is_resume(&self) -> bool {
        self.last_event_id.is_some() || self.from_sequence_num.is_some()
    }

    pub fn high_watermark(&self, session: Option<&StreamSession>) -> u32 {
        let mut watermark = self.from_sequence_num.unwrap_or_default();

        if let Some(last_event_id) = self.last_event_id.as_deref() {
            if let Some(sequence_num) = parse_sequence_num(last_event_id) {
                watermark = watermark.max(sequence_num);
            } else if let Some(session) = session {
                watermark = watermark.max(session.sequence_for_event_id(last_event_id));
            }
        }

        watermark
    }
}

#[derive(Default)]
pub struct StreamRegistry {
    sessions: RwLock<HashMap<String, Arc<StreamSession>>>,
}

impl StreamRegistry {
    pub async fn get(&self, session_id: &str) -> Option<Arc<StreamSession>> {
        self.sessions.read().await.get(session_id).cloned()
    }

    pub async fn create_or_replace(
        &self,
        session_id: impl Into<String>,
        request_id: impl Into<String>,
        queue_capacity: usize,
        enqueue_timeout: Duration,
        lifecycle: Arc<LifecycleManager>,
    ) -> Arc<StreamSession> {
        let session_id = session_id.into();
        let session = Arc::new(StreamSession::new(
            request_id.into(),
            session_id.clone(),
            StreamQueueConfig {
                capacity: queue_capacity,
                enqueue_timeout,
            },
            lifecycle.register_stream(),
        ));
        self.sessions.write().await.insert(session_id, session.clone());
        session
    }

    pub async fn force_shutdown_active(&self, code: &str, message: &str) {
        let sessions = self
            .sessions
            .read()
            .await
            .values()
            .cloned()
            .collect::<Vec<_>>();

        for session in sessions {
            session.force_shutdown(code.to_string(), message.to_string()).await;
        }
    }
}

pub struct StreamSession {
    request_id: String,
    session_id: String,
    state: Arc<Mutex<StreamSessionState>>,
    tx: broadcast::Sender<StreamEventData>,
    queue: StreamQueue<PendingStreamEvent>,
    active_lease: Arc<ActiveStreamLease>,
}

#[derive(Debug, Default)]
struct StreamSessionState {
    next_sequence_num: u32,
    completed: bool,
    events: Vec<StreamEventData>,
}

pub struct SessionReplay {
    pub replay_events: Vec<StreamEventData>,
    pub receiver: broadcast::Receiver<StreamEventData>,
    pub completed: bool,
}

#[derive(Clone)]
struct StreamSessionWorker {
    request_id: String,
    session_id: String,
    state: Arc<Mutex<StreamSessionState>>,
    tx: broadcast::Sender<StreamEventData>,
    active_lease: Arc<ActiveStreamLease>,
}

impl StreamSession {
    pub fn new(
        request_id: String,
        session_id: String,
        queue_config: StreamQueueConfig,
        active_lease: ActiveStreamLease,
    ) -> Self {
        let (tx, _) = broadcast::channel(BROADCAST_BUFFER);
        let (queue, rx) = StreamQueue::new(queue_config);
        let session = Self {
            request_id,
            session_id,
            state: Arc::new(Mutex::new(StreamSessionState::default())),
            tx,
            queue,
            active_lease: Arc::new(active_lease),
        };
        session.spawn_queue_worker(rx);
        session
    }

    fn spawn_queue_worker(&self, mut rx: mpsc::Receiver<PendingStreamEvent>) {
        let worker = self.worker();
        tokio::spawn(async move {
            while let Some(pending) = rx.recv().await {
                let terminal = worker.process_event(pending).await;
                if terminal {
                    break;
                }
            }
            tracing::info!(
                request_id = %worker.request_id,
                session_id = %worker.session_id,
                "stream queue worker stopped"
            );
        });
    }

    fn worker(&self) -> StreamSessionWorker {
        StreamSessionWorker {
            request_id: self.request_id.clone(),
            session_id: self.session_id.clone(),
            state: Arc::clone(&self.state),
            tx: self.tx.clone(),
            active_lease: Arc::clone(&self.active_lease),
        }
    }

    pub async fn enqueue_event(&self, pending: PendingStreamEvent) -> Result<(), AppError> {
        {
            let state = self.state.lock().await;
            if state.completed {
                return Err(AppError::new(
                    ErrorCode::StreamInterrupted,
                    "stream session already completed",
                ));
            }
        }

        self.queue.enqueue(pending).await.map_err(|err| match err {
            StreamQueueError::Closed => AppError::new(
                ErrorCode::StreamInterrupted,
                "stream queue closed before event could be delivered",
            ),
            StreamQueueError::Timeout => AppError::new(
                ErrorCode::StreamTimeout,
                "stream queue backpressure timeout",
            ),
        })
    }

    pub async fn force_shutdown(
        &self,
        code: impl Into<String>,
        message: impl Into<String>,
    ) -> Option<StreamEventData> {
        self.worker()
            .emit_terminal_error(code.into(), message.into())
            .await
    }

    pub fn request_id(&self) -> &str {
        &self.request_id
    }

    pub async fn open_replay(&self, after_sequence_num: u32) -> SessionReplay {
        let receiver = self.tx.subscribe();
        let state = self.state.lock().await;

        SessionReplay {
            replay_events: state
                .events
                .iter()
                .filter(|event| event.sequence_num > after_sequence_num)
                .cloned()
                .collect(),
            receiver,
            completed: state.completed,
        }
    }

    pub fn live_stream(
        &self,
        receiver: broadcast::Receiver<StreamEventData>,
        initial_high_watermark: u32,
    ) -> impl futures::Stream<Item = StreamEventData> + Send + 'static {
        let high_watermark = Arc::new(Mutex::new(initial_high_watermark));

        BroadcastStream::new(receiver).filter_map(move |result| {
            let high_watermark = Arc::clone(&high_watermark);
            async move {
                match result {
                    Ok(event) => {
                        let mut watermark = high_watermark.lock().await;
                        if event.sequence_num > *watermark {
                            *watermark = event.sequence_num;
                            Some(event)
                        } else {
                            None
                        }
                    }
                    Err(_) => None,
                }
            }
        })
    }

    pub fn sequence_for_event_id(&self, event_id: &str) -> u32 {
        if let Some(sequence_num) = parse_sequence_num(event_id) {
            return sequence_num;
        }

        if let Ok(state) = self.state.try_lock() {
            return state
                .events
                .iter()
                .find(|event| event.event_id == event_id)
                .map(|event| event.sequence_num)
                .unwrap_or_default();
        }

        0
    }

    pub fn session_id(&self) -> &str {
        &self.session_id
    }

    pub fn queue_capacity(&self) -> usize {
        self.queue.capacity()
    }

    pub fn queue_available_permits(&self) -> usize {
        self.queue.available_permits()
    }
}

impl StreamSessionWorker {
    async fn process_event(&self, pending: PendingStreamEvent) -> bool {
        let mut state = self.state.lock().await;
        if state.completed {
            return true;
        }

        let sequence_num = normalize_sequence_num(pending.sequence_num, state.next_sequence_num);
        let event = StreamEventData {
            event_id: pending
                .event_id
                .filter(|value| !value.trim().is_empty())
                .unwrap_or_else(|| format!("{}:{sequence_num:05}", self.request_id)),
            sequence_num,
            event_type: pending.event_type,
            payload: pending.payload,
            request_id: pending.request_id,
            session_id: pending.session_id,
        };

        state.next_sequence_num = sequence_num;
        let terminal = matches!(event.event_type.as_str(), "done" | "error");
        if terminal {
            state.completed = true;
        }
        state.events.push(event.clone());
        drop(state);

        let _ = self.tx.send(event);
        if terminal {
            self.active_lease.release();
        }
        terminal
    }

    async fn emit_terminal_error(
        &self,
        code: String,
        message: String,
    ) -> Option<StreamEventData> {
        let mut state = self.state.lock().await;
        if state.completed {
            return None;
        }

        let sequence_num = normalize_sequence_num(None, state.next_sequence_num);
        let event = StreamEventData {
            event_id: format!("{}:{sequence_num:05}", self.request_id),
            sequence_num,
            event_type: "error".to_string(),
            payload: json!({
                "code": code,
                "message": message,
            }),
            request_id: self.request_id.clone(),
            session_id: self.session_id.clone(),
        };
        state.next_sequence_num = sequence_num;
        state.completed = true;
        state.events.push(event.clone());
        drop(state);

        let _ = self.tx.send(event.clone());
        self.active_lease.release();
        Some(event)
    }
}

pub fn normalize_sequence_num(candidate: Option<u32>, current_high_watermark: u32) -> u32 {
    match candidate {
        Some(value) if value > current_high_watermark => value,
        _ => current_high_watermark.saturating_add(1),
    }
}

pub fn parse_sequence_num(event_id: &str) -> Option<u32> {
    let digits = event_id
        .chars()
        .rev()
        .take_while(|ch| ch.is_ascii_digit())
        .collect::<String>();

    if digits.is_empty() {
        return None;
    }

    digits
        .chars()
        .rev()
        .collect::<String>()
        .parse::<u32>()
        .ok()
}

pub fn sse_event_name(event_type: &str) -> &str {
    match event_type {
        "done" => "done",
        "heartbeat" => "heartbeat",
        _ => "message",
    }
}

#[cfg(test)]
mod tests {
    use std::{sync::Arc, time::Duration};

    use futures::StreamExt;
    use serde_json::json;

    use crate::app::lifecycle::{LifecycleConfig, LifecycleManager};

    use super::{
        parse_sequence_num, PendingStreamEvent, ResumeCursor, StreamRegistry, StreamSession,
    };

    #[tokio::test]
    async fn enqueue_event_keeps_sequence_monotonic() {
        let session = StreamSession::new(
            "req-1".to_string(),
            "sess-1".to_string(),
            StreamQueueConfig {
                capacity: 8,
                enqueue_timeout: Duration::from_millis(50),
            },
            Arc::new(LifecycleManager::new(LifecycleConfig {
                shutdown_drain_timeout: Duration::from_millis(50),
                shutdown_cleanup_timeout: Duration::from_millis(20),
            }))
            .register_stream(),
        );

        session
            .enqueue_event(PendingStreamEvent {
                event_type: "delta".to_string(),
                payload: json!({ "text": "one" }),
                event_id: Some("evt_00001".to_string()),
                sequence_num: Some(1),
                request_id: "req-1".to_string(),
                session_id: "sess-1".to_string(),
            })
            .await
            .expect("first event should enqueue");
        session
            .enqueue_event(PendingStreamEvent {
                event_type: "delta".to_string(),
                payload: json!({ "text": "two" }),
                event_id: Some("evt_00001".to_string()),
                sequence_num: Some(1),
                request_id: "req-1".to_string(),
                session_id: "sess-1".to_string(),
            })
            .await
            .expect("second event should enqueue");
        session
            .enqueue_event(PendingStreamEvent {
                event_type: "done".to_string(),
                payload: json!({ "finish_reason": "stop" }),
                event_id: None,
                sequence_num: None,
                request_id: "req-1".to_string(),
                session_id: "sess-1".to_string(),
            })
            .await
            .expect("done event should enqueue");

        tokio::time::sleep(Duration::from_millis(20)).await;
        let replay = session.open_replay(0).await;

        assert_eq!(replay.replay_events[0].sequence_num, 1);
        assert_eq!(replay.replay_events[1].sequence_num, 2);
        assert_eq!(replay.replay_events[2].event_type, "done");
    }

    #[tokio::test]
    async fn replay_respects_high_watermark() {
        let lifecycle = Arc::new(LifecycleManager::new(LifecycleConfig {
            shutdown_drain_timeout: Duration::from_millis(50),
            shutdown_cleanup_timeout: Duration::from_millis(20),
        }));
        let registry = StreamRegistry::default();
        let session = registry
            .create_or_replace(
                "sess-1",
                "req-1",
                8,
                Duration::from_millis(50),
                lifecycle,
            )
            .await;
        session
            .enqueue_event(PendingStreamEvent {
                event_type: "delta".to_string(),
                payload: json!({ "text": "one" }),
                event_id: None,
                sequence_num: Some(1),
                request_id: "req-1".to_string(),
                session_id: "sess-1".to_string(),
            })
            .await
            .expect("event one should enqueue");
        session
            .enqueue_event(PendingStreamEvent {
                event_type: "delta".to_string(),
                payload: json!({ "text": "two" }),
                event_id: None,
                sequence_num: Some(2),
                request_id: "req-1".to_string(),
                session_id: "sess-1".to_string(),
            })
            .await
            .expect("event two should enqueue");
        session
            .enqueue_event(PendingStreamEvent {
                event_type: "done".to_string(),
                payload: json!({ "finish_reason": "stop" }),
                event_id: None,
                sequence_num: Some(3),
                request_id: "req-1".to_string(),
                session_id: "sess-1".to_string(),
            })
            .await
            .expect("done event should enqueue");

        tokio::time::sleep(Duration::from_millis(20)).await;
        let replay = session.open_replay(1).await;

        assert!(replay.completed);
        assert_eq!(replay.replay_events.len(), 2);
        assert_eq!(replay.replay_events[0].sequence_num, 2);
        assert_eq!(replay.replay_events[1].sequence_num, 3);
    }

    #[tokio::test]
    async fn live_stream_skips_duplicate_sequences() {
        let session = StreamSession::new(
            "req-1".to_string(),
            "sess-1".to_string(),
            StreamQueueConfig {
                capacity: 8,
                enqueue_timeout: Duration::from_millis(50),
            },
            Arc::new(LifecycleManager::new(LifecycleConfig {
                shutdown_drain_timeout: Duration::from_millis(50),
                shutdown_cleanup_timeout: Duration::from_millis(20),
            }))
            .register_stream(),
        );
        let replay = session.open_replay(0).await;
        let mut live_stream = Box::pin(session.live_stream(replay.receiver, 1));

        session
            .enqueue_event(PendingStreamEvent {
                event_type: "delta".to_string(),
                payload: json!({ "text": "duplicate" }),
                event_id: Some("req-1:00001".to_string()),
                sequence_num: Some(1),
                request_id: "req-1".to_string(),
                session_id: "sess-1".to_string(),
            })
            .await
            .expect("duplicate event should enqueue");
        session
            .enqueue_event(PendingStreamEvent {
                event_type: "delta".to_string(),
                payload: json!({ "text": "next" }),
                event_id: Some("req-1:00002".to_string()),
                sequence_num: Some(2),
                request_id: "req-1".to_string(),
                session_id: "sess-1".to_string(),
            })
            .await
            .expect("next event should enqueue");

        let event = live_stream.next().await.expect("expected non-duplicate event");
        assert_eq!(event.sequence_num, 2);
    }

    #[tokio::test]
    async fn force_shutdown_marks_session_complete() {
        let session = StreamSession::new(
            "req-1".to_string(),
            "sess-1".to_string(),
            StreamQueueConfig {
                capacity: 8,
                enqueue_timeout: Duration::from_millis(50),
            },
            Arc::new(LifecycleManager::new(LifecycleConfig {
                shutdown_drain_timeout: Duration::from_millis(50),
                shutdown_cleanup_timeout: Duration::from_millis(20),
            }))
            .register_stream(),
        );

        let forced = session
            .force_shutdown("STREAM_TIMEOUT", "forced shutdown")
            .await
            .expect("force shutdown should emit terminal event");
        let replay = session.open_replay(0).await;

        assert_eq!(forced.event_type, "error");
        assert!(replay.completed);
    }

    #[tokio::test]
    async fn resume_cursor_uses_last_event_and_body_watermark() {
        let registry = StreamRegistry::default();
        let lifecycle = Arc::new(LifecycleManager::new(LifecycleConfig {
            shutdown_drain_timeout: Duration::from_millis(50),
            shutdown_cleanup_timeout: Duration::from_millis(20),
        }));
        let session = registry
            .create_or_replace(
                "sess-1",
                "req-1",
                8,
                Duration::from_millis(50),
                lifecycle,
            )
            .await;
        session
            .enqueue_event(PendingStreamEvent {
                event_type: "delta".to_string(),
                payload: json!({ "text": "one" }),
                event_id: Some("custom-evt-00004".to_string()),
                sequence_num: Some(4),
                request_id: "req-1".to_string(),
                session_id: "sess-1".to_string(),
            })
            .await
            .expect("cursor test event should enqueue");

        tokio::time::sleep(Duration::from_millis(20)).await;
        let cursor = ResumeCursor {
            last_event_id: Some("custom-evt-00004".to_string()),
            from_sequence_num: Some(2),
        };

        assert_eq!(cursor.high_watermark(Some(&session)), 4);
        assert_eq!(parse_sequence_num("req-1:00009"), Some(9));
        assert_eq!(parse_sequence_num("evt_without_digits"), None);
    }
}
