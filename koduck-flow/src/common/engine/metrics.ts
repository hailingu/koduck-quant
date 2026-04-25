/**
 * Engine Metrics Collection & Observability
 *
 * This module provides metrics collection for task execution engine monitoring.
 * Implements OpenTelemetry integration for distributed tracing and observability.
 *
 * ## Features
 *
 * 1. **Run Lifecycle Tracking**
 * - Run duration measurement
 * - Blocking time calculation (main thread + fallback execution)
 * - Entities processed count
 *
 * 2. **Execution Path Metrics**
 * - Worker task execution count and time
 * - Main thread execution count and time
 * - Fallback execution count and time
 * - Worker failure tracking
 *
 * 3. **OpenTelemetry Integration**
 * - Histogram: engine.run.duration (ms)
 * - Histogram: engine.run.blocking_time (ms)
 * - Counter: engine.worker.execution.count
 * - Counter: engine.worker.fallback.count
 *
 * 4. **Event Snapshot System**
 * - Captures detailed metrics for each run
 * - Supports custom snapshot callbacks
 * - Provides snapshot history for analysis
 *
 * ## Usage Example
 *
 * ```typescript
 * const metricsAdapter = new FlowEngineMetricsAdapter({
 *   scope: 'my-app-engine',
 *   attributes: {
 *     service: 'data-processor',
 *     version: '1.0.0',
 *   },
 *   onSnapshot: (snapshot) => {
 *     console.log(`Run ${snapshot.flowId} completed:`);
 *     console.log(`  Duration: ${snapshot.runDurationMs}ms`);
 *     console.log(`  Worker executions: ${snapshot.workerExecutions}`);
 *     console.log(`  Blocking time: ${snapshot.blockingTimeMs}ms`);
 *     // Send to observability backend
 *     sendToDatadog(snapshot);
 *   },
 * });
 *
 * // Attach to engine
 * metricsAdapter.attach(engine);
 *
 * // Later: detach if needed
 * metricsAdapter.detach();
 * ```
 *
 * ## Integration Pattern
 *
 * The adapter follows the Observer pattern:
 * 1. Engine emits lifecycle events (onRunStart, onRunFinish)
 * 2. Engine records execution events (recordMainThreadExecution)
 * 3. Worker pool reports task results (via workerObserver)
 * 4. Adapter aggregates data and creates run snapshot
 * 5. Optional callback receives snapshot for external processing
 *
 * @module Engine.Metrics
 */

import { meter, ScopedMeter, type Attributes } from "../metrics";
import type {
  FlowEngineMainThreadExecutionEvent,
  FlowEngineMetricsRecorder,
  FlowEngineRunFinishEvent,
  FlowEngineRunStartEvent,
} from "./types";
import type {
  FlowEngineWorkerObserver,
  FlowEngineWorkerTaskFallbackEvent,
  FlowEngineWorkerTaskSuccessEvent,
} from "./worker-bridge";

/**
 * Run Execution Metrics Snapshot
 *
 * Complete metrics for a single flow execution, capturing all performance data:
 * execution paths, durations, failure counts, and blocking times.
 *
 * @example
 * ```typescript
 * const snapshot: FlowEngineRunSnapshot = {
 *   flowId: 'flow-123',
 *   ok: true,
 *   hasWorker: true,
 *   runDurationMs: 1500,
 *   entitiesProcessed: 25,
 *   workerExecutions: 20,
 *   workerFailures: 2,
 *   workerTimeMs: 1200,
 *   mainThreadExecutions: 5,
 *   mainThreadTimeMs: 250,
 *   fallbackExecutions: 2,
 *   fallbackTimeMs: 80,
 *   blockingTimeMs: 330,  // mainThread + fallback
 * };
 * ```
 *
 * @property flowId - Unique flow identifier for this execution
 * @property ok - Whether execution completed successfully (all entities processed)
 * @property hasWorker - Whether worker pool was used for this run
 * @property runDurationMs - Total execution time in milliseconds
 * @property startedAt - Unix timestamp when run started
 * @property finishedAt - Unix timestamp when run finished
 * @property entitiesProcessed - Total number of entities executed
 * @property workerExecutions - Number of successful worker task executions
 * @property workerFailures - Number of worker task failures (fallback triggered)
 * @property workerTimeMs - Total time spent in worker pool execution
 * @property mainThreadExecutions - Number of entities executed on main thread
 * @property mainThreadTimeMs - Total time for main thread execution
 * @property fallbackExecutions - Number of fallback executions (after worker failure)
 * @property fallbackTimeMs - Total time for fallback execution
 * @property blockingTimeMs - Total main thread blocking time (mainThread + fallback)
 */
