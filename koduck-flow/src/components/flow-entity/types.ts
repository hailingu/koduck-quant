/**
 * @file Flow Entity TSX component types
 * @description Component-facing type definitions for Flow Entity.
 * Domain model types are owned by common/flow/model-types and re-exported here
 * for backwards-compatible component imports.
 *
 * @see docs/design/flow-entity-tsx-design.md sections 3.x-9.x
 */

import type * as React from "react";
import type {
  EdgeAnimationConfig,
  ExecutionVisualConfig,
  FlowEdgeTheme,
  FlowNodeTheme,
  FlowTheme,
  FormSchema,
  IFlowEdgeEntityData,
  IFlowNodeEntityData,
  PathConfig,
  PathType,
  PortDefinition,
  PortState,
  PortSystemConfig,
  Position,
} from "../../common/flow/model-types";

export type * from "../../common/flow/model-types";

// =============================================================================
// Component Props Types
// =============================================================================

/**
 * Base props for flow node components.
 */
export interface FlowNodeProps {
  /** Entity data */
  data: IFlowNodeEntityData;
  /** Whether the node is selected */
  selected?: boolean;
  /** Whether the node is being dragged */
  dragging?: boolean;
  /** Port state map */
  portStates?: Map<string, PortState>;
  /** Theme configuration */
  theme?: FlowNodeTheme;
  /** Execution visual config */
  executionVisual?: ExecutionVisualConfig;
  /** Callback when node is clicked */
  onClick?: (nodeId: string, event: React.MouseEvent) => void;
  /** Callback when node is double-clicked */
  onDoubleClick?: (nodeId: string, event: React.MouseEvent) => void;
  /** Callback when node drag starts */
  onDragStart?: (nodeId: string, position: Position) => void;
  /** Callback when node is dragged */
  onDrag?: (nodeId: string, position: Position) => void;
  /** Callback when node drag ends */
  onDragEnd?: (nodeId: string, position: Position) => void;
  /** Callback when port is clicked */
  onPortClick?: (nodeId: string, portId: string, event: React.MouseEvent) => void;
  /** Callback when port drag starts (for edge creation) */
  onPortDragStart?: (nodeId: string, portId: string) => void;
  /** Callback when config changes */
  onConfigChange?: (nodeId: string, config: Record<string, unknown>) => void;
}

/**
 * Base props for flow edge components.
 */
export interface FlowEdgeProps {
  /** Entity data */
  data: IFlowEdgeEntityData;
  /** Source port position */
  sourcePosition: Position;
  /** Target port position */
  targetPosition: Position;
  /** Whether the edge is selected */
  selected?: boolean;
  /** Theme configuration */
  theme?: FlowEdgeTheme;
  /** Animation configuration */
  animationConfig?: EdgeAnimationConfig;
  /** Callback when edge is clicked */
  onClick?: (edgeId: string, event: React.MouseEvent) => void;
  /** Callback when edge is double-clicked */
  onDoubleClick?: (edgeId: string, event: React.MouseEvent) => void;
  /** Callback to delete edge */
  onDelete?: (edgeId: string) => void;
}

/**
 * Props for the flow canvas container.
 */
export interface FlowCanvasProps {
  /** Node entities to render */
  nodes: IFlowNodeEntityData[];
  /** Edge entities to render */
  edges: IFlowEdgeEntityData[];
  /** Theme configuration */
  theme?: FlowTheme;
  /** Canvas width */
  width?: number | string;
  /** Canvas height */
  height?: number | string;
  /** Enable grid display */
  showGrid?: boolean;
  /** Enable minimap */
  showMinimap?: boolean;
  /** Enable zoom controls */
  showZoomControls?: boolean;
  /** Minimum zoom level */
  minZoom?: number;
  /** Maximum zoom level */
  maxZoom?: number;
  /** Default zoom level */
  defaultZoom?: number;
  /** Port system configuration */
  portConfig?: PortSystemConfig;
  /** Path configuration for edges */
  pathConfig?: PathConfig;
  /** Callback when canvas is clicked */
  onCanvasClick?: (position: Position, event: React.MouseEvent) => void;
  /** Callback when node is selected */
  onNodeSelect?: (nodeIds: string[]) => void;
  /** Callback when edge is selected */
  onEdgeSelect?: (edgeIds: string[]) => void;
  /** Callback when nodes are moved */
  onNodeMove?: (nodeId: string, position: Position) => void;
  /** Callback when edge is created */
  onEdgeCreate?: (
    sourceNodeId: string,
    sourcePortId: string,
    targetNodeId: string,
    targetPortId: string
  ) => void;
  /** Callback when edge is deleted */
  onEdgeDelete?: (edgeId: string) => void;
  /** Callback when viewport changes */
  onViewportChange?: (viewport: { x: number; y: number; zoom: number }) => void;
}

// =============================================================================
// Registry & Factory Types
// =============================================================================

/**
 * Node type registration entry.
 */
export interface NodeTypeRegistration {
  /** Unique type identifier */
  type: string;
  /** Display name */
  displayName: string;
  /** Description */
  description?: string;
  /** Icon component or icon name */
  icon?: string | React.ComponentType;
  /** Default configuration */
  defaultConfig?: Record<string, unknown>;
  /** Default port definitions */
  defaultPorts?: {
    input: PortDefinition[];
    output: PortDefinition[];
  };
  /** Form schema for configuration */
  formSchema?: FormSchema;
  /** Theme overrides for this node type */
  theme?: Partial<FlowNodeTheme>;
  /** Custom render component */
  component?: React.ComponentType<FlowNodeProps>;
  /** Category for grouping in node palette */
  category?: string;
  /** Tags for search */
  tags?: string[];
}

/**
 * Edge type registration entry.
 */
export interface EdgeTypeRegistration {
  /** Unique type identifier */
  type: string;
  /** Display name */
  displayName: string;
  /** Default path type */
  pathType?: PathType;
  /** Default animation config */
  animationConfig?: EdgeAnimationConfig;
  /** Theme overrides */
  theme?: Partial<FlowEdgeTheme>;
  /** Custom render component */
  component?: React.ComponentType<FlowEdgeProps>;
}
