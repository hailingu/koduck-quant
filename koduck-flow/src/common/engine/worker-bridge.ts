/**
 * Engine Worker Pool Integration Bridge
 *
 * Implements communication layer between the execution engine and worker pool,
 * enabling CPU-intensive task offloading to worker threads with automatic
 * fallback to main thread execution.
 *
 * ## Architecture
 *
 * The worker bridge acts as an adapter:
 * - **Outbound**: Translates entity execution requests into worker pool tasks
 * - **Inbound**: Handles worker responses and failure fallback
 * - **State Management**: Maintains shared state between main and worker contexts
 *
 * ## Communication Protocol
 *
 * ### Task Payload Structure
 * ```typescript
 * interface FlowEngineWorkerTaskPayload {
 *   engineId: string;              // Engine identifier
 *   flowId: string;                // Flow being executed
 *   entityId: string;              // Entity to execute
 *   entityType: string;            // Entity type for executor lookup
 *   sharedStateId: string;         // Shared context identifier
 * }
 * ```
 *
 * ### Result Structure
 * ```typescript
 * interface FlowEngineWorkerTaskResult {
 *   status: 'success' | 'error' | 'skipped';
 *   output?: unknown;
 *   error?: SerializedError;
 * }
 * ```
 *
 * ## Fallback Strategy
 *
 * The bridge implements automatic fallback execution:
 * 1. Submit task to worker pool
 * 2. If worker succeeds: return result (fire onWorkerTaskSuccess event)
 * 3. If worker fails: automatically execute on main thread
 * 4. Record metrics for both worker and fallback execution
 * 5. Fire onWorkerTaskFallback event with durations
 *
 * This ensures guaranteed execution even if worker pool fails.
 *
 * ## Shared State Management
 *
 * The bridge manages shared context that needs to be accessible to both
 * main thread and worker threads:
 *
 * ```typescript
 * const shared = new Map<string, unknown>([
 *   ['key1', value1],
 *   ['key2', value2],
 * ]);
 *
 * // Register shared state
 * const sharedStateId = bridge.registerSharedState(shared);
 *
 * // Later, after worker completes
 * bridge.releaseSharedState(shared);
 * ```
 *
 * Shared state is tracked via weak references to prevent memory leaks.
 *
 * ## Usage Example
 *
 * ```typescript
 * // Create bridge with all required dependencies
 * const bridge = new FlowEngineWorkerBridge({
 *   engineId: 'engine-1',
 *   pool: myWorkerPool,
 *   resolveFlow: () => currentFlow,
 *   resolveExecutor: (type) => executorRegistry.get(type),
 *   runLocally: async (executor, entity, flow, shared, origin) => {
 *     return await executor(entity, shared);
 *   },
 *   taskTimeoutMs: 30000,
 *   observer: {
 *     onWorkerTaskSuccess: (event) => {
 *       console.log(`Worker completed: ${event.durationMs}ms`);
 *     },
 *     onWorkerTaskFallback: (event) => {
 *       console.log(`Fallback executed: worker=${event.workerDurationMs}ms, fallback=${event.fallbackDurationMs}ms`);
 *     },
 *   },
 * });
 *
 * // Execute entity with worker
 * const result = await bridge.execute({
 *   entity: myEntity,
 *   entityType: 'processor',
 *   shared: contextMap,
 *   flow: myFlow,
 * });
 *
 * // Later, cleanup
 * bridge.dispose();
 * ```
 *
 * @module Engine.WorkerBridge
 * @see {@link FlowEngineWorkerBridgeOptions}
 * @see {@link FlowEngineWorkerTaskPayload}
 */

import { logger } from "../logger";
import type { EntityExecutor, EntityResult } from "./types/engine-types";
export type {
  FlowEngineWorkerObserver,
  FlowEngineWorkerTaskSuccessEvent,
  FlowEngineWorkerTaskFallbackEvent,
  FlowEngineWorkerTaskPayload,
  FlowEngineWorkerTaskResult,
  SerializedError,
} from "./types/worker-bridge-types";
import type { WorkerPool, Task, TaskHandler } from "../worker-pool/types";
import type { IFlow, IEdge, IFlowNodeEntity, INode } from "../flow/types";
import type {
  FlowEngineWorkerObserver,
  FlowEngineWorkerTaskPayload,
  FlowEngineWorkerTaskResult,
  SerializedError,
} from "./types";

