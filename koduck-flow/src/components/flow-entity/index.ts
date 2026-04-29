/**
 * @file Flow Entity public exports
 * @description Stable public exports for Flow Entity canvas, node, edge,
 * context, hooks, layout, execution, and performance helpers.
 */

// Domain and component-facing types
export type * from "../../common/flow/model-types";
export type {
  FlowNodeProps,
  FlowEdgeProps,
  NodeTypeRegistration,
  EdgeTypeRegistration,
} from "./types";

// Context
export {
  FlowEntityProvider,
  DEFAULT_NODE_THEME,
  DEFAULT_EDGE_THEME,
  DEFAULT_FLOW_THEME,
  DEFAULT_PORT_CONFIG,
  DEFAULT_EXECUTION_VISUALS,
  DEFAULT_EDGE_ANIMATION,
  useFlowEntityContext,
  useOptionalFlowEntityContext,
  useFlowTheme as useFlowEntityTheme,
  usePortConfig,
  useFlowReadOnly,
} from "./context";
export type { FlowEntityContextValue, FlowEntityProviderProps } from "./context";

// Canvas
export { FlowCanvas, FlowCanvasWithProvider } from "./canvas/FlowCanvas";
export type {
  FlowCanvasInteraction,
  FlowCanvasMode,
  FlowCanvasProps,
  FlowCanvasRenderEngine,
  FlowCanvasRenderModel,
  FlowCanvasNodeRenderItem,
  FlowCanvasPortRenderItem,
  FlowCanvasEdgeRenderItem,
  NodeRenderProps,
  EdgeRenderProps,
  EdgeRoute,
  FlowCanvasPortEndpoint,
  FlowCanvasPortConnection,
  ConnectionValidationResult as FlowCanvasConnectionValidationResult,
} from "./canvas/FlowCanvas";
export { FlowPreviewCanvas } from "./canvas/FlowPreviewCanvas";
export type { FlowPreviewCanvasProps, FlowPreviewFitMode } from "./canvas/FlowPreviewCanvas";
export { FlowEditorCanvas } from "./canvas/FlowEditorCanvas";
export type { FlowEditorCanvasProps, FlowEditorInitialFit } from "./canvas/FlowEditorCanvas";
export {
  FlowViewport,
  useViewport,
  useViewportOptional,
  DEFAULT_VIEWPORT_STATE,
  DEFAULT_VIEWPORT_CONSTRAINTS,
} from "./canvas/FlowViewport";
export type {
  ViewportState,
  ViewportConstraints,
  ViewportContextValue,
  FlowViewportProps,
} from "./canvas/FlowViewport";
export { FlowGrid, DEFAULT_GRID_PATTERN } from "./canvas/FlowGrid";
export type { GridPattern, FlowGridProps } from "./canvas/FlowGrid";

// Nodes
export { BaseFlowNode } from "./node/BaseFlowNode";
export type {
  BaseFlowNodeProps,
  NodeRenderMode,
  HeaderRendererProps,
  ContentRendererProps,
  FooterRendererProps,
} from "./node/BaseFlowNode";
export { FlowNodeHeader } from "./node/FlowNodeHeader";
export type { FlowNodeHeaderProps } from "./node/FlowNodeHeader";
export { FlowNodeContent } from "./node/FlowNodeContent";
export type { FlowNodeContentProps, ContentRenderMode } from "./node/FlowNodeContent";
export { FlowNodePorts } from "./node/FlowNodePorts";
export type { FlowNodePortsProps, PortRendererProps, PortPosition } from "./node/FlowNodePorts";
export {
  FlowNodeStatus,
  FlowNodeStatusDot,
  FlowNodeStatusBadge,
} from "./node/FlowNodeStatus";
export type { FlowNodeStatusProps, StatusPosition, StatusSize } from "./node/FlowNodeStatus";
export {
  FlowNodeProgress,
  FlowNodeProgressTop,
  FlowNodeProgressBottom,
  FlowNodeProgressOverlay,
  getProgressClassName,
  shouldShowProgressForState,
} from "./node/FlowNodeProgress";
export type { FlowNodeProgressProps } from "./node/FlowNodeProgress";

