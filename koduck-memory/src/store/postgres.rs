use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use sqlx::migrate::Migrator;
use sqlx::postgres::{PgConnectOptions, PgPool, PgPoolOptions};
use sqlx::{Connection, Executor, PgConnection};
use tokio::sync::RwLock;
use tracing::{info, warn};

use crate::config::AppConfig;
use crate::Result;

static MIGRATOR: Migrator = sqlx::migrate!("./migrations");

#[derive(Clone)]
pub struct RuntimeState {
    pool: PgPool,
    status: Arc<RuntimeStatus>,
}

struct RuntimeStatus {
    ready: AtomicBool,
    postgres_up: AtomicBool,
    last_error: RwLock<Option<String>>,
}

#[derive(Clone)]
pub struct DependencySnapshot {
    pub ready: bool,
    pub postgres_up: bool,
    pub last_error: Option<String>,
    pub pool_size: u32,
    pub pool_idle: usize,
}

impl RuntimeState {
    pub async fn initialize(config: &AppConfig) -> Result<Self> {
        ensure_database_exists(&config.postgres.dsn).await?;

        let pool = PgPoolOptions::new()
            .max_connections(5)
            .min_connections(1)
            .acquire_timeout(Duration::from_secs(5))
            .connect(&config.postgres.dsn)
            .await?;

        run_migrations(&pool).await?;

        let state = Self {
            pool,
            status: Arc::new(RuntimeStatus {
                ready: AtomicBool::new(false),
                postgres_up: AtomicBool::new(false),
                last_error: RwLock::new(None),
            }),
        };

        state.check_postgres().await;
        if !state.is_ready() {
            anyhow::bail!("postgres dependency is not ready after initial connection");
        }

        info!("koduck-memory postgres pool initialized successfully");
        state.spawn_health_probe();
        Ok(state)
    }

    pub fn pool(&self) -> &PgPool {
        &self.pool
    }

    pub fn is_ready(&self) -> bool {
        self.status.ready.load(Ordering::SeqCst)
    }

    pub fn postgres_up(&self) -> bool {
        self.status.postgres_up.load(Ordering::SeqCst)
    }

    pub async fn snapshot(&self) -> DependencySnapshot {
        DependencySnapshot {
            ready: self.is_ready(),
            postgres_up: self.postgres_up(),
            last_error: self.status.last_error.read().await.clone(),
            pool_size: self.pool.size(),
            pool_idle: self.pool.num_idle(),
        }
    }

    fn spawn_health_probe(&self) {
        let state = self.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(10));
            loop {
                interval.tick().await;
                state.check_postgres().await;
            }
        });
    }

    async fn check_postgres(&self) {
        match sqlx::query_scalar::<_, i32>("SELECT 1")
            .fetch_one(&self.pool)
            .await
        {
            Ok(_) => {
                self.status.ready.store(true, Ordering::SeqCst);
                self.status.postgres_up.store(true, Ordering::SeqCst);
                let mut last_error = self.status.last_error.write().await;
                *last_error = None;
            }
            Err(error) => {
                warn!(%error, "koduck-memory postgres health check failed");
                self.status.ready.store(false, Ordering::SeqCst);
                self.status.postgres_up.store(false, Ordering::SeqCst);
                let mut last_error = self.status.last_error.write().await;
                *last_error = Some(error.to_string());
            }
        }
    }
}

async fn ensure_database_exists(dsn: &str) -> Result<()> {
    let target_options: PgConnectOptions = dsn.parse()?;
    let database_name = target_options
        .get_database()
        .filter(|name| !name.trim().is_empty())
        .ok_or_else(|| anyhow::anyhow!("postgres.dsn must include a target database name"))?
        .to_string();

    if database_name == "postgres" {
        info!("koduck-memory target database is postgres; skipping database bootstrap");
        return Ok(());
    }

    let admin_options = target_options.clone().database("postgres");
    let mut connection = PgConnection::connect_with(&admin_options).await?;
    let exists = sqlx::query_scalar::<_, bool>("SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1)")
        .bind(&database_name)
        .fetch_one(&mut connection)
        .await?;

    if exists {
        info!(database = %database_name, "koduck-memory target database already exists");
        return Ok(());
    }

    let statement = format!("CREATE DATABASE {}", quote_identifier(&database_name));
    connection.execute(statement.as_str()).await?;
    info!(database = %database_name, "koduck-memory target database created");
    Ok(())
}

async fn run_migrations(pool: &PgPool) -> Result<()> {
    MIGRATOR.run(pool).await?;
    info!("koduck-memory postgres migrations applied successfully");
    Ok(())
}

fn quote_identifier(identifier: &str) -> String {
    format!("\"{}\"", identifier.replace('"', "\"\""))
}

#[cfg(test)]
mod tests {
    use super::quote_identifier;

    #[test]
    fn quote_identifier_escapes_double_quotes() {
        assert_eq!(quote_identifier("koduck_memory"), "\"koduck_memory\"");
        assert_eq!(quote_identifier("memory\"prod"), "\"memory\"\"prod\"");
    }
}
