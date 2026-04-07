//! Redis cache wrapper

use crate::error::Result;
use deadpool_redis::Pool;
use deadpool_redis::redis::AsyncCommands;

/// Redis cache wrapper
#[derive(Clone)]
pub struct RedisCache {
    pool: Pool,
}

impl RedisCache {
    /// Create new Redis cache
    pub fn new(pool: Pool) -> Self {
        Self { pool }
    }

    /// Add token to blacklist
    pub async fn add_to_token_blacklist(&self, jti: &str, exp: usize) -> Result<()> {
        let mut conn = self.pool.get().await?;
        let key = format!("token:blacklist:{}", jti);
        let ttl = exp.saturating_sub(
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs() as usize,
        );
        
        if ttl > 0 {
            let _: () = conn.set_ex(&key, 1, ttl as u64).await?;
        }
        
        Ok(())
    }

    /// Check if token is revoked
    pub async fn is_token_revoked(&self, jti: &str) -> Result<bool> {
        let mut conn = self.pool.get().await?;
        let key = format!("token:blacklist:{}", jti);
        let exists: bool = conn.exists(&key).await?;
        Ok(exists)
    }

    /// Increment login attempts for IP
    pub async fn incr_login_attempt(&self, ip: &str) -> Result<i32> {
        let mut conn = self.pool.get().await?;
        let key = format!("login:attempts:{}", ip);
        let count: i32 = conn.incr(&key, 1).await?;
        
        // Set 1 hour expiry on first attempt
        if count == 1 {
            let _: () = conn.expire(&key, 3600).await?;
        }
        
        Ok(count)
    }

    /// Get login attempts for IP
    pub async fn get_login_attempts(&self, ip: &str) -> Result<i32> {
        let mut conn = self.pool.get().await?;
        let key = format!("login:attempts:{}", ip);
        let count: Option<i32> = conn.get(&key).await?;
        Ok(count.unwrap_or(0))
    }

    /// Reset login attempts for IP
    pub async fn reset_login_attempts(&self, ip: &str) -> Result<()> {
        let mut conn = self.pool.get().await?;
        let key = format!("login:attempts:{}", ip);
        let _: () = conn.del(&key).await?;
        Ok(())
    }

    /// Lock IP address
    pub async fn lock_ip(&self, ip: &str, duration_secs: u64) -> Result<()> {
        let mut conn = self.pool.get().await?;
        let key = format!("login:locked:{}", ip);
        let _: () = conn.set_ex(&key, 1, duration_secs).await?;
        Ok(())
    }

    /// Check if IP is locked
    pub async fn is_ip_locked(&self, ip: &str) -> Result<bool> {
        let mut conn = self.pool.get().await?;
        let key = format!("login:locked:{}", ip);
        let locked: bool = conn.exists(&key).await?;
        Ok(locked)
    }
}
