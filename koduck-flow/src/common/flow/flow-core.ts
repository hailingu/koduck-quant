/**
 * Flow Core Implementation Module
 *
 * This module provides the core implementation of the Koduck Flow engine.
 * **FlowCore** is a low-level core subsystem coordinator (internal use).
 *
 * Architecture Design:
 * - **Subsystem Coordination**: FlowCore integrates 6 key subsystems
 * - **Dependency Injection**: All dependencies injected through constructor
 * - **Lifecycle Management**: Event hook system for flow-level event handling
 *
 * Main Subsystems (coordinated by FlowCore):
 * 1. **EntityRegistry** - Entity registration and retrieval
 * 2. **FlowGraphCoordinator** - Graph topology structure management
 * 3. **FlowHooks** - Lifecycle event system
 * 4. **FlowMetrics** - Performance metrics collection
 * 5. **FlowTraversal** - Graph traversal algorithms
 * 6. **FlowSerialization** - Serialization and deserialization
 *
 * Use Cases:
 * - Central assembly and dependency injection for flow subsystems
 * - Provide unified access to core components
 * - Manage subsystem lifecycle (initialization and disposal)
 *
 * @module FlowCore
 * @see {@link Flow} High-level flow management facade
 * @see {@link FlowCoreConfig} Configuration type
 * @see {@link types} Type definitions
 */

import { FlowGraphAST } from "./flow-graph";
import type { EntityManager } from "../entity";
import type { IEdge, IFlowEdgeEntity, IFlowEntity, IFlowNodeEntity, INode } from "./types";
import { EntityRegistry } from "./entity-registry";
import { FlowGraphCoordinator } from "./graph-coordinator";
import { FlowHooks } from "./hooks";
import { FlowMetrics } from "./metrics";
import { FlowSerialization } from "./serialization";
import { FlowSerializer } from "./serialization/flow-serializer";
import { HookAdapter } from "./orchestration/hook-adapter";
import { MetricsAdapter } from "./orchestration/metrics-adapter";
import type { FlowSerializationState } from "./serialization";
import { FlowTraversal } from "./traversal";

/**
 * FlowCore Configuration Type
 *
 * Configuration used to initialize a FlowCore instance.
 * Contains all required dependencies and callback functions for subsystem assembly.
 *
 * @template N - Node type
 * @template E - Edge type
 * @template NE - Node entity type
 * @template EE - Edge entity type
 */
type FlowCoreConfig<
  N extends INode,
  E extends IEdge,
  NE extends IFlowNodeEntity<N>,
  EE extends IFlowEdgeEntity<E>,
> = {
  /** Entity manager instance responsible for managing entity lifecycle */
  entityManager: EntityManager;
  /** Serialization state, typically provided by Flow instance */
  state: FlowSerializationState;
  /** Type guard function to check if entity is a node entity */
  isNodeEntity(entity: unknown): entity is NE;
  /** Type guard function to check if entity is an edge entity */
  isEdgeEntity(entity: unknown): entity is EE;
  /** Entity resolution function to get entity by ID */
  resolveEntity(id: string): IFlowEntity | undefined;
  /** Graph creation factory function to create new FlowGraphAST instance (optional) */
  createGraph?: () => FlowGraphAST;
};

