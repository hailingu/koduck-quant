//! JWKS handler

use axum::{
    extract::State,
    response::Json,
};
use serde_json::Value;
use std::sync::Arc;

use crate::{
    crypto::load_public_key,
    error::Result,
    jwt::JwksService,
    state::AppState,
};

/// Get JWKS endpoint
pub async fn get_jwks(State(state): State<Arc<AppState>>) -> Result<Json<Value>> {
    let public_key = load_public_key(&state.config().jwt.public_key_path).await?;
    let jwks_service = JwksService::new(&public_key, state.config().jwt.key_id.clone())?;
    let jwks = jwks_service.get_jwks()?;
    Ok(Json(jwks))
}
