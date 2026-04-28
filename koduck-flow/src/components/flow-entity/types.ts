/**
 * @file Flow Entity TSX component types
 * @description Core type definitions for Flow Entity components including node data,
 * edge data, ports, execution state, themes, and form schemas.
 *
 * @see docs/design/flow-entity-tsx-design.md sections 3.x–9.x
 */

// =============================================================================
// Basic Geometric Types
// =============================================================================

/**
 * Represents a 2D position with x and y coordinates.
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Represents dimensions with width and height.
 */
export interface Size {
  width: number;
  height: number;
}

// =============================================================================
// Execution & Animation State Types
// =============================================================================

/**
 * Execution states for flow nodes.
 * @see Design doc section 4.1 - Node Execution States
 */
export type ExecutionState =
  | "idle"
  | "pending"
  | "running"
  | "success"
  | "error"
  | "skipped"
  | "cancelled";

/**
 * Animation states for edges during execution.
 * @see Design doc section 5.2 - Edge Animation States
 */
export type EdgeAnimationState = "idle" | "flowing" | "success" | "error" | "highlight";

// =============================================================================
// Port System Types
// =============================================================================

/**
 * Supported data types for ports.
 */
export type PortDataType =
  | "any"
  | "string"
  | "number"
  | "boolean"
  | "object"
  | "array"
  | "function";

/**
 * Port direction: input receives data, output sends data.
 */
export type PortDirection = "input" | "output";

/**
 * Port side on the node boundary.
 */
export type PortSide = "left" | "right" | "top" | "bottom";

/**
 * Port placement strategy along its side.
 */
export type PortAlignment = "center" | "start" | "end" | "distributed";

/**
 * Port visibility policy.
 */
export type PortVisibility = "always" | "connected" | "hover";

/**
 * Definition of a port on a node.
 * @see Design doc section 4.2 - Port System
 */
export interface PortDefinition {
  /** Unique identifier for the port within the node */
  id: string;
  /** Display name for the port */
  name: string;
  /** Port direction */
  type: PortDirection;
  /** Expected data type for type checking */
  dataType?: PortDataType;
  /** Whether the port is required for node execution */
  required?: boolean;
  /** Whether the port accepts multiple connections */
  allowMultiple?: boolean;
  /** Side of the node boundary where this port should be rendered */
  side?: PortSide;
  /** Placement strategy along the selected side */
  alignment?: PortAlignment;
  /** Visibility policy for renderers that support hidden/hover ports */
  visibility?: PortVisibility;
  /** Default value when no connection is present */
  defaultValue?: unknown;
  /** Description shown in tooltips */
  description?: string;
}

/**
 * Runtime state of a port including connection status.
 */
export interface PortState {
  /** Reference to the port definition */
  definition: PortDefinition;
  /** Whether the port is currently connected */
  connected: boolean;
  /** IDs of connected edges */
  connectedEdgeIds: string[];
  /** Computed position of the port for edge rendering */
  position?: Position;
  /** Whether the port is currently highlighted (e.g., during drag) */
  highlighted?: boolean;
  /** Error message if port has validation error */
  error?: string;
}

/**
 * Configuration for the port system behavior.
 */
export interface PortSystemConfig {
  /** Enable type checking between connected ports */
  enableTypeChecking?: boolean;
  /** Show port labels */
  showLabels?: boolean;
  /** Port visual size in pixels */
  portSize?: number;
  /** Spacing between ports */
  portSpacing?: number;
  /** Allow connecting incompatible types with warning */
  allowIncompatibleConnections?: boolean;
}

// =============================================================================
// Form System Types
// =============================================================================

/**
 * Supported field types for node configuration forms.
 * @see Design doc section 8 - Form Schema Integration
 */
export type FormFieldType =
  | "text"
  | "number"
  | "boolean"
  | "select"
  | "multiselect"
  | "textarea"
  | "json"
  | "code"
  | "color"
  | "file"
  | "date"
  | "time"
  | "datetime"
  | "range"
  | "password"
  | "url"
  | "email";

/**
 * Validation rule for form fields.
 */
export interface FormFieldValidation {
  /** Field is required */
  required?: boolean;
  /** Minimum value (for numbers) or length (for strings) */
  min?: number;
  /** Maximum value (for numbers) or length (for strings) */
  max?: number;
  /** Regex pattern for string validation */
  pattern?: string;
  /** Custom error message */
  message?: string;
  /** Custom validation function name (resolved at runtime) */
  customValidator?: string;
}

