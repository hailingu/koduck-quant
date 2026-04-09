//! Error handling middleware

use axum::{
    body::{to_bytes, Body},
    extract::Request,
    http::header::CONTENT_LENGTH,
    middleware::Next,
    response::Response,
};
use serde_json::json;
use tracing::error;

/// Error handler middleware.
/// AppError is converted by IntoResponse earlier; this middleware only adds a
/// defensive log for unexpected 5xx responses.
pub async fn error_handler(req: Request, next: Next) -> Response {
    let method = req.method().clone();
    let path = req.uri().path().to_string();
    let request_id_from_req = req
        .headers()
        .get("x-request-id")
        .and_then(|v| v.to_str().ok())
        .map(ToOwned::to_owned);

    let response = next.run(req).await;
    let status = response.status();

    if status.is_server_error() {
        error!(%method, path = %path, %status, "Unhandled server error response");
    }

    if !(status.is_client_error() || status.is_server_error()) {
        return response;
    }

    let request_id = response
        .headers()
        .get("x-request-id")
        .and_then(|v| v.to_str().ok())
        .map(ToOwned::to_owned)
        .or(request_id_from_req);

    let (mut parts, body) = response.into_parts();
    let body_bytes = match to_bytes(body, usize::MAX).await {
        Ok(bytes) => bytes,
        Err(_) => return Response::from_parts(parts, Body::empty()),
    };

    let mut value = match serde_json::from_slice::<serde_json::Value>(&body_bytes) {
        Ok(v) => v,
        Err(_) => return Response::from_parts(parts, Body::from(body_bytes)),
    };

    if let Some(obj) = value.as_object_mut() {
        obj.insert("path".to_string(), json!(path));
        obj.insert(
            "request_id".to_string(),
            match request_id {
                Some(id) => json!(id),
                None => serde_json::Value::Null,
            },
        );
    }

    let new_body = match serde_json::to_vec(&value) {
        Ok(v) => v,
        Err(_) => body_bytes.to_vec(),
    };

    parts.headers.remove(CONTENT_LENGTH);
    Response::from_parts(parts, Body::from(new_body))
}
