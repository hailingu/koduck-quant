/**
 * @file Flow Entity hooks exports
 * @description Exports for Flow Entity hooks including useFlowNode, useNodeDrag,
 * useNodeResize, usePortConnection, useSelection, and useExecutionState.
 *
 * @see docs/design/flow-entity-step-plan-en.md Phase 2
 */

// Node view state hook (Task 2.1)
export {
  useFlowNode,
  default as useFlowNodeDefault,
  type UseFlowNodeOptions,
  type UseFlowNodeResult,
} from "./useFlowNode";

// Node drag hook (Task 2.2)
export {
  useNodeDrag,
  default as useNodeDragDefault,
  type DragState,
  type UseNodeDragOptions,
  type UseNodeDragResult,
} from "./useNodeDrag";

// Node resize hook (Task 2.3)
export {
  useNodeResize,
  default as useNodeResizeDefault,
  type ResizeState,
  type UseNodeResizeOptions,
  type UseNodeResizeResult,
} from "./useNodeResize";

// Selection hook (Task 2.4)
export {
  useSelection,
  useSelectionContext,
  useSelectionContextOptional,
  SelectionProvider,
  default as useSelectionDefault,
  type SelectionState,
  type SelectionContextValue,
  type SelectionProviderProps,
  type SelectOptions,
  type UseSelectionOptions,
  type UseSelectionResult,
} from "./useSelection.jsx";

// Port connection hook (Task 2.5)
export {
  usePortConnection,
  usePortConnectionContext,
  usePortConnectionContextOptional,
  PortConnectionProvider,
  PortConnectionContext,
  areTypesCompatible,
  createConnectionKey,
  default as usePortConnectionDefault,
  type ConnectionState,
  type PortConnection,
  type ConnectionValidationResult,
  type ConnectionValidationRules,
  type PortConnectionContextValue,
  type PortConnectionProviderProps,
  type UsePortConnectionOptions,
  type UsePortConnectionResult,
} from "./usePortConnection.jsx";

// Execution state hook (Task 3.2)
export {
  useExecutionState,
  useExecutionStateOptional,
  useExecutionStateValue,
  useExecutionStateWithProgress,
  useIsExecutionState,
  createUseExecutionState,
  type UseExecutionStateOptions,
  type UseExecutionStateResult,
  type UseExecutionStateOptionalResult,
} from "./useExecutionState";

// Theme hook (Task 5.3)
export {
  useFlowTheme,
  useIsDarkTheme,
  useThemeConfig,
  type UseFlowThemeOptions,
  type UseFlowThemeReturn,
} from "./useFlowTheme";
