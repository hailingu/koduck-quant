/**
 * @file FlowEdgeEntity class
 * @module flow-edge-entity
 * @description Entity class for Flow Edges with animation support.
 * Provides connection management, styling, and animation state handling.
 *
 * @see docs/design/flow-entity-component-design.md section 3.2
 */

import { nanoid } from "nanoid";
import type { IEntityArguments } from "../entity/types";
import type { IEdge, IFlowEdgeEntity } from "./types";
import type {
  EdgeAnimationState,
  PathType,
  PathConfig,
  EdgeAnimationConfig,
  FlowEdgeTheme,
  IFlowEdgeEntityData,
} from "../../components/flow-entity/types";

/**
 * Default edge animation state
 */
const DEFAULT_ANIMATION_STATE: EdgeAnimationState = "idle";

/**
 * Default path type
 */
const DEFAULT_PATH_TYPE: PathType = "bezier";

/**
 * FlowEdgeEntity - Flow edge entity with animation support
 *
 * Implements the entity layer for flow edges, providing:
 * - Connection management (source/target node and port binding)
 * - Animation state management (idle, flowing, success, error, highlight)
 * - Path type configuration (straight, bezier, step, smoothstep)
 * - Theme customization
 * - Serialization/deserialization
 *
 * @template E - Edge type (default: IEdge)
 *
 * @example
 * ```typescript
 * const edge = new FlowEdgeEntity({
 *   sourceNodeId: 'node1',
 *   sourcePortId: 'out1',
 *   targetNodeId: 'node2',
 *   targetPortId: 'in1',
 * });
 *
 * // Set animation state
 * edge.setAnimationState('flowing');
 *
 * // Change path type
 * edge.setPathType('smoothstep');
 *
 * // Customize theme
 * edge.setTheme({ strokeColor: '#3b82f6', strokeWidth: 2 });
 * ```
 */
export class FlowEdgeEntity<E extends IEdge = IEdge> implements IFlowEdgeEntity<E> {
  /**
   * Entity type identifier for registry
   */
  static readonly type = "flow-edge-entity";

  /**
   * Unique entity identifier
   */
  readonly id: string;

  /**
   * Entity type (static, read from constructor)
   */
  readonly type: string = FlowEdgeEntity.type;

  /**
   * Entity data containing all edge properties
   */
  private _data: IFlowEdgeEntityData;

  /**
   * Entity configuration
   */
  private _config: IEntityArguments | undefined;

  /**
   * Whether the entity has been disposed
   */
  private _disposed = false;

  /**
   * Reference to the underlying edge (for connection management)
   */
  private _edge: E | undefined;

  /**
   * Creates a new FlowEdgeEntity
   *
   * @param args - Initial entity arguments
   */
  constructor(args?: IFlowEdgeEntityArguments) {
    this.id = `flow-edge-${nanoid()}`;

    // Validate required connection parameters
    if (!args?.sourceNodeId) {
      throw new Error("FlowEdgeEntity: sourceNodeId is required");
    }
    if (!args?.sourcePortId) {
      throw new Error("FlowEdgeEntity: sourcePortId is required");
    }
    if (!args?.targetNodeId) {
      throw new Error("FlowEdgeEntity: targetNodeId is required");
    }
    if (!args?.targetPortId) {
      throw new Error("FlowEdgeEntity: targetPortId is required");
    }

    // Initialize data with defaults
    this._data = {
      edgeType: args?.edgeType ?? "default",
      label: args?.label,
      sourceNodeId: args.sourceNodeId,
      sourcePortId: args.sourcePortId,
      targetNodeId: args.targetNodeId,
      targetPortId: args.targetPortId,
      animationState: args?.animationState ?? DEFAULT_ANIMATION_STATE,
      pathType: args?.pathType ?? DEFAULT_PATH_TYPE,
      pathConfig: args?.pathConfig,
      animationConfig: args?.animationConfig,
      theme: args?.theme,
      selected: args?.selected ?? false,
      disabled: args?.disabled ?? false,
      metadata: args?.metadata,
    };

    this._config = args;
  }

  // ===========================================================================
  // IEntity Implementation
  // ===========================================================================

  /**
   * Gets the entity data
   */
  get data(): IFlowEdgeEntityData | undefined {
    return this._data;
  }

  /**
   * Sets the entity data
   */
  set data(value: IFlowEdgeEntityData | undefined) {
    if (!this._disposed && value) {
      this._data = value;
    }
  }

  /**
   * Gets the entity configuration
   */
  get config(): IEntityArguments | undefined {
    return this._config;
  }

