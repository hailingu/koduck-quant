use serde_json::{json, Value};
use std::collections::HashMap;

use super::{
    build_memory_entry_flow_json, extract_entity_like_query, parse_execution_intent_response,
    request_execution_intent, resolve_knowledge_query, ChatHistoryMessage, ChatRequest,
    QueryKnowledgeToolArgs,
};

#[test]
fn extract_entity_like_query_rejects_generic_follow_up() {
    assert_eq!(extract_entity_like_query("知识库吧"), None);
    assert_eq!(extract_entity_like_query("继续吧"), None);
}

#[test]
fn extract_entity_like_query_keeps_fact_subject() {
    assert_eq!(
        extract_entity_like_query("我们有没有关于威廉的可靠信息？"),
        Some("威廉".to_string())
    );
    assert_eq!(
        extract_entity_like_query("介绍一下Wilhelm II"),
        Some("Wilhelm II".to_string())
    );
}

#[test]
fn resolve_knowledge_query_falls_back_to_recent_history_entity() {
    let request = ChatRequest {
        session_id: None,
        message: "知识库吧".to_string(),
        history: Some(vec![
            ChatHistoryMessage {
                role: "user".to_string(),
                content: "我们有没有关于威廉的可靠信息？".to_string(),
                memory_entry_id: None,
            },
            ChatHistoryMessage {
                role: "assistant".to_string(),
                content: "我可以继续从知识库开始介绍。".to_string(),
                memory_entry_id: None,
            },
        ]),
        provider: None,
        model: None,
        temperature: None,
        max_tokens: None,
        retrieve_policy: None,
        metadata: None,
    };

    assert_eq!(
        resolve_knowledge_query(&request, &QueryKnowledgeToolArgs::default()),
        Some("威廉".to_string())
    );
}

#[test]
fn classifier_metadata_marks_memory_flow_canvas() {
    let request = ChatRequest {
        session_id: None,
        message: "以flow 的模式显示现在的我们聊天的 memory entry".to_string(),
        history: None,
        provider: None,
        model: None,
        temperature: None,
        max_tokens: None,
        retrieve_policy: None,
        metadata: Some(
            [
                ("enablePlanCanvas".to_string(), json!(true)),
                ("targetIntent".to_string(), json!("memory")),
                ("presentationIntent".to_string(), json!("flow_canvas")),
            ]
            .into_iter()
            .collect(),
        ),
    };

    let intent = request_execution_intent(&request);
    assert_eq!(intent.target.as_str(), "memory");
    assert_eq!(intent.presentation.as_str(), "flow_canvas");
}

#[test]
fn classifier_metadata_marks_flow_reference_as_text() {
    let request = ChatRequest {
        session_id: None,
        message: "根据该 flow，罗伯斯庇尔的主张是过于激进还是有什么其他的问题".to_string(),
        history: Some(vec![ChatHistoryMessage {
            role: "assistant".to_string(),
            content: "```json\n{\"title\":\"一个 flow\",\"steps\":[]}\n```".to_string(),
            memory_entry_id: None,
        }]),
        provider: None,
        model: None,
        temperature: None,
        max_tokens: None,
        retrieve_policy: None,
        metadata: Some(
            [
                ("enablePlanCanvas".to_string(), json!(true)),
                ("targetIntent".to_string(), json!("conversation")),
                ("presentationIntent".to_string(), json!("text")),
            ]
            .into_iter()
            .collect(),
        ),
    };

    let intent = request_execution_intent(&request);
    assert_eq!(intent.target.as_str(), "conversation");
    assert_eq!(intent.presentation.as_str(), "text");
}

#[test]
fn classifier_metadata_marks_conversation_flow_canvas() {
    let request = ChatRequest {
        session_id: None,
        message: "以 flow 的方式展示我们之前的聊天过程".to_string(),
        history: None,
        provider: None,
        model: None,
        temperature: None,
        max_tokens: None,
        retrieve_policy: None,
        metadata: Some(
            [
                ("enablePlanCanvas".to_string(), json!(true)),
                ("targetIntent".to_string(), json!("conversation")),
                ("presentationIntent".to_string(), json!("flow_canvas")),
            ]
            .into_iter()
            .collect(),
        ),
    };

    let intent = request_execution_intent(&request);
    assert_eq!(intent.target.as_str(), "conversation");
    assert_eq!(intent.presentation.as_str(), "flow_canvas");
}

#[test]
fn classifier_metadata_is_source_even_if_message_mentions_flow_diagram() {
    let request = ChatRequest {
        session_id: None,
        message: "能用 flow diagram 表达吗？".to_string(),
        history: None,
        provider: None,
        model: None,
        temperature: None,
        max_tokens: None,
        retrieve_policy: None,
        metadata: Some(
            [
                ("enablePlanCanvas".to_string(), json!(true)),
                ("targetIntent".to_string(), json!("conversation")),
                ("presentationIntent".to_string(), json!("text")),
            ]
            .into_iter()
            .collect(),
        ),
    };

    let intent = request_execution_intent(&request);
    assert_eq!(intent.presentation.as_str(), "text");
}

