//! gRPC service layer

pub mod auth_service;
pub mod proto;
pub mod server;
pub mod token_service;

pub use server::create_server;