// Edges
export { BaseFlowEdge, EdgeArrowMarker } from "./edge/BaseFlowEdge";
export type {
  BaseFlowEdgeProps,
  PathRendererProps,
  EdgeArrowMarkerProps,
} from "./edge/BaseFlowEdge";
export { EdgePath, calculatePath } from "./edge/EdgePath";
export type { EdgePathProps } from "./edge/EdgePath";
export {
  EdgeAnimation,
  EdgeAnimationParticles,
  getEdgeAnimationClassName,
  isEdgeAnimating,
  getEdgeStateColor,
} from "./edge/EdgeAnimation";
export type { EdgeAnimationProps, EdgeAnimationParticlesProps } from "./edge/EdgeAnimation";

// Hooks
export {
  useFlowNode,
  useNodeDrag,
  useNodeResize,
  useSelection,
  useSelectionContext,
  useSelectionContextOptional,
  SelectionProvider,
  usePortConnection,
  usePortConnectionContext,
  usePortConnectionContextOptional,
  PortConnectionProvider,
  PortConnectionContext,
  areTypesCompatible,
  createConnectionKey,
  useExecutionState,
  useExecutionStateOptional,
  useExecutionStateValue,
  useExecutionStateWithProgress,
  useIsExecutionState,
  createUseExecutionState,
  useFlowTheme,
  useIsDarkTheme,
  useThemeConfig,
} from "./hooks";
export type {
  UseFlowNodeOptions,
  UseFlowNodeResult,
  DragState,
  UseNodeDragOptions,
  UseNodeDragResult,
  ResizeState,
  UseNodeResizeOptions,
  UseNodeResizeResult,
  SelectionState,
  SelectionContextValue,
  SelectionProviderProps,
  SelectOptions,
  UseSelectionOptions,
  UseSelectionResult,
  ConnectionState,
  PortConnection,
  ConnectionValidationResult,
  ConnectionValidationRules,
  PortConnectionContextValue,
  PortConnectionProviderProps,
  UsePortConnectionOptions,
  UsePortConnectionResult,
  UseExecutionStateOptions,
  UseExecutionStateResult,
  UseExecutionStateOptionalResult,
  UseFlowThemeOptions,
  UseFlowThemeReturn,
} from "./hooks";

// Layout, execution, and performance utilities
export {
  calculateFlowGraphBounds,
  layoutFlowGraph,
} from "./layout";
export type { FlowLayoutOptions, FlowLayoutResult, FlowLayoutStrategy } from "./layout";
export {
  ExecutionStateManager,
  createExecutionStateManager,
  ExecutionStateProvider,
  ExecutionStateContext,
  useExecutionStateContext,
  useExecutionStateContextOptional,
  useExecutionStateManager,
} from "./execution";
export type {
  ExecutionStateManagerConfig,
  EntityExecutionInfo,
  ExecutionStateListener,
  ProgressListener,
  EntityStartEvent,
  EntityFinishEvent,
  ExecutionStateSnapshot,
  ExecutionStateContextValue,
  ExecutionStateProviderProps,
} from "./execution";
export {
  generatePathCacheKey,
  createMemoizedPathCalculator,
  memoizedPathCalculator,
  arePositionsEqual,
  areSizesEqual,
  areArraysShallowEqual,
  areNodePropsEqual,
  areEdgePropsEqual,
  createMemoizedComponent,
  isNodeInViewport,
  calculateNodeBounds,
  useVirtualizedNodes,
  useStableCallback,
  measurePerformance,
  throttle,
  debounce,
} from "./optimizations";
export type {
  PathCacheKey,
  Viewport,
  UseVirtualizedNodesOptions,
  UseVirtualizedNodesResult,
  CacheStats,
} from "./optimizations";
