import type { FlowSerialization, FlowSnapshot } from "../serialization";
import type { HookAdapter } from "../orchestration/hook-adapter";
import type { MetricsAdapter, TimingResult } from "../orchestration/metrics-adapter";
import type { IEdge, IFlowEdgeEntity, IFlowNodeEntity, INode } from "../types";

/**
 * Flow Serialization Module
 *
 * Provides a unified interface for serializing and deserializing flow graphs.
 * Encapsulates `FlowSerialization` and integrates with lifecycle hooks and
 * performance metrics collection.
 *
 * ## Key Responsibilities
 * - **Serialization**: Convert flow graph to JSON format
 * - **Deserialization**: Restore flow graph from JSON
 * - **Hook Integration**: Trigger save/load lifecycle events
 * - **Metrics Recording**: Track serialization performance
 *
 * ## Architecture Pattern
 * - **Adapter Pattern**: Wraps FlowSerialization with additional capabilities
 * - **Decorator Pattern**: Adds hooks and metrics to core serialization logic
 *
 * @template N - Node type
 * @template E - Edge type
 * @template NE - Node entity type
 * @template EE - Edge entity type
 *
 * @example
 * ```typescript
 * const serializer = new FlowSerializer(
 *   flowSerialization,
 *   hookAdapter,
 *   metricsAdapter
 * );
 *
 * // Serialize flow to JSON
 * const json = serializer.toJSON();
 *
 * // Deserialize flow from JSON
 * serializer.loadFromJSON(json);
 * ```
 */
export class FlowSerializer<
  N extends INode = INode,
  E extends IEdge = IEdge,
  NE extends IFlowNodeEntity<N> = IFlowNodeEntity<N>,
  EE extends IFlowEdgeEntity<E> = IFlowEdgeEntity<E>,
> {
  private readonly serialization: FlowSerialization<N, E, NE, EE>;
  private readonly hookAdapter: HookAdapter<NE>;
  private readonly metricsAdapter: MetricsAdapter;

  /**
   * Constructor
   *
   * Initializes the flow serializer with core serialization service and
   * optional hook/metrics adapters.
   *
   * @param serialization - The underlying FlowSerialization instance
   * @param hookAdapter - Hook adapter for lifecycle events
   * @param metricsAdapter - Metrics adapter for performance tracking
   *
   * @example
   * ```typescript
   * const serializer = new FlowSerializer(
   *   flowCore.getServices().serialization,
   *   hookAdapter,
   *   metricsAdapter
   * );
   * ```
   */
  constructor(
    serialization: FlowSerialization<N, E, NE, EE>,
    hookAdapter: HookAdapter<NE>,
    metricsAdapter: MetricsAdapter
  ) {
    this.serialization = serialization;
    this.hookAdapter = hookAdapter;
    this.metricsAdapter = metricsAdapter;
  }

  /**
   * Serialize flow to JSON representation
   *
   * Converts the flow graph to a JSON-compatible object format.
   * Automatically triggers the `onFlowSaved` hook and records
   * serialization timing metrics.
   *
   * ## Behavior
   * - Calls underlying FlowSerialization.toJSON
   * - Wraps operation with performance timing
   * - Triggers onFlowSaved hook before returning
   * - Returns JSON-compatible object representation
   *
   * @returns JSON representation of the flow graph
   *
   * @description
   * - Performance is automatically recorded via metricsAdapter
   * - Hook triggered with flow state information
   * - JSON structure remains compatible with historical format
   * - Suitable for persistence or network transmission
   *
   * @example
   * ```typescript
   * const json = serializer.toJSON();
   * console.log('Serialized flow:', json);
   *
   * // Save to file or database
   * await storage.save(json);
   * ```
   */
  toJSON(): FlowSnapshot {
    const allowSave = this.hookAdapter.runFlowSaved();
    if (!allowSave) {
      const state = this.serialization.getStateSnapshot();
      return {
        id: state.id,
        name: state.name,
        createdAt: state.createdAt,
        updatedAt: state.updatedAt,
        metadata: state.metadata,
        entities: [],
        flowGraph: undefined,
      } satisfies FlowSnapshot;
    }

    const { result, duration }: TimingResult<FlowSnapshot> = this.metricsAdapter.withTiming(
      "flow-serialization",
      () => this.serialization.toJSON()
    );

    const entityCount = Array.isArray(result.entities) ? result.entities.length : 0;
    this.metricsAdapter.recordSerialization(entityCount, duration);

    return result;
  }

  /**
   * Load flow from JSON representation
   *
   * Restores the flow graph from a JSON object. Automatically triggers
   * the `onFlowLoaded` hook and records deserialization timing metrics.
   *
   * ## Behavior
   * - Validates JSON input format
   * - Calls underlying FlowSerialization.loadFromJSON
   * - Wraps operation with performance timing
   * - Triggers onFlowLoaded hook after loading
   * - Maintains idempotency on error
   *
   * @param json - JSON object representing the flow graph
   *
   * @throws {Error} If JSON format is invalid or deserialization fails
   *
   * @description
   * - Performance is automatically recorded via metricsAdapter
   * - Hook triggered after successful load
   * - Validates JSON structure before loading
   * - Throws descriptive errors on failure
   * - Original flow state preserved on error (idempotent)
   *
   * @example
   * ```typescript
   * try {
   *   const json = await storage.load();
   *   serializer.loadFromJSON(json);
   *   console.log('Flow restored successfully');
   * } catch (error) {
   *   console.error('Failed to load flow:', error.message);
   * }
   * ```
   */
  loadFromJSON(json: Record<string, unknown>): void {
    if (!json || typeof json !== "object") {
      throw new Error("Invalid JSON input: expected object");
    }

    const { result: allowMetrics, duration } = this.metricsAdapter.withTiming(
      "flow-deserialization",
      () => {
        this.serialization.loadFromJSON(json);
        return this.hookAdapter.runFlowLoaded(json);
      }
    );

    if (allowMetrics) {
      this.metricsAdapter.recordFlowLoaded(duration);
    }
  }

  /**
   * Get underlying FlowSerialization instance
   *
   * Provides access to the core serialization service for advanced use cases.
   *
   * @returns The underlying FlowSerialization instance
   *
   * @description
   * - Use for direct serialization API access if needed
   * - Advanced users only; prefer toJSON/loadFromJSON for most cases
   * - Bypasses hook and metrics recording
   *
   * @example
   * ```typescript
   * const serialization = serializer.getUnderlying();
   * const customJson = serialization.toJSON();
   * ```
   */
  getUnderlying(): FlowSerialization<N, E, NE, EE> {
    return this.serialization;
  }
}