export interface FlowEngineRunSnapshot {
  flowId: string;
  ok: boolean;
  hasWorker: boolean;
  runDurationMs: number;
  startedAt: number;
  finishedAt: number;
  entitiesProcessed: number;
  workerExecutions: number;
  workerFailures: number;
  workerTimeMs: number;
  mainThreadExecutions: number;
  mainThreadTimeMs: number;
  fallbackExecutions: number;
  fallbackTimeMs: number;
  blockingTimeMs: number;
}

/**
 * Configuration Options for Metrics Adapter
 *
 * Controls metrics collection behavior and OpenTelemetry integration.
 *
 * @example
 * ```typescript
 * const options: FlowEngineMetricsAdapterOptions = {
 *   scope: 'my-service-engine',
 *   attributes: {
 *     environment: 'production',
 *     region: 'us-west-2',
 *   },
 *   onSnapshot: (snapshot) => {
 *     console.log(`Flow ${snapshot.flowId}: ${snapshot.runDurationMs}ms`);
 *   },
 * };
 * ```
 *
 * @property scope - OpenTelemetry meter scope name (default: 'flow-engine')
 * @property attributes - Additional context attributes for all metrics
 * @property onSnapshot - Optional callback invoked after each run completes
 */
export interface FlowEngineMetricsAdapterOptions {
  /** OpenTelemetry meter scope name for metric categorization */
  scope?: string;
  /** Context attributes added to all metrics (environment, region, service, etc.) */
  attributes?: Attributes;
  /** Callback invoked when run completes with full metrics snapshot */
  onSnapshot?: (snapshot: FlowEngineRunSnapshot) => void;
}

/**
 * Current Run State Tracking
 *
 * Internal state machine for tracking metrics during active flow execution.
 * Maintains counters for all execution paths and durations.
 *
 * @internal
 */
interface CurrentRunState {
  /** Flow identifier being executed */
  flowId: string;
  /** Whether worker pool is configured for this run */
  hasWorker: boolean;
  /** Unix timestamp when run started */
  startedAt: number;
  /** Running counter of successful worker executions */
  workerExecutions: number;
  /** Running counter of worker failures (fallback triggered) */
  workerFailures: number;
  /** Accumulated worker execution time in milliseconds */
  workerTimeMs: number;
  /** Running counter of main thread executions */
  mainThreadExecutions: number;
  /** Accumulated main thread execution time */
  mainThreadTimeMs: number;
  /** Running counter of fallback executions (after worker failure) */
  fallbackExecutions: number;
  /** Accumulated fallback execution time */
  fallbackTimeMs: number;
}

/**
 * Engine Metrics Collection Adapter
 *
 * Implements the FlowEngineMetricsRecorder interface to collect engine metrics
 * and integrate with OpenTelemetry. Tracks execution paths, timing, and failures
 * for observability and performance analysis.
 *
 * ## Key Metrics
 *
 * **Histograms** (timing distributions):
 * - `engine.run.duration`: Total execution time per run
 * - `engine.run.blocking_time`: Main thread blocking time (local + fallback)
 *
 * **Counters** (event counts):
 * - `engine.worker.execution.count`: Successful worker executions
 * - `engine.worker.fallback.count`: Fallback executions (worker failures)
 *
 * ## State Management
 *
 * The adapter maintains a state machine for each active run:
 * - `onRunStart`: Initialize current run state
 * - Event processing: Accumulate execution metrics
 * - `onRunFinish`: Create final snapshot and record metrics
 *
 * ## Example
 *
 * ```typescript
 * // Create adapter
 * const adapter = new FlowEngineMetricsAdapter({
 *   scope: 'data-processor',
 *   attributes: { service: 'worker-1' },
 *   onSnapshot: (snapshot) => {
 *     console.log(`Flow ${snapshot.flowId}:`);
 *     console.log(`  Duration: ${snapshot.runDurationMs}ms`);
 *     console.log(`  Blocking: ${snapshot.blockingTimeMs}ms`);
 *     console.log(`  Worker: ${snapshot.workerExecutions}/${snapshot.entitiesProcessed}`);
 *   },
 * });
 *
 * // Attach to engine
 * adapter.attach(engine);
 *
 * // Engine automatically calls adapter methods during execution
 * ```
 */
