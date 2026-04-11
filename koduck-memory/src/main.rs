use tracing::info;

use koduck_memory::{app, config::AppConfig, observe};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    observe::init_tracing()?;

    let config = AppConfig::load()?;
    info!(
        service = %config.app.name,
        version = %config.app.version,
        environment = %config.app.env,
        grpc_addr = %config.server.grpc_addr,
        metrics_addr = %config.server.metrics_addr,
        config = %config.redacted_summary(),
        "starting koduck-memory service"
    );

    app::run(config).await?;
    Ok(())
}
