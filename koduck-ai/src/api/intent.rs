use std::{collections::HashMap, sync::Arc};

use crate::{
    app::AppState,
    auth::AuthContext,
    llm::{
        ChatMessage as ProviderChatMessage, GenerateRequest as ProviderGenerateRequest,
        RequestContext,
    },
    reliability::error::AppError,
};

use super::ChatRequest;
use tracing::info;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum ActionIntent {
    Answer,
    Query,
    Research,
    Plan,
    Summarize,
}

impl ActionIntent {
    pub(super) fn as_str(self) -> &'static str {
        match self {
            Self::Answer => "answer",
            Self::Query => "query",
            Self::Research => "research",
            Self::Plan => "plan",
            Self::Summarize => "summarize",
        }
    }

    fn from_str(value: &str) -> Self {
        match enum_token(value).as_str() {
            "query" => Self::Query,
            "research" => Self::Research,
            "plan" => Self::Plan,
            "summarize" => Self::Summarize,
            _ => Self::Answer,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum TargetIntent {
    None,
    Knowledge,
    Memory,
    Conversation,
}

impl TargetIntent {
    pub(super) fn as_str(self) -> &'static str {
        match self {
            Self::None => "none",
            Self::Knowledge => "knowledge",
            Self::Memory => "memory",
            Self::Conversation => "conversation",
        }
    }

    fn from_str(value: &str) -> Self {
        match enum_token(value).as_str() {
            "knowledge" => Self::Knowledge,
            "memory" => Self::Memory,
            "conversation" => Self::Conversation,
            _ => Self::None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum PresentationIntent {
    Text,
    Table,
    FlowCanvas,
    Json,
}

impl PresentationIntent {
    pub(super) fn as_str(self) -> &'static str {
        match self {
            Self::Text => "text",
            Self::Table => "table",
            Self::FlowCanvas => "flow_canvas",
            Self::Json => "json",
        }
    }

    fn from_str(value: &str) -> Self {
        match enum_token(value).as_str() {
            "table" => Self::Table,
            "flow_canvas" => Self::FlowCanvas,
            "json" => Self::Json,
            _ => Self::Text,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub(super) struct ExecutionIntent {
    pub(super) action: ActionIntent,
    pub(super) target: TargetIntent,
    pub(super) presentation: PresentationIntent,
    pub(super) confidence: f64,
}

impl Default for ExecutionIntent {
    fn default() -> Self {
        Self {
            action: ActionIntent::Answer,
            target: TargetIntent::None,
            presentation: PresentationIntent::Text,
            confidence: 0.0,
        }
    }
}

fn plan_canvas_enabled(request: &ChatRequest) -> bool {
    request
        .metadata
        .as_ref()
        .and_then(|metadata| metadata.get("enablePlanCanvas"))
        .and_then(|value| match value {
            serde_json::Value::Bool(value) => Some(*value),
            serde_json::Value::String(value) => value.parse::<bool>().ok(),
            _ => None,
        })
        .unwrap_or(false)
}

pub(super) fn request_execution_intent(request: &ChatRequest) -> ExecutionIntent {
    let Some(metadata) = request.metadata.as_ref() else {
        return ExecutionIntent::default();
    };

    ExecutionIntent {
        action: metadata
            .get("actionIntent")
            .and_then(|value| value.as_str())
            .map(ActionIntent::from_str)
            .unwrap_or(ActionIntent::Answer),
        target: metadata
            .get("targetIntent")
            .and_then(|value| value.as_str())
            .map(TargetIntent::from_str)
            .unwrap_or(TargetIntent::None),
        presentation: metadata
            .get("presentationIntent")
            .and_then(|value| value.as_str())
            .map(PresentationIntent::from_str)
            .unwrap_or(PresentationIntent::Text),
        confidence: metadata
            .get("confidence")
            .and_then(json_number_or_string)
            .unwrap_or(0.0),
    }
}

fn request_has_execution_intent(request: &ChatRequest) -> bool {
    request.metadata.as_ref().is_some_and(|metadata| {
        metadata.contains_key("actionIntent")
            || metadata.contains_key("targetIntent")
            || metadata.contains_key("presentationIntent")
    })
}

pub(super) fn request_with_execution_intent(
    request: &ChatRequest,
    intent: ExecutionIntent,
) -> ChatRequest {
    let mut request = request.clone();
    let mut metadata = request.metadata.take().unwrap_or_default();
    metadata.insert(
        "actionIntent".to_string(),
        serde_json::Value::String(intent.action.as_str().to_string()),
    );
    metadata.insert(
        "targetIntent".to_string(),
        serde_json::Value::String(intent.target.as_str().to_string()),
    );
    metadata.insert(
        "presentationIntent".to_string(),
        serde_json::Value::String(intent.presentation.as_str().to_string()),
    );
    metadata.insert(
        "confidence".to_string(),
        serde_json::Value::from(intent.confidence),
    );
    request.metadata = Some(metadata);
    request
}

fn json_number_or_string(value: &serde_json::Value) -> Option<f64> {
    value
        .as_f64()
        .or_else(|| value.as_str().and_then(|value| value.parse::<f64>().ok()))
}

fn enum_token(value: &str) -> String {
    value
        .trim()
        .trim_matches(|ch| ch == '"' || ch == '\'' || ch == ',' || ch == '`')
        .split(|ch: char| {
            ch.is_whitespace()
                || matches!(ch, '(' | ')' | '[' | ']' | '{' | '}' | ':' | ';' | ',')
        })
        .next()
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase()
}

pub(super) fn parse_execution_intent_response(content: &str) -> Option<ExecutionIntent> {
    extract_json_objects(content)
        .into_iter()
        .rev()
        .find_map(|value| execution_intent_from_json(&value))
}

fn execution_intent_from_json(value: &serde_json::Value) -> Option<ExecutionIntent> {
    if !value.is_object() {
        return None;
    }

    let action = parse_action_intent(value
        .get("actionIntent")
        .or_else(|| value.get("action"))
        .and_then(|intent| intent.as_str())?)?;
    let target = parse_target_intent(value
        .get("targetIntent")
        .or_else(|| value.get("target"))
        .and_then(|intent| intent.as_str())?)?;
    let presentation = parse_presentation_intent(value
        .get("presentationIntent")
        .or_else(|| value.get("presentation"))
        .and_then(|intent| intent.as_str())?)?;
    let confidence = value
        .get("confidence")
        .and_then(json_number_or_string)
        .unwrap_or(0.0);

    Some(ExecutionIntent {
        action,
        target,
        presentation,
        confidence,
    })
}

fn parse_action_intent(value: &str) -> Option<ActionIntent> {
    match enum_token(value).as_str() {
        "answer" => Some(ActionIntent::Answer),
        "query" => Some(ActionIntent::Query),
        "research" => Some(ActionIntent::Research),
        "plan" => Some(ActionIntent::Plan),
        "summarize" => Some(ActionIntent::Summarize),
        _ => None,
    }
}

fn parse_target_intent(value: &str) -> Option<TargetIntent> {
    match enum_token(value).as_str() {
        "none" => Some(TargetIntent::None),
        "knowledge" => Some(TargetIntent::Knowledge),
        "memory" => Some(TargetIntent::Memory),
        "conversation" => Some(TargetIntent::Conversation),
        _ => None,
    }
}

fn parse_presentation_intent(value: &str) -> Option<PresentationIntent> {
    match enum_token(value).as_str() {
        "text" => Some(PresentationIntent::Text),
        "table" => Some(PresentationIntent::Table),
        "flow_canvas" => Some(PresentationIntent::FlowCanvas),
        "json" => Some(PresentationIntent::Json),
        _ => None,
    }
}

fn contains_any(value: &str, needles: &[&str]) -> bool {
    needles.iter().any(|needle| value.contains(needle))
}

pub(super) fn fallback_execution_intent(request: &ChatRequest) -> ExecutionIntent {
    let message = request.message.trim().to_ascii_lowercase();
    let original = request.message.trim();

    let presentation = if contains_any(
        &message,
        &["flow", "canvas", "flow diagram", "流程图", "节点图"],
    ) {
        PresentationIntent::FlowCanvas
    } else if contains_any(&message, &["json"]) {
        PresentationIntent::Json
    } else if contains_any(&message, &["table", "表格"]) {
        PresentationIntent::Table
    } else {
        PresentationIntent::Text
    };

    let target = if contains_any(
        original,
        &[
            "当前对话",
            "聊天记录",
            "当前 session",
            "当前session",
            "之前聊",
            "我们聊",
        ],
    ) {
        TargetIntent::Conversation
    } else if contains_any(
        original,
        &["memory", "记忆", "memory entry", "记忆条目", "聊天 memory"],
    ) {
        TargetIntent::Memory
    } else if contains_any(original, &["知识库", "资料", "信息", "关于"]) {
        TargetIntent::Knowledge
    } else {
        TargetIntent::None
    };

    let action = if contains_any(original, &["计划", "步骤", "方案", "工作流"]) {
        ActionIntent::Plan
    } else if contains_any(original, &["总结", "概括", "梳理"]) {
        ActionIntent::Summarize
    } else if contains_any(original, &["分析", "研究", "综合判断"]) {
        ActionIntent::Research
    } else if contains_any(
        original,
        &["查询", "查", "有没有", "是否有", "哪些", "资料", "之前"],
    ) {
        ActionIntent::Query
    } else {
        ActionIntent::Answer
    };

    ExecutionIntent {
        action,
        target,
        presentation,
        confidence: 0.4,
    }
}

fn intent_response_log_preview(content: &str) -> String {
    if parse_execution_intent_response(content).is_some() {
        return "valid_execution_intent_json".to_string();
    }

    content
        .trim()
        .chars()
        .take(160)
        .collect::<String>()
        .replace('\n', "\\n")
        .replace('\r', "\\r")
}

fn extract_json_objects(content: &str) -> Vec<serde_json::Value> {
    let mut values = Vec::new();
    for (start_index, _) in content.match_indices('{') {
        let candidate = &content[start_index..];
        let mut stream =
            serde_json::Deserializer::from_str(candidate).into_iter::<serde_json::Value>();
        if let Some(Ok(value)) = stream.next() {
            values.push(value);
        }
    }
    values
}

pub(super) async fn classify_execution_intent(
    state: &Arc<AppState>,
    request: &ChatRequest,
    request_id: &str,
    session_id: &str,
    auth_ctx: &AuthContext,
    trace_id: &str,
) -> Result<ExecutionIntent, AppError> {
    if !plan_canvas_enabled(request) {
        info!(
            request_id = %request_id,
            session_id = %session_id,
            reason = "plan_canvas_disabled",
            "execution intent classification skipped"
        );
        return Ok(ExecutionIntent::default());
    }

    if request_has_execution_intent(request) {
        info!(
            request_id = %request_id,
            session_id = %session_id,
            source = "request_metadata",
            "execution intent loaded from request metadata"
        );
        return Ok(request_execution_intent(request));
    }

    let mut user_context = String::new();
    if let Some(history) = request.history.as_ref() {
        for item in history.iter().rev().take(8).rev() {
            user_context.push_str(item.role.trim());
            user_context.push_str(": ");
            user_context.push_str(item.content.trim());
            user_context.push('\n');
        }
    }
    user_context.push_str("user: ");
    user_context.push_str(request.message.trim());

    let classifier_request = ProviderGenerateRequest {
        meta: RequestContext {
            request_id: format!("{}:execution-intent", request_id),
            session_id: session_id.to_string(),
            user_id: auth_ctx.user_id.clone(),
            trace_id: trace_id.to_string(),
            deadline_ms: state.config.llm.timeout_ms,
        },
        provider: request.provider.clone().unwrap_or_default(),
        model: request.model.clone().unwrap_or_default(),
        messages: vec![
            ProviderChatMessage {
                role: "system".to_string(),
                content: r#"你是 koduck-ai 的 execution intent router。你的任务是把当前用户请求拆成三个独立维度：动作、目标、表现形式。
你可以在内部推理，但最终回答必须只输出一个严格 JSON 对象，不能把解释、分析、Markdown、列表、代码块、前后缀或自然语言写入最终 content。
JSON schema:
{"actionIntent":"answer|query|research|plan|summarize","targetIntent":"none|knowledge|memory|conversation","presentationIntent":"text|table|flow_canvas|json","confidence":0.0}

判定标准:
- actionIntent=answer: 直接回答、解释、说明。
- actionIntent=query: 查询或展示已有信息。
- actionIntent=research: 需要研究、分析、综合判断。
- actionIntent=plan: 生成计划、步骤、执行方案、工作流。
- actionIntent=summarize: 总结已有内容。
- targetIntent=memory: 目标是 memory entry、记忆条目、当前会话记忆、聊天 memory。
- targetIntent=knowledge: 目标是知识库、领域知识、资料。
- targetIntent=conversation: 目标是当前对话、聊天记录、当前 session 内容、当前会话上下文。
- targetIntent=none: 没有明确外部目标。
- presentationIntent=flow_canvas: 仅当“当前用户最后一条消息”明确要求用 flow/canvas/flow diagram/流程图/节点图展示、表达、生成可编辑流程或节点化计划时使用。
- 如果用户只是说“根据该 flow”“基于这个 flow”“参考上面的 flow”，这是引用上下文，不是展示形式请求，presentationIntent 必须为 text。
- presentationIntent=table: 用户明确要求表格。
- presentationIntent=json: 用户明确要求 JSON。
- presentationIntent=text: 默认表现形式；当用户没有明确指定表格、JSON、flow/canvas、流程图或节点图时使用。这里的 text 表示“最终回答使用 Markdown 文本”，不是让你用 Markdown 输出本分类结果。

示例:
- "解释一下夏普比率的含义" => {"actionIntent":"answer","targetIntent":"none","presentationIntent":"text","confidence":0.9}
- "火箭队姚明的每年数据" => {"actionIntent":"query","targetIntent":"knowledge","presentationIntent":"text","confidence":0.9}
- "把当前策略回测结果按指标整理成表格" => {"actionIntent":"summarize","targetIntent":"conversation","presentationIntent":"table","confidence":0.9}
- "查询知识库里关于动量因子的资料，并用 JSON 返回" => {"actionIntent":"query","targetIntent":"knowledge","presentationIntent":"json","confidence":0.9}
- "以 flow 的模式显示现在的我们聊天的 memory entry" => {"actionIntent":"query","targetIntent":"memory","presentationIntent":"flow_canvas","confidence":0.9}
- "使用flow的形式展示当前session的内容" => {"actionIntent":"summarize","targetIntent":"conversation","presentationIntent":"flow_canvas","confidence":0.9}
"#.to_string(),
                name: String::new(),
                metadata: HashMap::new(),
            },
            ProviderChatMessage {
                role: "user".to_string(),
                content: user_context.clone(),
                name: String::new(),
                metadata: HashMap::new(),
            },
        ],
        temperature: 0.0,
        top_p: 1.0,
        max_tokens: 256,
        tools: Vec::new(),
        response_format: "json_object".to_string(),
    };

    match state.llm_provider.generate(classifier_request).await {
        Ok(response) => {
            let raw_response_preview = intent_response_log_preview(&response.message.content);
            info!(
                request_id = %request_id,
                session_id = %session_id,
                raw_response_preview = %raw_response_preview,
                raw_response_chars = response.message.content.chars().count(),
                "execution intent classifier raw response"
            );
            if let Some(intent) = parse_execution_intent_response(&response.message.content) {
                return Ok(intent);
            }

            let fallback_intent = fallback_execution_intent(request);
            info!(
                request_id = %request_id,
                session_id = %session_id,
                action_intent = %fallback_intent.action.as_str(),
                target_intent = %fallback_intent.target.as_str(),
                presentation_intent = %fallback_intent.presentation.as_str(),
                "execution intent classifier returned no strict JSON; using local fallback"
            );
            Ok(fallback_intent)
        }
        Err(err) => Err(err),
    }
}
