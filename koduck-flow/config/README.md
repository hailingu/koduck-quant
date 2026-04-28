# KoduckFlow Config Layout

KoduckFlow configuration is grouped by purpose:

- `schema/`: generated JSON Schema and TypeScript declaration artifacts.
- `di/`: dependency injection registration metadata.
- `.env.template`: generated environment variable template.

Runtime override files such as `koduckflow.config.json` stay at the project root or an explicit runtime path so the loader can resolve them predictably.