  /**
   * Sets the entity configuration
   */
  set config(value: IEntityArguments | undefined) {
    if (!this._disposed) {
      this._config = value;
    }
  }

  /**
   * Gets the underlying edge reference
   */
  get edge(): E {
    if (!this._edge) {
      throw new Error("FlowEdgeEntity: edge reference not set");
    }
    return this._edge;
  }

  /**
   * Sets the underlying edge reference
   */
  setEdge(edge: E): void {
    this._edge = edge;
  }

  /**
   * Whether the entity has been disposed
   */
  get isDisposed(): boolean {
    return this._disposed;
  }

  // ===========================================================================
  // Connection Management
  // ===========================================================================

  /**
   * Gets the source node ID
   */
  getSourceNodeId(): string {
    return this._data.sourceNodeId;
  }

  /**
   * Gets the source port ID
   */
  getSourcePortId(): string {
    return this._data.sourcePortId;
  }

  /**
   * Gets the target node ID
   */
  getTargetNodeId(): string {
    return this._data.targetNodeId;
  }

  /**
   * Gets the target port ID
   */
  getTargetPortId(): string {
    return this._data.targetPortId;
  }

  /**
   * Updates the source connection
   *
   * @param nodeId - Source node ID
   * @param portId - Source port ID
   */
  setSource(nodeId: string, portId: string): void {
    if (this._disposed) return;

    this._data.sourceNodeId = nodeId;
    this._data.sourcePortId = portId;
    this.markDirty();
  }

  /**
   * Updates the target connection
   *
   * @param nodeId - Target node ID
   * @param portId - Target port ID
   */
  setTarget(nodeId: string, portId: string): void {
    if (this._disposed) return;

    this._data.targetNodeId = nodeId;
    this._data.targetPortId = portId;
    this.markDirty();
  }

  /**
   * Reconnects both source and target
   *
   * @param sourceNodeId - Source node ID
   * @param sourcePortId - Source port ID
   * @param targetNodeId - Target node ID
   * @param targetPortId - Target port ID
   */
  connect(
    sourceNodeId: string,
    sourcePortId: string,
    targetNodeId: string,
    targetPortId: string
  ): void {
    if (this._disposed) return;

    this._data.sourceNodeId = sourceNodeId;
    this._data.sourcePortId = sourcePortId;
    this._data.targetNodeId = targetNodeId;
    this._data.targetPortId = targetPortId;
    this.markDirty();
  }

  /**
   * Checks if the edge connects a specific node
   *
   * @param nodeId - Node ID to check
   * @returns true if the edge connects to this node
   */
  connectsNode(nodeId: string): boolean {
    return this._data.sourceNodeId === nodeId || this._data.targetNodeId === nodeId;
  }

  /**
   * Checks if the edge connects two specific nodes
   *
   * @param node1 - First node ID
   * @param node2 - Second node ID
   * @returns true if the edge connects both nodes (in any direction)
   */
  connectsNodes(node1: string, node2: string): boolean {
    return (
      (this._data.sourceNodeId === node1 && this._data.targetNodeId === node2) ||
      (this._data.sourceNodeId === node2 && this._data.targetNodeId === node1)
    );
  }

  /**
   * Gets the node ID on the other end of the edge
   *
   * @param nodeId - One node ID
   * @returns The other node ID, or undefined if nodeId is not part of this edge
   */
  getOtherNodeId(nodeId: string): string | undefined {
    if (this._data.sourceNodeId === nodeId) {
      return this._data.targetNodeId;
    }
    if (this._data.targetNodeId === nodeId) {
      return this._data.sourceNodeId;
    }
    return undefined;
  }

  /**
   * Checks if this is a self-loop (same source and target node)
   *
   * @returns true if source and target are the same node
   */
  isSelfLoop(): boolean {
    return this._data.sourceNodeId === this._data.targetNodeId;
  }

  // ===========================================================================
  // Animation State Management
  // ===========================================================================

  /**
   * Gets the current animation state
   *
   * @returns Current animation state
   */
  getAnimationState(): EdgeAnimationState {
    return this._data.animationState;
  }

  /**
   * Sets the animation state
   *
   * @param state - New animation state
   */
  setAnimationState(state: EdgeAnimationState): void {
    if (this._disposed) return;

    this._data.animationState = state;
    this.markDirty();
  }

  /**
   * Gets the animation configuration
   *
   * @returns Animation config or undefined
   */
  getAnimationConfig(): EdgeAnimationConfig | undefined {
    return this._data.animationConfig;
  }

  /**
   * Sets the animation configuration
   *
   * @param config - Animation configuration
   */
  setAnimationConfig(config: EdgeAnimationConfig): void {
    if (this._disposed) return;

    this._data.animationConfig = config;
    this.markDirty();
  }

