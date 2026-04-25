/**
 * @file Flow Node component exports
 * @description Exports for BaseFlowNode and sub-components (header, content, ports, status, progress).
 *
 * @see docs/design/flow-entity-step-plan-en.md Tasks 1.8–1.9, Task 3.3, Task 3.5, Task 4.9
 */

// BaseFlowNode component and types (Task 1.8)
export {
  BaseFlowNode,
  default as BaseFlowNodeDefault,
  type BaseFlowNodeProps,
  type NodeRenderMode,
  type HeaderRendererProps,
  type ContentRendererProps,
  type FooterRendererProps,
} from "./BaseFlowNode";

// Sub-components (Task 1.9)
export { FlowNodeHeader, type FlowNodeHeaderProps } from "./FlowNodeHeader";
export {
  FlowNodeContent,
  type FlowNodeContentProps,
  type ContentRenderMode,
} from "./FlowNodeContent";
export {
  FlowNodePorts,
  type FlowNodePortsProps,
  type PortRendererProps,
  type PortPosition,
} from "./FlowNodePorts";

// Status component (Task 3.3)
export {
  FlowNodeStatus,
  FlowNodeStatusDot,
  FlowNodeStatusBadge,
  default as FlowNodeStatusDefault,
  type FlowNodeStatusProps,
  type StatusPosition,
  type StatusSize,
} from "./FlowNodeStatus";

// Progress component (Task 3.5)
export {
  FlowNodeProgress,
  FlowNodeProgressTop,
  FlowNodeProgressBottom,
  FlowNodeProgressOverlay,
  default as FlowNodeProgressDefault,
  getProgressClassName,
  shouldShowProgressForState,
  type FlowNodeProgressProps,
} from "./FlowNodeProgress";

// Form types and utilities (Task 4.1)
export * from "./form";

// Demo nodes (Task 4.9)
export * from "./demo";
