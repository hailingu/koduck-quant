/**
 * @file FlowNodeEntity class
 * @module flow-node-entity
 * @description Entity class for Flow Nodes with React rendering support.
 * Provides port configuration, execution state management, and form data handling.
 *
 * @see docs/design/flow-entity-component-design.md section 3.1
 */

import { nanoid } from "nanoid";
import { Data } from "../data";
import type { IEntityArguments } from "../entity/types";
import type { INode, IFlowNodeEntity } from "./types";
import type {
  ExecutionState,
  PortDefinition,
  FormSchema,
  FlowNodeTheme,
  Position,
  Size,
  IFlowNodeEntityData,
} from "./flow-entity-types";

/**
 * Default node dimensions
 */
const DEFAULT_NODE_WIDTH = 200;
const DEFAULT_NODE_HEIGHT = 100;

/**
 * Default execution state for new nodes
 */
const DEFAULT_EXECUTION_STATE: ExecutionState = "idle";

/**
 * FlowNodeEntity - Flow node entity with React rendering support
 *
 * Implements the entity layer for flow nodes, providing:
 * - Port configuration (input/output ports with type checking)
 * - Execution state management (idle, pending, running, success, error, etc.)
 * - Form data management (schema-based configuration)
 * - Theme customization
 * - Serialization/deserialization
 *
 * @template N - Node type (default: INode)
 *
 * @example
 * ```typescript
 * const entity = new FlowNodeEntity({
 *   nodeType: 'task',
 *   label: 'Process Data',
 *   position: { x: 100, y: 100 },
 * });
 *
 * // Configure ports
 * entity.setPorts([
 *   { id: 'in1', name: 'Input', type: 'input', dataType: 'any' },
 *   { id: 'out1', name: 'Output', type: 'output', dataType: 'any' },
 * ]);
 *
 * // Update execution state
 * entity.setExecutionState('running');
 * ```
 */
export class FlowNodeEntity<N extends INode = INode> implements IFlowNodeEntity<N> {
  /**
   * Entity type identifier for registry
   */
  static readonly type = "flow-node-entity";

  /**
   * Unique entity identifier
   */
  readonly id: string;

  /**
   * Entity type (static, read from constructor)
   */
  readonly type: string = FlowNodeEntity.type;

  /**
   * Entity data containing all node properties
   */
  private _data: IFlowNodeEntityData;

  /**
   * Entity configuration
   */
  private _config: IEntityArguments | undefined;

  /**
   * Whether the entity has been disposed
   */
  private _disposed = false;

  /**
   * Reference to the underlying node (for tree structure)
   */
  private _node: N | undefined;

  /**
   * Creates a new FlowNodeEntity
   *
   * @param args - Initial entity arguments
   */
  constructor(args?: IFlowNodeEntityArguments) {
    this.id = `flow-node-${nanoid()}`;

    // Initialize data with defaults
    this._data = Object.assign(new Data(), {
      nodeType: args?.nodeType ?? "default",
      label: args?.label ?? "Node",
      position: args?.position ?? { x: 0, y: 0 },
      size: args?.size ?? { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT },
      executionState: args?.executionState ?? DEFAULT_EXECUTION_STATE,
      inputPorts: args?.inputPorts ?? [],
      outputPorts: args?.outputPorts ?? [],
      disabled: args?.disabled ?? false,
      selected: args?.selected ?? false,
      locked: args?.locked ?? false,
      ...(args?.config === undefined ? {} : { config: args.config }),
      ...(args?.formSchema === undefined ? {} : { formSchema: args.formSchema }),
      ...(args?.theme === undefined ? {} : { theme: args.theme }),
      ...(args?.metadata === undefined ? {} : { metadata: args.metadata }),
    }) as IFlowNodeEntityData;

    this._config = args;
  }

  // ===========================================================================
  // IEntity Implementation
  // ===========================================================================

  /**
   * Gets the entity data
   *
   * @returns Entity data or undefined
   */
  get data(): IFlowNodeEntityData | undefined {
    return this._data;
  }

  /**
   * Sets the entity data
   *
   * @param value - Entity data
   */
  set data(value: IFlowNodeEntityData | undefined) {
    if (!this._disposed && value) {
      this._data = value;
    }
  }

  /**
   * Gets the entity configuration
   *
   * @returns Entity configuration or undefined
   */
  get config(): IEntityArguments | undefined {
    return this._config;
  }

  /**
   * Sets the entity configuration
   *
   * @param value - Entity configuration
   */
  set config(value: IEntityArguments | undefined) {
    if (!this._disposed) {
      this._config = value;
    }
  }

