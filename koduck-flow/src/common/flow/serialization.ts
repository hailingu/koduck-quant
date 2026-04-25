/**
 * @module serialization
 * @description Flow serialization and deserialization with JSON snapshot support.
 *
 * This module provides the {@link FlowSerialization} class for comprehensive JSON
 * serialization and deserialization of flow instances. It focuses on state management,
 * entity serialization, and graph snapshots. Lifecycle hooks and metrics collection are
 * orchestrated by higher-level adapters such as {@link FlowSerializer}.
 *
 * ## Key Responsibilities
 * - **JSON Serialization**: Convert flow to JSON snapshots with full state
 * - **JSON Deserialization**: Load flows from JSON with state restoration
 * - **State Management**: Manage flow metadata, IDs, timestamps
 * - **Entity Collection**: Gather all entities and graph for output
 * - **Graph Snapshot**: Serialize/deserialize graph topology
 * - **Integration Ready**: Provides raw snapshots for hook/metrics orchestration layers
 *
 * ## Data Structures
 * - **FlowSnapshot**: Complete flow state including entities and graph
 * - **FlowSerializationState**: Metadata and flow identifiers
 * - **FlowASTSnapshot**: Graph topology snapshot
 *
 * ## Architecture Patterns
 * - **Dependency Injection**: Accept all dependencies via constructor
 * - **Lifecycle Hooks**: Orchestrated by higher-level adapters
 * - **Performance Tracking**: Delegated to orchestration layers
 * - **Safe Failure**: Handle hook rejection gracefully
 * - **Graph Integration**: Coordinate with graph for topology serialization
 *
 * ## Design Features
 * - Atomic serialize operation with performance timing
 * - Extensible via external hook orchestration (e.g., FlowSerializer)
 * - Graceful degradation when orchestration layers veto serialization
 * - Full entity collection including nodes and edges
 * - Optional graph topology serialization
 * - Timestamp tracking (createdAt, updatedAt)
 *
 * ## Usage Example
 * ```typescript
 * // Create serialization service
 * const serialization = new FlowSerialization({
 *   state: { id: 'flow-1', name: 'MyFlow', createdAt: new Date().toISOString() },
 *   registry,
 *   graphCoordinator,
 *   getGraph: () => graph,
 *   setGraph: (g) => (graph = g),
 * });
 *
 * // Serialize to JSON
 * const json = serialization.toJSON();
 * console.log(JSON.stringify(json));
 *
 * // Deserialize from JSON
 * const loadedJson = JSON.parse(jsonString);
 * serialization.loadFromJSON(loadedJson);
 * ```
 *
 * @see {@link FlowSnapshot} for snapshot structure
 * @see {@link FlowSerializationState} for state interface
 * @see {@link FlowASTSnapshot} for graph snapshot
 */

import { FlowGraphAST } from "./flow-graph";
import type {
  FlowASTSnapshot,
  FlowMetadata,
  IEdge,
  IFlowEdgeEntity,
  IFlowNodeEntity,
  INode,
  OptionalProp,
} from "./types";
import type { EntityRegistry } from "./entity-registry";
import type { FlowGraphCoordinator } from "./graph-coordinator";

/**
 * Complete flow snapshot for serialization
 *
 * Contains full flow state including metadata, all entities, and graph topology.
 * Suitable for persistence, export, or transmission.
 *
 * @property id - Unique flow identifier
 * @property name - Optional flow name
 * @property createdAt - Creation timestamp (ISO 8601)
 * @property updatedAt - Last update timestamp (optional)
 * @property metadata - Optional custom metadata
 * @property entities - Array of serialized entity objects
 * @property flowGraph - Optional graph topology snapshot
 */
export interface FlowSnapshot extends Record<string, unknown> {
  id: string;
  name: OptionalProp<string>;
  createdAt: string;
  updatedAt: OptionalProp<string>;
  metadata: OptionalProp<FlowMetadata>;
  entities: Array<Record<string, unknown>>;
  flowGraph: OptionalProp<FlowASTSnapshot>;
}

/**
 * Flow serialization state interface
 *
 * Holds mutable flow metadata that changes during lifecycle.
 * Separate from snapshot for in-memory representation.
 *
 * @property id - Unique flow identifier
 * @property name - Optional human-readable flow name
 * @property createdAt - Initial creation timestamp
 * @property updatedAt - Last modification timestamp (optional)
 * @property metadata - Optional extensible metadata
 */
export interface FlowSerializationState {
  id: string;
  name: OptionalProp<string>;
  createdAt: string;
  updatedAt: OptionalProp<string>;
  metadata: OptionalProp<FlowMetadata>;
}

