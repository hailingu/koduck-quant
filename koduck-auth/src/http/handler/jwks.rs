//! JWKS handler

use axum::{
    extract::State,
    response::Json,
};
use serde_json::Value;
use std::sync::Arc;

use crate::{error::Result, state::AppState};

/// Get JWKS endpoint
pub async fn get_jwks(State(_state): State<Arc<AppState>>) -> Result<Json<Value>> {
    // TODO: Return JWKS from service
    Ok(Json(serde_json::json!({
        "keys": []
    })))
}
