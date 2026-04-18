use std::{sync::Arc, time::Duration};

use futures::StreamExt;
use serde_json::json;

use crate::app::lifecycle::{LifecycleConfig, LifecycleManager};

use super::{
    parse_sequence_num, PendingStreamEvent, ResumeCursor, StreamQueueConfig, StreamRegistry,
    StreamSession,
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

#[tokio::test]
async fn replacing_session_rejects_stale_generation_events() {
    let registry = StreamRegistry::default();
    let lifecycle = Arc::new(LifecycleManager::new(LifecycleConfig {
        shutdown_drain_timeout: Duration::from_millis(50),
        shutdown_cleanup_timeout: Duration::from_millis(20),
    }));
    let first = registry
        .create_or_replace(
            "sess-1",
            "req-1",
            8,
            Duration::from_millis(50),
            Arc::clone(&lifecycle),
        )
        .await;
    let first_guard = first.request_guard().await;
    first
        .enqueue_event_if_current(
            &first_guard,
            PendingStreamEvent {
                event_type: "delta".to_string(),
                payload: json!({ "text": "old" }),
                event_id: None,
                sequence_num: Some(1),
                request_id: "req-1".to_string(),
                session_id: "sess-1".to_string(),
            },
        )
        .await
        .expect("first generation should enqueue");

    let replacement = registry
        .create_or_replace(
            "sess-1",
            "req-2",
            8,
            Duration::from_millis(50),
            lifecycle,
        )
        .await;
    tokio::time::sleep(Duration::from_millis(20)).await;

    let stale = first
        .enqueue_event_if_current(
            &first_guard,
            PendingStreamEvent {
                event_type: "done".to_string(),
                payload: json!({ "finish_reason": "stale" }),
                event_id: None,
                sequence_num: Some(2),
                request_id: "req-1".to_string(),
                session_id: "sess-1".to_string(),
            },
        )
        .await;
    assert!(stale.is_err());

    let replacement_guard = replacement.request_guard().await;
    replacement
        .enqueue_event_if_current(
            &replacement_guard,
            PendingStreamEvent {
                event_type: "delta".to_string(),
                payload: json!({ "text": "new" }),
                event_id: None,
                sequence_num: Some(1),
                request_id: "req-2".to_string(),
                session_id: "sess-1".to_string(),
            },
        )
        .await
        .expect("replacement generation should enqueue");
    replacement
        .enqueue_event_if_current(
            &replacement_guard,
            PendingStreamEvent {
                event_type: "done".to_string(),
                payload: json!({ "finish_reason": "stop" }),
                event_id: None,
                sequence_num: Some(2),
                request_id: "req-2".to_string(),
                session_id: "sess-1".to_string(),
            },
        )
        .await
        .expect("replacement done event should enqueue");
    tokio::time::sleep(Duration::from_millis(20)).await;

    let first_replay = first.open_replay(0).await;
    let replacement_replay = replacement.open_replay(0).await;

    assert!(first_replay.completed);
    assert_eq!(
        first_replay
            .replay_events
            .last()
            .expect("stale session terminal event")
            .event_type,
        "error"
    );
    assert!(
        replacement_replay
            .replay_events
            .iter()
            .all(|event| event.request_id == "req-2")
    );
    assert_eq!(
        replacement_replay
            .replay_events
            .iter()
            .filter(|event| event.event_type == "done")
            .count(),
        1
    );
}

#[tokio::test]
async fn superseded_session_cleanup_releases_lifecycle_leases() {
    let registry = StreamRegistry::default();
    let lifecycle = Arc::new(LifecycleManager::new(LifecycleConfig {
        shutdown_drain_timeout: Duration::from_millis(50),
        shutdown_cleanup_timeout: Duration::from_millis(20),
    }));

    let _first = registry
        .create_or_replace(
            "sess-1",
            "req-1",
            8,
            Duration::from_millis(50),
            Arc::clone(&lifecycle),
        )
        .await;
    assert_eq!(lifecycle.active_streams(), 1);

    let replacement = registry
        .create_or_replace(
            "sess-1",
            "req-2",
            8,
            Duration::from_millis(50),
            Arc::clone(&lifecycle),
        )
        .await;
    tokio::time::sleep(Duration::from_millis(20)).await;
    assert_eq!(lifecycle.active_streams(), 1);

    replacement
        .force_shutdown("STREAM_INTERRUPTED", "test cleanup")
        .await
        .expect("replacement should terminate cleanly");
    tokio::time::sleep(Duration::from_millis(20)).await;

    assert_eq!(lifecycle.active_streams(), 0);
}
