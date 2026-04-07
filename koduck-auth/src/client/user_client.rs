//! User service client

/// User service client placeholder
#[derive(Debug, Clone)]
pub struct UserClient;

impl UserClient {
    /// Create new user client
    pub fn new() -> Self {
        Self
    }
}

impl Default for UserClient {
    fn default() -> Self {
        Self::new()
    }
}