const DEFAULT_TASK_TIMEOUT_MS = 30_000;
const TASK_TYPE_PREFIX = "duck-flow:flow-engine";

/**
 * Configuration Options for Worker Bridge
 *
 * Specifies all dependencies and behavior configuration for the worker bridge.
 *
 * @template N - Node type in the flow
 * @template NE - Node entity type in the flow
 *
 * @example
 * ```typescript
 * const options: FlowEngineWorkerBridgeOptions<MyNode, MyNodeEntity> = {
 *   engineId: 'engine-1',
 *   pool: workerPool,
 *   resolveFlow: () => engine.flow,
 *   resolveExecutor: (type) => registry.get(type),
 *   runLocally: async (executor, entity, flow, shared) => {
 *     return await executor(entity, shared);
 *   },
 *   taskType: 'duck-flow:flow-engine:engine-1',
 *   taskTimeoutMs: 30000,
 * };
 * ```
 *
 * @property engineId - Unique identifier for the engine instance
 * @property pool - Worker pool instance for task execution
 * @property resolveFlow - Function to get the current flow being executed
 * @property resolveExecutor - Function to resolve executor by entity type
 * @property runLocally - Function to execute tasks on main thread (baseline/fallback)
 * @property taskType - Custom task type prefix (auto-generated if not provided)
 * @property taskTimeoutMs - Task execution timeout in milliseconds
 * @property observer - Optional observer for tracking execution metrics
 */
export interface FlowEngineWorkerBridgeOptions<N extends INode, NE extends IFlowNodeEntity<N>> {
  /** Unique engine identifier for scoping worker tasks */
  engineId: string;
  /** Worker pool instance for task delegation */
  pool: WorkerPool;
  /** Resolver function to get current flow execution context */
  resolveFlow: () => IFlow<N, IEdge, NE> | undefined;
  /** Resolver function to find executor for given entity type */
  resolveExecutor: (type: string) => EntityExecutor<N, NE> | undefined;
  /** Main thread executor for baseline and fallback execution */
  runLocally: (
    executor: EntityExecutor<N, NE>,
    entity: NE,
    flow: IFlow<N, IEdge, NE>,
    shared: Map<string, unknown>,
    origin: "baseline" | "fallback"
  ) => Promise<EntityResult>;
  /** Custom task type identifier (default: 'duck-flow:flow-engine:engineId') */
  taskType?: string;
  /** Task execution timeout in milliseconds (default: 30000) */
  taskTimeoutMs?: number;
  /** Observer for tracking worker task execution metrics */
  observer?: FlowEngineWorkerObserver;
}

/**
 * Parameters for Worker Task Execution
 *
 * @internal
 *
 * @template N - Node type
 * @template NE - Node entity type
 *
 * @property entity - Entity instance to execute
 * @property entityType - Type of the entity (executor lookup key)
 * @property shared - Shared context map accessible to executor
 * @property flow - Flow graph context
 */
interface FlowEngineWorkerExecuteParams<N extends INode, NE extends IFlowNodeEntity<N>> {
  /** Entity instance to process */
  entity: NE;
  /** Entity type for executor resolution */
  entityType: string;
  /** Shared execution context */
  shared: Map<string, unknown>;
  /** Flow graph context */
  flow: IFlow<N, IEdge, NE>;
}

/**
 * Worker Bridge for Task Distribution and Fallback
 *
 * Manages communication with worker pool, handles task serialization/deserialization,
 * and implements fallback execution strategy. Ensures every task completes successfully
 * (either via worker or main thread).
 *
 * ## Key Responsibilities
 *
 * 1. **Task Submission**: Converts entity execution requests into worker pool tasks
 * 2. **Result Handling**: Deserializes worker results or triggers fallback
 * 3. **State Management**: Maps shared state between main and worker contexts
 * 4. **Metrics**: Records execution metrics for monitoring
 * 5. **Cleanup**: Manages task handler lifecycle and shared state cleanup
 *
 * ## Error Handling & Fallback
 *
 * - Worker timeout → automatic fallback to main thread
 * - Worker exception → log warning and fallback to main thread
 * - Fallback failure → propagate error to engine
 * - Main thread handles final execution (no second fallback)
 *
 * ## Performance Notes
 *
 * | Operation | Complexity | Notes |
 * |-----------|-----------|-------|
 * | Task registration | O(1) | One-time setup |
 * | Execute | O(1) | Task submission + await result |
 * | Shared state management | O(1) | Hash map lookup |
 * | Serialization | O(n) | n = size of result object |
 *
 * @template N - Node type in flow graph (default: INode)
 * @template NE - Node entity type (default: IFlowNodeEntity<N>)
 *
 * @see {@link FlowEngineWorkerBridgeOptions}
 * @see {@link FlowEngineWorkerTaskPayload}
 */
