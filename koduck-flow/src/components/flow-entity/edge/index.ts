/**
 * @file Flow Edge component exports
 * @description Exports for BaseFlowEdge and sub-components (EdgePath, EdgeLabel, EdgeAnimation).
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 1.10, Task 3.4
 */

// BaseFlowEdge component and types (Task 1.10)
export {
  BaseFlowEdge,
  default as BaseFlowEdgeDefault,
  EdgeArrowMarker,
  type BaseFlowEdgeProps,
  type PathRendererProps,
  type EdgeArrowMarkerProps,
} from "./BaseFlowEdge";

// EdgePath component and utilities (Task 1.10)
export {
  EdgePath,
  default as EdgePathDefault,
  calculatePath,
  type EdgePathProps,
} from "./EdgePath";

// EdgeAnimation component and utilities (Task 3.4)
export {
  EdgeAnimation,
  EdgeAnimationParticles,
  default as EdgeAnimationDefault,
  getEdgeAnimationClassName,
  isEdgeAnimating,
  getEdgeStateColor,
  type EdgeAnimationProps,
  type EdgeAnimationParticlesProps,
} from "./EdgeAnimation";

// EdgeLabel component (Task 1.10 - later phase)
// export { EdgeLabel, type EdgeLabelProps } from "./EdgeLabel";
