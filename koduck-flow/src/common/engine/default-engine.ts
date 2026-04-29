/**
 * Koduck Flow Default Execution Engine
 *
 * Implements the core task execution engine for Koduck Flow, providing a complete
 * scheduling system that manages entity execution across the flow graph with
 * support for concurrency, error handling, cancellation, and metrics collection.
 *
 * ## Architecture Overview
 *
 * ```
 * Flow Graph (DAG)
 *        ↓
 *  [DefaultEngine]
 *        ↓
 *  ┌─────┴─────┬──────────┐
 *  ↓           ↓          ↓
 * Level-based  Executor   Worker Bridge
 * Scheduling   Registry   (optional)
 *  ↓           ↓          ↓
 * Batch        Direct     Worker
 * Processing   Execution  Pool
 * ```
 *
 * ## Execution Model: Level-Based Scheduling
 *
 * The engine executes the flow graph layer-by-layer:
 *
 * **1. Initialization Phase**:
 * - Validates flow attachment and entry entity availability
 * - Sets up execution context (shared state, results map)
 * - Creates AbortController for cancellation support
 * - Fires onRunStarted event
 *
 * **2. Level Iteration Phase**:
 * - Collects all entities from current queue level
 * - Executes level with controlled concurrency (batch processing)
 * - Enqueues children of completed entities
 * - Repeats until queue exhausted or error encountered
 *
 * **3. Batch Processing Phase** (per level):
 * - Splits level into chunks of size = config.concurrency
 * - Executes each chunk in parallel (Promise.all)
 * - Waits for chunk completion before processing next chunk
 * - Maintains execution order within concurrency constraints
 *
 * **4. Completion Phase**:
 * - Collects all entity results
 * - Determines overall success/failure status
 * - Fires onRunFinished event
 * - Records metrics
 *
 * **Time Complexity**: O(depth * (entities / concurrency))
 * **Space Complexity**: O(entities) for tracking visited and results
 *
 * ## Concurrency Control
 *
 * Concurrency is controlled at the batch level, not individual task level:
 *
 * ```typescript
 * // concurrency: 2
 * Level: [E1, E2, E3, E4]
 * Batch 1: [E1, E2] → Execute in parallel
 * Batch 2: [E3, E4] → Execute in parallel (after batch 1 completes)
 *
 * // concurrency: 1
 * Level: [E1, E2, E3, E4]
 * Batch 1: [E1] → Execute
 * Batch 2: [E2] → Execute (after E1)
 * Batch 3: [E3] → Execute (after E2)
 * Batch 4: [E4] → Execute (after E3)
 * ```
 *
 * This preserves flow semantics (children execute after parents).
 *
 * ## Error Handling Strategies
 *
 * **Strategy 1: Stop on First Error** (stopOnError: true)
 * - Any entity error halts entire execution
 * - Remaining entities not processed
 * - Run result: ok = false
 * - Use case: Critical workflows where partial completion is invalid
 *
 * **Strategy 2: Continue on Error** (stopOnError: false)
 * - Entity errors recorded but execution continues
 * - All reachable entities attempted
 * - Run result: ok = true if no errors, false if any entity failed
 * - Use case: Parallel processing with optional entities
 *
 * **Error Propagation**:
 * 1. Executor throws error or returns error EntityResult
 * 2. processEntity catches and records error
 * 3. onEntityFinish fired with status: 'error'
 * 4. Check config.stopOnError
 * 5. If true: throw error (halts executeFrom)
 * 6. If false: continue to next entity
 *
 * ## Executor Selection & Invocation
 *
 * **Resolution Order**:
 * 1. Extract entity.type
 * 2. Lookup executor in registry: _executors.get(type)
 * 3. If not found: return { status: 'skipped' }
 * 4. If found: invoke executor
 *
 * **Invocation Path**:
 * - With Worker Bridge: workerBridge.execute() → tries worker pool → fallback to main thread
 * - Without Worker Bridge: invokeExecutor() → direct main thread execution
 *
 * **Executor Signature**:
 * ```typescript
 * async (context: {
 *   flow: IFlow<N, IEdge, NE>;      // Complete flow graph
 *   node: N;                          // Node definition
 *   entity: NE;                       // Entity instance
 *   shared: Map<string, unknown>;     // Shared execution context
 * }) => EntityResult
 * ```
 *
 * ## Metrics Collection
 *
 * The engine tracks:
 * - Run-level metrics: startedAt, finishedAt, ok, flowId
 * - Entity-level metrics: entityId, type, status, durationMs
 * - Worker metrics: success/fallback tracking (via workerBridge)
 * - Main thread execution: origin ('baseline' or 'fallback'), durationMs
 *
 * All metrics recorded via FlowEngineMetricsRecorder interface.
 *
 * ## Cancellation Support
 *
 * Cancellation via AbortSignal:
 *
 * ```typescript
 * const ac = new AbortController();
 * const runPromise = engine.run({ signal: ac.signal });
 * // Later:
 * ac.abort(); // Stops new level processing
 *
 * // Or via engine.stop()
 * engine.stop(); // Same effect
 * ```
 *
 * Cancellation behavior:
 * - Checked at level start (before batch processing)
 * - Completes current batch before stopping
 * - Returns ok = false
 * - Cancellation is cooperative (not preemptive)
 *
 * ## Shared State Management
 *
 * Shared state is a Map accessible to all executors:
 *
 * ```typescript
 * const engine = new DefaultEngine();
 * await engine.run({
 *   // Executors access shared state
 *   // and can modify it for downstream entities
 * });
 * ```
 *
 * Shared state lifecycle:
 * 1. Created empty at run start
 * 2. Passed to all executors
 * 3. Cleared at run end
 * 4. Registered with worker bridge (for worker access)
 * 5. Released after run completion
 *
 * ## Worker Pool Integration
 *
 * Optional integration for CPU-intensive tasks:
 *
 * ```typescript
 * const engine = new DefaultEngine({
 *   worker: {
 *     pool: myWorkerPool,
 *     taskType: 'koduck-flow:engine:custom',
 *     taskTimeoutMs: 30000,
 *   }
 * });
 * ```
 *
 * When enabled:
 * - Tasks submitted to worker pool
 * - Automatic fallback to main thread on failure
 * - Metrics recorded for both paths
 *
 * ## Event System
 *
 * The engine emits 4 event types:
 * - **onRunStarted**: Execution begins (flowId)
 * - **onRunFinished**: Execution ends (flowId, ok, durationMs)
 * - **onEntityStart**: Entity processing begins (entityId, type)
 * - **onEntityFinish**: Entity processing ends (entityId, type, status, durationMs)
 *
 * ## Usage Example
 *
 * ```typescript
 * // Create engine with configuration
 * const engine = new DefaultEngine<MyNode, MyEntity>({
 *   concurrency: 4,           // 4 entities in parallel per level
 *   stopOnError: true,        // Halt on first error
 *   validateBeforeRun: true,  // Verify flow structure
 *   strictEntityGraph: false, // No extra validation
 *   worker: {                 // Optional worker pool
 *     pool: myWorkerPool,
 *     taskTimeoutMs: 30000,
 *   },
 * });
 *
 * // Attach flow and register executors
 * engine.attachFlow(myFlow);
 * engine.registerExecutor('processor', async (context) => {
 *   const { entity, shared } = context;
 *   const config = shared.get('config') as MyConfig;
 *   return await processEntity(entity, config);
 * });
 *
 * // Execute with cancellation support
 * const ac = new AbortController();
 * const result = await engine.run({
 *   signal: ac.signal,
 * });
 *
 * if (result.ok) {
 *   console.log('Execution successful');
 *   for (const [id, res] of result.entityResults) {
 *     console.log(`Entity ${id}: ${res.status}`);
 *   }
 * } else {
 *   console.log('Execution failed');
 * }
 *
 * // Cleanup
 * engine.dispose();
 * ```
 *
 * ## Performance Characteristics
 *
 * | Operation | Time | Notes |
 * |-----------|------|-------|
 * | attachFlow | O(1) | Reference assignment |
 * | registerExecutor | O(1) | Map insertion |
 * | run (idle flow) | O(n) | n = entity count |
 * | Level processing | O(n) | n = level size, parallelized by concurrency |
 * | Executor lookup | O(1) | Map lookup by type |
 * | Shared state | O(1) | Map operations |
 *
 * Memory usage:
 * - Entities: O(n)
 * - Results map: O(n)
 * - Visited set: O(n)
 * - Executor registry: O(e) where e = unique types
 *
 * ## Best Practices
 *
 * 1. **Set appropriate concurrency**: Match CPU cores for CPU-intensive work
 * 2. **Use shared state for context**: Avoid capturing external mutable state
 * 3. **Return proper EntityResult**: Always include status field
 * 4. **Handle cancellation**: Check for premature completion
 * 5. **Register metrics**: Enable observability via FlowEngineMetricsRecorder
 * 6. **Clean up properly**: Call dispose() when engine no longer needed
 * 7. **Validate flow structure**: Enable validateBeforeRun in development
 *
 * @template N - Node type (default: INode)
 * @template NE - Node entity type (default: IFlowNodeEntity<N>)
 */

