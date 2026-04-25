/**
 * @file Flow Canvas component exports
 * @description Exports for FlowCanvas, FlowViewport, and FlowGrid components.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 2.6
 */

// FlowCanvas - Top-level canvas container
export { FlowCanvas, FlowCanvasWithProvider, default } from "./FlowCanvas";
export type { FlowCanvasProps, NodeRenderProps, EdgeRenderProps } from "./FlowCanvas";

// FlowViewport - Viewport state management
export {
  FlowViewport,
  useViewport,
  useViewportOptional,
  DEFAULT_VIEWPORT_STATE,
  DEFAULT_VIEWPORT_CONSTRAINTS,
} from "./FlowViewport";
export type {
  ViewportState,
  ViewportConstraints,
  ViewportContextValue,
  FlowViewportProps,
} from "./FlowViewport";

// FlowGrid - Background grid rendering
export { FlowGrid, DEFAULT_GRID_PATTERN } from "./FlowGrid";
export type { GridPattern, FlowGridProps } from "./FlowGrid";
