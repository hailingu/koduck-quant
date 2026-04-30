use std::sync::Arc;

use axum::{
    extract::Json,
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
};
use tracing::{info, warn};
use uuid::Uuid;

use crate::{
    app::AppState,
    clients::memory::{self, MemoryRequestContext},
    reliability::error::{AppError, ErrorCode},
};

use super::{api_error_response, ApiResponse};

pub(super) fn extract_or_create_request_id(headers: &HeaderMap) -> String {
    headers
        .get("x-request-id")
        .and_then(|h| h.to_str().ok())
        .filter(|v| !v.trim().is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| format!("req_{}", Uuid::new_v4()))
}

pub(super) fn resolve_session_id(session_id: Option<String>) -> String {
    session_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .and_then(normalize_session_id)
        .unwrap_or_else(|| Uuid::new_v4().to_string())
}

pub(super) fn normalize_session_id(session_id: &str) -> Option<String> {
    let candidate = session_id
        .strip_prefix("sess_")
        .unwrap_or(session_id)
        .trim();

    normalize_uuid(candidate)
}

pub(super) fn normalize_uuid(value: &str) -> Option<String> {
    Uuid::parse_str(value.trim()).ok().map(|uuid| uuid.to_string())
}

pub(super) fn extract_trace_id(headers: &HeaderMap) -> String {
    headers
        .get("x-trace-id")
        .or_else(|| headers.get("x-b3-traceid"))
        .or_else(|| headers.get("traceparent"))
        .and_then(|h| h.to_str().ok())
        .unwrap_or("-")
        .to_string()
}

pub(super) async fn delete_session_impl(
    state: Arc<AppState>,
    headers: HeaderMap,
    raw_session_id: String,
) -> Response {
    let request_id = extract_or_create_request_id(&headers);
    info!(
        request_id = %request_id,
        raw_session_id = %raw_session_id,
        "session delete request received"
    );
    let auth_ctx = match crate::auth::authenticate_bearer(&headers, &state).await {
        Ok(ctx) => ctx,
        Err(err) => {
            warn!(
                request_id = %request_id,
                error_code = ?err.code,
                "session delete authentication failed"
            );
            return api_error_response(err.with_request_id(request_id.clone()), request_id);
        }
    };

    let Some(session_id) = normalize_session_id(&raw_session_id) else {
        warn!(
            request_id = %request_id,
            raw_session_id = %raw_session_id,
            "session delete rejected invalid session id"
        );
        return api_error_response(
            AppError::new(ErrorCode::InvalidArgument, "session_id is invalid")
                .with_request_id(request_id.clone()),
            request_id,
        );
    };

    let trace_id = extract_trace_id(&headers);
    let memory_ctx = MemoryRequestContext::from_auth(
        request_id.clone(),
        session_id,
        trace_id,
        state.config.llm.timeout_ms,
        &auth_ctx,
    );

    if let Err(err) = memory::delete_session(&state, &memory_ctx).await {
        warn!(
            request_id = %request_id,
            session_id = %memory_ctx.session_id,
            error_code = ?err.code,
            "session delete failed"
        );
        return api_error_response(err, request_id);
    }

    info!(
        request_id = %request_id,
        session_id = %memory_ctx.session_id,
        tenant_id = %auth_ctx.tenant_id,
        "session delete completed"
    );

    (
        StatusCode::OK,
        Json(ApiResponse::<()> {
            success: true,
            code: ErrorCode::Ok.to_string(),
            message: "session deleted".to_string(),
            data: None,
            error: None,
        }),
    )
        .into_response()
}