/**
 * Schema definition for a single form field.
 */
export interface FormFieldSchema {
  /** Field type */
  type: FormFieldType;
  /** Display label */
  label?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Default value */
  default?: unknown;
  /** Field description / help text */
  description?: string;
  /** Options for select/multiselect fields */
  options?: Array<{ value: string | number; label: string }>;
  /** Validation rules */
  validation?: FormFieldValidation;
  /** Whether field is disabled */
  disabled?: boolean;
  /** Whether field is hidden */
  hidden?: boolean;
  /** Conditional visibility expression */
  visibleWhen?: string;
  /** Group name for organizing fields */
  group?: string;
  /** Display order within group */
  order?: number;
}

/**
 * Layout configuration for form rendering.
 */
export interface FormLayout {
  /** Number of columns in the form grid */
  columns?: 1 | 2 | 3 | 4;
  /** Field groups with titles */
  groups?: Array<{
    id: string;
    title: string;
    collapsed?: boolean;
    fields: string[];
  }>;
  /** Spacing between fields */
  spacing?: "compact" | "normal" | "relaxed";
  /** Label position */
  labelPosition?: "top" | "left" | "inline";
}

/**
 * Complete form schema for node configuration.
 */
export interface FormSchema {
  /** Schema type (always 'object' for forms) */
  type: "object";
  /** Field definitions keyed by field name */
  properties: Record<string, FormFieldSchema>;
  /** Layout configuration */
  layout?: FormLayout;
  /** Schema version for migration */
  version?: string;
}

// =============================================================================
// Theme Types
// =============================================================================

/**
 * Theme configuration for flow nodes.
 * @see Design doc section 9.1 - Theme Configuration
 */
export interface FlowNodeTheme {
  /** Node background color */
  backgroundColor: string;
  /** Node border color */
  borderColor: string;
  /** Node border width in pixels */
  borderWidth?: number;
  /** Node border radius in pixels */
  borderRadius?: number;
  /** Header background color (for nodes with headers) */
  headerColor?: string;
  /** Text color */
  textColor?: string;
  /** Secondary text color */
  secondaryTextColor?: string;
  /** Shadow configuration */
  shadow?: string;
  /** Port colors by state */
  portColors?: {
    default: string;
    connected: string;
    highlighted: string;
    error: string;
  };
  /** Execution state visual overrides */
  executionStateColors?: Partial<Record<ExecutionState, string>>;
}

/**
 * Theme configuration for flow edges.
 * @see Design doc section 9.2 - Edge Theme
 */
export interface FlowEdgeTheme {
  /** Edge stroke color */
  strokeColor: string;
  /** Edge stroke width in pixels */
  strokeWidth?: number;
  /** Edge stroke dash pattern (e.g., '5,5' for dashed) */
  strokeDasharray?: string;
  /** Arrow marker color */
  arrowColor?: string;
  /** Arrow marker size */
  arrowSize?: number;
  /** Edge opacity */
  opacity?: number;
  /** Selected edge color */
  selectedColor?: string;
  /** Hover edge color */
  hoverColor?: string;
  /** Animation state colors */
  animationStateColors?: Partial<Record<EdgeAnimationState, string>>;
}

/**
 * Complete theme configuration for the flow canvas.
 */
export interface FlowTheme {
  /** Node theme defaults */
  node: FlowNodeTheme;
  /** Edge theme defaults */
  edge: FlowEdgeTheme;
  /** Canvas background color */
  canvasBackground?: string;
  /** Grid line color */
  gridColor?: string;
  /** Selection box color */
  selectionColor?: string;
  /** Minimap theme */
  minimap?: {
    backgroundColor: string;
    nodeColor: string;
    viewportColor: string;
  };
}

// =============================================================================
// Path & Animation Types
// =============================================================================

/**
 * Edge path calculation strategies.
 * @see Design doc section 5.1 - Edge Path Calculation
 */
export type PathType = "straight" | "bezier" | "step" | "smoothstep";

/**
 * Configuration for edge path calculation.
 */
export interface PathConfig {
  /** Path type to use */
  type: PathType;
  /** Curvature for bezier paths (0-1) */
  curvature?: number;
  /** Border radius for step paths */
  borderRadius?: number;
  /** Offset for smoothstep paths */
  offset?: number;
}

/**
 * General animation configuration.
 */
