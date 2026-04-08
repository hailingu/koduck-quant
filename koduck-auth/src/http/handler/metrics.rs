//! Metrics handler

use axum::{
    body::Body,
    http::header::{CONTENT_TYPE, HeaderValue},
    response::Response,
};

/// Prometheus metrics handler
pub async fn handler() -> Response<Body> {
    let body = r#"# HELP koduck_auth_build_info Build metadata.
# TYPE koduck_auth_build_info gauge
koduck_auth_build_info{service="koduck-auth",version=""} 1
"#;

    let mut response = Response::new(Body::from(body));
    response.headers_mut().insert(
        CONTENT_TYPE,
        HeaderValue::from_static("text/plain; version=0.0.4; charset=utf-8"),
    );
    response
}
