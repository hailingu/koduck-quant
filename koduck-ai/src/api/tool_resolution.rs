use std::{
    collections::{HashMap, HashSet},
    sync::Arc,
};

use serde::Deserialize;
use tracing::{info, warn};

use crate::{
    app::AppState,
    auth::AuthContext,
    clients::{
        knowledge, tool_catalog,
        memory::{
            self, MemoryHit, MemoryRequestContext, QueryIntent, QueryMemoryInput, RetrievePolicy,
        },
    },
    llm::{
        ChatMessage as ProviderChatMessage, GenerateRequest as ProviderGenerateRequest,
        RequestContext, ToolCall as ProviderToolCall,
    },
    reliability::{
        degrade::DegradeRoute,
        error::AppError,
        memory_observe::MemoryOperation,
    },
};

use super::{
    format_tool_call_names, is_first_class_tool,
    memory_io::{json_value_as_string, log_memory_failure, metadata_string},
    prompt::build_provider_generate_request,
    ChatRequest, ConversationContextSnapshot, KnowledgeContextSnapshot, KnowledgeProfileDetailSnapshot,
    MEMORY_PROMPT_TAIL, MEMORY_QUERY_TOP_K,
};
use super::intent::ExecutionIntent;

const MEMORY_QUERY_PAGE_SIZE: i32 = 5;
const KNOWLEDGE_GENERIC_QUERIES: &[&str] = &[
    "知识库",
    "知识库吧",
    "从知识库开始",
    "那就知识库吧",
    "继续",
    "继续吧",
    "开始吧",
    "详细说说",
    "展开说说",
    "多说一点",
    "更多",
    "更多信息",
    "这个",
    "那个",
    "这里",
    "那里",
    "他",
    "她",
    "它",
];
const KNOWLEDGE_QUERY_PREFIXES: &[&str] = &[
    "关于",
    "介绍一下",
    "介绍",
    "讲讲",
    "说说",
    "聊聊",
    "查查",
    "查询",
    "搜索",
    "看看",
];
const KNOWLEDGE_QUERY_SUFFIXES: &[&str] = &[
    "是谁",
    "是什么",
    "有哪些",
    "有什么",
    "事迹",
    "生平",
    "政绩",
    "履历",
    "时间线",
    "timeline",
    "资料",
    "信息",
];

#[derive(Debug, Default)]
pub(super) struct ToolResolutionResult {
    pub(super) snapshot: ConversationContextSnapshot,
    pub(super) direct_response: Option<crate::llm::GenerateResponse>,
}

#[derive(Debug, Deserialize, Default)]
pub(super) struct QueryKnowledgeToolArgs {
    query: Option<String>,
    domain_class: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
struct GetKnowledgeProfileDetailToolArgs {
    entity_id: Option<i64>,
    entry_code: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
struct QueryMemoryToolArgs {
    query: Option<String>,
    intent: Option<String>,
    memory_scope: Option<String>,
    domain_class: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
struct MemoryHitReviewDecision {
    #[serde(default)]
    keep: bool,
}

fn parse_memory_hit_review_decision(raw: &str) -> Option<MemoryHitReviewDecision> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }

    if let Ok(parsed) = serde_json::from_str::<MemoryHitReviewDecision>(trimmed) {
        return Some(parsed);
    }

    let start = trimmed.find('{')?;
    let end = trimmed.rfind('}')?;
    if end <= start {
        return None;
    }