#[test]
fn parse_execution_intent_response_maps_flow_canvas_presentation() {
    let intent = parse_execution_intent_response(
        r#"{"actionIntent":"summarize","targetIntent":"conversation","presentationIntent":"flow_canvas","confidence":0.9}"#,
    )
    .expect("strict json should parse");

    let request = ChatRequest {
        session_id: None,
        message: "以 flow 的方式展示我们之前的聊天过程".to_string(),
        history: None,
        provider: None,
        model: None,
        temperature: None,
        max_tokens: None,
        retrieve_policy: None,
        metadata: Some(
            [
                ("enablePlanCanvas".to_string(), json!(true)),
                ("actionIntent".to_string(), json!(intent.action.as_str())),
                ("targetIntent".to_string(), json!(intent.target.as_str())),
                (
                    "presentationIntent".to_string(),
                    json!(intent.presentation.as_str()),
                ),
            ]
            .into_iter()
            .collect(),
        ),
    };

    let parsed_intent = request_execution_intent(&request);
    assert_eq!(parsed_intent.action.as_str(), "summarize");
    assert_eq!(parsed_intent.target.as_str(), "conversation");
    assert_eq!(parsed_intent.presentation.as_str(), "flow_canvas");
}

#[test]
fn parse_execution_intent_response_uses_final_json_after_reasoning_text() {
    let intent = parse_execution_intent_response(
        r#"The user wants historical Yao Ming data, so this is a knowledge query.
{"actionIntent":"query","targetIntent":"knowledge","presentationIntent":"text","confidence":0.9}"#,
    )
    .expect("final json object should parse");

    assert_eq!(intent.action.as_str(), "query");
    assert_eq!(intent.target.as_str(), "knowledge");
    assert_eq!(intent.presentation.as_str(), "text");
    assert_eq!(intent.confidence, 0.9);
}

#[test]
fn parse_execution_intent_response_prefers_last_json_object() {
    let intent = parse_execution_intent_response(
        r#"Example: {"actionIntent":"answer","targetIntent":"none","presentationIntent":"text","confidence":0.1}
Final: {"actionIntent":"query","targetIntent":"knowledge","presentationIntent":"json","confidence":0.95}"#,
    )
    .expect("last json object should parse");

    assert_eq!(intent.action.as_str(), "query");
    assert_eq!(intent.target.as_str(), "knowledge");
    assert_eq!(intent.presentation.as_str(), "json");
    assert_eq!(intent.confidence, 0.95);
}

#[test]
fn parse_execution_intent_response_rejects_labeled_text() {
    let intent = parse_execution_intent_response(
        r#"The user wants a flow view.
- actionIntent: query
- targetIntent: conversation
- presentationIntent: flow_canvas
- confidence: 0.95"#,
    );

    assert!(intent.is_none());
}

#[test]
fn parse_execution_intent_response_rejects_labeled_values_with_explanations() {
    let intent = parse_execution_intent_response(
        r#"The user asks for sports knowledge.
- actionIntent: answer (direct answer)
- targetIntent: knowledge (established facts)
- presentationIntent: text (default)
- confidence: 0.9"#,
    );

    assert!(intent.is_none());
}

#[test]
fn parse_execution_intent_response_rejects_natural_language_inference() {
    let intent = parse_execution_intent_response(
        "The user wants to use flow to analyze our conversation in this session.",
    );

    assert!(intent.is_none());
}

#[test]
fn quoted_memory_entry_creates_flow_branch_dependency() {
    let flow = build_memory_entry_flow_json(vec![
        (
            "root".to_string(),
            "user".to_string(),
            "火箭队和马刺队的荣誉对比".to_string(),
            1,
            1,
            HashMap::new(),
        ),
        (
            "answer".to_string(),
            "assistant".to_string(),
            "火箭有总冠军，马刺也有总冠军。".to_string(),
            2,
            2,
            HashMap::new(),
        ),
        (
            "quote_follow_up".to_string(),
            "user".to_string(),
            "> 火箭队和马刺队的荣誉对比\n\n为什么马刺更多？".to_string(),
            3,
            3,
            HashMap::from([("quoted_memory_entry_id".to_string(), "root".to_string())]),
        ),
    ]);
    let payload = flow
        .trim()
        .trim_start_matches("```json")
        .trim_end_matches("```")
        .trim();
    let parsed: Value = serde_json::from_str(payload).expect("flow json should parse");
    let steps = parsed["steps"].as_array().expect("steps should be an array");

    assert_eq!(steps[2]["id"], "entry_quote_follow_up");
    assert_eq!(steps[2]["dependsOn"], json!(["entry_root"]));
}
