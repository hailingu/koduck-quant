//! Compatibility provider that adapts the existing gRPC LLM adapter to the unified trait.

use async_trait::async_trait;
use futures::StreamExt;
use tonic::transport::Channel;

use crate::{
    clients::proto::{
        ChatMessage as ProtoChatMessage, CountTokensRequest as ProtoCountTokensRequest,
        GenerateRequest as ProtoGenerateRequest, LlmServiceClient, ListModelsRequest as ProtoListModelsRequest,
        ModelInfo as ProtoModelInfo, RequestMeta, StreamGenerateEvent as ProtoStreamGenerateEvent,
        TokenUsage as ProtoTokenUsage, ToolDefinition as ProtoToolDefinition,
    },
    reliability::{
        error::{AppError, ErrorCode, UpstreamService},
        error_mapper::{map_contract_error_detail, map_grpc_status, map_transport_error},
    },
};

use super::{
    provider::{LlmProvider, ProviderEventStream},
    types::{
        ChatMessage, CountTokensRequest, CountTokensResponse, GenerateRequest, GenerateResponse,
        ListModelsRequest, ModelInfo, StreamEvent, TokenUsage, ToolDefinition,
    },
};

#[derive(Debug, Clone)]
pub struct AdapterLlmProvider {
    adapter_grpc_target: String,
}

impl AdapterLlmProvider {
    pub fn new(adapter_grpc_target: impl Into<String>) -> Self {
        Self {
            adapter_grpc_target: adapter_grpc_target.into(),
        }
    }

    async fn connect(&self, request_id: &str) -> Result<LlmServiceClient<Channel>, AppError> {
        let target = grpc_target_with_scheme(&self.adapter_grpc_target);
        let channel = Channel::from_shared(target.clone())
            .map_err(|e| {
                map_transport_error(
                    UpstreamService::Llm,
                    request_id.to_string(),
                    "invalid llm grpc target",
                    e,
                )
            })?
            .connect()
            .await
            .map_err(|e| {
                map_transport_error(
                    UpstreamService::Llm,
                    request_id.to_string(),
                    "failed to connect llm adapter",
                    e,
                )
            })?;

        Ok(LlmServiceClient::new(channel))
    }
}

#[async_trait]
impl LlmProvider for AdapterLlmProvider {
    async fn generate(&self, req: GenerateRequest) -> Result<GenerateResponse, AppError> {
        let request_id = req.meta.request_id.clone();
        let provider = req.provider.clone();
        let model = req.model.clone();
        let mut client = self.connect(&request_id).await?;
        let response = client
            .generate(tonic::Request::new(proto_generate_request(req)))
            .await
            .map_err(|e| map_grpc_status(UpstreamService::Llm, request_id.clone(), &e))?
            .into_inner();

        if !response.ok {
            return Err(map_contract_error_detail(
                UpstreamService::Llm,
                request_id,
                response.error.as_ref(),
                ErrorCode::DependencyFailed,
                "llm adapter returned not ok",
            ));
        }

        Ok(GenerateResponse {
            provider,
            model,
            message: proto_chat_message_to_unified(response.message.unwrap_or_default()),
            finish_reason: response.finish_reason,
            usage: response.usage.map(proto_usage_to_unified),
        })
    }

    async fn stream_generate(&self, req: GenerateRequest) -> Result<ProviderEventStream, AppError> {
        let request_id = req.meta.request_id.clone();
        let provider = req.provider.clone();
        let model = req.model.clone();
        let mut client = self.connect(&request_id).await?;
        let stream = client
            .stream_generate(tonic::Request::new(proto_generate_request(req)))
            .await
            .map_err(|e| map_grpc_status(UpstreamService::Llm, request_id.clone(), &e))?
            .into_inner()
            .map(move |item| match item {
                Ok(event) => proto_stream_event_to_unified(event, &request_id, &provider, &model),
                Err(status) => Err(map_grpc_status(
                    UpstreamService::Llm,
                    request_id.clone(),
                    &status,
                )),
            });

        Ok(Box::pin(stream))
    }

    async fn list_models(&self, req: ListModelsRequest) -> Result<Vec<ModelInfo>, AppError> {
        let request_id = req.meta.request_id.clone();
        let mut client = self.connect(&request_id).await?;
        let response = client
            .list_models(tonic::Request::new(ProtoListModelsRequest {
                meta: Some(proto_request_meta(&req.meta)),
                provider: req.provider.clone(),
            }))
            .await
            .map_err(|e| map_grpc_status(UpstreamService::Llm, request_id.clone(), &e))?
            .into_inner();

        if !response.ok {
            return Err(map_contract_error_detail(
                UpstreamService::Llm,
                request_id,
                response.error.as_ref(),
                ErrorCode::DependencyFailed,
                "llm adapter list_models returned not ok",
            ));
        }

        Ok(response.models.into_iter().map(proto_model_to_unified).collect())
    }

