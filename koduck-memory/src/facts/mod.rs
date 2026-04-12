//! Independent long-term fact materialization.

mod model;
mod repository;

pub use model::{InsertMemoryFact, MemoryFact};
pub use repository::MemoryFactRepository;