    serde_json::from_str::<MemoryHitReviewDecision>(&trimmed[start..=end]).ok()
}

fn build_memory_hit_review_request(
    request: &ChatRequest,
    request_id: &str,
    session_id: &str,
    auth_ctx: &AuthContext,
    trace_id: &str,
    deadline_ms: u64,
    hit_index: usize,
    hit: &MemoryHit,
) -> ProviderGenerateRequest {
    let system_prompt = format!(
        "你是记忆命中筛选器。\
输出必须是 JSON：{{\"keep\":true|false}}。\
{}\
如果该历史命中与当前问题无关，keep=false；如果相关，keep=true。\
筛选阶段仅做保留判断，不要改写内容。\
禁止输出 JSON 以外的内容，禁止臆造不存在的信息。",
        MEMORY_PROMPT_TAIL
    );

    let user_prompt = format!(
        "当前用户问题:\n{}\n\n候选历史命中 #{}:\nsource_session={}\nreasons=[{}]\nsnippet={}",
        request.message.trim(),
        hit_index + 1,
        hit.session_id,
        hit.match_reasons.join(","),
        hit.snippet
    );

    ProviderGenerateRequest {
        meta: RequestContext {
            request_id: format!("{request_id}:memory-hit-review:{hit_index}"),
            session_id: session_id.to_string(),
            user_id: auth_ctx.user_id.clone(),
            trace_id: trace_id.to_string(),
            deadline_ms,
        },
        provider: request.provider.clone().unwrap_or_default(),
        model: request.model.clone().unwrap_or_default(),
        messages: vec![
            ProviderChatMessage {
                role: "system".to_string(),
                content: system_prompt,
                name: String::new(),
                metadata: HashMap::new(),
            },
            ProviderChatMessage {
                role: "user".to_string(),
                content: user_prompt,
                name: String::new(),
                metadata: HashMap::new(),
            },
        ],
        temperature: 0.0,
        top_p: 1.0,
        max_tokens: 256,
        tools: vec![],
        response_format: String::new(),
    }
}

pub(super) async fn review_memory_hits_for_stream(
    state: &Arc<AppState>,
    request: &ChatRequest,
    request_id: &str,
    session_id: &str,
    auth_ctx: &AuthContext,
    trace_id: &str,
    hits: &[MemoryHit],
) -> Vec<MemoryHit> {
    if hits.is_empty() {
        info!(
            request_id = %request_id,
            session_id = %session_id,
            "memory hit review skipped because there are no hits"
        );
        return Vec::new();
    }

    let mut seen_sessions = HashSet::new();
    let mut deduped_hits = Vec::with_capacity(hits.len());
    for hit in hits {
        if seen_sessions.insert(hit.session_id.clone()) {
            deduped_hits.push(hit.clone());
        }
    }

    info!(
        request_id = %request_id,
        session_id = %session_id,
        hit_count = hits.len(),
        deduped_hit_count = deduped_hits.len(),
        "memory hit review started"
    );

    let mut kept = Vec::new();
    for (index, hit) in deduped_hits.iter().enumerate() {
        info!(
            request_id = %request_id,
            session_id = %session_id,
            hit_index = index,
            source_session_id = %hit.session_id,
            match_reasons = %hit.match_reasons.join(","),
            snippet_chars = hit.snippet.chars().count(),
            source_session_content = %hit.snippet,
            "reviewing memory hit"
        );

        let review_request = build_memory_hit_review_request(
            request,
            request_id,
            session_id,
            auth_ctx,
            trace_id,
            state.config.llm.timeout_ms,
            index,
            hit,
        );

        let decision = match state.llm_provider.generate(review_request).await {
            Ok(resp) => parse_memory_hit_review_decision(&resp.message.content),
            Err(err) => {
                warn!(
                    request_id = %request_id,
                    session_id = %session_id,
                    hit_index = index,
                    source_session_id = %hit.session_id,
                    error = %err,
                    "memory hit review failed; falling back to keep original snippet"
                );
                None
            }
        };

        match decision {
            Some(parsed) if parsed.keep => {
                info!(
                    request_id = %request_id,
                    session_id = %session_id,
                    hit_index = index,
                    source_session_id = %hit.session_id,
                    review_decision = "keep",
                    "memory hit review completed"
                );
                kept.push(hit.clone());
            }
            Some(_) => {
                info!(
                    request_id = %request_id,
                    session_id = %session_id,
                    hit_index = index,
                    source_session_id = %hit.session_id,
                    review_decision = "drop",
                    "memory hit review completed"
                );
            }
            None => {
                warn!(
                    request_id = %request_id,
                    session_id = %session_id,
                    hit_index = index,
                    source_session_id = %hit.session_id,
                    review_decision = "keep_fallback",
                    "memory hit review parse failed; kept original session transcript"
                );
                kept.push(hit.clone());
            }
        }
    }

    info!(
        request_id = %request_id,
        session_id = %session_id,
        kept_count = kept.len(),
        dropped_count = deduped_hits.len().saturating_sub(kept.len()),
        "memory hit review finished"
    );

    kept
}

fn parse_query_knowledge_tool_args(raw: &str) -> QueryKnowledgeToolArgs {
    serde_json::from_str::<QueryKnowledgeToolArgs>(raw).unwrap_or_default()
}

fn parse_get_knowledge_profile_detail_tool_args(raw: &str) -> GetKnowledgeProfileDetailToolArgs {
    serde_json::from_str::<GetKnowledgeProfileDetailToolArgs>(raw).unwrap_or_default()
}

fn parse_query_memory_tool_args(raw: &str) -> QueryMemoryToolArgs {
    serde_json::from_str::<QueryMemoryToolArgs>(raw).unwrap_or_default()
}

fn parse_query_intent(raw: &str) -> QueryIntent {
    match raw.trim().to_ascii_lowercase().as_str() {
        "recall" => QueryIntent::Recall,
        "compare" => QueryIntent::Compare,
        "disambiguate" => QueryIntent::Disambiguate,
        "correct" => QueryIntent::Correct,
        "explain" => QueryIntent::Explain,
        "decide" => QueryIntent::Decide,
        "delete" => QueryIntent::Delete,
        "none" => QueryIntent::None,
        _ => QueryIntent::Unspecified,
    }
}

fn memory_query_session_scope(current_session_id: &str, raw_scope: Option<&str>) -> Option<String> {
    match raw_scope
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("global")
        .to_ascii_lowercase()
        .as_str()
    {
        "current_session" => Some(current_session_id.to_string()),
        _ => None,
    }
}

fn build_memory_query_text(request: &ChatRequest, args: &QueryMemoryToolArgs) -> String {
    args.query
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| request.message.trim())
        .to_string()
}

