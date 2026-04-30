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
        match value.trim() {
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
        match value.trim() {
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
        match value.trim() {
            "table" => Self::Table,
            "flow_canvas" => Self::FlowCanvas,
            "json" => Self::Json,
            _ => Self::Text,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) struct ExecutionIntent {
    pub(super) action: ActionIntent,
    pub(super) target: TargetIntent,
    pub(super) presentation: PresentationIntent,
}

impl Default for ExecutionIntent {
    fn default() -> Self {
        Self {
            action: ActionIntent::Answer,
            target: TargetIntent::None,
            presentation: PresentationIntent::Text,
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
    request.metadata = Some(metadata);
    request
}

pub(super) fn parse_execution_intent_response(content: &str) -> ExecutionIntent {
    let trimmed = content.trim();
    let json_text = if trimmed.starts_with('{') {
        trimmed
    } else if let (Some(start), Some(end)) = (trimmed.find('{'), trimmed.rfind('}')) {
        &trimmed[start..=end]
    } else {
        return ExecutionIntent::default();
    };

    serde_json::from_str::<serde_json::Value>(json_text)
        .ok()
        .map(|value| {
            let action = value
                .get("actionIntent")
                .or_else(|| value.get("action"))
                .and_then(|intent| intent.as_str())
                .map(ActionIntent::from_str)
                .unwrap_or(ActionIntent::Answer);
            let target = value
                .get("targetIntent")
                .or_else(|| value.get("target"))
                .and_then(|intent| intent.as_str())
                .map(TargetIntent::from_str)
                .unwrap_or(TargetIntent::None);
            let presentation = value
                .get("presentationIntent")
                .or_else(|| value.get("presentation"))
                .and_then(|intent| intent.as_str())
                .map(PresentationIntent::from_str)
                .unwrap_or(PresentationIntent::Text);

            ExecutionIntent {
                action,
                target,
                presentation,
            }
        })
        .unwrap_or_default()
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
        return Ok(ExecutionIntent::default());
    }

    if request_has_execution_intent(request) {
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
只输出 JSON 对象，不要输出解释。JSON schema:
{"actionIntent":"answer|query|research|plan|summarize","targetIntent":"none|knowledge|memory|conversation","presentationIntent":"text|table|flow_canvas|json","confidence":0.0}

判定标准:
- actionIntent=answer: 直接回答、解释、说明。
- actionIntent=query: 查询或展示已有信息。
- actionIntent=research: 需要研究、分析、综合判断。
- actionIntent=plan: 生成计划、步骤、执行方案、工作流。
- actionIntent=summarize: 总结已有内容。
- targetIntent=memory: 目标是 memory entry、记忆条目、当前会话记忆、聊天 memory。
- targetIntent=knowledge: 目标是知识库、领域知识、资料。
- targetIntent=conversation: 目标是当前对话、聊天记录、上下文。
- targetIntent=none: 没有明确外部目标。
- presentationIntent=flow_canvas: 仅当“当前用户最后一条消息”明确要求用 flow/canvas/flow diagram/流程图/节点图展示、表达、生成可编辑流程或节点化计划时使用。
- 如果用户只是说“根据该 flow”“基于这个 flow”“参考上面的 flow”，这是引用上下文，不是展示形式请求，presentationIntent 必须为 text。
- presentationIntent=table: 用户明确要求表格。
- presentationIntent=json: 用户明确要求 JSON。
- presentationIntent=text: 默认文本表达。

示例:
- "解释一下夏普比率的含义" => {"actionIntent":"answer","targetIntent":"none","presentationIntent":"text","confidence":0.9}
- "把当前策略回测结果按指标整理成表格" => {"actionIntent":"summarize","targetIntent":"conversation","presentationIntent":"table","confidence":0.9}
- "查询知识库里关于动量因子的资料，并用 JSON 返回" => {"actionIntent":"query","targetIntent":"knowledge","presentationIntent":"json","confidence":0.9}
- "以 flow 的模式显示现在的我们聊天的 memory entry" => {"actionIntent":"query","targetIntent":"memory","presentationIntent":"flow_canvas","confidence":0.9}
"#.to_string(),
                name: String::new(),
                metadata: HashMap::new(),
            },
            ProviderChatMessage {
                role: "user".to_string(),
                content: user_context,
                name: String::new(),
                metadata: HashMap::new(),
            },
        ],
        temperature: 0.0,
        top_p: 1.0,
        max_tokens: 80,
        tools: Vec::new(),
        response_format: "json_object".to_string(),
    };

    match state.llm_provider.generate(classifier_request).await {
        Ok(response) => Ok(parse_execution_intent_response(&response.message.content)),
        Err(err) => Err(err),
    }
}
