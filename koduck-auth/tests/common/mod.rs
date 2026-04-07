//! Test utilities

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