  /**
   * Gets the underlying node reference
   *
   * @returns The underlying node
   */
  get node(): N {
    if (!this._node) {
      throw new Error("FlowNodeEntity: node reference not set");
    }
    return this._node;
  }

  /**
   * Sets the underlying node reference
   *
   * @param node - Node reference
   */
  setNode(node: N): void {
    this._node = node;
  }

  /**
   * Whether the entity has been disposed
   *
   * @returns true if disposed
   */
  get isDisposed(): boolean {
    return this._disposed;
  }

  // ===========================================================================
  // Position & Size Management
  // ===========================================================================

  /**
   * Gets the node position
   *
   * @returns Node position
   */
  getPosition(): Position {
    return { ...this._data.position };
  }

  /**
   * Sets the node position
   *
   * @param position - New position
   */
  setPosition(position: Position): void {
    if (this._disposed) return;
    this._data.position = { ...position };
    this.markDirty();
  }

  /**
   * Gets the node size
   *
   * @returns Node size
   */
  getSize(): Size {
    return this._data.size
      ? { ...this._data.size }
      : { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT };
  }

  /**
   * Sets the node size
   *
   * @param size - New size
   */
  setSize(size: Size): void {
    if (this._disposed) return;
    this._data.size = { ...size };
    this.markDirty();
  }

  // ===========================================================================
  // Port Management
  // ===========================================================================

  /**
   * Sets all ports for the node
   *
   * Splits the ports by type into inputPorts and outputPorts.
   *
   * @param ports - Array of port definitions
   */
  setPorts(ports: PortDefinition[]): void {
    if (this._disposed) return;

    this._data.inputPorts = ports.filter((p) => p.type === "input");
    this._data.outputPorts = ports.filter((p) => p.type === "output");
    this.markDirty();
  }

  /**
   * Gets all input ports
   *
   * @returns Array of input port definitions
   */
  getInputPorts(): PortDefinition[] {
    return [...this._data.inputPorts];
  }

  /**
   * Gets all output ports
   *
   * @returns Array of output port definitions
   */
  getOutputPorts(): PortDefinition[] {
    return [...this._data.outputPorts];
  }

  /**
   * Gets all ports (input and output)
   *
   * @returns Array of all port definitions
   */
  getAllPorts(): PortDefinition[] {
    return [...this._data.inputPorts, ...this._data.outputPorts];
  }

  /**
   * Gets a port by its ID
   *
   * @param id - Port ID to find
   * @returns Port definition or undefined if not found
   */
  getPortById(id: string): PortDefinition | undefined {
    return this.getAllPorts().find((p) => p.id === id);
  }

  /**
   * Adds a single port
   *
   * @param port - Port definition to add
   */
  addPort(port: PortDefinition): void {
    if (this._disposed) return;

    if (port.type === "input") {
      this._data.inputPorts = [...this._data.inputPorts, port];
    } else {
      this._data.outputPorts = [...this._data.outputPorts, port];
    }
    this.markDirty();
  }

  /**
   * Removes a port by ID
   *
   * @param id - Port ID to remove
   * @returns true if port was removed, false if not found
   */
  removePort(id: string): boolean {
    if (this._disposed) return false;

    const inputIndex = this._data.inputPorts.findIndex((p) => p.id === id);
    if (inputIndex !== -1) {
      this._data.inputPorts = this._data.inputPorts.filter((p) => p.id !== id);
      this.markDirty();
      return true;
    }

    const outputIndex = this._data.outputPorts.findIndex((p) => p.id === id);
    if (outputIndex !== -1) {
      this._data.outputPorts = this._data.outputPorts.filter((p) => p.id !== id);
      this.markDirty();
      return true;
    }

    return false;
  }

  // ===========================================================================
  // Execution State Management
  // ===========================================================================

  /**
   * Gets the current execution state
   *
   * @returns Current execution state
   */
  getExecutionState(): ExecutionState {
    return this._data.executionState;
  }

  /**
   * Sets the execution state
   *
   * @param state - New execution state
   */
  setExecutionState(state: ExecutionState): void {
    if (this._disposed) return;

    const previousState = this._data.executionState;
    this._data.executionState = state;

    // Track execution timing
    if (state === "running" && previousState !== "running") {
      this._data.executionStartTime = Date.now();
      delete this._data.executionEndTime;
      this._data.executionProgress = 0;
    } else if (
      (state === "success" || state === "error" || state === "cancelled") &&
      previousState === "running"
    ) {
      this._data.executionEndTime = Date.now();
      if (state === "success") {
        this._data.executionProgress = 100;
      }
    }

    // Clear error message on state change (unless setting to error)
    if (state !== "error") {
      delete this._data.errorMessage;
    }

    this.markDirty();
  }

