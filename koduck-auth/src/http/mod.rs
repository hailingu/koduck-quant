//! HTTP REST API layer

pub mod handler;
pub mod middleware;
pub mod routes;

pub use routes::create_router;
