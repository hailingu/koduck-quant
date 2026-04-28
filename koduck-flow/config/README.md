# DuckFlow Config Layout

DuckFlow configuration is grouped by purpose:

- `environments/`: runtime configuration per deployment environment.
- `schema/`: generated JSON Schema and TypeScript declaration artifacts.
- `di/`: dependency injection registration metadata.
- `quality/`: quality-gate and coverage policy inputs.

Runtime override files such as `duckflow.config.json` stay at the project root or an explicit runtime path so the loader can resolve them predictably.