fn is_cjk_character(value: char) -> bool {
    matches!(
        value as u32,
        0x4E00..=0x9FFF | 0x3400..=0x4DBF | 0x20000..=0x2A6DF | 0x2A700..=0x2B73F
    )
}

fn trim_query_noise(value: &str) -> String {
    value
        .trim()
        .trim_matches(|ch: char| {
            matches!(
                ch,
                ' ' | '\t'
                    | '\n'
                    | '\r'
                    | '，'
                    | ','
                    | '。'
                    | '.'
                    | '？'
                    | '?'
                    | '！'
                    | '!'
                    | '：'
                    | ':'
                    | '；'
                    | ';'
                    | '“'
                    | '”'
                    | '"'
                    | '\''
                    | '（'
                    | '）'
                    | '('
                    | ')'
            )
        })
        .trim_end_matches(|ch: char| matches!(ch, '吧' | '吗' | '呢' | '呀' | '啊'))
        .trim()
        .to_string()
}

fn is_generic_knowledge_query(value: &str) -> bool {
    let normalized = trim_query_noise(value);
    if normalized.is_empty() {
        return true;
    }

    let lowercase = normalized.to_ascii_lowercase();
    KNOWLEDGE_GENERIC_QUERIES.iter().any(|candidate| {
        normalized == *candidate || lowercase == candidate.to_ascii_lowercase()
    })
}

fn looks_like_entity_fragment(value: &str) -> bool {
    let normalized = trim_query_noise(value);
    if normalized.len() < 2 || normalized.len() > 48 || is_generic_knowledge_query(&normalized) {
        return false;
    }

    normalized
        .chars()
        .any(|ch| ch.is_ascii_alphanumeric() || is_cjk_character(ch))
}

