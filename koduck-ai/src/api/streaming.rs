use std::{convert::Infallible, sync::Arc, time::Duration};

use axum::{
    http::{HeaderMap, HeaderValue, StatusCode},
    response::{
        sse::{Event, KeepAlive, Sse},
        IntoResponse, Response,
    },
};
use futures::{stream, StreamExt};
use serde_json::json;
use tracing::info;

use crate::{
    llm::StreamEvent as ProviderStreamEvent,
    orchestrator::cancel::{run_abortable_with_cleanup, AbortReason, RequestGenerationGuard},
    reliability::error::{AppError, ErrorCode},
    stream::sse::PendingStreamEvent,
};

fn chunk_answer(answer: &str) -> Vec<String> {
    const CHUNK_SIZE: usize = 48;
    let chars = answer.chars().collect::<Vec<_>>();
    if chars.is_empty() {
        return vec!["回答已完成。".to_string()];
    }

    chars
        .chunks(CHUNK_SIZE)
        .map(|chunk| chunk.iter().collect::<String>())
        .collect()
}

pub(super) async fn stream_sse_response_with_watermark(
    session: Arc<crate::stream::sse::StreamSession>,
    request_id: String,
    high_watermark: u32,
) -> Response {
    let replay = session.open_replay(high_watermark).await;
    let replay_high_watermark = replay
        .replay_events
        .last()
        .map(|event| event.sequence_num)
        .unwrap_or(high_watermark);
    let replay_stream = stream::iter(
        replay
            .replay_events
            .into_iter()
            .map(|event| Ok::<Event, Infallible>(event.to_sse_event())),
    );
    let live_stream = if replay.completed {
        stream::empty().boxed()
    } else {
        session
            .live_stream(replay.receiver, replay_high_watermark)
            .map(|event| Ok::<Event, Infallible>(event.to_sse_event()))
            .boxed()
    };
    let combined = replay_stream.chain(live_stream).boxed();

    let mut headers = HeaderMap::new();
    if let Ok(v) = HeaderValue::from_str(&request_id) {
        headers.insert("X-Request-Id", v);
    }

    (
        StatusCode::OK,
        headers,
        Sse::new(combined).keep_alive(
            KeepAlive::new()
                .interval(Duration::from_secs(10))
                .text("heartbeat"),
        ),
    )
        .into_response()
}

pub(super) async fn handle_stream_abort(
    stream_session: &Arc<crate::stream::sse::StreamSession>,
    guard: &RequestGenerationGuard,
    reason: AbortReason,
) {
    let (code, message) = match reason {
        AbortReason::Superseded => (
            ErrorCode::StreamInterrupted.to_string(),
            "stream interrupted by newer request".to_string(),
        ),
        AbortReason::TimedOut => (
            ErrorCode::StreamTimeout.to_string(),
            "stream exceeded max duration".to_string(),
        ),
    };

    let _ = stream_session
        .force_shutdown_if_current(guard, code, message)
        .await;
}

pub(super) fn build_stream_events(
    ev: &ProviderStreamEvent,
    request_id: &str,
    session_id: &str,
) -> Vec<PendingStreamEvent> {
    let mut events = Vec::with_capacity(2);

    if !ev.delta.is_empty() {
        events.push(PendingStreamEvent {
            event_type: "message".to_string(),
            payload: json!({ "text": &ev.delta }),
            event_id: Some(ev.event_id.clone()),
            sequence_num: Some(ev.sequence_num),
            request_id: request_id.to_string(),
            session_id: session_id.to_string(),
        });
    }

    if !ev.finish_reason.is_empty() {
        events.push(PendingStreamEvent {
            event_type: "done".to_string(),
            payload: json!({ "finish_reason": &ev.finish_reason }),
            event_id: None,
            sequence_num: None,
            request_id: request_id.to_string(),
            session_id: session_id.to_string(),
        });
    }

    events
}

