use tonic::Status;

use crate::api::RequestMeta;
use crate::observe::RpcGuard;

pub(crate) fn validate_meta(meta: &RequestMeta) -> Result<(), Status> {
    if meta.request_id.trim().is_empty() {
        return Err(Status::invalid_argument("request_id is required"));
    }
    if meta.session_id.trim().is_empty() {
        return Err(Status::invalid_argument("session_id is required"));
    }
    if meta.user_id.trim().is_empty() {
        return Err(Status::invalid_argument("user_id is required"));
    }
    if meta.tenant_id.trim().is_empty() {
        return Err(Status::invalid_argument("tenant_id is required"));
    }
    if meta.trace_id.trim().is_empty() {
        return Err(Status::invalid_argument("trace_id is required"));
    }
    if meta.deadline_ms <= 0 {
        return Err(Status::invalid_argument("deadline_ms must be greater than 0"));
    }
    if meta.api_version.trim().is_empty() {
        return Err(Status::invalid_argument("api_version is required"));
    }
    Ok(())
}

pub(crate) fn validate_write_meta(meta: &RequestMeta) -> Result<(), Status> {
    validate_meta(meta)?;
    if meta.idempotency_key.trim().is_empty() {
        return Err(Status::invalid_argument("idempotency_key is required"));
    }
    Ok(())
}

pub(crate) fn read_meta<'a>(meta: Option<&'a RequestMeta>) -> Result<&'a RequestMeta, Status> {
    let meta = meta.ok_or_else(|| Status::invalid_argument("meta is required"))?;
    validate_meta(meta)?;
    Ok(meta)
}

pub(crate) fn read_write_meta<'a>(
    meta: Option<&'a RequestMeta>,
) -> Result<&'a RequestMeta, Status> {
    let meta = meta.ok_or_else(|| Status::invalid_argument("meta is required"))?;
    validate_write_meta(meta)?;
    Ok(meta)
}

pub(crate) fn read_meta_with_guard<'a>(
    meta: Option<&'a RequestMeta>,
    guard: &mut RpcGuard,
) -> Result<&'a RequestMeta, Status> {
    read_meta(meta).map_err(|error| {
        guard.error();
        error
    })
}

pub(crate) fn read_write_meta_with_guard<'a>(
    meta: Option<&'a RequestMeta>,
    guard: &mut RpcGuard,
) -> Result<&'a RequestMeta, Status> {
    read_write_meta(meta).map_err(|error| {
        guard.error();
        error
    })
}

#[cfg(test)]
#[path = "request_meta_test.rs"]
mod tests;