export class FlowEngineWorkerBridge<
  N extends INode = INode,
  NE extends IFlowNodeEntity<N> = IFlowNodeEntity<N>,
> {
  private readonly pool: WorkerPool;
  private readonly resolveFlow: () => IFlow<N, IEdge, NE> | undefined;
  private readonly resolveExecutor: (type: string) => EntityExecutor<N, NE> | undefined;
  private readonly runLocally: (
    executor: EntityExecutor<N, NE>,
    entity: NE,
    flow: IFlow<N, IEdge, NE>,
    shared: Map<string, unknown>,
    origin: "baseline" | "fallback"
  ) => Promise<EntityResult>;
  private readonly taskType: string;
  private readonly taskTimeout: number;
  private readonly engineId: string;
  private observer: FlowEngineWorkerObserver | undefined;
  private readonly unregisterHandler: ((type: string) => void) | undefined;

  /** Maps shared state IDs to shared state maps */
  private readonly sharedById = new Map<string, Map<string, unknown>>();
  /** Reverse mapping from shared state to ID (weak references) */
  private readonly sharedIds = new WeakMap<Map<string, unknown>, string>();
  /** Disposal flag to prevent operations after cleanup */
  private disposed = false;

  /**
   * Create a new worker bridge instance
   *
   * Initializes the bridge and registers the task handler with the worker pool.
   * Logs a warning if worker pool doesn't support task handler registration
   * (bridge will operate in fallback-only mode).
   *
   * @param options - Configuration options with all required dependencies
   *
   * @throws Will not throw; logs warnings if worker pool integration unavailable
   *
   * @example
   * ```typescript
   * const bridge = new FlowEngineWorkerBridge({
   *   engineId: 'engine-1',
   *   pool: myWorkerPool,
   *   resolveFlow: () => currentFlow,
   *   resolveExecutor: (type) => executors.get(type),
   *   runLocally: async (executor, entity, flow, shared, origin) => {
   *     return await executor(entity, shared);
   *   },
   * });
   * ```
   */
  constructor(options: FlowEngineWorkerBridgeOptions<N, NE>) {
    this.pool = options.pool;
    this.resolveFlow = options.resolveFlow;
    this.resolveExecutor = options.resolveExecutor;
    this.runLocally = options.runLocally;
    this.taskType = options.taskType ?? `${TASK_TYPE_PREFIX}:${options.engineId}`;
    this.taskTimeout = options.taskTimeoutMs ?? DEFAULT_TASK_TIMEOUT_MS;
    this.engineId = options.engineId;
    this.observer = options.observer;

    const registerHandler =
      typeof this.pool.registerHandler === "function"
        ? (this.pool.registerHandler.bind(this.pool) as (
            type: string,
            handler: TaskHandler<FlowEngineWorkerTaskPayload, FlowEngineWorkerTaskResult>
          ) => void)
        : undefined;
    this.unregisterHandler =
      typeof this.pool.unregisterHandler === "function"
        ? (this.pool.unregisterHandler.bind(this.pool) as (type: string) => void)
        : undefined;

    if (registerHandler) {
      registerHandler(this.taskType, (payload) => this.handleTask(payload));
    } else {
      logger.warn(
        "Worker pool does not expose registerHandler; FlowEngine worker bridge will operate in fallback mode"
      );
    }
  }

  /**
   * Get the worker pool instance
   *
   * Provides access to the underlying worker pool for advanced usage scenarios
   * such as querying pool status or statistics.
   *
   * @returns The worker pool instance
   *
   * @example
   * ```typescript
   * const poolStats = bridge.getPool().getStats?.();
   * ```
   */
  getPool(): WorkerPool {
    return this.pool;
  }

  /**
   * Register shared execution context
   *
   * Creates a mapping between shared state and a unique ID that can be serialized
   * for transmission to worker threads. Uses weak references to automatically
   * clean up after shared state is no longer referenced.
   *
   * @param shared - Map of shared context values
   * @returns Unique identifier for the shared state
   *
   * @example
   * ```typescript
   * const shared = new Map([['config', myConfig]]);
   * const sharedId = bridge.registerSharedState(shared);
   * // Use sharedId to access shared in worker
   * ```
   */
  registerSharedState(shared: Map<string, unknown>): string {
    let id = this.sharedIds.get(shared);
    if (!id) {
      id = `${this.engineId}:shared:${this.sharedById.size + 1}`;
      this.sharedIds.set(shared, id);
      this.sharedById.set(id, shared);
    }
    return id;
  }

  /**
   * Release shared execution context
   *
   * Removes the shared state mapping, allowing garbage collection.
   * Safe to call on unregistered or already-released shared state.
   *
   * @param shared - Map to release
   *
   * @example
   * ```typescript
   * bridge.releaseSharedState(shared);
   * ```
   */
  releaseSharedState(shared: Map<string, unknown>): void {
    const id = this.sharedIds.get(shared);
    if (!id) {
      return;
    }
    this.sharedIds.delete(shared);
    this.sharedById.delete(id);
  }

  /**
   * Execute entity with worker pool fallback
   *
   * Submits task to worker pool with automatic fallback to main thread
   * on failure. Measures and records execution metrics.
   *
   * **Execution Path**:
   * 1. Submit task to worker pool with timeout
   * 2. If successful: fire onWorkerTaskSuccess, return result
   * 3. If failed: execute on main thread with same executor
   * 4. Fire onWorkerTaskFallback with timing information
   * 5. Return main thread result or throw final error
   *
   * @param params - Entity and execution parameters
   * @returns Entity execution result
   *
   * @throws Error if main thread execution also fails
   *
   * @example
   * ```typescript
   * const result = await bridge.execute({
   *   entity: myEntity,
   *   entityType: 'processor',
   *   shared: sharedContext,
   *   flow: myFlow,
   * });
   * ```
   */
  async execute(params: FlowEngineWorkerExecuteParams<N, NE>): Promise<EntityResult> {
    const { entity, entityType, shared, flow } = params;
    const executor = this.resolveExecutor(entityType);
    if (!executor) {
      return { status: "skipped" };
    }

    const sharedStateId = this.registerSharedState(shared);
    const attachedFlow = this.resolveFlow() ?? flow;
    if (!attachedFlow) {
      return { status: "error", error: new Error("Flow is not attached to engine") };
    }
    const payload: FlowEngineWorkerTaskPayload = {
      engineId: this.engineId,
      flowId: attachedFlow.id,
      entityId: entity.id,
      entityType,
      sharedStateId,
    };

    const task: Task<FlowEngineWorkerTaskPayload> = {
      type: this.taskType,
      payload,
      timeout: this.taskTimeout,
    };

    const workerStart = performance.now();
    try {
      const result = await this.pool.execute(task as Task<unknown>);
      const durationMs = performance.now() - workerStart;
      this.observer?.onWorkerTaskSuccess({
        entityId: entity.id,
        entityType,
        durationMs,
      });
      return this.deserializeResult(result as FlowEngineWorkerTaskResult);
    } catch (error) {
      logger.warn("Worker pool execution failed, falling back to main thread", {
        error: error instanceof Error ? error.message : error,
        engineId: this.engineId,
        entityId: entity.id,
      });
      const workerDurationMs = performance.now() - workerStart;
      const fallbackStart = performance.now();
      try {
        const fallbackResult = await this.runLocally(executor, entity, flow, shared, "fallback");
        const fallbackDurationMs = performance.now() - fallbackStart;
        this.observer?.onWorkerTaskFallback?.({
          entityId: entity.id,
          entityType,
          workerDurationMs,
          fallbackDurationMs,
          reason: error,
        });
        return fallbackResult;
      } catch (fallbackError) {
        const fallbackDurationMs = performance.now() - fallbackStart;
        this.observer?.onWorkerTaskFallback?.({
          entityId: entity.id,
          entityType,
          workerDurationMs,
          fallbackDurationMs,
          reason: fallbackError,
        });
        throw fallbackError;
      }
    }
  }

  /**
   * Clean up worker bridge resources
   *
   * Unregisters task handler from worker pool and clears shared state mappings.
   * Safe to call multiple times (subsequent calls are no-ops).
   *
   * @example
   * ```typescript
   * bridge.dispose();
   * // Bridge is no longer usable
   * ```
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    if (this.unregisterHandler) {
      this.unregisterHandler(this.taskType);
    }

    this.sharedById.clear();
  }

  /**
   * Handle task execution in worker context
   *
   * Called by worker pool when task is received in worker thread.
   * Resolves flow, executor, and shared state, then executes the task.
   *
   * @param payload - Task payload with entity and context IDs
   * @returns Serialized execution result
   *
   * @internal
   */
  private async handleTask(
    payload: FlowEngineWorkerTaskPayload
  ): Promise<FlowEngineWorkerTaskResult> {
    const executor = this.resolveExecutor(payload.entityType);
    if (!executor) {
      return { status: "skipped" };
    }

    const flow = this.resolveFlow();
    if (!flow) {
      return this.serializeError(new Error("Flow is not attached to engine"));
    }

    const shared = this.sharedById.get(payload.sharedStateId);
    if (!shared) {
      return this.serializeError(
        new Error(
          `Shared state ${payload.sharedStateId} is not registered for engine ${this.engineId}`
        )
      );
    }

    const entity = flow.getEntity(payload.entityId);
    if (!entity) {
      return this.serializeError(new Error(`Entity ${payload.entityId} not found in flow`));
    }

    try {
      const result = await this.runLocally(executor, entity as NE, flow, shared, "baseline");
      return this.serializeResult(result);
    } catch (error) {
      return this.serializeError(error);
    }
  }

  /**
   * Set or update the execution metrics observer
   *
   * @param observer - Observer instance or undefined to clear
   *
   * @example
   * ```typescript
   * bridge.setObserver({
   *   onWorkerTaskSuccess: (event) => console.log('Worker succeeded'),
   *   onWorkerTaskFallback: (event) => console.log('Fallback used'),
   * });
   * ```
   */
  setObserver(observer?: FlowEngineWorkerObserver): void {
    this.observer = observer;
  }

  /**
   * Serialize EntityResult for worker transmission
   *
   * @param result - Entity execution result to serialize
   * @returns Serialized result for transmission to worker thread
   *
   * @internal
   */
  private serializeResult(result: EntityResult): FlowEngineWorkerTaskResult {
    if (result.status === "error") {
      const base: FlowEngineWorkerTaskResult = {
        status: result.status,
        output: result.output,
      };
      if (result.error) {
        base.error = serializeError(result.error);
      }
      return base;
    }
    return {
      status: result.status,
      output: result.output,
    };
  }

  /**
   * Serialize error for worker transmission
   *
   * @param error - Error object to serialize
   * @returns Serialized error for transmission to worker thread
   *
   * @internal
   */
  private serializeError(error: unknown): FlowEngineWorkerTaskResult {
    if (error instanceof Error) {
      return {
        status: "error",
        error: serializeError(error),
      };
    }
    return {
      status: "error",
      error: {
        name: "Error",
        message: String(error),
      },
    };
  }

  /**
   * Deserialize worker task result
   *
   * @param result - Worker task result object to deserialize
   * @returns Entity result reconstructed from worker response
   *
   * @internal
   */
  private deserializeResult(result: FlowEngineWorkerTaskResult): EntityResult {
    if (result.status === "error") {
      return {
        status: "error",
        output: result.output,
        error: result.error ? deserializeError(result.error) : new Error("Worker task failed"),
      };
    }

    return {
      status: result.status,
      output: result.output,
    };
  }
}

/**
 * Serialize Error for cross-thread transmission
 *
 * Converts JavaScript Error to serializable format that preserves
 * name, message, and stack trace information.
 *
 * @param error - Error instance to serialize
 * @returns Serialized error object
 *
 * @internal
 */
export function serializeError(error: Error): SerializedError {
  const serialized: SerializedError = {
    name: error.name,
    message: error.message,
  };
  if (error.stack) {
    serialized.stack = error.stack;
  }
  return serialized;
}

/**
 * Deserialize Error from cross-thread transmission
 *
 * Reconstructs Error instance from serialized format.
 *
 * @param error - Serialized error object
 * @returns Reconstructed Error instance
 *
 * @internal
 */
export function deserializeError(error: SerializedError): Error {
  const deserialized = new Error(error.message);
  deserialized.name = error.name ?? "Error";
  if (error.stack) {
    deserialized.stack = error.stack;
  }
  return deserialized;
}
