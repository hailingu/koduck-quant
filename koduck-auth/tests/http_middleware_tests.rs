use axum::{
    body::Body,
    http::{Request, StatusCode},
    middleware,
    routing::get,
    Router,
};
use http_body_util::BodyExt;
use koduck_auth::{
    error::AppError,
    http::middleware::{error_handler, log_request},
};
use tower::{ServiceBuilder, ServiceExt};
use tower_http::{
    request_id::{MakeRequestUuid, PropagateRequestIdLayer},
    ServiceBuilderExt,
};

async fn ok_handler() -> &'static str {
    "ok"
}

async fn err_handler() -> Result<&'static str, AppError> {
    Err(AppError::ServiceUnavailable("upstream unavailable".to_string()))
}

fn test_router() -> Router {
    Router::new()
        .route("/ok", get(ok_handler))
        .route("/err", get(err_handler))
        .layer(
            ServiceBuilder::new()
                .set_x_request_id(MakeRequestUuid)
                .layer(PropagateRequestIdLayer::x_request_id()),
        )
        .layer(middleware::from_fn(error_handler))
        .layer(middleware::from_fn(log_request))
}

#[tokio::test]
async fn request_id_is_propagated() {
    let app = test_router();
    let response = app
        .oneshot(Request::builder().uri("/ok").body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    assert!(response.headers().get("x-request-id").is_some());
}

#[tokio::test]
async fn error_response_contains_extended_fields() {
    let app = test_router();
    let response = app
        .oneshot(Request::builder().uri("/err").body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
    assert!(response.headers().get("x-request-id").is_some());

    let body_bytes = response.into_body().collect().await.unwrap().to_bytes();
    let value: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();

    assert_eq!(value["success"], false);
    assert_eq!(value["code"], "SERVICE_UNAVAILABLE");
    assert!(value.get("timestamp").is_some());
    assert!(value.get("error_id").is_some());
    assert_eq!(value["retryable"], true);
    assert_eq!(value["path"], "/err");
    assert!(value["request_id"].is_string());
}