  /**
   * Enables or disables animation
   *
   * @param enabled - Whether animation is enabled
   */
  setAnimationEnabled(enabled: boolean): void {
    if (this._disposed) return;

    this._data.animationConfig = {
      ...this._data.animationConfig,
      enabled,
    };
    this.markDirty();
  }

  /**
   * Checks if animation is enabled
   *
   * @returns true if animation is enabled
   */
  isAnimationEnabled(): boolean {
    return this._data.animationConfig?.enabled ?? false;
  }

  // ===========================================================================
  // Path Type Management
  // ===========================================================================

  /**
   * Gets the path type
   *
   * @returns Current path type
   */
  getPathType(): PathType {
    return this._data.pathType ?? DEFAULT_PATH_TYPE;
  }

  /**
   * Sets the path type
   *
   * @param pathType - New path type
   */
  setPathType(pathType: PathType): void {
    if (this._disposed) return;

    this._data.pathType = pathType;
    this.markDirty();
  }

  /**
   * Gets the path configuration
   *
   * @returns Path config or undefined
   */
  getPathConfig(): PathConfig | undefined {
    return this._data.pathConfig;
  }

  /**
   * Sets the path configuration
   *
   * @param config - Path configuration
   */
  setPathConfig(config: PathConfig): void {
    if (this._disposed) return;

    this._data.pathConfig = config;

    // Sync pathType if specified in config
    if (config.type) {
      this._data.pathType = config.type;
    }

    this.markDirty();
  }

  /**
   * Sets the curvature for bezier paths
   *
   * @param curvature - Curvature value (0-1)
   */
  setCurvature(curvature: number): void {
    if (this._disposed) return;

    const normalizedCurvature = Math.max(0, Math.min(1, curvature));
    this._data.pathConfig = {
      ...this._data.pathConfig,
      type: this._data.pathType ?? DEFAULT_PATH_TYPE,
      curvature: normalizedCurvature,
    };
    this.markDirty();
  }

  /**
   * Gets the curvature for bezier paths
   *
   * @returns Curvature value or default
   */
  getCurvature(): number {
    return this._data.pathConfig?.curvature ?? 0.25;
  }

  // ===========================================================================
  // Theme Management
  // ===========================================================================

  /**
   * Gets the edge theme
   *
   * @returns Theme configuration or undefined
   */
  getTheme(): Partial<FlowEdgeTheme> | undefined {
    return this._data.theme;
  }

  /**
   * Sets the edge theme
   *
   * @param theme - Theme configuration (partial)
   */
  setTheme(theme: Partial<FlowEdgeTheme>): void {
    if (this._disposed) return;
    this._data.theme = theme;
    this.markDirty();
  }

  /**
   * Updates the edge theme (merge)
   *
   * @param patch - Partial theme to merge
   */
  updateTheme(patch: Partial<FlowEdgeTheme>): void {
    if (this._disposed) return;
    this._data.theme = { ...this._data.theme, ...patch };
    this.markDirty();
  }

  /**
   * Gets the stroke color
   *
   * @returns Stroke color or undefined
   */
  getStrokeColor(): string | undefined {
    return this._data.theme?.strokeColor;
  }

  /**
   * Sets the stroke color
   *
   * @param color - Stroke color
   */
  setStrokeColor(color: string): void {
    if (this._disposed) return;
    this._data.theme = { ...this._data.theme, strokeColor: color };
    this.markDirty();
  }

  /**
   * Gets the stroke width
   *
   * @returns Stroke width in pixels or undefined
   */
  getStrokeWidth(): number | undefined {
    return this._data.theme?.strokeWidth;
  }

  /**
   * Sets the stroke width
   *
   * @param width - Stroke width in pixels
   */
  setStrokeWidth(width: number): void {
    if (this._disposed) return;
    this._data.theme = { ...this._data.theme, strokeWidth: width };
    this.markDirty();
  }

  /**
   * Gets the stroke dash array
   *
   * @returns Stroke dash pattern or undefined
   */
  getStrokeDasharray(): string | undefined {
    return this._data.theme?.strokeDasharray;
  }

  /**
   * Sets the stroke dash array
   *
   * @param dasharray - Dash pattern (e.g., '5,5')
   */
  setStrokeDasharray(dasharray: string): void {
    if (this._disposed) return;
    this._data.theme = { ...this._data.theme, strokeDasharray: dasharray };
    this.markDirty();
  }

  // ===========================================================================
  // Label & Type Management
  // ===========================================================================

