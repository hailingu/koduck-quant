import type { Data } from "../data";

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export type ExecutionState =
  | "idle"
  | "pending"
  | "running"
  | "success"
  | "error"
  | "skipped"
  | "cancelled";

export type EdgeAnimationState = "idle" | "flowing" | "success" | "error" | "highlight";

export type PortDataType =
  | "any"
  | "string"
  | "number"
  | "boolean"
  | "object"
  | "array"
  | "function";

export type PortDirection = "input" | "output";
export type PortSide = "left" | "right" | "top" | "bottom";
export type PortAlignment = "center" | "start" | "end" | "distributed";
export type PortVisibility = "always" | "connected" | "hover";

export interface PortDefinition {
  id: string;
  name: string;
  type: PortDirection;
  dataType?: PortDataType;
  required?: boolean;
  allowMultiple?: boolean;
  side?: PortSide;
  alignment?: PortAlignment;
  visibility?: PortVisibility;
  defaultValue?: unknown;
  description?: string;
}

export interface PortState {
  definition: PortDefinition;
  connected: boolean;
  connectedEdgeIds: string[];
  position?: Position;
  highlighted?: boolean;
  error?: string;
}

export interface PortSystemConfig {
  enableTypeChecking?: boolean;
  showLabels?: boolean;
  portSize?: number;
  portSpacing?: number;
  allowIncompatibleConnections?: boolean;
}

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

export interface FormFieldValidation {
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: string;
  message?: string;
  customValidator?: string;
}

export interface FormFieldSchema {
  type: FormFieldType;
  label?: string;
  placeholder?: string;
  default?: unknown;
  description?: string;
  options?: Array<{ value: string | number; label: string }>;
  validation?: FormFieldValidation;
  disabled?: boolean;
  hidden?: boolean;
  visibleWhen?: string;
  group?: string;
  order?: number;
}

export interface FormLayout {
  columns?: 1 | 2 | 3 | 4;
  groups?: Array<{
    id: string;
    title: string;
    collapsed?: boolean;
    fields: string[];
  }>;
  spacing?: "compact" | "normal" | "relaxed";
  labelPosition?: "top" | "left" | "inline";
}

export interface FormSchema {
  type: "object";
  properties: Record<string, FormFieldSchema>;
  layout?: FormLayout;
  version?: string;
}

export interface FlowNodeTheme {
  backgroundColor: string;
  borderColor: string;
  borderWidth?: number;
  borderRadius?: number;
  headerColor?: string;
  textColor?: string;
  secondaryTextColor?: string;
  shadow?: string;
  portColors?: {
    default: string;
    connected: string;
    highlighted: string;
    error: string;
  };
  executionStateColors?: Partial<Record<ExecutionState, string>>;
}

export interface FlowEdgeTheme {
  strokeColor: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  arrowColor?: string;
  arrowSize?: number;
  opacity?: number;
  selectedColor?: string;
  hoverColor?: string;
  animationStateColors?: Partial<Record<EdgeAnimationState, string>>;
}

export interface FlowTheme {
  node: FlowNodeTheme;
  edge: FlowEdgeTheme;
  canvasBackground?: string;
  gridColor?: string;
  selectionColor?: string;
  minimap?: {
    backgroundColor: string;
    nodeColor: string;
    viewportColor: string;
  };
}

export type PathType = "straight" | "bezier" | "step" | "smoothstep";

export interface PathConfig {
  type: PathType;
  curvature?: number;
  borderRadius?: number;
  offset?: number;
}

export interface AnimationConfig {
  duration?: number;
  easing?: "linear" | "ease" | "ease-in" | "ease-out" | "ease-in-out";
  delay?: number;
  iterations?: number | "infinite";
}

export type ProgressPosition = "top" | "bottom" | "overlay";

export interface ExecutionVisualConfig {
  showProgress?: boolean;
  enablePulse?: boolean;
  showExecutionTime?: boolean;
  stateAnimations?: Partial<Record<ExecutionState, AnimationConfig>>;
  stateIcons?: Partial<Record<ExecutionState, string>>;
  progressPosition?: ProgressPosition;
  progressHeight?: number;
}

export interface EdgeAnimationConfig {
  enabled?: boolean;
  particleSpeed?: number;
  particleSize?: number;
  particleCount?: number;
  animation?: AnimationConfig;
}

export interface IFlowNodeEntityData extends Data {
  nodeType: string;
  label: string;
  position: Position;
  size?: Size;
  executionState: ExecutionState;
  executionProgress?: number;
  errorMessage?: string;
  executionStartTime?: number;
  executionEndTime?: number;
  inputPorts: PortDefinition[];
  outputPorts: PortDefinition[];
  config?: Record<string, unknown>;
  formSchema?: FormSchema;
  theme?: Partial<FlowNodeTheme>;
  disabled?: boolean;
  selected?: boolean;
  locked?: boolean;
  metadata?: Record<string, unknown>;
}

export interface IFlowEdgeEntityData extends Data {
  edgeType?: string;
  label?: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
  animationState: EdgeAnimationState;
  pathType?: PathType;
  pathConfig?: PathConfig;
  animationConfig?: EdgeAnimationConfig;
  theme?: Partial<FlowEdgeTheme>;
  selected?: boolean;
  disabled?: boolean;
  metadata?: Record<string, unknown>;
}