  /**
   * Sets the execution progress (0-100)
   *
   * @param progress - Progress percentage
   */
  setExecutionProgress(progress: number): void {
    if (this._disposed) return;
    this._data.executionProgress = Math.max(0, Math.min(100, progress));
    this.markDirty();
  }

  /**
   * Gets the execution progress
   *
   * @returns Progress percentage (0-100)
   */
  getExecutionProgress(): number {
    return this._data.executionProgress ?? 0;
  }

  /**
   * Sets an error message (typically when state is 'error')
   *
   * @param message - Error message
   */
  setErrorMessage(message: string): void {
    if (this._disposed) return;
    this._data.errorMessage = message;
    this.markDirty();
  }

  /**
   * Gets the error message
   *
   * @returns Error message or undefined
   */
  getErrorMessage(): string | undefined {
    return this._data.errorMessage;
  }

  /**
   * Gets the execution duration in milliseconds
   *
   * @returns Duration in ms, or undefined if not applicable
   */
  getExecutionDuration(): number | undefined {
    if (!this._data.executionStartTime) return undefined;

    const endTime = this._data.executionEndTime ?? Date.now();
    return endTime - this._data.executionStartTime;
  }

  // ===========================================================================
  // Form Data Management
  // ===========================================================================

  /**
   * Sets the form schema for node configuration
   *
   * Optionally resets form data to only include keys defined in the schema.
   * Applies default values from schema for keys not present in current config.
   *
   * @param schema - Form schema
   */
  setFormSchema(schema: FormSchema): void {
    if (this._disposed) return;

    this._data.formSchema = schema;

    // Reset form data to only include valid keys from the new schema
    // and apply default values for missing keys
    if (schema.properties) {
      const validKeys = Object.keys(schema.properties);
      const currentConfig = this._data.config ?? {};
      const newConfig: Record<string, unknown> = {};

      for (const key of validKeys) {
        if (key in currentConfig) {
          newConfig[key] = currentConfig[key];
        } else if (schema.properties[key]?.default !== undefined) {
          newConfig[key] = schema.properties[key].default;
        }
      }

      this._data.config = newConfig;
    }

    this.markDirty();
  }

  /**
   * Gets the form schema
   *
   * @returns Form schema or undefined
   */
  getFormSchema(): FormSchema | undefined {
    return this._data.formSchema;
  }

  /**
   * Updates the form data (node configuration)
   *
   * Merges the patch with existing config, only allowing keys defined in schema.
   *
   * @param patch - Partial config to merge
   */
  updateFormData(patch: Record<string, unknown>): void {
    if (this._disposed) return;

    const currentConfig = this._data.config ?? {};
    const mergedConfig = { ...currentConfig, ...patch };

    // If we have a schema, only keep valid keys
    if (this._data.formSchema?.properties) {
      const validKeys = Object.keys(this._data.formSchema.properties);
      const filteredConfig: Record<string, unknown> = {};

      for (const key of Object.keys(mergedConfig)) {
        if (validKeys.includes(key)) {
          filteredConfig[key] = mergedConfig[key];
        }
      }

      this._data.config = filteredConfig;
    } else {
      this._data.config = mergedConfig;
    }

    this.markDirty();
  }

  /**
   * Gets the form data (node configuration)
   *
   * @returns Config data or empty object
   */
  getFormData(): Record<string, unknown> {
    return this._data.config ?? {};
  }

  // ===========================================================================
  // Theme Management
  // ===========================================================================

  /**
   * Gets the node theme
   *
   * @returns Theme configuration or undefined
   */
  getTheme(): Partial<FlowNodeTheme> | undefined {
    return this._data.theme;
  }

  /**
   * Sets the node theme
   *
   * @param theme - Theme configuration (partial)
   */
  setTheme(theme: Partial<FlowNodeTheme>): void {
    if (this._disposed) return;
    this._data.theme = theme;
    this.markDirty();
  }

  // ===========================================================================
  // Label & Type Management
  // ===========================================================================

  /**
   * Gets the node label
   *
   * @returns Node label
   */
  getLabel(): string {
    return this._data.label;
  }

  /**
   * Sets the node label
   *
   * @param label - Node label
   */
  setLabel(label: string): void {
    if (this._disposed) return;
    this._data.label = label;
    this.markDirty();
  }

  /**
   * Gets the node type identifier
   *
   * @returns Node type identifier
   */
  getNodeType(): string {
    return this._data.nodeType;
  }