  /**
   * Gets the edge label
   */
  getLabel(): string | undefined {
    return this._data.label;
  }

  /**
   * Sets the edge label
   */
  setLabel(label: string): void {
    if (this._disposed) return;
    this._data.label = label;
    this.markDirty();
  }

  /**
   * Gets the edge type identifier
   */
  getEdgeType(): string {
    return this._data.edgeType ?? "default";
  }

  /**
   * Sets the edge type identifier
   */
  setEdgeType(edgeType: string): void {
    if (this._disposed) return;
    this._data.edgeType = edgeType;
    this.markDirty();
  }

  // ===========================================================================
  // Selection & State Flags
  // ===========================================================================

  /**
   * Gets whether the edge is selected
   */
  isSelected(): boolean {
    return this._data.selected ?? false;
  }

  /**
   * Sets the selection state
   */
  setSelected(selected: boolean): void {
    if (this._disposed) return;
    this._data.selected = selected;
    this.markDirty();
  }

  /**
   * Gets whether the edge is disabled
   */
  isDisabled(): boolean {
    return this._data.disabled ?? false;
  }

  /**
   * Sets the disabled state
   */
  setDisabled(disabled: boolean): void {
    if (this._disposed) return;
    this._data.disabled = disabled;
    this.markDirty();
  }

  // ===========================================================================
  // Metadata Management
  // ===========================================================================

  /**
   * Gets edge metadata
   */
  getMetadata(): Record<string, unknown> | undefined {
    return this._data.metadata;
  }

  /**
   * Sets edge metadata
   */
  setMetadata(metadata: Record<string, unknown>): void {
    if (this._disposed) return;
    this._data.metadata = metadata;
    this.markDirty();
  }

  /**
   * Updates edge metadata (merge)
   */
  updateMetadata(patch: Record<string, unknown>): void {
    if (this._disposed) return;
    this._data.metadata = { ...this._data.metadata, ...patch };
    this.markDirty();
  }

  // ===========================================================================
  // Serialization
  // ===========================================================================

  /**
   * Serializes the entity to a JSON-compatible object
   *
   * @returns Serialized entity data
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      type: this.type,
      data: { ...this._data },
    };
  }

  /**
   * Creates a FlowEdgeEntity from serialized data
   *
   * @param json - Serialized entity data
   * @returns New FlowEdgeEntity instance
   */
  static fromJSON(json: Record<string, unknown>): FlowEdgeEntity {
    const data = json.data as IFlowEdgeEntityData;

    const entity = new FlowEdgeEntity({
      edgeType: data.edgeType,
      label: data.label,
      sourceNodeId: data.sourceNodeId,
      sourcePortId: data.sourcePortId,
      targetNodeId: data.targetNodeId,
      targetPortId: data.targetPortId,
      animationState: data.animationState,
      pathType: data.pathType,
      pathConfig: data.pathConfig,
      animationConfig: data.animationConfig,
      theme: data.theme,
      selected: data.selected,
      disabled: data.disabled,
      metadata: data.metadata,
    });

    return entity;
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /**
   * Marks the entity as dirty (needs re-render)
   *
   * Override this method to integrate with render systems.
   */
  protected markDirty(): void {
    // Placeholder for integration with render systems
    // Can be overridden by subclasses or integrated with RenderManager
  }

  /**
   * Disposes the entity and releases resources
   */
  dispose(): void {
    if (this._disposed) return;

    this._disposed = true;

    // Dispose the underlying edge if it has a dispose method
    if (this._edge && typeof (this._edge as { dispose?: () => void }).dispose === "function") {
      (this._edge as { dispose: () => void }).dispose();
    }

    // Clear references
    this._edge = undefined;
  }
}

/**
 * Arguments for creating a FlowEdgeEntity
 */
export interface IFlowEdgeEntityArguments extends IEntityArguments {
  /** Edge type identifier */
  edgeType?: string;
  /** Display label */
  label?: string;
  /** Source node ID (required) */
  sourceNodeId: string;
  /** Source port ID (required) */
  sourcePortId: string;
  /** Target node ID (required) */
  targetNodeId: string;
  /** Target port ID (required) */
  targetPortId: string;
  /** Initial animation state */
  animationState?: EdgeAnimationState;
  /** Path calculation type */
  pathType?: PathType;
  /** Path configuration */
  pathConfig?: PathConfig;
  /** Animation configuration */
  animationConfig?: EdgeAnimationConfig;
  /** Theme overrides */
  theme?: Partial<FlowEdgeTheme>;
  /** Whether edge is selected */
  selected?: boolean;
  /** Whether edge is disabled */
  disabled?: boolean;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}
