//! Auth adapter (integration with koduck-auth via JWKS).
//!
//! Two modes are supported:
//! 1. **APISIX OIDC mode**: When the `X-Auth-Provider: apisix-oidc` header is present,
//!    APISIX has already validated the token via the openid-connect plugin.
//!    We decode the JWT payload from the Authorization header without
//!    re-verifying the signature to extract user identity.
//! 2. **Direct JWKS mode** (fallback): When the OIDC header is absent, the service
//!    performs its own full JWT validation against koduck-auth's JWKS endpoint.

use std::{sync::Arc, time::{Duration, Instant}};

use axum::http::{header::AUTHORIZATION, HeaderMap};
use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
use once_cell::sync::Lazy;
use serde::Deserialize;
use tokio::sync::RwLock;

use crate::{
    app::AppState,
    reliability::error::{AppError, ErrorCode, UpstreamService},
};

const JWKS_CACHE_TTL: Duration = Duration::from_secs(60);

/// Header injected by APISIX proxy-rewrite when OIDC validation succeeded.
const OIDC_PROVIDER_HEADER: &str = "x-auth-provider";
const OIDC_PROVIDER_VALUE: &str = "apisix-oidc";

#[derive(Debug, Clone)]
pub struct AuthContext {
    pub user_id: String,
    pub username: Option<String>,
    pub roles: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct Claims {
    sub: String,
    username: Option<String>,
    #[serde(default)]
    roles: Vec<String>,
    exp: usize,
}

#[derive(Debug, Clone, Deserialize)]
struct JwksDocument {
    keys: Vec<Jwk>,
}

#[derive(Debug, Clone, Deserialize)]
struct Jwk {
    kid: String,
    kty: String,
    n: String,
    e: String,
}

#[derive(Debug, Clone)]
struct CachedJwks {
    fetched_at: Instant,
    jwks: JwksDocument,
}

static JWKS_CACHE: Lazy<RwLock<Option<CachedJwks>>> = Lazy::new(|| RwLock::new(None));

pub async fn authenticate_bearer(
    headers: &HeaderMap,
    state: &Arc<AppState>,
) -> Result<AuthContext, AppError> {
    // Mode 1: APISIX OIDC — gateway already validated the token.
    if is_apisix_oidc(headers) {
        return authenticate_via_apisix(headers);
    }

    // Mode 2: Direct JWKS validation (fallback / direct access).
    authenticate_via_jwks(headers, state).await
}

/// Check whether the request was authenticated by APISIX OIDC plugin.
fn is_apisix_oidc(headers: &HeaderMap) -> bool {
    headers
        .get(OIDC_PROVIDER_HEADER)
        .and_then(|v| v.to_str().ok())
        .map(|v| v == OIDC_PROVIDER_VALUE)
        .unwrap_or(false)
}

/// Extract user identity from JWT payload.
/// APISIX openid-connect plugin already validated signature/exp/issuer/audience,
/// so we only decode the payload without re-verifying the signature.
fn authenticate_via_apisix(headers: &HeaderMap) -> Result<AuthContext, AppError> {
    let token = extract_bearer_token(headers)?;

    // Decode without validation — APISIX already verified the token.
    let mut validation = Validation::new(Algorithm::RS256);
    validation.validate_exp = false;
    validation.insecure_disable_signature_validation();
    validation.validate_aud = false;

    let data = decode::<Claims>(token, &DecodingKey::from_secret(&[]), &validation)
        .map_err(|e| {
            AppError::new(
                ErrorCode::AuthFailed,
                format!("failed to decode APISIX-validated token: {e}"),
            )
        })?;

    let claims = data.claims;
    if claims.sub.trim().is_empty() {
        return Err(AppError::new(
            ErrorCode::AuthFailed,
            "invalid token claims: empty sub",
        ));
    }

    Ok(AuthContext {
        user_id: claims.sub,
        username: claims.username,
        roles: claims.roles,
    })
}

/// Perform local JWKS-based token validation against koduck-auth.
async fn authenticate_via_jwks(
    headers: &HeaderMap,
    state: &Arc<AppState>,
) -> Result<AuthContext, AppError> {
    let token = extract_bearer_token(headers)?;
    let header = decode_header(token).map_err(|_| {
        AppError::new(ErrorCode::AuthFailed, "invalid bearer token header")
    })?;

    let kid = header.kid.ok_or_else(|| {
        AppError::new(ErrorCode::AuthFailed, "bearer token missing kid")
    })?;

    let jwks = get_jwks(&state.config.auth.jwks_url).await?;
    let jwk = jwks
        .keys
        .iter()
        .find(|k| k.kid == kid && k.kty == "RSA")
        .ok_or_else(|| AppError::new(ErrorCode::AuthFailed, "no matching jwk for token kid"))?;

    let decoding_key = DecodingKey::from_rsa_components(&jwk.n, &jwk.e).map_err(|_| {
        AppError::new(ErrorCode::AuthFailed, "invalid jwk key material")
    })?;

    let mut validation = Validation::new(Algorithm::RS256);
    validation.validate_exp = true;
    validation.set_issuer(&["koduck-auth"]);
    validation.set_audience(&["koduck"]);

    let data = decode::<Claims>(token, &decoding_key, &validation)
        .map_err(|_| AppError::new(ErrorCode::AuthFailed, "invalid or expired bearer token"))?;
    let claims = data.claims;

    if claims.exp == 0 || claims.sub.trim().is_empty() {
        return Err(AppError::new(
            ErrorCode::AuthFailed,
            "invalid token claims",
        ));
    }

    Ok(AuthContext {
        user_id: claims.sub,
        username: claims.username,
        roles: claims.roles,
    })
}

fn extract_bearer_token(headers: &HeaderMap) -> Result<&str, AppError> {
    let value = headers
        .get(AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| AppError::new(ErrorCode::AuthFailed, "missing Authorization header"))?;

    value
        .strip_prefix("Bearer ")
        .or_else(|| value.strip_prefix("bearer "))
        .filter(|v| !v.trim().is_empty())
        .ok_or_else(|| AppError::new(ErrorCode::AuthFailed, "invalid Authorization header"))
}

async fn get_jwks(url: &str) -> Result<JwksDocument, AppError> {
    {
        let cache = JWKS_CACHE.read().await;
        if let Some(cached) = &*cache {
            if cached.fetched_at.elapsed() < JWKS_CACHE_TTL {
                return Ok(cached.jwks.clone());
            }
        }
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| {
            AppError::new(
                ErrorCode::UpstreamUnavailable,
                format!("failed to build jwks client: {e}"),
            )
            .with_upstream(UpstreamService::Auth)
        })?;

    let response = client.get(url).send().await.map_err(|e| {
        AppError::new(
            ErrorCode::UpstreamUnavailable,
            format!("failed to fetch jwks: {e}"),
        )
        .with_upstream(UpstreamService::Auth)
    })?;

    if !response.status().is_success() {
        return Err(
            AppError::new(
                ErrorCode::UpstreamUnavailable,
                format!("jwks endpoint returned {}", response.status()),
            )
            .with_upstream(UpstreamService::Auth),
        );
    }

    let jwks: JwksDocument = response.json().await.map_err(|e| {
        AppError::new(
            ErrorCode::UpstreamUnavailable,
            format!("failed to parse jwks response: {e}"),
        )
        .with_upstream(UpstreamService::Auth)
    })?;

    let mut cache = JWKS_CACHE.write().await;
    *cache = Some(CachedJwks {
        fetched_at: Instant::now(),
        jwks: jwks.clone(),
    });

    Ok(jwks)
}
