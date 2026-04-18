use std::collections::HashMap;

use serde_json::json;

use super::{
    build_chat_completions_request, parse_generate_response, parse_stream_chunk,
    sanitize_assistant_text, sanitize_stream_delta, OpenAiChoiceDelta, OpenAiGenerateChoice,
    OpenAiGenerateResponse, OpenAiResponseMessage, OpenAiStreamChoice, OpenAiStreamChunk,
    OpenAiUsage,
};
use crate::llm::types::{ChatMessage, GenerateRequest, RequestContext, ToolDefinition};

fn sample_request() -> GenerateRequest {
    GenerateRequest {
        meta: RequestContext {
            request_id: "req-1".to_string(),
            session_id: "sess-1".to_string(),
            user_id: "user-1".to_string(),
            trace_id: "trace-1".to_string(),
            deadline_ms: 1500,
        },
        provider: "openai".to_string(),
        model: "gpt-4.1-mini".to_string(),
        messages: vec![ChatMessage {
            role: "user".to_string(),
            content: "hello".to_string(),
            name: String::new(),
            metadata: HashMap::new(),
        }],
        temperature: 0.2,
        top_p: 0.9,
        max_tokens: 256,
        tools: vec![ToolDefinition {
            name: "search".to_string(),
            description: "Search docs".to_string(),
            input_schema: r#"{"type":"object"}"#.to_string(),
        }],
        response_format: "json_object".to_string(),
    }
}

#[test]
fn builds_openai_wire_request() {
    let body = build_chat_completions_request(&sample_request(), "gpt-4.1-mini", true);

    assert_eq!(body["model"], "gpt-4.1-mini");
    assert_eq!(body["stream"], true);
    assert_eq!(body["messages"][0]["content"], "hello");
    assert_eq!(body["tools"][0]["function"]["name"], "search");
    assert_eq!(body["response_format"]["type"], "json_object");
    assert_eq!(body["stream_options"]["include_usage"], true);
}

#[test]
fn parses_non_stream_response_into_unified_shape() {
    let payload = OpenAiGenerateResponse {
        model: Some("gpt-4.1-mini".to_string()),
        choices: vec![OpenAiGenerateChoice {
            message: OpenAiResponseMessage {
                role: Some("assistant".to_string()),
                content: json!("world"),
                tool_calls: None,
            },
            finish_reason: Some("stop".to_string()),
        }],
        usage: Some(OpenAiUsage {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
        }),
    };

    let response = parse_generate_response("openai", "fallback-model", payload, "req-1").unwrap();

    assert_eq!(response.provider, "openai");
    assert_eq!(response.model, "gpt-4.1-mini");
    assert_eq!(response.message.content, "world");
    assert_eq!(response.finish_reason, "stop");
    assert_eq!(response.usage.unwrap().total_tokens, 15);
}

#[test]
fn parses_stream_chunks_into_unified_events() {
    let mut sequence_num = 0;
    let mut saw_terminal_event = false;
    let mut inside_reasoning_block = false;
    let payload = OpenAiStreamChunk {
        id: Some("chunk-1".to_string()),
        model: Some("gpt-4.1-mini".to_string()),
        choices: vec![OpenAiStreamChoice {
            delta: Some(OpenAiChoiceDelta {
                content: Some(json!("hello")),
            }),
            finish_reason: None,
        }],
        usage: None,
    };

    let event = parse_stream_chunk(
        "openai",
        "fallback-model",
        Some("evt-1".to_string()),
        &mut sequence_num,
        &mut saw_terminal_event,
        &mut inside_reasoning_block,
        payload,
    )
    .unwrap()
    .unwrap();

    assert_eq!(event.sequence_num, 1);
    assert_eq!(event.delta, "hello");
    assert!(!saw_terminal_event);
}

#[test]
fn parses_terminal_stream_chunk_with_usage() {
    let mut sequence_num = 0;
    let mut saw_terminal_event = false;
    let mut inside_reasoning_block = false;
    let payload = OpenAiStreamChunk {
        id: Some("chunk-2".to_string()),
        model: None,
        choices: vec![OpenAiStreamChoice {
            delta: Some(OpenAiChoiceDelta { content: None }),
            finish_reason: Some("stop".to_string()),
        }],
        usage: Some(OpenAiUsage {
            prompt_tokens: 7,
            completion_tokens: 9,
            total_tokens: 16,
        }),
    };

    let event = parse_stream_chunk(
        "openai",
        "fallback-model",
        None,
        &mut sequence_num,
        &mut saw_terminal_event,
        &mut inside_reasoning_block,
        payload,
    )
    .unwrap()
    .unwrap();

    assert_eq!(event.model, "fallback-model");
    assert_eq!(event.finish_reason, "stop");
    assert_eq!(event.usage.unwrap().total_tokens, 16);
    assert!(saw_terminal_event);
}

#[test]
fn strips_think_blocks_from_generate_response() {
    let payload = OpenAiGenerateResponse {
        model: Some("gpt-4.1-mini".to_string()),
        choices: vec![OpenAiGenerateChoice {
            message: OpenAiResponseMessage {
                role: Some("assistant".to_string()),
                content: json!("<think>internal</think>最终答案"),
                tool_calls: None,
            },
            finish_reason: Some("stop".to_string()),
        }],
        usage: None,
    };

    let response = parse_generate_response("openai", "fallback-model", payload, "req-1").unwrap();

    assert_eq!(response.message.content, "最终答案");
}

#[test]
fn strips_think_blocks_across_stream_chunks() {
    let mut inside_reasoning_block = false;

    assert_eq!(
        sanitize_stream_delta("<think>internal", &mut inside_reasoning_block),
        ""
    );
    assert!(inside_reasoning_block);

    assert_eq!(
        sanitize_stream_delta(" more</think>你好", &mut inside_reasoning_block),
        "你好"
    );
    assert!(!inside_reasoning_block);
}

#[test]
fn strips_inline_think_tags_from_text() {
    assert_eq!(
        sanitize_assistant_text("前缀<think>internal</think>后缀"),
        "前缀后缀"
    );
}