/**
 * Dependencies for FlowSerialization
 *
 * @property state - Mutable flow serialization state
 * @property hooks - Lifecycle hooks for save/load events
 * @property metrics - Metrics collection for performance tracking
 * @property registry - Entity registry for entity access
 * @property graphCoordinator - Graph coordinator for topology management
 * @property getGraph - Function to retrieve current graph instance
 * @property setGraph - Function to replace graph instance
 */
type FlowSerializationDeps<
  N extends INode,
  E extends IEdge,
  NE extends IFlowNodeEntity<N>,
  EE extends IFlowEdgeEntity<E>,
> = {
  state: FlowSerializationState;
  registry: EntityRegistry<N, E, NE, EE>;
  graphCoordinator: FlowGraphCoordinator<N, E, NE, EE>;
  getGraph(): FlowGraphAST | undefined;
  setGraph(graph: FlowGraphAST | undefined): void;
};

/**
 * FlowSerialization - Flow JSON serialization/deserialization service
 *
 * Manages complete flow lifecycle serialization including state, entities,
 * graph topology, and lifecycle events. Provides atomic serialize/deserialize
 * operations with full metrics tracking.
 *
 * ## Key Features
 * - **Complete Serialization**: Captures flow state, entities, and graph
 * - **Lifecycle Hooks**: Invoke onFlowSaved/onFlowLoaded hooks
 * - **Performance Tracking**: Record serialization timing and entity counts
 * - **State Management**: Update flow metadata during load
 * - **Graph Snapshot**: Serialize graph topology as part of snapshot
 * - **Graceful Degradation**: Handle hook rejection safely
 * - **Generic Types**: Full type support for custom node/edge types
 *
 * ## Serialization Flow
 * 1. Check runFlowSaved hook (can veto)
 * 2. Collect all node and edge entities
 * 3. Serialize all entities to JSON objects
 * 4. Include optional graph snapshot
 * 5. Record performance metrics
 * 6. Return complete snapshot
 *
 * ## Deserialization Flow
 * 1. Extract and set state from JSON
 * 2. Restore graph from snapshot if present
 * 3. Check runFlowLoaded hook (can veto)
 * 4. Record performance metrics
 * 5. Flow ready for use
 *
 * @template N - Node type (default: INode)
 * @template E - Edge type (default: IEdge)
 * @template NE - Node entity type (default: IFlowNodeEntity<N>)
 * @template EE - Edge entity type (default: IFlowEdgeEntity<E>)
 *
 * @example
 * ```typescript
 * // Create service
 * const serialization = new FlowSerialization({
 *   state,
 *   hooks,
 *   metrics,
 *   registry,
 *   graphCoordinator,
 *   getGraph: () => coordinator.getGraph(),
 *   setGraph: (g) => coordinator.setGraph(g),
 * });
 *
 * // Serialize
 * const snapshot = serialization.toJSON();
 * fs.writeFileSync('flow.json', JSON.stringify(snapshot));
 *
 * // Deserialize
 * const loaded = JSON.parse(fs.readFileSync('flow.json'));
 * serialization.loadFromJSON(loaded);
 * ```
 */
export class FlowSerialization<
  N extends INode = INode,
  E extends IEdge = IEdge,
  NE extends IFlowNodeEntity<N> = IFlowNodeEntity<N>,
  EE extends IFlowEdgeEntity<E> = IFlowEdgeEntity<E>,