/**
 * Flow 核心Subsystem Coordination器
 *
 * FlowCore is the central coordinator of the Flow architecture,integrating 6 key subsystems:
 * - **EntityRegistry** - Entity registration table managing all node and edge entities
 * - **FlowGraphCoordinator** - Graph coordinator maintaining graph topology structure
 * - **FlowHooks** - Hook system triggering lifecycle events
 * - **FlowMetrics** - Metrics collection recording performance data
 * - **FlowTraversal** - Traverser providing graph traversal algorithms
 * - **FlowSerialization** - Serializer handling data persistence
 *
 * Design Characteristics:
 * - **Internal Implementation**:FlowCore is an internal class,primarily used by Flow
 * - **Dependency Injection**:All dependencies injected through constructor
 * - **Separation of Concerns**:Each subsystem independently handles single responsibility
 * - **Type Safety**:Generic parameters ensure type consistency throughout
 *
 * @template N - Node type,defaults to INode
 * @template E - Edge type,defaults to IEdge
 * @template NE - Node entity type,defaults to IFlowNodeEntity<N>
 * @template EE - edge entity type,defaults to IFlowEdgeEntity<E>
 *
 * @see {@link Flow} High-level flow management class,typically the only consumer of FlowCore
 * @see {@link EntityRegistry}
 * @see {@link FlowGraphCoordinator}
 * @see {@link FlowHooks}
 * @see {@link FlowMetrics}
 * @see {@link FlowTraversal}
 * @see {@link FlowSerialization}
 */
export class FlowCore<
  N extends INode = INode,
  E extends IEdge = IEdge,
  NE extends IFlowNodeEntity<N> = IFlowNodeEntity<N>,
  EE extends IFlowEdgeEntity<E> = IFlowEdgeEntity<E>,
