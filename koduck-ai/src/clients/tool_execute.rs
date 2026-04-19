//! Generic tool execution client for discovered non-first-class tool routes.

use std::{sync::Arc, time::Duration};

use serde::{Deserialize, Serialize};
use tonic::Request;

use crate::{
    app::AppState,
    auth::AuthContext,
    clients::proto::{
        ExecuteToolRequest, ExecuteToolResponse, RequestMeta, ToolServiceClient,
    },
    clients::tool_catalog::{service_upstream, DiscoveredTool, ToolRoute},
    registry::ServiceProtocol,
    reliability::error::{AppError, ErrorCode},
};

const CONNECT_TIMEOUT_SECS: u64 = 3;

#[derive(Debug, Clone, PartialEq)]
pub struct ExecutedToolResult {
    pub tool_name: String,
    pub tool_version: String,
    pub service_name: String,
    pub result_json: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct HttpExecuteToolRequest {
    meta: HttpRequestMeta,
    tool_name: String,
    tool_version: String,
    arguments_json: String,
    execution_mode: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct HttpRequestMeta {
    request_id: String,
    session_id: String,
    user_id: String,
    tenant_id: String,
    trace_id: String,
    idempotency_key: String,
    deadline_ms: i64,
    api_version: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HttpExecuteToolResponse {
    ok: bool,
    #[serde(default)]
    result_json: String,
    #[allow(dead_code)]
    duration_ms: Option<i32>,
    #[serde(default)]
    error: Option<HttpErrorDetail>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HttpErrorDetail {
    code: String,
    message: String,
}

pub async fn execute_tool(
    state: &Arc<AppState>,
    tool: &DiscoveredTool,
    request_id: &str,
    session_id: &str,
    auth_ctx: &AuthContext,
    trace_id: &str,
    arguments_json: &str,
) -> Result<ExecutedToolResult, AppError> {
    let result_json = match tool.route.protocol {
        ServiceProtocol::Http => {
            execute_http_tool(
                &tool.route,
                request_id,
                session_id,
                auth_ctx,
                trace_id,
                arguments_json,
            )
            .await?
        }
        ServiceProtocol::Grpc => {
            execute_grpc_tool(
                state,
                &tool.route,
                request_id,
                session_id,
                auth_ctx,
                trace_id,
                arguments_json,
            )
            .await?
        }
    };

    Ok(ExecutedToolResult {
        tool_name: tool.definition.name.clone(),
        tool_version: tool.route.tool_version.clone(),
        service_name: tool.route.service_name.clone(),
        result_json,
    })
}

async fn execute_http_tool(
    route: &ToolRoute,
    request_id: &str,
    session_id: &str,
    auth_ctx: &AuthContext,
    trace_id: &str,
    arguments_json: &str,
) -> Result<String, AppError> {
    let client = reqwest::Client::builder()
        .use_native_tls()
        .connect_timeout(Duration::from_secs(CONNECT_TIMEOUT_SECS))
        .timeout(Duration::from_millis(route.timeout_ms as u64))
        .build()
        .map_err(|error| {
            AppError::new(
                ErrorCode::InternalError,
                "failed to build tool execute http client",
            )
            .with_request_id(request_id.to_string())
            .with_upstream(service_upstream(route.service_kind))
            .with_source(error)
        })?;

    let response = client
        .post(format!(
            "{}{}",
            route.target.trim_end_matches('/'),
            derived_http_execute_path(route.http_catalog_path.as_deref())
        ))
        .header("x-request-id", request_id)
        .json(&HttpExecuteToolRequest {
            meta: HttpRequestMeta {
                request_id: request_id.to_string(),
                session_id: session_id.to_string(),
                user_id: auth_ctx.user_id.clone(),
                tenant_id: auth_ctx.tenant_id.clone(),
                trace_id: trace_id.to_string(),
                idempotency_key: format!("{request_id}:{}", route.tool_name),
                deadline_ms: route.timeout_ms as i64,
                api_version: "tool.v1".to_string(),
            },
            tool_name: route.tool_name.clone(),
            tool_version: route.tool_version.clone(),
            arguments_json: arguments_json.to_string(),
            execution_mode: "sync".to_string(),
        })
        .send()
        .await
        .map_err(|error| {
            AppError::new(
                ErrorCode::UpstreamUnavailable,
                format!("tool execute request failed: {error}"),
            )
            .with_request_id(request_id.to_string())
            .with_upstream(service_upstream(route.service_kind))
            .with_source(error)
        })?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(
            AppError::new(
                ErrorCode::DependencyFailed,
                format!(
                    "tool execute request to '{}' returned {}: {}",
                    route.service_name, status, body
                ),
            )
            .with_request_id(request_id.to_string())
            .with_upstream(service_upstream(route.service_kind)),
        );
    }

    let payload = response
        .json::<HttpExecuteToolResponse>()
        .await
        .map_err(|error| {
            AppError::new(
                ErrorCode::DependencyFailed,
                format!("tool execute endpoint returned malformed json: {error}"),
            )
            .with_request_id(request_id.to_string())
            .with_upstream(service_upstream(route.service_kind))
            .with_source(error)
        })?;

    if !payload.ok {
        return Err(
            AppError::new(
                ErrorCode::DependencyFailed,
                format!(
                    "tool execute request was rejected by '{}': {} ({})",
                    route.service_name,
                    payload
                        .error
                        .as_ref()
                        .map(|detail| detail.message.as_str())
                        .unwrap_or("unknown error"),
                    payload
                        .error
                        .as_ref()
                        .map(|detail| detail.code.as_str())
                        .unwrap_or("unknown")
                ),
            )
            .with_request_id(request_id.to_string())
            .with_upstream(service_upstream(route.service_kind)),
        );
    }

    Ok(payload.result_json)
}

async fn execute_grpc_tool(
    _state: &Arc<AppState>,
    route: &ToolRoute,
    request_id: &str,
    session_id: &str,
    auth_ctx: &AuthContext,
    trace_id: &str,
    arguments_json: &str,
) -> Result<String, AppError> {
    let mut client = ToolServiceClient::connect(route.target.clone())
        .await
        .map_err(|error| {
            AppError::new(
                ErrorCode::UpstreamUnavailable,
                format!("failed to connect tool execute grpc endpoint: {error}"),
            )
            .with_request_id(request_id.to_string())
            .with_upstream(service_upstream(route.service_kind))
            .with_source(error)
        })?;

    let response = client
        .execute_tool(Request::new(ExecuteToolRequest {
            meta: Some(RequestMeta {
                request_id: request_id.to_string(),
                session_id: session_id.to_string(),
                user_id: auth_ctx.user_id.clone(),
                tenant_id: auth_ctx.tenant_id.clone(),
                trace_id: trace_id.to_string(),
                idempotency_key: format!("{request_id}:{}", route.tool_name),
                deadline_ms: route.timeout_ms as i64,
                api_version: "tool.v1".to_string(),
            }),
            tool_name: route.tool_name.clone(),
            tool_version: route.tool_version.clone(),
            arguments_json: arguments_json.to_string(),
            execution_mode: crate::clients::proto::ExecutionMode::Sync as i32,
        }))
        .await
        .map_err(|status| {
            AppError::from_grpc_status(&status, service_upstream(route.service_kind))
                .with_request_id(request_id.to_string())
        })?
        .into_inner();

    map_grpc_execute_response(route, request_id, response)
}

fn map_grpc_execute_response(
    route: &ToolRoute,
    request_id: &str,
    response: ExecuteToolResponse,
) -> Result<String, AppError> {
    if !response.ok {
        return Err(
            AppError::new(
                ErrorCode::DependencyFailed,
                format!(
                    "tool execute request was rejected by '{}': {}",
                    route.service_name,
                    response
                        .error
                        .as_ref()
                        .map(|detail| detail.message.as_str())
                        .unwrap_or("unknown error")
                ),
            )
            .with_request_id(request_id.to_string())
            .with_upstream(service_upstream(route.service_kind)),
        );
    }

    Ok(response.result_json)
}

fn derived_http_execute_path(http_catalog_path: Option<&str>) -> String {
    let base = http_catalog_path
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("/internal/tools");

    let normalized = if base.starts_with('/') {
        base.to_string()
    } else {
        format!("/{base}")
    };

    format!("{}/execute", normalized.trim_end_matches('/'))
}
