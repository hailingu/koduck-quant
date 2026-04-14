//! Koduck Memory - Memory service skeleton for Koduck AI southbound integration.

pub mod api;
pub mod app;
pub mod capability;
pub mod config;
pub mod facts;
pub mod index;
pub mod memory_anchor;
pub mod memory;
pub mod memory_unit;
pub mod observe;
pub mod reliability;
pub mod retrieve;
pub mod session;
pub mod store;
pub mod summary;

pub type Result<T> = std::result::Result<T, anyhow::Error>;
