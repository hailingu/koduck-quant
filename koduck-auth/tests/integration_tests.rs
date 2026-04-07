//! Integration tests

mod common;

use common::init;

#[tokio::test]
async fn test_health_check() {
    init();
    // TODO: Implement health check test
}

#[tokio::test]
async fn test_login() {
    init();
    // TODO: Implement login test
}
