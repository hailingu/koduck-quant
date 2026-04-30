use std::{collections::HashMap, sync::Arc};

use chrono::Utc;
use tracing::warn;

use crate::{
    app::AppState,
    clients::memory::{self, MemoryEntry, MemoryRequestContext, SessionUpsertInput},
    reliability::{
        degrade::DegradeRoute,
        error::AppError,
        memory_observe::MemoryOperation,
    },
};

use super::{ChatRequest, ConversationContextSnapshot};

pub(super) async fn load_memory_snapshot(
    state: &Arc<AppState>,
    route: DegradeRoute,
    request: &ChatRequest,
    ctx: &MemoryRequestContext,
) -> ConversationContextSnapshot {
    if let Err(err) = memory::upsert_session_meta(
        state,
        ctx,
        SessionUpsertInput {
            title: metadata_string(request, "title"),
            status: metadata_string(request, "status"),
            extra: request_metadata_extra(request),
            parent_session_id: metadata_string(request, "parent_session_id"),
            forked_from_session_id: metadata_string(request, "forked_from_session_id"),
            last_message_at: Utc::now().timestamp_millis(),
        },
    )
    .await
    {
        log_memory_failure(
            state,
            route,
            MemoryOperation::UpsertSessionMeta,
            ctx,
            &err,
            true,
            "upsert_session_meta failed; continuing with request-local session context",
        );
    }

    ConversationContextSnapshot::default()
}

async fn append_chat_turn(
    state: &Arc<AppState>,
    ctx: &MemoryRequestContext,
    request: &ChatRequest,
    answer: &str,
    model: &str,
) -> Result<(), AppError> {
    let now = Utc::now().timestamp_millis();
    let user_entry = MemoryEntry {
        role: "user".to_string(),
        content: request.message.clone(),
        timestamp: now,
        metadata: build_memory_entry_metadata(request, ctx, None),
    };
    let mut entries = vec![user_entry];

    if !answer.trim().is_empty() {
        entries.push(MemoryEntry {
            role: "assistant".to_string(),
            content: answer.to_string(),
            timestamp: now,
            metadata: build_memory_entry_metadata(request, ctx, Some(model)),
        });
    }

    let _ = memory::append_memory(state, ctx, entries, "append-turn").await?;

    Ok(())
}

pub(super) async fn append_chat_turn_best_effort(
    state: &Arc<AppState>,
    route: DegradeRoute,
    ctx: &MemoryRequestContext,
    request: &ChatRequest,
    answer: &str,
    model: &str,
    failure_message: &'static str,
) {
    if let Err(err) = append_chat_turn(state, ctx, request, answer, model).await {
        log_memory_failure(
            state,
            route,
            MemoryOperation::AppendMemory,
            ctx,
            &err,
            true,
            failure_message,
        );
    }
}

pub(super) fn log_memory_failure(
    state: &Arc<AppState>,
    route: DegradeRoute,
    operation: MemoryOperation,
    ctx: &MemoryRequestContext,
    err: &AppError,
    fallback_applied: bool,
    message: &'static str,
) {
    state
        .memory_observe_policy
        .record_failure(route, operation, err.code, fallback_applied);

    warn!(
        request_id = %ctx.request_id,
        session_id = %ctx.session_id,
        tenant_id = %ctx.tenant_id,
        trace_id = %ctx.trace_id,
        memory.route = %route,
        memory.operation = %operation,
        memory.code = %err.code,
        memory.retryable = err.retryable,
        memory.fallback_applied = fallback_applied,
        error = %err,
        "{message}"
    );
}

pub(super) fn metadata_string(request: &ChatRequest, key: &str) -> String {
    request
        .metadata
        .as_ref()
        .and_then(|metadata| metadata.get(key))
        .and_then(json_value_as_string)
        .unwrap_or_default()
}

fn request_metadata_extra(request: &ChatRequest) -> HashMap<String, String> {
    const RESERVED_KEYS: &[&str] = &[
        "title",
        "status",
        "parent_session_id",
        "forked_from_session_id",
        "domain_class",
        "retrieve_policy",
    ];

    request
        .metadata
        .as_ref()
        .map(|metadata| {
            metadata
                .iter()
                .filter(|(key, _)| !RESERVED_KEYS.contains(&key.as_str()))
                .map(|(key, value)| {
                    (
                        key.clone(),
                        json_value_as_string(value).unwrap_or_else(|| value.to_string()),
                    )
                })
                .collect()
        })
        .unwrap_or_default()
}

pub(super) fn json_value_as_string(value: &serde_json::Value) -> Option<String> {
    match value {
        serde_json::Value::String(value) => Some(value.clone()),
        serde_json::Value::Number(value) => Some(value.to_string()),
        serde_json::Value::Bool(value) => Some(value.to_string()),
        serde_json::Value::Null => None,
        _ => Some(value.to_string()),
    }
}

fn build_memory_entry_metadata(
    request: &ChatRequest,
    ctx: &MemoryRequestContext,
    model: Option<&str>,
) -> HashMap<String, String> {
    let mut metadata = HashMap::from([
        ("request_id".to_string(), ctx.request_id.clone()),
        ("trace_id".to_string(), ctx.trace_id.clone()),
        ("tenant_id".to_string(), ctx.tenant_id.clone()),
        ("source".to_string(), "koduck-ai".to_string()),
    ]);

    if let Some(model) = model.filter(|value| !value.trim().is_empty()) {
        metadata.insert("model".to_string(), model.to_string());
    }

    if let Some(retrieve_policy) = request.retrieve_policy.as_ref() {
        metadata.insert("retrieve_policy".to_string(), retrieve_policy.clone());
    }

    if let Some(domain_class) = request
        .metadata
        .as_ref()
        .and_then(|metadata| metadata.get("domain_class"))
        .and_then(json_value_as_string)
    {
        metadata.insert("domain_class".to_string(), domain_class);
    }

    for key in [
        "quoted_message_id",
        "quoted_memory_entry_id",
        "quoted_role",
        "quoted_content",
    ] {
        if let Some(value) = request
            .metadata
            .as_ref()
            .and_then(|metadata| metadata.get(key))
            .and_then(json_value_as_string)
            .filter(|value| !value.trim().is_empty())
        {
            metadata.insert(key.to_string(), value);
        }
    }

    metadata
}