export class FlowEngineMetricsAdapter implements FlowEngineMetricsRecorder {
  private readonly scoped: ScopedMeter;
  private readonly runDurationHistogram;
  private readonly blockingHistogram;
  private readonly workerExecutionCounter;
  private readonly workerFallbackCounter;
  private readonly workerObserverImpl: FlowEngineWorkerObserver;
  private readonly onSnapshot: ((snapshot: FlowEngineRunSnapshot) => void) | undefined;

  private currentRun: CurrentRunState | undefined;
  private readonly snapshots: FlowEngineRunSnapshot[] = [];
  private attachedEngine:
    | { registerMetricsRecorder(recorder: FlowEngineMetricsRecorder | undefined): void }
    | undefined;

  /**
   * Create a new metrics adapter
   *
   * Initializes OpenTelemetry metrics (histograms and counters) and sets up
   * the worker pool observer for tracking task execution.
   *
   * @param options - Configuration options for scope, attributes, and snapshot callback
   *
   * @example
   * ```typescript
   * const adapter = new FlowEngineMetricsAdapter({
   *   scope: 'my-app-engine',
   *   attributes: { pod: 'worker-1' },
   *   onSnapshot: (snapshot) => {
   *     // Process snapshot
   *   },
   * });
   * ```
   */
  constructor(options?: FlowEngineMetricsAdapterOptions) {
    const scopedAttributes: Attributes = {
      component: "flow-engine",
      ...options?.attributes,
    };
    this.scoped = new ScopedMeter(meter(options?.scope ?? "flow-engine"), scopedAttributes);
    this.runDurationHistogram = this.scoped.histogram("engine.run.duration", {
      description: "FlowEngine 单次 run 总耗时",
      unit: "ms",
    });
    this.blockingHistogram = this.scoped.histogram("engine.run.blocking_time", {
      description: "主线程阻塞时间（本地执行 + 回退）",
      unit: "ms",
    });
    this.workerExecutionCounter = this.scoped.counter("engine.worker.execution.count", {
      description: "Worker 成功执行次数",
    });
    this.workerFallbackCounter = this.scoped.counter("engine.worker.fallback.count", {
      description: "Worker 回退次数",
    });
    this.onSnapshot = options?.onSnapshot;

    this.workerObserverImpl = {
      onWorkerTaskSuccess: (event: FlowEngineWorkerTaskSuccessEvent) => {
        if (!this.currentRun) return;
        this.currentRun.workerExecutions += 1;
        this.currentRun.workerTimeMs += event.durationMs;
      },
      onWorkerTaskFallback: (event: FlowEngineWorkerTaskFallbackEvent) => {
        if (!this.currentRun) return;
        this.currentRun.workerFailures += 1;
        this.currentRun.workerTimeMs += event.workerDurationMs;
      },
    } satisfies FlowEngineWorkerObserver;
  }

  /**
   * Attach adapter to engine for metrics collection
   *
   * Registers this adapter with the engine so it receives lifecycle events.
   * Only one adapter can be attached at a time; attaching a new adapter
   * automatically detaches the previous one.
   *
   * @param engine - Engine instance to attach metrics adapter to
   * @param engine.registerMetricsRecorder - Method to register metrics recorder
   *
   * @example
   * ```typescript
   * const adapter = new FlowEngineMetricsAdapter();
   * adapter.attach(engine);
   * // Now engine fires events to adapter
   * ```
   */
  attach(engine: {
    registerMetricsRecorder(recorder: FlowEngineMetricsRecorder | undefined): void;
  }): void {
    if (this.attachedEngine) {
      this.detach();
    }
    this.attachedEngine = engine;
    engine.registerMetricsRecorder(this);
  }

  /**
   * Detach adapter from engine
   *
   * Unregisters the adapter so it no longer receives lifecycle events.
   * Safe to call even if not currently attached.
   *
   * @example
   * ```typescript
   * adapter.detach();
   * // Engine no longer sends events to adapter
   * ```
   */
  detach(): void {
    if (!this.attachedEngine) {
      return;
    }
    this.attachedEngine.registerMetricsRecorder(undefined);
    this.attachedEngine = undefined;
  }