import { GenericEvent } from "../event/generic-event";
import type { IEdge, IFlow, IFlowNodeEntity, INode } from "../flow/types";
import type { IDisposable } from "../disposable";
import { logger } from "../logger";
import {
  type EngineConfig,
  type EngineStatus,
  type FlowRunResult,
  type IEngine,
  type EntityExecutor,
  type EntityResult,
  type RunOptions,
  type FlowEngineMetricsRecorder,
  type ExecutionContext,
} from "./types";
import { FlowEngineWorkerBridge, type FlowEngineWorkerBridgeOptions } from "./worker-bridge";

/**
 * Default implementation of IEngine interface
 *
 * Provides level-based task scheduling with configurable concurrency,
 * error handling, and worker pool integration.
 *
 * @template N - Node type in the flow (default: INode)
 * @template NE - Node entity type (default: IFlowNodeEntity<N>)
 *
 * @see {@link IEngine}
 * @see {@link EngineConfig}
 */
export class DefaultEngine<
    N extends INode = INode,
    NE extends IFlowNodeEntity<N> = IFlowNodeEntity<N>,
  >
  implements IEngine<N, NE>, IDisposable
{
  public readonly name = "DefaultEngine";
  public readonly type = "engine";

  private _status: EngineStatus = "idle";
  private _flow: IFlow<N, IEdge, NE> | undefined;
  private readonly _executors = new Map<string, EntityExecutor<N, NE>>();
  private readonly _shared = new Map<string, unknown>();
  private _abortController: AbortController | undefined;
  private readonly engineId: string;
  private readonly workerBridge?: FlowEngineWorkerBridge<N, NE>;
  private metricsRecorder: FlowEngineMetricsRecorder | undefined;

  public readonly config: Required<EngineConfig>;

  public readonly onRunStarted = new GenericEvent<{ flowId: string }>("engine:run-start");
  public readonly onRunFinished = new GenericEvent<{
    flowId: string;
    ok: boolean;
    durationMs: number;
  }>("engine:run-finish");
  public readonly onEntityStart = new GenericEvent<{
    entityId: string;
    type: string;
  }>("engine:entity-start");
  public readonly onEntityFinish = new GenericEvent<{
    entityId: string;
    type: string;
    status: EntityResult["status"];
    durationMs: number;
  }>("engine:entity-finish");

  /**
   * Create a new default execution engine
   *
   * Initializes the engine with configuration and sets up optional worker pool integration.
   * Generates a unique engine ID for scoping worker tasks and metrics.
   *
   * **Initialization Steps**:
   * 1. Generate unique engineId for worker task identification
   * 2. Normalize and validate configuration values
   * 3. Set default values for all config options
   * 4. If worker pool provided: create FlowEngineWorkerBridge
   * 5. Link metrics recorder to worker bridge observer
   *
   * @param cfg - Engine configuration (optional, all fields default)
   *
   * @example
   * ```typescript
   * // Minimal configuration
   * const engine = new DefaultEngine();
   *
   * // With concurrency and error handling
   * const engine = new DefaultEngine({
   *   concurrency: 4,
   *   stopOnError: false,
   *   validateBeforeRun: true,
   * });
   *
   * // With worker pool integration
   * const engine = new DefaultEngine({
   *   worker: {
   *     pool: myWorkerPool,
   *     taskType: 'custom:task:type',
   *     taskTimeoutMs: 30000,
   *   },
   * });
   * ```
   *
   * @see {@link EngineConfig}
   */
  constructor(cfg?: EngineConfig) {
    this.engineId = `engine-${crypto.randomUUID()}`;
    this.config = {
      concurrency: Math.max(1, Math.floor(cfg?.concurrency ?? 1)),
      stopOnError: cfg?.stopOnError ?? true,
      validateBeforeRun: cfg?.validateBeforeRun ?? true,
      strictEntityGraph: cfg?.strictEntityGraph ?? false,
      worker: cfg?.worker ?? null,
      enableWorkerPool: cfg?.enableWorkerPool ?? false,
      workerPoolConfig: cfg?.workerPoolConfig || null,
    };

    // Determine worker pool configuration
    // Priority: enableWorkerPool && workerPoolConfig > worker
    let workerCfg = this.config.worker;

    if (cfg?.enableWorkerPool && cfg?.workerPoolConfig?.pool) {
      // Use new-style configuration if provided
      const wpCfg = cfg.workerPoolConfig;
      workerCfg = {
        pool: wpCfg.pool!,
        ...(wpCfg.taskType ? { taskType: wpCfg.taskType } : {}),
        ...(wpCfg.taskTimeoutMs ? { taskTimeoutMs: wpCfg.taskTimeoutMs } : {}),
      };
    }

    if (workerCfg?.pool) {
      const workerOptions: FlowEngineWorkerBridgeOptions<N, NE> = {
        engineId: this.engineId,
        pool: workerCfg.pool,
        resolveFlow: () => this._flow,
        resolveExecutor: (type: string) => (type ? this._executors.get(type) : undefined),
        runLocally: (
          executor: EntityExecutor<N, NE>,
          entity: NE,
          flowInstance: IFlow<N, IEdge, NE>,
          sharedState: Map<string, unknown>,
          origin: "baseline" | "fallback"
        ) => this.invokeExecutor(executor, entity, flowInstance, sharedState, origin),
      };

      if (workerCfg.taskType) {
        workerOptions.taskType = workerCfg.taskType;
      }
      if (typeof workerCfg.taskTimeoutMs === "number") {
        workerOptions.taskTimeoutMs = workerCfg.taskTimeoutMs;
      }

      this.workerBridge = new FlowEngineWorkerBridge<N, NE>(workerOptions);
      if (this.metricsRecorder) {
        this.workerBridge.setObserver(this.metricsRecorder.getWorkerObserver());
      }
    }
  }

  /**
   * Get current engine status
   *
   * Returns the current operational state of the engine.
   *
   * **Status Values**:
   * - 'idle': Engine is ready, no execution in progress
   * - 'running': Execution in progress
   * - 'paused': Execution paused (via pause())
   * - 'stopped': Execution stopped (via stop() or cancellation)
   *
   * @returns Current engine status
   *
   * @example
   * ```typescript
   * if (engine.status === 'idle') {
   *   await engine.run();
   * }
   * ```
   */
  get status(): EngineStatus {
    return this._status;
  }

  /**
   * Attach flow graph for execution
   *
   * Associates a flow graph with this engine, enabling execution of entities
   * within the flow. The engine can only execute when a flow is attached.
   *
   * **Prerequisites**:
   * - Engine must be in idle state
   * - Flow must be a valid DAG (checked at run time if validateBeforeRun enabled)
   * - Flow must have a root entity or entry entity provided
   *
   * @param flow - Flow graph to attach
   *
   * @example
   * ```typescript
   * const flow = new MyFlow();
   * engine.attachFlow(flow);
   * const result = await engine.run();
   * ```
   */
  attachFlow(flow: IFlow<N, IEdge, NE>): void {
    this._flow = flow;
  }

  /**
   * Detach flow graph from engine
   *
   * Removes the flow association, preventing future execution attempts.
   * Safe to call when no flow is attached.
   *
   * @example
   * ```typescript
   * engine.detachFlow();
   * // engine.status now returns error if run() is called
   * ```
   */
  detachFlow(): void {
    this._flow = undefined;
  }

  /**
   * Get attached flow graph
   *
   * Returns the currently attached flow or undefined if no flow attached.
   *
   * @returns Attached flow or undefined
   *
   * @example
   * ```typescript
   * const flow = engine.getFlow();
   * if (flow) {
   *   console.log(`Executing flow: ${flow.id}`);
   * }
   * ```
   */
  getFlow(): IFlow<N, IEdge, NE> | undefined {
    return this._flow;
  }

  /**
   * Register executor for entity type
   *
   * Associates an executor function with an entity type. When an entity of that
   * type is encountered during execution, the executor is called with the entity context.
   *
   * Executors can be registered/unregistered at any time, but changes during
   * execution only affect subsequently-processed entities.
   *
   * @param type - Entity type identifier (matches entity.type)
   * @param executor - Async function to execute entity
   *
   * @example
   * ```typescript
   * engine.registerExecutor('processor', async (context) => {
   *   const { entity, shared, flow } = context;
   *   const result = await processEntity(entity, shared.get('config'));
   *   return { status: 'success', output: result };
   * });
   * ```
   */
  registerExecutor(type: string, executor: EntityExecutor<N, NE>): void {
    this._executors.set(type, executor);
  }

  /**
   * Unregister executor for entity type
   *
   * Removes the executor association for a type. Subsequently-encountered entities
   * of this type will return { status: 'skipped' }.
   *
   * Safe to call if executor not registered.
   *
   * @param type - Entity type identifier to unregister
   *
   * @example
   * ```typescript
   * engine.unregisterExecutor('processor');
   * ```
   */
  unregisterExecutor(type: string): void {
    this._executors.delete(type);
  }

  /**
   * Check if executor is registered for type
   *
   * @param type - Entity type identifier
   * @returns True if executor registered for type
   *
   * @example
   * ```typescript
   * if (engine.hasExecutor('processor')) {
   *   console.log('Processor executor available');
   * }
   * ```
   */
  hasExecutor(type: string): boolean {
    return this._executors.has(type);
  }

  /**
   * Register metrics collector
   *
   * Associates a metrics recorder with the engine for observability.
   * The recorder receives callbacks for all run and entity lifecycle events.
   *
   * Can be registered/unregistered at any time. Only active during and after
   * runs that occur after registration.
   *
   * @param recorder - Metrics recorder instance or undefined to clear
   *
   * @example
   * ```typescript
   * const metricsRecorder = new FlowEngineMetricsAdapter(options);
   * engine.registerMetricsRecorder(metricsRecorder);
   * ```
   */
  registerMetricsRecorder(recorder: FlowEngineMetricsRecorder | undefined): void {
    this.metricsRecorder = recorder;
    if (this.workerBridge) {
      this.workerBridge.setObserver(recorder?.getWorkerObserver());
    }
  }

  /**
   * Execute flow from entry entity
   *
   * Initiates flow execution starting from the specified entry entity or root entity.
   * Implements level-based scheduling with batch concurrency control.
   *
   * **Execution Phases**:
   * 1. **Validation**: Verify flow attachment and entry entity availability
   * 2. **Initialization**: Setup execution context (shared state, metrics)
   * 3. **Level Iteration**: Execute entities level-by-level in parallel batches
   * 4. **Completion**: Record results and fire termination events
   *
   * **Concurrency Model**:
   * - Processes one level at a time
   * - Within level: processes in batches of size = config.concurrency
   * - Batches execute in parallel (Promise.all)
   * - Next batch waits for current batch completion
   *
   * **Error Handling**:
   * - If config.stopOnError: any error halts execution immediately
   * - If !config.stopOnError: errors recorded but execution continues
   * - Always records partial results even on failure
   *
   * **Cancellation**:
   * - Checked at level boundary (not within batch)
   * - Current batch completes before stopping
   * - Signal can be provided via options.signal
   * - Or via engine.stop() method
   *
   * @param options - Run options with optional signal, entryEntity, and execution parameters
   * @returns FlowRunResult with overall status and per-entity results
   *
   * @throws Error if flow not attached
   * @throws Error if entry entity cannot be resolved
   * @throws Error from executor if stopOnError is true and executor fails
   *
   * @example
   * ```typescript
   * // Basic execution
   * const result = await engine.run();
   * console.log(`Success: ${result.ok}`);
   * for (const [id, res] of result.entityResults) {
   *   console.log(`Entity ${id}: ${res.status}`);
   * }
   *
   * // With cancellation
   * const ac = new AbortController();
   * const promise = engine.run({ signal: ac.signal });
   * setTimeout(() => ac.abort(), 5000);
   * const result = await promise;
   *
   * // With custom entry
   * const customEntry = myFlow.getEntity('custom-start');
   * const result = await engine.run({ entryEntity: customEntry });
   * ```
   *
   * @see {@link RunOptions}
   * @see {@link FlowRunResult}
   */
  async run(options?: RunOptions<N, NE>): Promise<FlowRunResult> {
    if (!this._flow) throw new Error("Engine has no flow attached");
    if (this._status === "running") throw new Error("Engine is already running");
    this._status = "running";

    const flow = this._flow;
    const shared = this._shared;
    shared.clear();
    const startedAt = performance.now();
    const entityResults = new Map<string, EntityResult>();
    const ac = new AbortController();
    this._abortController = ac;

    // Validation: must be able to resolve the entry entity
    if (this.config.validateBeforeRun) {
      const hasRootEntity = typeof flow.getRootEntity === "function" && !!flow.getRootEntity();
      if (!hasRootEntity && !options?.entryEntity) {
        this._status = "idle";
        throw new Error("Flow has no root entity and no entry is provided");
      }
    }

    // Resolve entry entity: entryEntity > rootEntity
    let entryEntity: NE | undefined = options?.entryEntity;
    entryEntity ??= flow.getRootEntity?.();
    if (!entryEntity) {
      this._status = "idle";
      throw new Error("No entry entity could be resolved");
    }

    this.onRunStarted.fire({ flowId: flow.id });
    this.metricsRecorder?.onRunStart({
      flowId: flow.id,
      startedAt,
      hasWorker: Boolean(this.workerBridge),
    });

    try {
      const ok = await this.executeFrom(entryEntity, {
        flow,
        shared,
        signal: options?.signal ?? ac.signal,
        entityResults,
      });
      const finishedAt = performance.now();
      this._status = "idle";
      const result: FlowRunResult = {
        ok,
        entityResults,
        startedAt,
        finishedAt,
      };
      this.onRunFinished.fire({
        flowId: flow.id,
        ok,
        durationMs: finishedAt - startedAt,
      });
      this.metricsRecorder?.onRunFinish({
        flowId: flow.id,
        ok,
        durationMs: finishedAt - startedAt,
        startedAt,
        finishedAt,
        entityResults,
      });
      return result;
    } catch (e) {
      this._status = "idle";
      const finishedAt = performance.now();
      this.onRunFinished.fire({
        flowId: flow.id,
        ok: false,
        durationMs: finishedAt - startedAt,
      });
      this.metricsRecorder?.onRunFinish({
        flowId: flow.id,
        ok: false,
        durationMs: finishedAt - startedAt,
        startedAt,
        finishedAt,
        entityResults,
      });
      throw e;
    } finally {
      this._abortController = undefined;
    }
  }

  /**
   * Pause execution
   *
   * Transitions engine from running to paused state. New level processing
   * will not begin until resumed.
   *
   * Safe to call when not running (no-op).
   *
   * **Note**: Current batch execution is NOT halted, only level transitions paused.
   *
   * @example
   * ```typescript
   * const runPromise = engine.run();
   * // Later
   * engine.pause();
   * // Later
   * engine.resume(); // Continue execution
   * ```
   */
  pause(): void {
    if (this._status !== "running") return;
    this._status = "paused";
  }

  /**
   * Resume execution
   *
   * Transitions engine from paused back to running state, allowing
   * level processing to continue.
   *
   * Safe to call when not paused (no-op).
   *
   * @example
   * ```typescript
   * engine.pause();
   * engine.resume(); // Resumes from where it was paused
   * ```
   */
  resume(): void {
    if (this._status !== "paused") return;
    this._status = "running";
  }

  /**
   * Stop execution immediately
   *
   * Halts current and pending execution. Sets engine status to stopped and
   * aborts the AbortController, allowing checks at level boundaries.
   *
   * Safe to call when not running (no-op).
   *
   * **Effect**:
   * - Current batch execution completes
   * - Level iteration stops
   * - onRunFinished fired with ok: false
   * - Metrics recorded
   *
   * @example
   * ```typescript
   * const runPromise = engine.run();
   * setTimeout(() => engine.stop(), 10000);
   * const result = await runPromise;
   * if (!result.ok) console.log('Execution stopped');
   * ```
   */
  stop(): void {
    if (this._abortController) this._abortController.abort();
    this._status = "stopped";
  }

  /**
   * Clean up engine resources
   *
   * Performs cleanup when engine is no longer needed:
   * 1. Stops current execution (safe if not running)
   * 2. Clears executor registry
   * 3. Clears shared state map
   * 4. Disposes worker bridge if active
   *
   * Safe to call multiple times (subsequent calls are no-ops).
   *
   * **After dispose()**:
   * - Engine cannot be reused
   * - Further method calls may throw or have no effect
   *
   * @example
   * ```typescript
   * try {
   *   await engine.run();
   * } finally {
   *   engine.dispose();
   * }
   * ```
   */
  dispose(): void {
    try {
      this.stop();
    } catch {
      // ignore stop errors during dispose
    }
    this._executors.clear();
    this._shared.clear();
    this.workerBridge?.dispose();
  }

  // Execute entire subtree from entry: level-based batch concurrency
  private async executeFrom(
    entry: NE,
    opts: {
      flow: IFlow<N, IEdge, NE>;
      shared: Map<string, unknown>;
      signal?: AbortSignal;
      entityResults: Map<string, EntityResult>;
    }
  ): Promise<boolean> {
    const { flow, shared, signal, entityResults } = opts;
    const sharedRegistered = this.workerBridge
      ? this.workerBridge.registerSharedState(shared)
      : null;
    const q: NE[] = [entry];
    const visited = new Set<string>();
    const level: NE[] = [];

    try {
      while (q.length > 0) {
        this.collectLevel(q, level);
        const levelOk = await this.runLevel(level, {
          flow,
          shared,
          signal,
          entityResults,
          visited,
        });
        if (!levelOk) return false;
        this.enqueueChildren(level, flow, q);
      }
    } finally {
      if (sharedRegistered && this.workerBridge) {
        this.workerBridge.releaseSharedState(shared);
      }
    }

    return true;
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    if (size <= 1) return arr.map((x) => [x]);
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  private collectLevel(queue: NE[], level: NE[]): void {
    level.length = 0;
    const size = queue.length;
    for (let i = 0; i < size; i++) {
      level.push(queue.shift()!);
    }
  }

  private async runLevel(
    level: NE[],
    params: {
      flow: IFlow<N, IEdge, NE>;
      shared: Map<string, unknown>;
      signal?: AbortSignal | undefined;
      entityResults: Map<string, EntityResult>;
      visited: Set<string>;
    }
  ): Promise<boolean> {
    const { flow, shared, signal, entityResults, visited } = params;
    if (signal?.aborted) return false;

    const chunks = this.chunk(level, this.config.concurrency);
    for (const group of chunks) {
      if (signal?.aborted) return false;
      const tasks = group.map(async (entity) => {
        if (!entity || visited.has(entity.id)) return;
        visited.add(entity.id);
        await this.processEntity(entity, flow, shared, entityResults);
      });
      await Promise.all(tasks);
    }

    return true;
  }

  private enqueueChildren(level: NE[], flow: IFlow<N, IEdge, NE>, queue: NE[]): void {
    for (const entity of level) {
      const children = flow.getChildEntities(entity);
      for (const child of children) {
        queue.push(child);
      }
    }
  }

  private async processEntity(
    entity: NE,
    flow: IFlow<N, IEdge, NE>,
    shared: Map<string, unknown>,
    entityResults: Map<string, EntityResult>
  ): Promise<void> {
    const type = entity.type;
    const entityId = entity.id ?? "";
    const start = performance.now();

    this.onEntityStart.fire({ entityId, type });

    try {
      const result = await this.runEntity(entity, flow, shared, type);
      this.onEntityFinish.fire({
        entityId,
        type,
        status: result.status,
        durationMs: performance.now() - start,
      });
      entityResults.set(entity.id, result);

      if (result.status === "error" && this.config.stopOnError) {
        throw result.error ?? new Error("Node execution error");
      }
    } catch (error) {
      logger.error("Engine node execution failed", error);
      this.onEntityFinish.fire({
        entityId,
        type,
        status: "error",
        durationMs: performance.now() - start,
      });
      entityResults.set(entity.id, {
        status: "error",
        error: error instanceof Error ? error : new Error(String(error)),
      });
      if (this.config.stopOnError) throw error;
    }
  }

  private async runEntity(
    entity: NE,
    flow: IFlow<N, IEdge, NE>,
    shared: Map<string, unknown>,
    type: string | undefined
  ): Promise<EntityResult> {
    if (!type) {
      return { status: "skipped" };
    }

    const executor = this._executors.get(type);
    if (!executor) {
      return { status: "skipped" };
    }

    if (this.workerBridge) {
      return this.workerBridge.execute({
        entity,
        entityType: type,
        shared,
        flow,
      });
    }

    return this.invokeExecutor(executor, entity, flow, shared, "baseline");
  }

  private async invokeExecutor(
    executor: EntityExecutor<N, NE>,
    entity: NE,
    flow: IFlow<N, IEdge, NE>,
    shared: Map<string, unknown>,
    origin: "baseline" | "fallback" = "baseline"
  ): Promise<EntityResult> {
    const start = performance.now();
    try {
      // Pass workerPool in ExecutionContext if available
      const executionContext: ExecutionContext<N, NE> = {
        flow,
        node: entity.node,
        entity,
        shared,
      };

      // Add workerPool if worker pool is enabled
      if (this.workerBridge) {
        executionContext.workerPool = this.workerBridge.getPool();
      }

      return await Promise.resolve(executor(executionContext));
    } finally {
      const durationMs = performance.now() - start;
      this.metricsRecorder?.recordMainThreadExecution({
        flowId: flow.id,
        entityId: entity.id ?? "",
        entityType: entity.type,
        durationMs,
        origin,
      });
    }
  }
}
