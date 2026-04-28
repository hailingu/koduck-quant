# Components Layout

React components are grouped by responsibility:

- `provider/`: runtime provider, context, and runtime access hooks.
- `flow-entity/`: reusable visual flow canvas, nodes, edges, layout, execution state, and themes.
- `editor/`: authoring/editor surface components.
- `demo/`: demo-only registry and visualization components.
- `debug/`: runtime diagnostics and debug panels.
- `virtualized/`: reusable virtual list primitives and calculations.
- `testing/`: E2E and browser harness components.

Use `src/components/index.ts` for stable public exports. Deep imports are reserved for tests and internal modules that need implementation-specific APIs.