pub(super) fn extract_entity_like_query(value: &str) -> Option<String> {
    let trimmed = trim_query_noise(value);
    if trimmed.is_empty() || is_generic_knowledge_query(&trimmed) {
        return None;
    }

    for prefix in KNOWLEDGE_QUERY_PREFIXES {
        if let Some(candidate) = trimmed.strip_prefix(prefix) {
            let cleaned = trim_query_noise(candidate);
            if looks_like_entity_fragment(&cleaned) {
                return Some(cleaned);
            }
        }
    }

    if let Some((_, candidate)) = trimmed.split_once("关于") {
        let subject = trim_query_noise(
            candidate
                .split(['的', '，', ',', '。', '？', '?', '！', '!'])
                .next()
                .unwrap_or(candidate),
        );
        if looks_like_entity_fragment(&subject) {
            return Some(subject);
        }
    }

    for suffix in KNOWLEDGE_QUERY_SUFFIXES {
        if let Some(candidate) = trimmed.strip_suffix(suffix) {
            let cleaned = trim_query_noise(candidate);
            if looks_like_entity_fragment(&cleaned) {
                return Some(cleaned);
            }
        }
    }

    if looks_like_entity_fragment(&trimmed) {
        return Some(trimmed);
    }

    None
}

pub(super) fn resolve_knowledge_query(
    request: &ChatRequest,
    args: &QueryKnowledgeToolArgs,
) -> Option<String> {
    if let Some(query) = args.query.as_deref().and_then(extract_entity_like_query) {
        return Some(query);
    }

    if let Some(query) = extract_entity_like_query(&request.message) {
        return Some(query);
    }

    request
        .history
        .as_ref()
        .into_iter()
        .flatten()
        .rev()
        .find_map(|message| extract_entity_like_query(&message.content))
}

fn retrieve_policy_from_request(request: &ChatRequest) -> RetrievePolicy {
    let raw = request
        .retrieve_policy
        .clone()
        .or_else(|| {
            request
                .metadata
                .as_ref()
                .and_then(|metadata| metadata.get("retrieve_policy"))
                .and_then(json_value_as_string)
        })
        .unwrap_or_else(|| "summary_first".to_string());

    match raw.trim().to_ascii_lowercase().as_str() {
        "domain_first" => RetrievePolicy::DomainFirst,
        "hybrid" => RetrievePolicy::Hybrid,
        "summary_first" => RetrievePolicy::SummaryFirst,
        _ => RetrievePolicy::SummaryFirst,
    }
}

async fn execute_memory_tool_call(
    state: &Arc<AppState>,
    route: DegradeRoute,
    request: &ChatRequest,
    ctx: &MemoryRequestContext,
    tool_call: &ProviderToolCall,
) -> ConversationContextSnapshot {
    let args = parse_query_memory_tool_args(&tool_call.arguments);
    let query_text = build_memory_query_text(request, &args);
    if query_text.trim().is_empty() {
        return ConversationContextSnapshot::default();
    }

    let input = QueryMemoryInput {
        query_text,
        session_id: memory_query_session_scope(&ctx.session_id, args.memory_scope.as_deref()),
        domain_class: args
            .domain_class
            .as_deref()
            .map(str::trim)
            .unwrap_or_default()
            .to_string(),
        query_intent: parse_query_intent(args.intent.as_deref().unwrap_or("none")),
        retrieve_policy: retrieve_policy_from_request(request),
        top_k: MEMORY_QUERY_TOP_K,
        page_size: MEMORY_QUERY_PAGE_SIZE,
    };

    match memory::query_memory(state, ctx, input).await {
        Ok(hits) => {
            let mut snapshot = ConversationContextSnapshot::default();
            snapshot.hits = hits;
            snapshot
        }
        Err(err) => {
            log_memory_failure(
                state,
                route,
                MemoryOperation::QueryMemory,
                ctx,
                &err,
                true,
                "tool selection chose query_memory but retrieval failed; continuing without retrieved memory hits",
            );
            ConversationContextSnapshot::default()
        }
    }
}

