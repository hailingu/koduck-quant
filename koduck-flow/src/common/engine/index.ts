/**
 * Koduck Flow Task Execution Engine
 *
 * The Engine module is the core execution system for Koduck Flow, responsible for:
 * - Task dispatch and scheduling
 * - Worker pool integration and fallback execution
 * - Lifecycle management (run start → entity execution → run finish)
 * - Metrics collection and observability
 * - Error handling and recovery strategies
 *
 * ## Architecture Overview
 *
 * The engine operates as a coordinator between the flow graph and task executors:
 *
 * ```
 * Flow Graph → Engine → [Worker Pool → Workers]
 *                    ↓
 *                 [Fallback Path → Main Thread]
 *                    ↓
 *              Metrics Recorder → Observability
 * ```
 *
 * ### Execution Flow
 *
 * 1. **Run Initialization** (onRunStarted event)
 *    - Engine validates flow structure
 *    - Initializes metrics recording
 *    - Prepares worker pool if configured
 *
 * 2. **Entity Execution** (batched or sequential)
 *    - For each entity:
 *      a. Try worker execution (if available)
 *      b. On failure: fallback to main thread execution
 *    - Fire onEntityStart and onEntityFinish events
 *    - Track metrics (duration, status, errors)
 *
 * 3. **Run Completion** (onRunFinished event)
 *    - Collect final metrics
 *    - Aggregate results
 *    - Fire completion event
 *
 * ## Configuration
 *
 * ```typescript
 * const engine = new DefaultEngine({
 *   concurrency: 4,                    // Parallel entities per batch
 *   stopOnError: true,                 // Halt on first error
 *   validateBeforeRun: true,           // Validate flow structure
 *   strictEntityGraph: false,          // Enforce DAG property
 *   worker: {
 *     pool: workerPool,                // Worker pool instance
 *     taskTimeoutMs: 30000,            // Task timeout
 *   }
 * });
 * ```
 *
 * ## Execution Patterns
 *
 * ### 1. Sequential Execution
 * ```typescript
 * const result = await engine.run(flow, {
 *   concurrency: 1,  // Process one entity at a time
 * });
 * ```
 *
 * ### 2. Batch Parallel Execution
 * ```typescript
 * const result = await engine.run(flow, {
 *   concurrency: 4,  // Process up to 4 entities in parallel
 * });
 * ```
 *
 * ### 3. With Worker Pool
 * ```typescript
 * const result = await engine.run(flow, {
 *   concurrency: 4,
 *   useWorker: true,  // Use worker pool for execution
 * });
 * // If worker fails, automatically falls back to main thread
 * ```
 *
 * ### 4. Event Monitoring
 * ```typescript
 * engine.onRunStarted.on(({ flowId }) => {
 *   console.log(`Started running flow: ${flowId}`);
 * });
 *
 * engine.onEntityStart.on(({ entityId, type }) => {
 *   console.log(`Executing entity ${entityId} (type: ${type})`);
 * });
 *
 * engine.onEntityFinish.on(({ entityId, status, durationMs }) => {
 *   console.log(`Entity ${entityId} finished: ${status} (${durationMs}ms)`);
 * });
 *
 * engine.onRunFinished.on(({ flowId, ok, durationMs }) => {
 *   console.log(`Flow ${flowId} completed: ${ok ? 'success' : 'failed'} (${durationMs}ms)`);
 * });
 * ```
 *
 * ## Error Handling
 *
 * The engine supports multiple error handling strategies:
 *
 * **Strategy 1: Stop on Error**
 * ```typescript
 * const engine = new DefaultEngine({ stopOnError: true });
 * // Execution halts on first entity error
 * ```
 *
 * **Strategy 2: Continue on Error**
 * ```typescript
 * const engine = new DefaultEngine({ stopOnError: false });
 * // Continue executing remaining entities despite errors
 * ```
 *
 * **Strategy 3: Worker Fallback**
 * - Worker execution fails → Automatic fallback to main thread
 * - Main thread execution = guaranteed execution (except OOM/fatal errors)
 *
 * **Error Taxonomy**
 * - `execution`: Executor function threw error
 * - `timeout`: Task exceeded timeout duration
 * - `worker_error`: Worker pool unavailable or crashed
 * - `validation`: Flow structure or configuration error
 *
 * ## Performance Characteristics
 *
 * | Operation | Complexity | Notes |
 * |-----------|-----------|-------|
 * | Run initialization | O(n) | n = entity count, validates DAG |
 * | Entity execution | O(1) | Executor function only |
 * | Metrics recording | O(1) | Amortized with batching |
 * | Batch scheduling | O(b) | b = batch size |
 * | Total run time | O(n) | Sequential/batched depending on concurrency |
 *
 * ## Integration with Other Systems
 *
 * ### Flow Module
 * - Receives flow graph (IFlow<N, IEdge, NE>)
 * - Traverses node hierarchy
 * - Respects edge constraints
 *
 * ### Worker Pool
 * - Delegates heavy computation to workers
 * - Handles worker failures gracefully
 * - Measures worker vs main-thread performance
 *
 * ### Metrics System
 * - Records run duration and entity timings
 * - Tracks worker vs fallback execution
 * - Publishes OpenTelemetry metrics
 *
 * ## Complete Usage Example
 *
 * ```typescript
 * import { DefaultEngine, type IEngine, type EntityExecutor } from './engine';
 * import type { IFlow, INode, IFlowNodeEntity } from '../flow/types';
 *
 * // 1. Create engine instance
 * const engine = new DefaultEngine<MyNode>({
 *   concurrency: 4,
 *   stopOnError: false,
 *   validateBeforeRun: true,
 *   worker: { pool: myWorkerPool },
 * });
 *
 * // 2. Register executors
 * const processExecutor: EntityExecutor<MyNode> = async (entity, shared) => {
 *   const processed = await heavyComputation(entity.data);
 *   return { status: 'success', output: processed };
 * };
 * engine.registerExecutor('process', processExecutor);
 *
 * // 3. Subscribe to lifecycle events
 * engine.onRunStarted.on(({ flowId }) => {
 *   console.log(`🚀 Started: ${flowId}`);
 * });
 *
 * engine.onRunFinished.on(({ flowId, ok, durationMs }) => {
 *   if (ok) {
 *     console.log(`✅ Completed in ${durationMs}ms`);
 *   } else {
 *     console.log(`❌ Failed after ${durationMs}ms`);
 *   }
 * });
 *
 * // 4. Execute flow
 * const result = await engine.run(myFlow, {
 *   concurrency: 4,
 *   useWorker: true,
 * });
 *
 * // 5. Check results
 * if (result.ok) {
 *   console.log('All entities processed successfully');
 *   result.entityResults.forEach((entityResult, entityId) => {
 *     console.log(`Entity ${entityId}: ${entityResult.status}`);
 *   });
 * } else {
 *   console.log('Some entities failed:');
 *   result.failedEntities.forEach(({ entityId, error }) => {
 *     console.error(`Entity ${entityId}: ${error.message}`);
 *   });
 * }
 *
 * // 6. Cleanup
 * engine.dispose();
 * ```
 *
 * ## Cancellation
 *
 * Execution can be cancelled using an AbortController:
 * ```typescript
 * const abortController = new AbortController();
 *
 * // Start execution
 * const runPromise = engine.run(flow, {
 *   signal: abortController.signal,
 * });
 *
 * // Cancel after 5 seconds
 * setTimeout(() => abortController.abort(), 5000);
 *
 * try {
 *   await runPromise;
 * } catch (error) {
 *   if (error instanceof DOMException && error.name === 'AbortError') {
 *     console.log('Execution cancelled');
 *   }
 * }
 * ```
 *
 * ## Best Practices
 *
 * 1. **Always register required executors** before calling run()
 * 2. **Set appropriate timeouts** (taskTimeoutMs) based on task complexity
 * 3. **Monitor metrics** for performance analysis and optimization
 * 4. **Handle errors gracefully** - use stopOnError: false for resilience
 * 5. **Use worker pool** for CPU-intensive tasks
 * 6. **Clean up resources** by calling dispose() when done
 * 7. **Track execution events** for debugging and monitoring
 *
 * @module Engine
 *
 * @see {@link DefaultEngine} Main engine implementation
 * @see {@link FlowEngineWorkerBridge} Worker pool communication layer
 * @see {@link FlowEngineMetricsAdapter} Observability integration
 * @see {@link IEngine} Engine interface definition
 *
 * @example
 * ```typescript
 * // Quick start
 * const engine = new DefaultEngine({ concurrency: 4 });
 * engine.registerExecutor('task', async (entity) => ({
 *   status: 'success',
 *   output: await processEntity(entity),
 * }));
 * const result = await engine.run(myFlow);
 * console.log(result.ok ? '✅ Success' : '❌ Failed');
 * ```
 */

export * from "./types";
export * from "./default-engine";
export * from "./metrics";