  // ===========================================================================
  // Selection & State Flags
  // ===========================================================================

  /**
   * Gets whether the node is selected
   *
   * @returns true if selected
   */
  isSelected(): boolean {
    return this._data.selected ?? false;
  }

  /**
   * Sets the selection state
   *
   * @param selected - Whether the node is selected
   */
  setSelected(selected: boolean): void {
    if (this._disposed) return;
    this._data.selected = selected;
    this.markDirty();
  }

  /**
   * Gets whether the node is disabled
   *
   * @returns true if disabled
   */
  isDisabled(): boolean {
    return this._data.disabled ?? false;
  }

  /**
   * Sets the disabled state
   *
   * @param disabled - Whether the node is disabled
   */
  setDisabled(disabled: boolean): void {
    if (this._disposed) return;
    this._data.disabled = disabled;
    this.markDirty();
  }

  /**
   * Gets whether the node is locked
   *
   * @returns true if locked
   */
  isLocked(): boolean {
    return this._data.locked ?? false;
  }

  /**
   * Sets the locked state
   *
   * @param locked - Whether the node is locked
   */
  setLocked(locked: boolean): void {
    if (this._disposed) return;
    this._data.locked = locked;
    this.markDirty();
  }

  // ===========================================================================
  // Metadata Management
  // ===========================================================================

  /**
   * Gets node metadata
   *
   * @returns Node metadata or undefined
   */
  getMetadata(): Record<string, unknown> | undefined {
    return this._data.metadata;
  }

  /**
   * Sets node metadata
   *
   * @param metadata - Node metadata
   */
  setMetadata(metadata: Record<string, unknown>): void {
    if (this._disposed) return;
    this._data.metadata = metadata;
    this.markDirty();
  }

  /**
   * Updates node metadata (merge)
   *
   * @param patch - Metadata to merge
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
   * Creates a FlowNodeEntity from serialized data
   *
   * @param json - Serialized entity data
   * @returns New FlowNodeEntity instance
   */
  static fromJSON(json: Record<string, unknown>): FlowNodeEntity {
    const data = json.data as IFlowNodeEntityData;
    const entity = new FlowNodeEntity({
      nodeType: data.nodeType,
      label: data.label,
      position: data.position,
      executionState: data.executionState,
      inputPorts: data.inputPorts,
      outputPorts: data.outputPorts,
      ...(data.size === undefined ? {} : { size: data.size }),
      ...(data.config === undefined ? {} : { config: data.config }),
      ...(data.formSchema === undefined ? {} : { formSchema: data.formSchema }),
      ...(data.theme === undefined ? {} : { theme: data.theme }),
      ...(data.disabled === undefined ? {} : { disabled: data.disabled }),
      ...(data.selected === undefined ? {} : { selected: data.selected }),
      ...(data.locked === undefined ? {} : { locked: data.locked }),
      ...(data.metadata === undefined ? {} : { metadata: data.metadata }),
    });

    // Restore execution timing if present
    if (data.executionStartTime) {
      entity._data.executionStartTime = data.executionStartTime;
    }
    if (data.executionEndTime) {
      entity._data.executionEndTime = data.executionEndTime;
    }
    if (data.executionProgress !== undefined) {
      entity._data.executionProgress = data.executionProgress;
    }
    if (data.errorMessage) {
      entity._data.errorMessage = data.errorMessage;
    }

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

    // Dispose the underlying node if it has a dispose method
    if (this._node && typeof (this._node as { dispose?: () => void }).dispose === "function") {
      (this._node as { dispose: () => void }).dispose();
    }

    // Clear references
    this._node = undefined;
  }
}

/**
 * Arguments for creating a FlowNodeEntity
 */
export interface IFlowNodeEntityArguments extends IEntityArguments {
  /** Node type identifier */
  nodeType?: string;
  /** Display label */
  label?: string;
  /** Position on canvas */
  position?: Position;
  /** Node dimensions */
  size?: Size;
  /** Initial execution state */
  executionState?: ExecutionState;
  /** Input port definitions */
  inputPorts?: PortDefinition[];
  /** Output port definitions */
  outputPorts?: PortDefinition[];
  /** Node configuration data */
  config?: Record<string, unknown>;
  /** Form schema for configuration UI */
  formSchema?: FormSchema;
  /** Theme overrides */
  theme?: Partial<FlowNodeTheme>;
  /** Whether node is disabled */
  disabled?: boolean;
  /** Whether node is selected */
  selected?: boolean;
  /** Whether node is locked */
  locked?: boolean;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}
