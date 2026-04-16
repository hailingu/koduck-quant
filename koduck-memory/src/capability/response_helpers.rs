use tonic::Response;

use crate::api::{
    AppendMemoryResponse, DeleteSessionResponse, ErrorDetail, GetSessionIdsLookupResponse,
    GetSessionResponse, GetSessionSummaryResponse, GetSessionTranscriptResponse, MemoryHit,
    QueryMemoryResponse, SessionInfo, SessionTranscriptEntry, SummarizeMemoryResponse,
    UpsertSessionMetaResponse,
};

fn error_detail(
    code: &str,
    message: String,
    retryable: bool,
    degraded: bool,
) -> ErrorDetail {
    ErrorDetail {
        code: code.to_string(),
        message,
        retryable,
        degraded,
        upstream: "koduck-memory".to_string(),
        retry_after_ms: 0,
    }
}

pub(crate) fn ok_upsert_session_meta() -> Response<UpsertSessionMetaResponse> {
    Response::new(UpsertSessionMetaResponse {
        ok: true,
        error: None,
    })
}

pub(crate) fn ok_get_session(session: SessionInfo) -> Response<GetSessionResponse> {
    Response::new(GetSessionResponse {
        ok: true,
        session: Some(session),
        error: None,
    })
}

pub(crate) fn session_not_found() -> Response<GetSessionResponse> {
    Response::new(GetSessionResponse {
        ok: false,
        session: None,
        error: Some(error_detail(
            "RESOURCE_NOT_FOUND",
            "session not found".to_string(),
            false,
            false,
        )),
    })
}

pub(crate) fn ok_session_transcript(
    entries: Vec<SessionTranscriptEntry>,
    transcript_text: String,
) -> Response<GetSessionTranscriptResponse> {
    Response::new(GetSessionTranscriptResponse {
        ok: true,
        entries,
        transcript_text,
        error: None,
    })
}

pub(crate) fn session_transcript_not_found() -> Response<GetSessionTranscriptResponse> {
    Response::new(GetSessionTranscriptResponse {
        ok: false,
        entries: Vec::new(),
        transcript_text: String::new(),
        error: Some(error_detail(
            "RESOURCE_NOT_FOUND",
            "session not found".to_string(),
            false,
            false,
        )),
    })
}

pub(crate) fn session_transcript_raw_unavailable(
    message: impl Into<String>,
) -> Response<GetSessionTranscriptResponse> {
    Response::new(GetSessionTranscriptResponse {
        ok: false,
        entries: Vec::new(),
        transcript_text: String::new(),
        error: Some(error_detail(
            "RAW_CONTENT_UNAVAILABLE",
            message.into(),
            false,
            true,
        )),
    })
}

pub(crate) fn ok_lookup_session_ids(session_ids: Vec<String>) -> Response<GetSessionIdsLookupResponse> {
    Response::new(GetSessionIdsLookupResponse {
        ok: true,
        session_ids,
        error: None,
    })
}

pub(crate) fn ok_get_session_summary(summary: String) -> Response<GetSessionSummaryResponse> {
    Response::new(GetSessionSummaryResponse {
        ok: true,
        summary,
        error: None,
    })
}

pub(crate) fn ok_query_memory(hits: Vec<MemoryHit>) -> Response<QueryMemoryResponse> {
    Response::new(QueryMemoryResponse {
        ok: true,
        hits,
        next_page_token: String::new(),
        error: None,
    })
}

pub(crate) fn ok_append_memory(appended_count: i32) -> Response<AppendMemoryResponse> {
    Response::new(AppendMemoryResponse {
        ok: true,
        appended_count,
        error: None,
    })
}

pub(crate) fn summarize_async_disabled() -> Response<SummarizeMemoryResponse> {
    Response::new(SummarizeMemoryResponse {
        ok: false,
        summary: String::new(),
        error: Some(error_detail(
            "SUMMARY_ASYNC_DISABLED",
            "summary.async_enabled is disabled".to_string(),
            false,
            false,
        )),
    })
}

pub(crate) fn ok_summarize_memory(summary: String) -> Response<SummarizeMemoryResponse> {
    Response::new(SummarizeMemoryResponse {
        ok: true,
        summary,
        error: None,
    })
}

pub(crate) fn ok_delete_session(
    deleted_facts: i32,
    deleted_units: i32,
    deleted_anchors: i32,
    deleted_entries: i32,
    deleted_summaries: i32,
    deleted_index_records: i32,
) -> Response<DeleteSessionResponse> {
    Response::new(DeleteSessionResponse {
        ok: true,
        deleted_facts,
        deleted_units,
        deleted_anchors,
        deleted_entries,
        deleted_summaries,
        deleted_index_records,
        error: None,
    })
}
