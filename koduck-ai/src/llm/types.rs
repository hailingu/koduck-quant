//! Unified LLM provider request/response types used by orchestrators.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RequestContext {
    pub request_id: String,
    pub session_id: String,
    pub user_id: String,
    pub trace_id: String,
    pub deadline_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
    pub name: String,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub input_schema: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TokenUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GenerateRequest {
    pub meta: RequestContext,
    pub provider: String,
    pub model: String,
    pub messages: Vec<ChatMessage>,
    pub temperature: f32,
    pub top_p: f32,
    pub max_tokens: u32,
    pub tools: Vec<ToolDefinition>,
    pub response_format: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GenerateResponse {
    pub provider: String,
    pub model: String,
    pub message: ChatMessage,
    pub finish_reason: String,
    pub usage: Option<TokenUsage>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StreamEvent {
    pub provider: String,
    pub model: String,
    pub event_id: String,
    pub sequence_num: u32,
    pub delta: String,
    pub finish_reason: String,
    pub usage: Option<TokenUsage>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ModelInfo {
    pub id: String,
    pub provider: String,
    pub display_name: String,
    pub max_context_tokens: u32,
    pub max_output_tokens: u32,
    pub supports_streaming: bool,
    pub supports_tools: bool,
    pub supported_features: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ListModelsRequest {
    pub meta: RequestContext,
    pub provider: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CountTokensRequest {
    pub meta: RequestContext,
    pub provider: String,
    pub model: String,
    pub messages: Vec<ChatMessage>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CountTokensResponse {
    pub provider: String,
    pub model: String,
    pub total_tokens: u32,
}