pub(super) fn build_stream_error_event(
    err: &AppError,
    request_id: &str,
    session_id: &str,
) -> PendingStreamEvent {
    PendingStreamEvent {
        event_type: "error".to_string(),
        payload: json!({
            "code": err.code.to_string(),
            "message": err.to_error_response().message,
            "retryable": err.retryable,
            "degraded": err.degraded,
            "retry_after_ms": err.retry_after_ms,
        }),
        event_id: None,
        sequence_num: None,
        request_id: request_id.to_string(),
        session_id: session_id.to_string(),
    }
}

fn build_generated_stream_delta(
    request_id: &str,
    session_id: &str,
    text: impl Into<String>,
) -> PendingStreamEvent {
    PendingStreamEvent {
        event_type: "message".to_string(),
        payload: json!({ "text": text.into() }),
        event_id: None,
        sequence_num: None,
        request_id: request_id.to_string(),
        session_id: session_id.to_string(),
    }
}

fn build_generated_stream_done(request_id: &str, session_id: &str) -> PendingStreamEvent {
    PendingStreamEvent {
        event_type: "done".to_string(),
        payload: json!({ "finish_reason": "stop" }),
        event_id: None,
        sequence_num: None,
        request_id: request_id.to_string(),
        session_id: session_id.to_string(),
    }
}

fn spawn_chunked_stream_producer<ChunkEventBuilder, DoneEventBuilder>(
    stream_session: Arc<crate::stream::sse::StreamSession>,
    guard: RequestGenerationGuard,
    stream_timeout: Duration,
    chunks: Vec<String>,
    chunk_delay_ms: u64,
    rejected_event_log_message: &'static str,
    terminated_log_message: &'static str,
    chunk_event_builder: ChunkEventBuilder,
    done_event_builder: DoneEventBuilder,
) where
    ChunkEventBuilder: Fn(&str, &str, String) -> PendingStreamEvent + Send + Sync + 'static,
    DoneEventBuilder: Fn(&str, &str) -> PendingStreamEvent + Send + Sync + 'static,
{
    tokio::spawn(async move {
        let producer_guard = guard.clone();
        let producer = async {
            for chunk in chunks {
                tokio::time::sleep(Duration::from_millis(chunk_delay_ms)).await;
                if let Err(err) = stream_session
                    .enqueue_event_if_current(
                        &producer_guard,
                        chunk_event_builder(
                            stream_session.request_id(),
                            stream_session.session_id(),
                            chunk,
                        ),
                    )
                    .await
                {
                    info!(
                        request_id = %stream_session.request_id(),
                        session_id = %stream_session.session_id(),
                        error = %err,
                        generation = producer_guard.generation(),
                        "{rejected_event_log_message}"
                    );
                    stream_session
                        .force_shutdown_if_current(
                            &producer_guard,
                            ErrorCode::StreamTimeout.to_string(),
                            "stream queue backpressure timeout",
                        )
                        .await;
                    return;
                }
            }

            let _ = stream_session
                .enqueue_event_if_current(
                    &producer_guard,
                    done_event_builder(stream_session.request_id(), stream_session.session_id()),
                )
                .await;
        };

        let cleanup_session = Arc::clone(&stream_session);
        let cleanup_guard = guard.clone();
        let cleanup_guard_for_log = cleanup_guard.clone();
        let result = run_abortable_with_cleanup(
            guard,
            stream_timeout,
            producer,
            move |reason| async move {
                handle_stream_abort(&cleanup_session, &cleanup_guard, reason).await;
            },
        )
        .await;

        if let Err(reason) = result {
            info!(
                request_id = %stream_session.request_id(),
                session_id = %stream_session.session_id(),
                generation = cleanup_guard_for_log.generation(),
                abort_reason = ?reason,
                "{terminated_log_message}"
            );
        }
    });
}

pub(super) fn spawn_generated_stream(
    stream_session: Arc<crate::stream::sse::StreamSession>,
    guard: RequestGenerationGuard,
    stream_timeout: Duration,
    answer: String,
) {
    spawn_chunked_stream_producer(
        stream_session,
        guard,
        stream_timeout,
        chunk_answer(&answer),
        40,
        "stream queue rejected generated event",
        "generated stream producer terminated early",
        build_generated_stream_delta,
        build_generated_stream_done,
    );
}