export interface AnimationConfig {
  /** Animation duration in milliseconds */
  duration?: number;
  /** Easing function name */
  easing?: "linear" | "ease" | "ease-in" | "ease-out" | "ease-in-out";
  /** Animation delay in milliseconds */
  delay?: number;
  /** Number of iterations (Infinity for loop) */
  iterations?: number | "infinite";
}

/**
 * Position options for progress indicator placement on nodes.
 * @see docs/design/flow-entity-step-plan-en.md Task 3.5
 */
export type ProgressPosition = "top" | "bottom" | "overlay";

/**
 * Visual configuration for node execution states.
 * @see Design doc section 4.1 - Execution State Visualization
 */
export interface ExecutionVisualConfig {
  /** Show progress indicator during running state */
  showProgress?: boolean;
  /** Enable pulse animation for running state */
  enablePulse?: boolean;
  /** Show execution time after completion */
  showExecutionTime?: boolean;
  /** Custom animation config per state */
  stateAnimations?: Partial<Record<ExecutionState, AnimationConfig>>;
  /** Custom icons per state */
  stateIcons?: Partial<Record<ExecutionState, string>>;
  /**
   * Position of the progress bar within the node
   * - 'top': Progress bar at the top of the node
   * - 'bottom': Progress bar at the bottom of the node
   * - 'overlay': Progress bar overlays the entire node
   * @default 'bottom'
   * @see docs/design/flow-entity-step-plan-en.md Task 3.5
   */
  progressPosition?: ProgressPosition;
  /**
   * Height of the progress bar in pixels
   * @default 4
   */
  progressHeight?: number;
}

/**
 * Configuration for edge animations during execution.
 * @see Design doc section 5.2 - Edge Animation
 */
export interface EdgeAnimationConfig {
  /** Enable flow animation */
  enabled?: boolean;
  /** Particle speed for flow animation */
  particleSpeed?: number;
  /** Particle size */
  particleSize?: number;
  /** Particle count */
  particleCount?: number;
  /** Animation timing */
  animation?: AnimationConfig;
}

// =============================================================================
// Entity Data Interfaces
// =============================================================================

/**
 * Data structure for flow node entities.
 * Extends base Data interface with flow-specific properties.
 * @see Design doc section 3.1 - FlowNodeEntity Data
 */
export interface IFlowNodeEntityData extends Record<string, unknown> {
  /** Entity ID */
  id: string;
  /** Node type identifier (e.g., 'task', 'condition', 'start') */
  nodeType: string;
  /** Node display label */
  label: string;
  /** Node position on canvas */
  position: Position;
  /** Node dimensions */
  size?: Size;
  /** Current execution state */
  executionState: ExecutionState;
  /** Execution progress (0-100) when state is 'running' */
  executionProgress?: number;
  /** Error message when state is 'error' */
  errorMessage?: string;
  /** Execution start timestamp */
  executionStartTime?: number;
  /** Execution end timestamp */
  executionEndTime?: number;
  /** Input port definitions */
  inputPorts: PortDefinition[];
  /** Output port definitions */
  outputPorts: PortDefinition[];
  /** Node-specific configuration data */
  config?: Record<string, unknown>;
  /** Form schema for configuration UI */
  formSchema?: FormSchema;
  /** Custom theme overrides */
  theme?: Partial<FlowNodeTheme>;
  /** Whether node is disabled */
  disabled?: boolean;
  /** Whether node is selected */
  selected?: boolean;
  /** Whether node is locked (cannot be moved/edited) */
  locked?: boolean;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Data structure for flow edge entities.
 * Extends base Data interface with flow-specific properties.
 * @see Design doc section 3.2 - FlowEdgeEntity Data
 */
export interface IFlowEdgeEntityData extends Record<string, unknown> {
  /** Entity ID */
  id: string;
  /** Edge type identifier */
  edgeType?: string;
  /** Edge display label */
  label?: string;
  /** Source node ID */
  sourceNodeId: string;
  /** Source port ID */
  sourcePortId: string;
  /** Target node ID */
  targetNodeId: string;
  /** Target port ID */
  targetPortId: string;
  /** Current animation state */
  animationState: EdgeAnimationState;
  /** Path calculation type */
  pathType?: PathType;
  /** Path configuration */
  pathConfig?: PathConfig;
  /** Animation configuration */
  animationConfig?: EdgeAnimationConfig;
  /** Custom theme overrides */
  theme?: Partial<FlowEdgeTheme>;
  /** Whether edge is selected */
  selected?: boolean;
  /** Whether edge is disabled */
  disabled?: boolean;
  /** Edge-specific metadata */
  metadata?: Record<string, unknown>;
}

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
