//! Test utilities

pub mod test_app;

pub use test_app::{TestApp, TestAppWithServer, TestUser};

use std::sync::Once;

static INIT: Once = Once::new();

/// Initialize test environment
pub fn init() {
    INIT.call_once(|| {
        let _ = tracing_subscriber::fmt()
            .with_env_filter("debug")
            .try_init();
    });
}
