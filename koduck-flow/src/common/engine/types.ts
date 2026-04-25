/**
 * Duck Flow Task Execution Engine - Type Definitions
 *
 * Central export point for all engine-related type definitions and interfaces.
 * This module provides the type system for the task execution engine, including:
 *
 * 1. **Engine Configuration** - IEngine setup and behavior control parameters
 * 2. **Task Execution** - EntityExecutor, EntityResult, execution context types
 * 3. **Run Management** - FlowRunResult, EngineStatus, RunOptions types
 * 4. **Worker Bridge** - Worker pool communication types and payloads
 * 5. **Metrics Collection** - Observability and performance tracking types
 * 6. **Event Types** - Lifecycle events for metrics and monitoring
 *
 * ## Architecture Overview
 *
 * The engine type system is organized into two main sections:
 * - `engine-types.ts`: Core execution engine types (IEngine, EntityExecutor, FlowRunResult)
 * - `worker-bridge-types.ts`: Worker pool communication types (FlowEngineWorkerBridge)
 *
 * This structure avoids circular dependencies while maintaining type safety.
 *
 * ## Key Type Categories
 *
 * ### Engine Configuration
 * - `IEngine<N, NE>`: Main engine interface for flow execution
 * - `EngineConfig`: Configuration options for engine setup
 * - `EngineStatus`: Engine lifecycle status (idle, running, completed, error)
 *
 * ### Task Execution
 * - `EntityExecutor<N, NE>`: Task handler function type
 * - `EntityResult`: Execution result with status, output, and error tracking
 * - `RunOptions`: Options for individual flow executions
 *
 * ### Metrics & Observability
 * - `FlowEngineMetricsRecorder`: Metrics collection interface
 * - `FlowEngineRunStartEvent`: Run initialization event
 * - `FlowEngineRunFinishEvent`: Run completion event
 * - `FlowEngineMainThreadExecutionEvent`: Local execution tracking
 *
 * ## Usage Example
 *
 * ```typescript
 * // Import all engine types
 * import type {
 *   IEngine,
 *   EngineConfig,
 *   EntityExecutor,
 *   EntityResult,
 *   FlowRunResult,
 *   FlowEngineMetricsRecorder,
 * } from './types';
 *
 * // Create engine configuration
 * const config: EngineConfig = {
 *   concurrency: 4,
 *   stopOnError: true,
 *   validateBeforeRun: true,
 * };
 *
 * // Define task executor
 * const executor: EntityExecutor<MyNode, MyNodeEntity> = async (entity, shared) => {
 *   return { status: 'success', output: result };
 * };
 * ```
 *
 * @module Engine.Types
 * @see {@link DefaultEngine}
 * @see {@link FlowEngineWorkerBridge}
 * @see {@link FlowEngineMetricsAdapter}
 */

// Export all engine type definitions from the types/ subdirectory
export * from "./types/engine-types";
export * from "./types/worker-bridge-types";

// Re-export worker observer type for metrics integration
import type { FlowEngineWorkerObserver } from "./types/worker-bridge-types";
import type {
  FlowEngineRunStartEvent,
  FlowEngineRunFinishEvent,
  FlowEngineMainThreadExecutionEvent,
} from "./types/engine-types";

/**
 * Metrics Recorder Interface for Engine Observability
 *
 * Adapts engine lifecycle events to metrics collection system.
 * Integrated with OpenTelemetry for distributed tracing and observability.
 *
 * ## Lifecycle Events
 *
 * The recorder tracks three main event types:
 * 1. `onRunStart`: Emitted when engine begins executing a flow
 * 2. `onRunFinish`: Emitted when engine completes flow execution
 * 3. `recordMainThreadExecution`: Emitted for local (non-worker) task execution
 *
 * ## Metrics Collected
 *
 * - Run duration (ms)
 * - Worker task execution count and time
 * - Main thread blocking time
 * - Fallback execution count and time
 * - Entities processed count
 *
 * ## Example
 *
 * ```typescript
 * const recorder: FlowEngineMetricsRecorder = {
 *   onRunStart(event) {
 *     console.log(`Run started for flow: ${event.flowId}`);
 *   },
 *   onRunFinish(event) {
 *     console.log(`Run finished: ${event.durationMs}ms`);
 *   },
 *   recordMainThreadExecution(event) {
 *     console.log(`Executed on main thread: ${event.durationMs}ms`);
 *   },
 *   getWorkerObserver() {
 *     return {
 *       onWorkerTaskSuccess: (event) => {},
 *       onWorkerTaskFallback: (event) => {},
 *     };
 *   },
 * };
 * ```
 *
 * @see {@link FlowEngineMetricsAdapter}
 */
export interface FlowEngineMetricsRecorder {
  /**
   * Called when engine starts executing a flow
   * @param event - Run start event containing flow ID and timing information
   */
  onRunStart(event: FlowEngineRunStartEvent): void;

  /**
   * Called when engine finishes executing a flow
   * @param event - Run finish event containing completion status and metrics
   */
  onRunFinish(event: FlowEngineRunFinishEvent): void;

  /**
   * Records execution of tasks on the main thread (non-worker)
   * @param event - Main thread execution event with duration and execution origin
   */
  recordMainThreadExecution(event: FlowEngineMainThreadExecutionEvent): void;

  /**
   * Retrieves the worker observer for tracking worker pool task execution
   * @returns Worker observer instance if worker pool is configured, undefined otherwise
   */
  getWorkerObserver(): FlowEngineWorkerObserver | undefined;
}