  /**
   * Called when engine starts executing a flow
   *
   * Initializes the current run state tracking. Called once per flow execution.
   *
   * @param event - Run start event with flow ID and timing
   *
   * @internal
   */
  onRunStart(event: FlowEngineRunStartEvent): void {
    this.currentRun = {
      flowId: event.flowId,
      hasWorker: event.hasWorker,
      startedAt: event.startedAt,
      workerExecutions: 0,
      workerFailures: 0,
      workerTimeMs: 0,
      mainThreadExecutions: 0,
      mainThreadTimeMs: 0,
      fallbackExecutions: 0,
      fallbackTimeMs: 0,
    } satisfies CurrentRunState;
  }

  /**
   * Called when engine finishes executing a flow
   *
   * Aggregates collected metrics into a snapshot and records OpenTelemetry metrics.
   * Invokes the snapshot callback if provided during adapter creation.
   *
   * @param event - Run finish event with flow ID, status, and duration
   *
   * @internal
   */
  onRunFinish(event: FlowEngineRunFinishEvent): void {
    const runState = this.currentRun;
    if (!runState) {
      return;
    }

    const blockingTimeMs = runState.mainThreadTimeMs + runState.fallbackTimeMs;
    const snapshot: FlowEngineRunSnapshot = {
      flowId: event.flowId,
      ok: event.ok,
      hasWorker: runState.hasWorker,
      runDurationMs: event.durationMs,
      startedAt: event.startedAt,
      finishedAt: event.finishedAt,
      entitiesProcessed: event.entityResults.size,
      workerExecutions: runState.workerExecutions,
      workerFailures: runState.workerFailures,
      workerTimeMs: runState.workerTimeMs,
      mainThreadExecutions: runState.mainThreadExecutions,
      mainThreadTimeMs: runState.mainThreadTimeMs,
      fallbackExecutions: runState.fallbackExecutions,
      fallbackTimeMs: runState.fallbackTimeMs,
      blockingTimeMs,
    };

    this.snapshots.push(snapshot);
    this.onSnapshot?.(snapshot);

    this.runDurationHistogram.record(snapshot.runDurationMs);
    this.blockingHistogram.record(snapshot.blockingTimeMs);
    this.workerExecutionCounter.add(snapshot.workerExecutions);
    this.workerFallbackCounter.add(snapshot.workerFailures);

    this.currentRun = undefined;
  }

  /**
   * Records execution of tasks on the main thread
   *
   * Tracks timing for tasks executed locally (not in worker pool).
   * Called for both baseline and fallback executions.
   *
   * @param event - Execution event with duration and execution origin
   *
   * @internal
   */
  recordMainThreadExecution(event: FlowEngineMainThreadExecutionEvent): void {
    const runState = this.currentRun;
    if (!runState) {
      return;
    }

    if (event.origin === "fallback") {
      runState.fallbackExecutions += 1;
      runState.fallbackTimeMs += event.durationMs;
    } else {
      runState.mainThreadExecutions += 1;
      runState.mainThreadTimeMs += event.durationMs;
    }
  }

  /**
   * Get worker pool observer for task execution tracking
   *
   * Returns the observer that tracks worker pool task successes and failures.
   * Should be registered with the worker pool to receive execution events.
   *
   * @returns Worker observer instance with task event handlers
   */
  getWorkerObserver(): FlowEngineWorkerObserver {
    return this.workerObserverImpl;
  }

  /**
   * Get all collected run snapshots
   *
   * Returns a copy of the snapshot history. Snapshots are accumulated
   * until explicitly cleared.
   *
   * @returns Array of run snapshots from current session
   */
  getSnapshots(): FlowEngineRunSnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Get the most recent run snapshot
   *
   * Convenience method for accessing the latest metrics snapshot.
   *
   * @returns Last snapshot if available, undefined if no runs completed
   */
  getLastSnapshot(): FlowEngineRunSnapshot | undefined {
    return this.snapshots.at(-1);
  }

  /**
   * Clear all collected snapshots
   *
   * Removes snapshot history. Useful for resetting metrics between
   * analysis sessions or to free memory.
   *
   * @example
   * ```typescript
   * // Analyze snapshots
   * const snapshots = adapter.getSnapshots();
   * analyzePerformance(snapshots);
   *
   * // Reset for next batch
   * adapter.clearSnapshots();
   * ```
   */
  clearSnapshots(): void {
    this.snapshots.length = 0;
  }
}
