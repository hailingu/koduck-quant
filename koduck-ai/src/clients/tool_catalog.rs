//! Dynamic tool catalog discovery for prompt injection.

use std::{collections::HashSet, sync::Arc, time::Duration};

use reqwest::StatusCode;
use serde::Deserialize;
use tonic::Request;
use tracing::warn;

use crate::{
    app::AppState,
    clients::proto::{ListToolsRequest, RequestMeta, ToolServiceClient},
    llm::ToolDefinition as ProviderToolDefinition,
    registry::{DiscoveredService, ServiceKind, ServiceProtocol, ToolDiscovery},
    reliability::error::{AppError, ErrorCode, UpstreamService},
};

const CONNECT_TIMEOUT_SECS: u64 = 3;
const REQUEST_TIMEOUT_SECS: u64 = 5;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HttpToolCatalogResponse {
    #[allow(dead_code)]
    service: Option<String>,
    #[serde(default)]
    tools: Vec<HttpToolDefinition>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HttpToolDefinition {
    name: String,
    description: String,
    input_schema: String,
}

pub async fn fetch_prompt_tool_definitions(
    state: &Arc<AppState>,
    request_id: &str,
) -> Vec<ProviderToolDefinition> {
    let services = state
        .service_registry
        .resolve_ai_tool_definition_services()
        .await;
    let mut definitions = Vec::new();
    let mut seen_names = HashSet::new();

    for service in services {
        match fetch_service_tool_definitions(&service, request_id).await {
            Ok(service_tools) => {
                for tool in service_tools {
                    if seen_names.insert(tool.name.clone()) {
                        definitions.push(tool);
                    } else {
                        warn!(
                            request_id = %request_id,
                            service = %service.name,
                            tool_name = %tool.name,
                            "duplicate tool definition ignored"
                        );
                    }
                }
            }
            Err(error) => {
                warn!(
                    request_id = %request_id,
                    service = %service.name,
                    error = %error,
                    "failed to fetch tool definitions from discovered service; continuing without them"
                );
            }
        }
    }

    definitions.sort_by(|left, right| left.name.cmp(&right.name));
    definitions
}

async fn fetch_service_tool_definitions(
    service: &DiscoveredService,
    request_id: &str,
) -> Result<Vec<ProviderToolDefinition>, AppError> {
    let discovery = service.tool_discovery.as_ref().ok_or_else(|| {
        AppError::new(
            ErrorCode::DependencyFailed,
            format!("service '{}' does not advertise tool discovery metadata", service.name),
        )
        .with_request_id(request_id.to_string())
        .with_upstream(service_upstream(service.service_kind))
    })?;

    match discovery.protocol {
        ServiceProtocol::Http => fetch_http_tool_definitions(service, discovery, request_id).await,
        ServiceProtocol::Grpc => fetch_grpc_tool_definitions(service, discovery, request_id).await,
    }
}

async fn fetch_http_tool_definitions(
    service: &DiscoveredService,
    discovery: &ToolDiscovery,
    request_id: &str,
) -> Result<Vec<ProviderToolDefinition>, AppError> {
    let client = reqwest::Client::builder()
        .use_native_tls()
        .connect_timeout(Duration::from_secs(CONNECT_TIMEOUT_SECS))
        .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
        .build()
        .map_err(|error| {
            AppError::new(
                ErrorCode::InternalError,
                "failed to build tool catalog http client",
            )
            .with_request_id(request_id.to_string())
            .with_upstream(service_upstream(service.service_kind))
            .with_source(error)
        })?;

    let base_url = discovery.target.trim_end_matches('/');
    let path = discovery
        .http_path
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("/internal/tools");
    let normalized_path = if path.starts_with('/') {
        path.to_string()
    } else {
        format!("/{path}")
    };

    let response = client
        .get(format!("{base_url}{normalized_path}"))
        .header("x-request-id", request_id)
        .send()
        .await
        .map_err(|error| {
            AppError::new(
                ErrorCode::UpstreamUnavailable,
                format!("tool catalog request failed: {error}"),
            )
            .with_request_id(request_id.to_string())
            .with_upstream(service_upstream(service.service_kind))
            .with_source(error)
        })?;

    let status = response.status();
    if !status.is_success() {
        return Err(http_error(service, request_id, status, response).await);
    }

    let payload = response
        .json::<HttpToolCatalogResponse>()
        .await
        .map_err(|error| {
            AppError::new(
                ErrorCode::DependencyFailed,
                format!("tool catalog returned malformed json: {error}"),
            )
            .with_request_id(request_id.to_string())
            .with_upstream(service_upstream(service.service_kind))
            .with_source(error)
        })?;

    Ok(payload
        .tools
        .into_iter()
        .map(|tool| ProviderToolDefinition {
            name: tool.name,
            description: tool.description,
            input_schema: tool.input_schema,
        })
        .collect())
}

async fn fetch_grpc_tool_definitions(
    service: &DiscoveredService,
    discovery: &ToolDiscovery,
    request_id: &str,
) -> Result<Vec<ProviderToolDefinition>, AppError> {
    let mut client = ToolServiceClient::connect(discovery.target.clone())
        .await
        .map_err(|error| {
            AppError::new(
                ErrorCode::UpstreamUnavailable,
                format!("failed to connect tool catalog grpc endpoint: {error}"),
            )
            .with_request_id(request_id.to_string())
            .with_upstream(service_upstream(service.service_kind))
            .with_source(error)
        })?;

    let response = client
        .list_tools(Request::new(ListToolsRequest {
            meta: Some(RequestMeta {
                request_id: request_id.to_string(),
                session_id: "tool-catalog-discovery".to_string(),
                user_id: "system".to_string(),
                tenant_id: "system".to_string(),
                trace_id: format!("trace-tool-catalog-{request_id}"),
                idempotency_key: String::new(),
                deadline_ms: REQUEST_TIMEOUT_SECS as i64 * 1000,
                api_version: "tool.v1".to_string(),
            }),
            permission_scope: String::new(),
        }))
        .await
        .map_err(|status| {
            AppError::from_grpc_status(&status, service_upstream(service.service_kind))
                .with_request_id(request_id.to_string())
        })?
        .into_inner();

    if !response.ok {
        return Err(
            AppError::new(
                ErrorCode::DependencyFailed,
                format!(
                    "tool catalog request was rejected by '{}': {}",
                    service.name,
                    response
                        .error
                        .as_ref()
                        .map(|detail| detail.message.as_str())
                        .unwrap_or("unknown error")
                ),
            )
            .with_request_id(request_id.to_string())
            .with_upstream(service_upstream(service.service_kind)),
        );
    }

    Ok(response
        .tools
        .into_iter()
        .map(|tool| ProviderToolDefinition {
            name: tool.name,
            description: tool.description,
            input_schema: tool.input_schema,
        })
        .collect())
}

async fn http_error(
    service: &DiscoveredService,
    request_id: &str,
    status: StatusCode,
    response: reqwest::Response,
) -> AppError {
    let upstream = service_upstream(service.service_kind);
    let text = response.text().await.unwrap_or_default();
    AppError::new(
        ErrorCode::DependencyFailed,
        format!(
            "tool catalog request to '{}' returned {}: {}",
            service.name, status, text
        ),
    )
    .with_request_id(request_id.to_string())
    .with_upstream(upstream)
}

fn service_upstream(kind: ServiceKind) -> UpstreamService {
    match kind {
        ServiceKind::Memory => UpstreamService::Memory,
        ServiceKind::Knowledge => UpstreamService::Knowledge,
        ServiceKind::Tool => UpstreamService::Tool,
        ServiceKind::Llm => UpstreamService::Llm,
        ServiceKind::Ai | ServiceKind::Gateway => UpstreamService::Tool,
    }
}
