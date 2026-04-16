use std::time::Duration;

use tonic::{Response, Status};

use crate::api::{QueryMemoryResponse, RequestMeta};
use crate::observe::{RpcMethod, RpcOutcome, record_rpc_call};

pub(crate) fn log_rpc_completion(
    method: &str,
    request_id: &str,
    session_id: &str,
    tenant_id: &str,
    trace_id: &str,
    outcome: &str,
    duration_ms: u64,
    detail: &str,
) {
    tracing::info!(
        rpc_method = method,
        request_id,
        session_id,
        tenant_id,
        trace_id,
        outcome,
        duration_ms,
        detail,
        "memory rpc completed"
    );
}

pub(crate) fn log_rpc_failure(
    method: &str,
    request_id: &str,
    session_id: &str,
    tenant_id: &str,
    trace_id: &str,
    duration_ms: u64,
    status: &Status,
) {
    tracing::warn!(
        rpc_method = method,
        request_id,
        session_id,
        tenant_id,
        trace_id,
        outcome = "error",
        duration_ms,
        grpc_code = ?status.code(),
        error = %status.message(),
        "memory rpc failed"
    );
}

pub(crate) fn finish_query_memory_success(
    meta: &RequestMeta,
    request_session_id: &str,
    retrieve_policy: i32,
    domain_class: &str,
    detail_suffix: Option<&str>,
    elapsed: Duration,
    response: &Response<QueryMemoryResponse>,
) {
    let duration_ms = elapsed.as_millis() as u64;
    record_rpc_call(RpcMethod::QueryMemory, RpcOutcome::Success, elapsed);
    tracing::info!(
        request_id = %meta.request_id,
        session_id = request_session_id,
        tenant_id = %meta.tenant_id,
        trace_id = %meta.trace_id,
        hits = ?response.get_ref().hits,
        "query_memory returned full hits"
    );

    let mut detail = format!(
        "hits_count={},retrieve_policy={},domain_class={}",
        response.get_ref().hits.len(),
        retrieve_policy,
        domain_class
    );
    if let Some(suffix) = detail_suffix {
        detail.push(',');
        detail.push_str(suffix);
    }

    log_rpc_completion(
        "QueryMemory",
        &meta.request_id,
        request_session_id,
        &meta.tenant_id,
        &meta.trace_id,
        "success",
        duration_ms,
        &detail,
    );
}