> {
  /** Entity manager instance */
  private readonly entityManager: EntityManager;
  /** Entity registry managing node and edge entities */
  private readonly registry: EntityRegistry<N, E, NE, EE>;
  /** Graph coordinator:maintaining graph topology structure */
  private readonly graphCoordinator: FlowGraphCoordinator<N, E, NE, EE>;
  /** Lifecycle hooks:triggering stage events */
  private readonly hooks: FlowHooks<NE>;
  /** Performance metrics:recording operation time and statistics */
  private readonly metrics: FlowMetrics;
  /** Metrics adapter bridging FlowMetrics for orchestration layers */
  private readonly metricsAdapter: MetricsAdapter;
  /** Hook adapter providing Flow facade compatibility */
  private readonly hookAdapter: HookAdapter<NE>;
  /** Graph traverser:providing various traversal algorithms */
  private readonly traversal: FlowTraversal<N, E, NE, EE>;
  /** Serialization service:handling flow save and load */
  private readonly serialization: FlowSerialization<N, E, NE, EE>;
  /** Serializer facade coordinating hooks and metrics */
  private readonly flowSerializer: FlowSerializer<N, E, NE, EE>;

  /**
   * Constructor
   *
   * Initializes FlowCore instance,creating and injecting all required subsystems.
   * Each subsystem is initialized,including metrics collector registration.
   *
   * @param config - FlowCore configuration object,containing dependencies and callbacks
   *
   * @example
   * ```typescript
   * const core = new FlowCore({
   *   entityManager,
   *   state: flowInstance,
   *   isNodeEntity: (e) => 'node' in e,
   *   isEdgeEntity: (e) => 'edge' in e,
   *   resolveEntity: (id) => flowInstance.getEntity(id),
   * });
   * ```
   */
  constructor(config: FlowCoreConfig<N, E, NE, EE>) {
    this.entityManager = config.entityManager;
    this.hooks = new FlowHooks<NE>();
    this.registry = new EntityRegistry<N, E, NE, EE>(config.entityManager, {
      isNodeEntity: config.isNodeEntity,
      isEdgeEntity: config.isEdgeEntity,
    });
    this.graphCoordinator = new FlowGraphCoordinator<N, E, NE, EE>({
      registry: this.registry,
      createGraph: config.createGraph ?? (() => new FlowGraphAST()),
      resolveEntity: config.resolveEntity,
    });
    this.traversal = new FlowTraversal<N, E, NE, EE>(this.graphCoordinator, this.registry);
    this.metrics = new FlowMetrics();
    this.metrics.markFlowCreated();
    this.metrics.registerEntityGauge(() => {
      const { nodeCount, edgeCount } = this.registry.countEntities();
      return nodeCount + edgeCount;
    });
    this.serialization = new FlowSerialization<N, E, NE, EE>({
      state: config.state,
      registry: this.registry,
      graphCoordinator: this.graphCoordinator,
      getGraph: () => this.graphCoordinator.getGraph(),
      setGraph: (graph) => {
        this.graphCoordinator.setGraph(graph);
      },
    });
    this.metricsAdapter = new MetricsAdapter(this.metrics);
    this.hookAdapter = new HookAdapter<NE>(this.hooks);
    this.flowSerializer = new FlowSerializer<N, E, NE, EE>(
      this.serialization,
      this.hookAdapter,
      this.metricsAdapter
    );
  }

  /**
   * Get Entity Registry
   *
   * @returns EntityRegistry 实例,for direct entity operations
   */
  getEntityRegistry(): EntityRegistry<N, E, NE, EE> {
    return this.registry;
  }

  /**
   * 获取Graph coordinator
   *
   * @returns FlowGraphCoordinator 实例,for managing graph structure
   */
  getGraphCoordinator(): FlowGraphCoordinator<N, E, NE, EE> {
    return this.graphCoordinator;
  }

  /**
   * 获取Lifecycle hooks系统
   *
   * @returns FlowHooks 实例,for listening to flow events
   */
  getHooks(): FlowHooks<NE> {
    return this.hooks;
  }

  /**
   * 获取Performance metrics collection器
   *
   * @returns FlowMetrics 实例,for viewing performance data
   */
  getMetrics(): FlowMetrics {
    return this.metrics;
  }

  /**
   * 获取Graph traverser
   *
   * @returns FlowTraversal 实例,for traversing graph structure
   */
  getTraversal(): FlowTraversal<N, E, NE, EE> {
    return this.traversal;
  }

  /**
   * 获取Serialization service
   *
   * @returns FlowSerialization 实例,for serialization and deserialization
   */
  getSerialization(): FlowSerialization<N, E, NE, EE> {
    return this.serialization;
  }

  /**
   * 获取封装后的 FlowSerializer
   *
   * @returns FlowSerializer 适配器实例
   */
  getFlowSerializer(): FlowSerializer<N, E, NE, EE> {
    return this.flowSerializer;
  }

  /**
   * Get all services as a readonly collection
   *
   * Provides unified access to all core subsystems managed by FlowCore.
   * This method returns a readonly object containing references to:
   * - EntityManager: for managing entity lifecycle
   * - EntityRegistry: for entity registration and retrieval
   * - FlowGraphCoordinator: for graph topology management
   * - FlowHooks: for lifecycle event handling
   * - FlowMetrics: for performance metrics collection
   * - FlowTraversal: for graph traversal operations
   * - FlowSerialization: for serialization/deserialization
   *
   * The returned object is readonly to prevent accidental modifications
   * to service references.
   *
   * @returns A readonly object containing all FlowCore services
   *
   * @example
   * ```typescript
   * const services = core.getServices();
   * const registry = services.registry;  // Access EntityRegistry
   * const hooks = services.hooks;        // Access FlowHooks
   * services.metrics = new FlowMetrics(); // Type error: Cannot assign to readonly property
   * ```
   */
  getServices(): Readonly<{
    entityManager: EntityManager;
    registry: EntityRegistry<N, E, NE, EE>;
    graphCoordinator: FlowGraphCoordinator<N, E, NE, EE>;
    hooks: FlowHooks<NE>;
    metrics: FlowMetrics;
    traversal: FlowTraversal<N, E, NE, EE>;
    serialization: FlowSerialization<N, E, NE, EE>;
    serializer: FlowSerializer<N, E, NE, EE>;
  }> {
    return Object.freeze({
      entityManager: this.entityManager,
      registry: this.registry,
      graphCoordinator: this.graphCoordinator,
      hooks: this.hooks,
      metrics: this.metrics,
      traversal: this.traversal,
      serialization: this.serialization,
      serializer: this.flowSerializer,
    });
  }
}
