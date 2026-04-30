use std::collections::HashMap;

use crate::{
    auth::AuthContext,
    llm::{
        ChatMessage as ProviderChatMessage, GenerateRequest as ProviderGenerateRequest,
        RequestContext, ToolDefinition as ProviderToolDefinition,
    },
};

use super::{
    intent::{ExecutionIntent, PresentationIntent},
    ChatRequest, ConversationContextSnapshot, MEMORY_PROMPT_TAIL, MEMORY_QUERY_TOP_K,
};

fn build_memory_prompt(
    snapshot: &ConversationContextSnapshot,
    user_message: &str,
) -> Option<String> {
    if snapshot.hits.is_empty() {
        return None;
    }

    let snippets = snapshot
        .hits
        .iter()
        .take(MEMORY_QUERY_TOP_K as usize)
        .enumerate()
        .map(|(index, hit)| {
            format!(
                "{}. source_session={} reasons=[{}] snippet={}",
                index + 1,
                hit.session_id,
                hit.match_reasons.join(","),
                hit.snippet
            )
        })
        .collect::<Vec<_>>()
        .join("\n");

    Some(format!(
        "以下内容来自 koduck-memory 的历史摘要检索结果，可能跨多个旧会话。\n{}\n\n历史命中:\n{}\n\n当前用户问题（请把它作为最终相关性判断依据）:\n{}",
        MEMORY_PROMPT_TAIL,
        snippets,
        user_message.trim()
    ))
}

fn build_knowledge_prompt(
    snapshot: &ConversationContextSnapshot,
    user_message: &str,
) -> Option<String> {
    let knowledge = snapshot.knowledge.as_ref()?;
    if knowledge.result.hits.is_empty() {
        return None;
    }

    let candidates = knowledge
        .result
        .hits
        .iter()
        .take(5)
        .enumerate()
        .map(|(index, hit)| {
            format!(
                "{}. entity_id={} domain_class={} canonical_name={} entity_name={} match_type={} valid_window=[{} ~ {}] basic_profile_s3_uri={}",
                index + 1,
                hit.entity_id,
                if hit.domain_class.trim().is_empty() {
                    "-"
                } else {
                    hit.domain_class.as_str()
                },
                hit.canonical_name,
                hit.entity_name,
                hit.match_type,
                hit.valid_from.as_deref().unwrap_or("-"),
                hit.valid_to.as_deref().unwrap_or("-"),
                hit.basic_profile_s3_uri.as_deref().unwrap_or("-"),
            )
        })
        .collect::<Vec<_>>()
        .join("\n");

    let profile = knowledge
        .result
        .primary_profile
        .as_ref()
        .map(|profile| {
            format!(
                "主命中 basic profile:\nentity_id={} canonical_name={} entity_name={} domain_class={} valid_window=[{} ~ {}] basic_profile_s3_uri={}",
                profile.entity_id,
                profile.canonical_name,
                profile.entity_name,
                profile.domain_class,
                profile.valid_from.as_deref().unwrap_or("-"),
                profile.valid_to.as_deref().unwrap_or("-"),
                profile.basic_profile_s3_uri.as_deref().unwrap_or("-"),
            )
        })
        .unwrap_or_else(|| "主命中 basic profile: 无".to_string());

    let detail = snapshot
        .knowledge_profile_detail
        .as_ref()
        .map(|detail| {
            format!(
                "已读取当前 profile detail:\nentity_id={} entry_code={} version={} is_current={} blob_uri={} loaded_at={}",
                detail.result.entity_id,
                detail.result.entry_code,
                detail.result.version,
                detail.result.is_current,
                detail.result.blob_uri,
                detail.result.loaded_at,
            )
        })
        .unwrap_or_else(|| "当前未读取非 BASIC profile detail。".to_string());

    if knowledge.domain_class.trim().is_empty() {
        return Some(format!(
            "以下内容来自 koduck-knowledge 的跨 domain 候选实体搜索结果。当前尚未解析出 domain_class，因此还不能读取 basic profile 或 profile detail。\n你现在不要直接回答实体事实；请仅基于候选实体列表，引导用户回复想继续查看的 entity_id，或回复候选中的 canonical_name + domain_class 组合，以便下一轮继续查询。\n知识查询: query={} domain_class=<unresolved>\n\n候选实体:\n{}\n\n当前用户问题（请把它作为最终相关性判断依据）:\n{}\n如果候选实体为空，请明确说明知识库暂未命中，不要补造事实。",
            knowledge.query,
            candidates,
            user_message.trim()
        ));
    }

    Some(format!(
        "以下内容来自 koduck-knowledge 的结构化实体检索结果，主要用于实体对齐与只读知识引用，不等于完整正文。\nquery_knowledge 只提供候选实体和 basic profile；如果这些信息仍不足以回答问题，你可以继续调用 get_knowledge_profile_detail 读取当前非 BASIC profile 的详情元信息。\n知识查询: query={} domain_class={}\n\n候选实体:\n{}\n\n{}\n\n{}\n\n当前用户问题（请把它作为最终相关性判断依据）:\n{}\n如果这些结果不足以支撑结论，请明确说明知识库未提供足够细节，不要补造事实。",
        knowledge.query,
        knowledge.domain_class,
        candidates,
        profile,
        detail,
        user_message.trim()
    ))
}

