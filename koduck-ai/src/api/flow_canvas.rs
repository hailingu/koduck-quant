use std::{collections::HashMap, sync::Arc};

use serde_json::json;

use crate::{
    app::AppState,
    clients::memory::{self, MemoryRequestContext},
};

use super::{
    intent::{ExecutionIntent, PresentationIntent, TargetIntent},
    ChatRequest,
};

fn flow_safe_snippet(content: &str) -> String {
    const MAX_CHARS: usize = 800;
    let normalized = content.split_whitespace().collect::<Vec<_>>().join(" ");
    let mut snippet = normalized.chars().take(MAX_CHARS).collect::<String>();
    if normalized.chars().count() > MAX_CHARS {
        snippet.push('…');
    }
    snippet
}

fn find_quoted_dependency(
    metadata: &HashMap<String, String>,
    content: &str,
    known_ids: &HashMap<String, String>,
    previous_entries: &[(String, String, String, i64, i64, HashMap<String, String>)],
) -> Option<String> {
    if let Some(id) = metadata
        .get("quoted_memory_entry_id")
        .or_else(|| metadata.get("quoted_message_id"))
        .and_then(|entry_id| known_ids.get(entry_id))
        .cloned()
    {
        return Some(id);
    }

    let quoted_text = metadata
        .get("quoted_content")
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| {
            content
                .lines()
                .take_while(|line| line.trim_start().starts_with('>') || line.trim().is_empty())
                .filter_map(|line| line.trim_start().strip_prefix('>'))
                .map(str::trim)
                .filter(|line| !line.is_empty())
                .collect::<Vec<_>>()
                .join(" ")
        });
    if quoted_text.is_empty() {
        return None;
    }

    previous_entries
        .iter()
        .rev()
        .find_map(|(entry_id, _, previous_content, _, _, _)| {
            let normalized_previous = previous_content.split_whitespace().collect::<String>();
            let normalized_quote = quoted_text.split_whitespace().collect::<String>();
            if !normalized_quote.is_empty()
                && (normalized_previous.contains(&normalized_quote)
                    || normalized_quote.contains(&normalized_previous))
            {
                known_ids.get(entry_id).cloned()
            } else {
                None
            }
        })
}

pub(super) fn build_memory_entry_flow_json(
    entries: Vec<(String, String, String, i64, i64, HashMap<String, String>)>,
) -> String {
    let mut previous_id: Option<String> = None;
    let mut known_ids: HashMap<String, String> = HashMap::new();
    let mut previous_entries: Vec<(String, String, String, i64, i64, HashMap<String, String>)> =
        Vec::new();
    let steps = entries
        .into_iter()
        .filter(|(_, role, content, _, _, _)| {
            matches!(role.as_str(), "user" | "assistant") && !content.trim().is_empty()
        })
        .enumerate()
        .map(|(index, (entry_id, role, content, timestamp, sequence_num, metadata))| {
            let id = if entry_id.trim().is_empty() {
                format!("entry_{}", index + 1)
            } else {
                format!("entry_{}", entry_id.replace('-', "_"))
            };
            known_ids.insert(entry_id.clone(), id.clone());
            let depends_on = find_quoted_dependency(
                &metadata,
                &content,
                &known_ids,
                &previous_entries,
            )
            .or_else(|| previous_id.clone())
            .into_iter()
            .collect::<Vec<_>>();
            let step = json!({
                "id": id.clone(),
                "name": format!("{} #{}", if role == "user" { "用户消息" } else { "助手回复" }, sequence_num),
                "input": [
                    format!("entry_id={}", entry_id),
                    format!("role={}", role),
                    format!("timestamp={}", timestamp),
                ],
                "output": flow_safe_snippet(&content),
                "status": "completed",
                "editable": true,
                "dependsOn": depends_on,
            });
            previous_id = Some(id);
            previous_entries.push((entry_id, role, content, timestamp, sequence_num, metadata));
            step
        })
        .collect::<Vec<_>>();

    let payload = json!({
        "title": "当前聊天 memory entries",
        "version": "1.0",
        "steps": steps,
    });

    format!(
        "```json\n{}\n```",
        serde_json::to_string_pretty(&payload).unwrap_or_else(|_| "{}".to_string())
    )
}

pub(super) async fn build_current_memory_entries_flow_answer(
    state: &Arc<AppState>,
    ctx: &MemoryRequestContext,
    request: &ChatRequest,
    execution_intent: ExecutionIntent,
) -> Option<String> {
    if execution_intent.presentation != PresentationIntent::FlowCanvas
        || execution_intent.target != TargetIntent::Memory
    {
        return None;
    }

    if let Ok(entries) = memory::get_session_transcript(state, ctx).await {
        let transcript_entries = entries
            .into_iter()
            .map(|entry| {
                (
                    entry.entry_id,
                    entry.role,
                    entry.content,
                    entry.timestamp,
                    entry.sequence_num,
                    entry.metadata,
                )
            })
            .collect::<Vec<_>>();
        return Some(build_memory_entry_flow_json(transcript_entries));
    }

    let history_entries = request
        .history
        .as_ref()
        .map(|history| {
            history
                .iter()
                .enumerate()
                .map(|(index, item)| {
                    (
                        format!("history_{}", index + 1),
                        item.role.clone(),
                        item.content.clone(),
                        0,
                        (index + 1) as i64,
                        HashMap::new(),
                    )
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    Some(build_memory_entry_flow_json(history_entries))
}
