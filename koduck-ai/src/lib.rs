//! Koduck AI - AI Gateway / Orchestrator
//!
//! An AI orchestration gateway written in Rust,
//! providing chat/stream interfaces and coordinating memory/tool/llm services.

pub mod api;
pub mod app;
pub mod auth;
pub mod clients;
pub mod config;
pub mod llm;
pub mod observe;
pub mod orchestrator;
pub mod plan;
pub mod registry;
pub mod reliability;
pub mod stream;

pub use config::Config;