async fn execute_knowledge_tool_call(
    state: &Arc<AppState>,
    request: &ChatRequest,
    ctx: &MemoryRequestContext,
    tool_call: &ProviderToolCall,
) -> ConversationContextSnapshot {
    let args = parse_query_knowledge_tool_args(&tool_call.arguments);
    let query = resolve_knowledge_query(request, &args).unwrap_or_default();
    let domain_class = args
        .domain_class
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| metadata_string(request, "domain_class"));

    if query.trim().is_empty() {
        warn!(
            request_id = %ctx.request_id,
            session_id = %ctx.session_id,
            tool_name = %tool_call.name,
            "query_knowledge skipped because entity query is unavailable"
        );
        return ConversationContextSnapshot::default();
    }

    if domain_class.trim().is_empty() {
        match knowledge::query_knowledge_candidates(state, &ctx.request_id, &query).await {
            Ok(result) => {
                if result.hits.is_empty() {
                    warn!(
                        request_id = %ctx.request_id,
                        session_id = %ctx.session_id,
                        tool_name = %tool_call.name,
                        query = %query,
                        "query_knowledge skipped because domain_class is unavailable and no candidate entities were found"
                    );
                    return ConversationContextSnapshot::default();
                }

                return ConversationContextSnapshot {
                    hits: Vec::new(),
                    knowledge: Some(KnowledgeContextSnapshot {
                        query,
                        domain_class: String::new(),
                        result,
                    }),
                    knowledge_profile_detail: None,
                };
            }
            Err(err) => {
                warn!(
                    request_id = %ctx.request_id,
                    session_id = %ctx.session_id,
                    tool_name = %tool_call.name,
                    error = %err,
                    "tool selection chose query_knowledge without domain_class and candidate search failed; continuing without structured knowledge"
                );
                return ConversationContextSnapshot::default();
            }
        }
    }

    match knowledge::query_knowledge(state, &ctx.request_id, &query, &domain_class).await {
        Ok(result) => ConversationContextSnapshot {
            hits: Vec::new(),
            knowledge: Some(KnowledgeContextSnapshot {
                query,
                domain_class,
                result,
            }),
            knowledge_profile_detail: None,
        },
        Err(err) => {
            warn!(
                request_id = %ctx.request_id,
                session_id = %ctx.session_id,
                tool_name = %tool_call.name,
                error = %err,
                "tool selection chose query_knowledge but retrieval failed; continuing without structured knowledge"
            );
            ConversationContextSnapshot::default()
        }
    }
}

async fn execute_knowledge_profile_detail_tool_call(
    state: &Arc<AppState>,
    ctx: &MemoryRequestContext,
    tool_call: &ProviderToolCall,
) -> ConversationContextSnapshot {
    let args = parse_get_knowledge_profile_detail_tool_args(&tool_call.arguments);
    let Some(entity_id) = args.entity_id else {
        warn!(
            request_id = %ctx.request_id,
            session_id = %ctx.session_id,
            tool_name = %tool_call.name,
            "get_knowledge_profile_detail skipped because entity_id is unavailable"
        );
        return ConversationContextSnapshot::default();
    };

    let Some(entry_code) = args
        .entry_code
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
    else {
        warn!(
            request_id = %ctx.request_id,
            session_id = %ctx.session_id,
            tool_name = %tool_call.name,
            "get_knowledge_profile_detail skipped because entry_code is unavailable"
        );
        return ConversationContextSnapshot::default();
    };

    match knowledge::get_profile_detail(state, &ctx.request_id, entity_id, &entry_code).await {
        Ok(result) => ConversationContextSnapshot {
            hits: Vec::new(),
            knowledge: None,
            knowledge_profile_detail: Some(KnowledgeProfileDetailSnapshot { result }),
        },
        Err(err) => {
            warn!(
                request_id = %ctx.request_id,
                session_id = %ctx.session_id,
                tool_name = %tool_call.name,
                error = %err,
                "tool selection chose get_knowledge_profile_detail but retrieval failed; continuing without profile detail"
            );
            ConversationContextSnapshot::default()
        }
    }
}

