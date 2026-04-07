//! Koduck Auth - Authentication Service
//! 
//! A high-performance authentication service written in Rust,
//! supporting both HTTP REST API and gRPC protocols.

pub mod client;
pub mod config;
pub mod crypto;
pub mod error;
pub mod grpc;
pub mod http;
pub mod jwt;
pub mod model;
pub mod repository;
pub mod service;
pub mod state;
pub mod util;

use std::sync::Arc;

pub use config::Config;
pub use error::AppError;
pub use state::AppState;

/// Application result type alias
pub type Result<T> = std::result::Result<T, AppError>;

/// Initialize the application state
pub async fn init_state(config: Config) -> Result<Arc<AppState>> {
    let state = AppState::new(config).await?;
    Ok(Arc::new(state))
}
