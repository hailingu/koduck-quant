//! OIDC discovery and token introspection handlers.

use axum::{
    extract::{Request, State},
    http::HeaderMap,
    response::Json,
};
use serde_json::Value;
use std::sync::Arc;

use crate::{
    error::Result,
    jwt::JwtValidator,
    model::TokenIntrospectionResult,
    state::AppState,
};

/// Build the base URL from the request's scheme + host.
fn base_url_from_headers(headers: &HeaderMap) -> String {
    // Prefer X-Forwarded-* headers (set by APISIX / reverse proxy).
    let proto = headers
        .get("x-forwarded-proto")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("http");
    let host = headers
        .get("host")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("localhost:8081");
    format!("{proto}://{host}")
}

/// OpenID Connect Discovery document (`.well-known/openid-configuration`).
///
/// Returns absolute URLs derived from the incoming request so that APISIX
/// (or any other client) can resolve `jwks_uri` and `introspection_endpoint`
/// without ambiguity.
pub async fn openid_configuration(
    State(_state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<Value>> {
    let base = base_url_from_headers(&headers);
    let issuer = &base; // issuer should be the reachable base URL

    let config = serde_json::json!({
        "issuer": issuer,
        "subject_types_supported": ["public"],
        "response_types_supported": ["token"],
        "grant_types_supported": ["client_credentials"],
        "id_token_signing_alg_values_supported": ["RS256"],
        "token_endpoint_auth_methods_supported": ["client_secret_post", "client_secret_basic"],
        "jwks_uri": format!("{}/.well-known/jwks.json", base),
        "introspection_endpoint": format!("{}/oauth/introspect", base),
        "scopes_supported": ["openid", "profile"],
        "claims_supported": ["sub", "username", "email", "roles", "exp", "iat", "jti"]
    });
    Ok(Json(config))
}

/// RFC 7662 Token Introspection endpoint (`POST /oauth/introspect`).
///
/// Accepts `application/x-www-form-urlencoded` body with `token=<jwt>`.
/// Validates the token locally and returns an introspection response.
pub async fn introspect_token(
    State(state): State<Arc<AppState>>,
    _headers: HeaderMap,
    axum::Form(params): axum::Form<std::collections::HashMap<String, String>>,
) -> Result<Json<TokenIntrospectionResult>> {
    let token = params
        .get("token")
        .filter(|v| !v.trim().is_empty())
        .ok_or_else(|| crate::error::AppError::Validation("missing 'token' parameter".to_string()))?;

    let public_key = crate::crypto::load_public_key(&state.config().jwt.public_key_path).await?;
    let validator = JwtValidator::new(
        &public_key,
        state.config().jwt.audience.clone(),
        state.config().jwt.issuer.clone(),
    )?;

    match validator.validate(token) {
        Ok(claims) => {
            // Only mark as active if it's an access token
            let result = if claims.token_type == crate::model::TokenType::Access {
                TokenIntrospectionResult::from_claims(&claims)
            } else {
                TokenIntrospectionResult::inactive()
            };
            Ok(Json(result))
        }
        Err(_) => Ok(Json(TokenIntrospectionResult::inactive())),
    }
}