pub(super) fn build_provider_generate_request(
    request: &ChatRequest,
    memory_snapshot: Option<&ConversationContextSnapshot>,
    request_id: &str,
    session_id: &str,
    auth_ctx: &AuthContext,
    trace_id: &str,
    deadline_ms: u64,
    tools: Vec<ProviderToolDefinition>,
    execution_intent: ExecutionIntent,
) -> ProviderGenerateRequest {
    const KODUCK_V1_LITE_PROMPT: &str =
        include_str!("../../prompts/system/koduck-v1-lite.md");
    const KODUCK_BASE_LANGUAGE_PROMPT: &str = "你是 koduck-ai 的中文助手。默认使用简体中文直接回答用户问题，保持准确、简洁、自然。不要输出思维链、推理过程、草稿、自我讨论或任何 <think> 标签内容；只输出面向用户的最终答案。如果用户输入过于简短或语义不清，先用一句中文澄清，不要臆测事实。";

    let mut system_content = format!(
        "{}\n\n{}",
        KODUCK_V1_LITE_PROMPT.trim(),
        KODUCK_BASE_LANGUAGE_PROMPT
    );

    if execution_intent.presentation == PresentationIntent::FlowCanvas {
        system_content.push_str(
            r#"

Koduck Flow Canvas 输出契约：
- 当用户要求生成 flow、canvas、流程图、可编辑流程或节点化计划时，你必须只输出一个 fenced JSON 代码块，语言标记必须是 json。
- 不要输出 Markdown 标题、说明文字、表格、Mermaid、ASCII 图、列表解释或 JSON 之外的任何文本。
- JSON 顶层必须是对象，字段必须包含 title、version、steps。
- steps 必须是数组；每个节点必须包含 id、name、input、output、status、editable、dependsOn。
- input 与 dependsOn 必须是字符串数组；output 必须是字符串；editable 必须是 true；status 只能是 pending、running、waiting_approval、completed、failed、skipped 之一。
- 用户要求几个研究步骤就生成几个研究步骤；如果用户要求信息不足时插入人工确认节点，只在确有信息不足时追加一个 status 为 waiting_approval 的人工确认节点。
- 节点 id 使用稳定英文 snake_case，例如 step_1、step_2、human_confirm、conclusion。

示例结构：
```json
{
  "title": "主题",
  "version": "1.0",
  "steps": [
    {
      "id": "step_1",
      "name": "背景梳理",
      "input": ["输入材料"],
      "output": "输出产物",
      "status": "pending",
      "editable": true,
      "dependsOn": []
    }
  ]
}
```
"#,
        );
    }

    if let Some(memory_prompt) =
        memory_snapshot.and_then(|snapshot| build_memory_prompt(snapshot, &request.message))
    {
        system_content.push_str("\n\n");
        system_content.push_str(&memory_prompt);
    }

    if let Some(knowledge_prompt) =
        memory_snapshot.and_then(|snapshot| build_knowledge_prompt(snapshot, &request.message))
    {
        system_content.push_str("\n\n");
        system_content.push_str(&knowledge_prompt);
    }

    if !tools.is_empty() {
        system_content.push_str("\n\n");
        system_content.push_str(
            "如需调用工具，只能依据每个工具自带的 description 与 JSON schema 决定是否调用、以及如何填写参数。不要臆造未声明字段，也不要调用未出现在 tools 列表中的工具。",
        );
    }

    let mut messages = vec![ProviderChatMessage {
        role: "system".to_string(),
        content: system_content,
        name: String::new(),
        metadata: HashMap::new(),
    }];

    if let Some(history) = request.history.as_ref() {
        messages.extend(history.iter().map(|item| ProviderChatMessage {
            role: item.role.trim().to_string(),
            content: item.content.trim().to_string(),
            name: String::new(),
            metadata: HashMap::new(),
        }));
    }

    messages.push(ProviderChatMessage {
        role: "user".to_string(),
        content: request.message.clone(),
        name: String::new(),
        metadata: HashMap::new(),
    });

    ProviderGenerateRequest {
        meta: RequestContext {
            request_id: request_id.to_string(),
            session_id: session_id.to_string(),
            user_id: auth_ctx.user_id.clone(),
            trace_id: trace_id.to_string(),
            deadline_ms,
        },
        provider: request.provider.clone().unwrap_or_default(),
        model: request.model.clone().unwrap_or_default(),
        messages,
        temperature: request.temperature.unwrap_or(0.2),
        top_p: 1.0,
        max_tokens: request.max_tokens.unwrap_or(2048),
        tools,
        response_format: String::new(),
    }
}
