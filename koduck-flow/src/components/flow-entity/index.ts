/**
 * @file Flow Entity public exports
 * @description Central export file for Flow Entity TSX components, types, hooks,
 * and context. Components are organized into node, edge, canvas, and hooks modules.
 *
 * @example
 * ```ts
 * import { BaseFlowNode, BaseFlowEdge, FlowEntityProvider } from '@/components/flow-entity';
 *
 * // Import styles (required for visual styling)
 * import '@/components/flow-entity/styles/flow-entity.css';
 * ```
 */

// Types (Task 1.2)
export * from "./types";

// Context (Task 1.7)
export * from "./context";

// Node components (Tasks 1.8–1.9)
export * from "./node";

// Edge components (Task 1.10)
export * from "./edge";

// Canvas components (Phase 2)
export * from "./canvas";

// Layout engine
export * from "./layout";

// Hooks (Phase 2–3)
export * from "./hooks";

// Execution state management (Phase 3)
export * from "./execution";

// Performance optimizations (Task 5.4)
export * from "./optimizations";

// Note: CSS styles should be imported separately by the consuming application:
// import '@/components/flow-entity/styles/flow-entity.css';
// This allows applications to choose whether to use the default styles or override them.