> {
  private readonly state: FlowSerializationState;
  private readonly registry: EntityRegistry<N, E, NE, EE>;
  private readonly graphCoordinator: FlowGraphCoordinator<N, E, NE, EE>;
  private readonly getGraphRef: () => FlowGraphAST | undefined;
  private readonly setGraphRef: (graph: FlowGraphAST | undefined) => void;

  /**
   * Initialize FlowSerialization with dependencies
   *
   * Accepts all required services via dependency injection. Stores references
   * to graph getter/setter functions for lazy graph access during serialization.
   *
   * @param deps - Dependency injection object
   * @param deps.state - Current flow serialization state
   * @param deps.registry - Entity registry for entity access
   * @param deps.graphCoordinator - Graph coordinator for topology
   * @param deps.getGraph - Function returning current graph (may be undefined)
   * @param deps.setGraph - Function to set graph instance
   *
   * @example
   * ```typescript
   * const serialization = new FlowSerialization({
   *   state: flowState,
   *   registry: entityRegistry,
   *   graphCoordinator: coordinator,
   *   getGraph: () => currentGraph,
   *   setGraph: (g) => { currentGraph = g; },
   * });
   * ```
   */
  constructor(deps: FlowSerializationDeps<N, E, NE, EE>) {
    this.state = deps.state;
    this.registry = deps.registry;
    this.graphCoordinator = deps.graphCoordinator;
    this.getGraphRef = deps.getGraph;
    this.setGraphRef = deps.setGraph;
  }

  /**
   * Serialize flow to JSON snapshot
   *
   * Creates a complete {@link FlowSnapshot} with current flow state including
   * metadata, all node and edge entities, and optional graph topology. Hook
   * orchestration (including veto support) and metrics recording are handled by
   * higher-level adapters such as {@link FlowSerializer}.
   *
   * ## Serialization Steps
   * - Collect all node entities from registry
   * - Collect all edge entities from registry
   * - Serialize each entity to plain object
   * - Include graph snapshot if graph exists
   *
   * @returns Complete flow snapshot with id, name, timestamps, metadata, entities, and flowGraph
   *
   * @description
   * This method performs no lifecycle hook invocation or metrics recording. Callers
   * that require those behaviors should wrap this class with {@link FlowSerializer}
   * or another orchestration layer.
   *
   * @example
   * ```typescript
   * const snapshot = serialization.toJSON();
   * const json = JSON.stringify(snapshot);
   * fs.writeFileSync('flow-backup.json', json);
   * ```
   *
   * @see {@link FlowSerializer} for hook and metrics integration
   */
  toJSON(): FlowSnapshot {
    const nodeEntities = this.collectNodeEntities();
    const edgeEntities = this.collectEdgeEntities();

    const allEntities = [...nodeEntities, ...edgeEntities];

    const graph = this.getGraphRef();

    const snapshot: FlowSnapshot = {
      id: this.state.id,
      name: this.state.name,
      createdAt: this.state.createdAt,
      updatedAt: this.state.updatedAt,
      metadata: this.state.metadata,
      entities: allEntities as Array<Record<string, unknown>>,
      flowGraph: graph ? graph.toJSON() : undefined,
    };

    return snapshot;
  }

  /**
   * Deserialize flow from JSON snapshot
   *
   * Loads a flow from a {@link FlowSnapshot} restoring state, entities, and
   * graph topology. Lifecycle hooks and metrics should be coordinated by
   * higher-level adapters such as {@link FlowSerializer}.
   *
   * ## Deserialization Steps
   * - Extract state properties from JSON (id, name, timestamps, metadata)
   * - Restore graph from snapshot if present
   * - Set graph in coordinator
   *
   * @param json - Plain object containing snapshot data
   *
   * @description
   * Assumes entities have already been loaded into registry before calling
   * this method. This method only handles state restoration and graph
   * reconstruction; entity loading, hook invocation, and metrics are
   * responsibilities of the caller.
   *
   * @example
   * ```typescript
   * // Load from file
   * const jsonStr = fs.readFileSync('flow-backup.json', 'utf-8');
   * const snapshot = JSON.parse(jsonStr);
   * serialization.loadFromJSON(snapshot);
   * ```
   *
   * @see {@link FlowSerializer} for hook and metrics integration
   * @see toJSON for snapshot structure
   */
  loadFromJSON(json: Record<string, unknown>): void {
    this.state.id = json.id as string;
    this.state.name = json.name as string | undefined;
    this.state.createdAt = json.createdAt as string;
    this.state.updatedAt = json.updatedAt as string | undefined;
    this.state.metadata = json.metadata as FlowMetadata | undefined;

    const graphSnapshot = json.flowGraph as FlowASTSnapshot | undefined;
    if (graphSnapshot) {
      this.setGraphRef(FlowGraphAST.fromJSON(graphSnapshot));
    } else {
      this.setGraphRef(undefined);
    }
  }

  /**
   * Get a copy of the current flow state metadata (without entities/graph).
   *
   * @returns Readonly snapshot of serialization state metadata
   */
  getStateSnapshot(): FlowSerializationState {
    return {
      id: this.state.id,
      name: this.state.name,
      createdAt: this.state.createdAt,
      updatedAt: this.state.updatedAt,
      metadata: this.state.metadata,
    };
  }

  private collectNodeEntities(): NE[] {
    const entities = this.registry.listNodeEntities();
    for (const entity of entities) {
      this.graphCoordinator.registerNode(entity);
    }
    return entities;
  }

  private collectEdgeEntities(): EE[] {
    const edges = this.registry.listEdgeEntities();
    for (const edge of edges) {
      this.graphCoordinator.registerEdge(edge);
    }
    return edges;
  }
}