pub(super) async fn execute_supported_tool_call(
    state: &Arc<AppState>,
    route: DegradeRoute,
    request: &ChatRequest,
    ctx: &MemoryRequestContext,
    base_snapshot: &ConversationContextSnapshot,
    tool_call: &ProviderToolCall,
) -> ConversationContextSnapshot {
    let mut snapshot = base_snapshot.clone();
    let next_snapshot = match tool_call.name.as_str() {
        "query_memory" => execute_memory_tool_call(state, route, request, ctx, tool_call).await,
        "query_knowledge" => execute_knowledge_tool_call(state, request, ctx, tool_call).await,
        "get_knowledge_profile_detail" => {
            execute_knowledge_profile_detail_tool_call(state, ctx, tool_call).await
        }
        _ => return snapshot,
    };

    if !next_snapshot.hits.is_empty() {
        snapshot.hits = next_snapshot.hits;
    }
    if next_snapshot.knowledge.is_some() {
        snapshot.knowledge = next_snapshot.knowledge;
    }
    if next_snapshot.knowledge_profile_detail.is_some() {
        snapshot.knowledge_profile_detail = next_snapshot.knowledge_profile_detail;
    }
    snapshot
}

pub(super) async fn resolve_tool_call(
    state: &Arc<AppState>,
    route: DegradeRoute,
    request: &ChatRequest,
    base_snapshot: &ConversationContextSnapshot,
    request_id: &str,
    session_id: &str,
    auth_ctx: &AuthContext,
    trace_id: &str,
    execution_intent: ExecutionIntent,
) -> Result<ToolResolutionResult, AppError> {
    const MAX_TOOL_ROUNDS: usize = 3;
    let discovered_tools = tool_catalog::fetch_prompt_tool_definitions(state, request_id).await;
    let mut snapshot = base_snapshot.clone();
    let mut last_tool_name: Option<String> = None;

    for _ in 0..MAX_TOOL_ROUNDS {
        let llm_request = build_provider_generate_request(
            request,
            Some(&snapshot),
            request_id,
            session_id,
            auth_ctx,
            trace_id,
            state.config.llm.timeout_ms,
            discovered_tools.iter().cloned().collect(),
            execution_intent,
        );
        let selection = state.llm_provider.generate(llm_request).await?;
        let maybe_tool_call = selection
            .tool_calls
            .iter()
            .find(|tool_call| {
                discovered_tools
                    .iter()
                    .any(|tool| tool.name == tool_call.name)
                    && is_first_class_tool(tool_call.name.as_str())
            })
            .cloned();
        info!(
            request_id = %request_id,
            session_id = %session_id,
            tool_call_count = selection.tool_calls.len(),
            tool_call_names = %format_tool_call_names(&selection.tool_calls),
            selected_first_class_tool = maybe_tool_call
                .as_ref()
                .map(|tool_call| tool_call.name.as_str())
                .unwrap_or("-"),
            finish_reason = %selection.finish_reason,
            "llm tool-selection phase completed"
        );

        if let Some(tool_call) = maybe_tool_call {
            if last_tool_name.as_deref() == Some(tool_call.name.as_str()) {
                info!(
                    request_id = %request_id,
                    session_id = %session_id,
                    tool_name = %tool_call.name,
                    "stop tool rounds because the same tool was selected consecutively"
                );
                break;
            }

            let ctx = MemoryRequestContext::from_auth(
                request_id.to_string(),
                session_id.to_string(),
                trace_id.to_string(),
                state.config.llm.timeout_ms,
                auth_ctx,
            );
            let next_snapshot =
                execute_supported_tool_call(state, route, request, &ctx, &snapshot, &tool_call)
                    .await;
            let has_new_context = next_snapshot != snapshot
                && (!next_snapshot.hits.is_empty()
                    || next_snapshot.knowledge.is_some()
                    || next_snapshot.knowledge_profile_detail.is_some());
            if !has_new_context {
                info!(
                    request_id = %request_id,
                    session_id = %session_id,
                    tool_name = %tool_call.name,
                    "stop tool rounds because the tool call produced no incremental context"
                );
                break;
            }

            snapshot = next_snapshot;
            last_tool_name = Some(tool_call.name.clone());
            continue;
        }

        return Ok(ToolResolutionResult {
            snapshot,
            direct_response: Some(selection),
        });
    }

    Ok(ToolResolutionResult {
        snapshot,
        direct_response: None,
    })
}