    async fn count_tokens(
        &self,
        req: CountTokensRequest,
    ) -> Result<CountTokensResponse, AppError> {
        let request_id = req.meta.request_id.clone();
        let mut client = self.connect(&request_id).await?;
        let response = client
            .count_tokens(tonic::Request::new(ProtoCountTokensRequest {
                meta: Some(proto_request_meta(&req.meta)),
                model: req.model.clone(),
                messages: req
                    .messages
                    .into_iter()
                    .map(unified_chat_message_to_proto)
                    .collect(),
            }))
            .await
            .map_err(|e| map_grpc_status(UpstreamService::Llm, request_id.clone(), &e))?
            .into_inner();

        if !response.ok {
            return Err(map_contract_error_detail(
                UpstreamService::Llm,
                request_id,
                response.error.as_ref(),
                ErrorCode::DependencyFailed,
                "llm adapter count_tokens returned not ok",
            ));
        }

        Ok(CountTokensResponse {
            provider: req.provider,
            model: req.model,
            total_tokens: response.total_tokens.max(0) as u32,
        })
    }
}

fn proto_generate_request(req: GenerateRequest) -> ProtoGenerateRequest {
    ProtoGenerateRequest {
        meta: Some(proto_request_meta(&req.meta)),
        model: req.model,
        messages: req
            .messages
            .into_iter()
            .map(unified_chat_message_to_proto)
            .collect(),
        temperature: req.temperature,
        top_p: req.top_p,
        max_tokens: req.max_tokens as i32,
        tools: req
            .tools
            .into_iter()
            .map(unified_tool_to_proto)
            .collect(),
        response_format: req.response_format,
        provider: req.provider,
    }
}

fn proto_request_meta(meta: &super::types::RequestContext) -> RequestMeta {
    RequestMeta {
        request_id: meta.request_id.clone(),
        session_id: meta.session_id.clone(),
        user_id: meta.user_id.clone(),
        tenant_id: String::new(),
        trace_id: meta.trace_id.clone(),
        idempotency_key: String::new(),
        deadline_ms: meta.deadline_ms as i64,
        api_version: "v1".to_string(),
    }
}

fn unified_chat_message_to_proto(message: ChatMessage) -> ProtoChatMessage {
    ProtoChatMessage {
        role: message.role,
        content: message.content,
        name: message.name,
        metadata: message.metadata,
    }
}

fn proto_chat_message_to_unified(message: ProtoChatMessage) -> ChatMessage {
    ChatMessage {
        role: message.role,
        content: message.content,
        name: message.name,
        metadata: message.metadata,
    }
}

fn unified_tool_to_proto(tool: ToolDefinition) -> ProtoToolDefinition {
    ProtoToolDefinition {
        name: tool.name,
        description: tool.description,
        input_schema: tool.input_schema,
    }
}

fn proto_usage_to_unified(usage: ProtoTokenUsage) -> TokenUsage {
    TokenUsage {
        prompt_tokens: usage.prompt_tokens.max(0) as u32,
        completion_tokens: usage.completion_tokens.max(0) as u32,
        total_tokens: usage.total_tokens.max(0) as u32,
    }
}

fn proto_model_to_unified(model: ProtoModelInfo) -> ModelInfo {
    ModelInfo {
        id: model.id,
        provider: model.provider,
        display_name: model.display_name,
        max_context_tokens: model.max_context_tokens.max(0) as u32,
        max_output_tokens: model.max_output_tokens.max(0) as u32,
        supports_streaming: model.supports_streaming,
        supports_tools: model.supports_tools,
        supported_features: model.supported_features,
    }
}

fn proto_stream_event_to_unified(
    event: ProtoStreamGenerateEvent,
    request_id: &str,
    provider: &str,
    model: &str,
) -> Result<StreamEvent, AppError> {
    if event.error.is_some() {
        return Err(map_contract_error_detail(
            UpstreamService::Llm,
            request_id.to_string(),
            event.error.as_ref(),
            ErrorCode::DependencyFailed,
            "llm stream returned error event",
        ));
    }

    Ok(StreamEvent {
        provider: provider.to_string(),
        model: model.to_string(),
        event_id: event.event_id,
        sequence_num: event.sequence_num.max(0) as u32,
        delta: event.delta,
        finish_reason: event.finish_reason,
        usage: event.usage.map(proto_usage_to_unified),
    })
}

fn grpc_target_with_scheme(raw: &str) -> String {
    if raw.starts_with("http://") || raw.starts_with("https://") {
        raw.to_string()
    } else {
        format!("http://{raw}")
    }
}
