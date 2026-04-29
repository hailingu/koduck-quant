/**
 * @module metrics
 * @description Performance metrics collection and monitoring for Flow operations.
 *
 * This module provides the {@link FlowMetrics} class for recording various performance
 * metrics throughout the flow lifecycle including creation, entity management, serialization,
 * and graph operations. Supports configurable sampling and batch submission for
 * efficient metric collection with minimal performance overhead.
 *
 * ## Key Responsibilities
 * - **Metric Recording**: Record counters, histograms, and gauges for flow operations
 * - **Sampling Control**: Configurable sampling rates to reduce metric volume
 * - **Batch Submission**: Queue metrics for batched submission to reduce overhead
 * - **Observable Gauges**: Track real-time entity counts with callbacks
 * - **Performance Optimization**: Balance observability with performance impact
 * - **Error Handling**: Graceful failure handling for metric operations
 *
 * ## Supported Metrics
 * - **Flow Lifecycle**: Flow creation, disposal, loading events
 * - **Entity Operations**: Entity creation, removal, updates with timing
 * - **Graph Operations**: Link success/failure, error tracking
 * - **Edge Management**: Edge entity creation and lifecycle
 * - **Serialization**: Serialization duration and entity counts
 * - **Traversal**: Graph traversal count and duration
 * - **Batch Operations**: Batch update size and timing
 *
 * ## Architecture Patterns
 * - **Scoped Meter**: Use scoped meters for contextual metric grouping
 * - **Sampling Strategy**: Default 10% sampling to reduce metric overhead
 * - **Batch Flushing**: Automatic periodic flushing or manual on-demand
 * - **Observable Providers**: Dynamic gauges via callback functions
 * - **Dual Mode**: Support for immediate or batched submission
 *
 * ## Design Features
 * - Sampling rate (0-1) prevents metric spam while maintaining observability
 * - Automatic batch flushing via configurable interval timers
 * - Observable gauges for real-time count monitoring
 * - Error recovery with console.error logging
 * - Graceful handling of disposed metrics
 * - Type-safe attribute tracking with Attributes type
 *
 * ## Usage Example
 * ```typescript
 * // Create metrics with custom sampling and batching
 * const metrics = new FlowMetrics({
 *   samplingRate: 0.5,      // 50% sampling
 *   batchEnabled: true,      // Enable batching
 *   batchFlushInterval: 2000 // Flush every 2 seconds
 * });
 *
 * // Register entity count provider
 * metrics.registerEntityGauge(() => entityCount);
 *
 * // Record operations
 * metrics.markFlowCreated();
 * metrics.recordNodeAddition(123, true);
 * metrics.recordSerialization(456, 50);
 *
 * // Manual flush for batched metrics
 * await metrics.flushMetrics();
 *
 * // Cleanup
 * metrics.dispose();
 * ```
 *
 * @see {@link ScopedMeter} for scoped meter operations
 * @see {@link Attributes} for metric attributes typing
 * @see {@link Observation} for observable gauge observations
 */

import { ScopedMeter, meter } from "../metrics";
import { getConfig } from "../config/loader";
import type { Attributes, ObservableGauge, Observation } from "../metrics";

/**
 * Provider function type for dynamic count queries
 *
 * @returns Current count value for gauge observations
 */
type CountProvider = () => number;

/**
 * Batch container for metrics pending submission
 *
 * @property counters - Map of counter names to accumulated values and attributes
 * @property histograms - Map of histogram names to list of recorded values and attributes
 *
 * @description
 * - Enables efficient batching of metric records
 * - Values accumulated before batch flush
 * - Attributes stored with each measurement for dimension tracking
 */
interface MetricsBatch {
  counters: Map<string, { value: number; attrs?: Attributes | undefined }>;
  histograms: Map<string, Array<{ value: number; attrs?: Attributes | undefined }>>;
}

/**
 * FlowMetrics - Performance metrics collection and monitoring system
 *
 * Manages comprehensive metric recording for flow operations with configurable
 * sampling and batch submission capabilities. Provides both counter and histogram
 * metrics plus observable gauges for real-time monitoring.
 *
 * ## Key Features
 * - **Sampling Support**: Configurable sampling rate (default 10%) to reduce overhead
 * - **Batch Mode**: Queue metrics for periodic batch submission
 * - **Observable Gauges**: Dynamic gauge callbacks for real-time counts
 * - **Comprehensive Coverage**: Track flow lifecycle, entities, graph, edges
 * - **Graceful Degradation**: Errors logged, operations continue
 * - **Resource Cleanup**: Proper disposal of timers and callbacks
 *
 * ## Metric Categories
 * - **Flow Events**: Creation, disposal, loading with timing
 * - **Entity Lifecycle**: Addition, removal, creation, updates
 * - **Batch Operations**: Batch update size and duration tracking
 * - **Graph Operations**: Link success/failure, error length tracking
 * - **Edge Management**: Edge entity creation and lifecycle
 * - **Serialization**: Serialization timing and entity counts
 * - **Traversal**: Traversal count and duration metrics
 *
 * ## Configuration
 * - samplingRate: 0-1 (default 0.1 = 10% sampling)
 * - batchEnabled: boolean (default false = immediate submission)
 * - batchFlushInterval: milliseconds (default from config)
 *
 * @example
 * ```typescript
 * // Standard usage with defaults
 * const metrics = new FlowMetrics();
 * metrics.markFlowCreated();
 * metrics.recordNodeAddition(100, true);
 * metrics.dispose();
 *
 * // Batched metrics with custom sampling
 * const batchedMetrics = new FlowMetrics({
 *   samplingRate: 0.5,
 *   batchEnabled: true,
 *   batchFlushInterval: 5000
 * });
 *
 * // Track entity gauge
 * batchedMetrics.registerEntityGauge(() => entities.length);
 * await batchedMetrics.flushMetrics();
 * batchedMetrics.dispose();
 * ```
 */
export class FlowMetrics {
  private readonly scoped: ScopedMeter;
  private entitiesGauge: ObservableGauge | undefined;
  private entitiesGaugeCallback: ((observe: (o: Observation) => void) => void) | undefined;
  private entityCountProvider: CountProvider | undefined;

  // Performance optimization: sampling and batching
  private samplingRate = 0.1; // Sample 10% of operations by default
  private batchEnabled = false;
  private pendingBatch: MetricsBatch = {
    counters: new Map(),
    histograms: new Map(),
  };
  private batchFlushTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly batchFlushInterval: number;

  /**
   * Constructor
   *
   * Initializes metrics collection with optional sampling, batching, and flush interval configuration.
   * Starts automatic batch flushing if batching is enabled.
   *
   * @param options - Optional configuration
   * @param options.samplingRate - Sampling rate 0-1 (default: 0.1 = 10%)
   * @param options.batchEnabled - Enable batch mode (default: false)
   * @param options.batchFlushInterval - Batch flush interval in milliseconds
   *
   * @description
   * - Creates scoped meter for organized metric grouping
   * - Loads default batch interval from config if not provided
   * - Starts batch flushing timer if batching enabled
   * - Sampling rate 0 = no sampling (all recorded), 1 = 100% sampling (all recorded)
   * - Use samplingRate 0.1-0.5 to reduce metric volume in production
   *
   * @example
   * ```typescript
   * // Default configuration (10% sampling, no batching)
   * const metrics = new FlowMetrics();
   *
   * // Custom configuration with batching
   * const batchedMetrics = new FlowMetrics({
   *   samplingRate: 0.05,  // 5% sampling
   *   batchEnabled: true,
   *   batchFlushInterval: 5000 // 5 second flush interval
   * });
   * ```
   */
  constructor(options?: {
    samplingRate?: number;
    batchEnabled?: boolean;
    batchFlushInterval?: number;
  }) {
    this.scoped = new ScopedMeter(meter("flow"), { component: "Flow" });
    const config = getConfig();

    if (options?.samplingRate !== undefined) {
      this.samplingRate = options.samplingRate;
    }
    if (options?.batchEnabled !== undefined) {
      this.batchEnabled = options.batchEnabled;
    }
    // Use default values from config if options are not provided
    this.batchFlushInterval = options?.batchFlushInterval ?? config.event.batchInterval;

    if (this.batchEnabled) {
      this.startBatchFlushing();
    }
  }

  /**
   * Record flow creation event
   *
   * Increments the flow.created counter.
   * Called when a new flow instance is created.
   */
  markFlowCreated(): void {
    this.scoped.counter("flow.created").add(1);
  }

  /**
   * Record flow disposal event
   *
   * Increments the flow.disposed counter.
   * Called when a flow instance is disposed/destroyed.
   */
  markFlowDisposed(): void {
    this.scoped.counter("flow.disposed").add(1);
  }

  /**
   * Register entity count gauge with provider callback
   *
   * Sets up an observable gauge that calls provider to get current entity count.
   * Replaces any existing gauge if previously registered.
   *
   * @param provider - Function that returns current entity count
   *
   * @description
   * - Disposes previous gauge if one exists
   * - Creates new observable gauge "entities.count"
   * - Adds callback that calls provider and observes value
   * - Useful for real-time entity count monitoring
   * - Called periodically by metric collection backend
   *
   * @example
   * ```typescript
   * metrics.registerEntityGauge(() => registry.countEntities().nodeCount);
   * ```
   */
  registerEntityGauge(provider: CountProvider): void {
    this.disposeEntityGauge();
    this.entityCountProvider = provider;
    const gauge = this.scoped.observableGauge("entities.count", {
      description: "Number of flow entities currently managed",
      unit: "count",
    });
    const cb = (observe: (o: Observation) => void) => this.observeEntities(observe);
    gauge.addCallback(cb);
    this.entitiesGauge = gauge;
    this.entitiesGaugeCallback = cb;
  }

  /**
   * Record graph traversal operation
   *
   * Records traversal count and duration metrics.
   *
   * @param duration - Traversal duration in milliseconds
   *
   * @description
   * - Increments traverse.count counter
   * - Records traverse.duration.ms histogram with duration value
   * - Subject to sampling configuration
   */
  recordTraversal(duration: number): void {
    this.recordCounter("traverse.count", 1);
    this.recordHistogram("traverse.duration.ms", duration, { unit: "ms" });
  }

  /**
   * Record node addition event
   *
   * @param duration - Operation duration in milliseconds
   * @param added - Whether node addition succeeded
   *
   * @description
   * - Conditionally records node.added counter (only if added=true)
   * - Always records node.add.duration.ms histogram
   * - Tracks both success and timing metrics
   */
  recordNodeAddition(duration: number, added: boolean): void {
    this.recordCounter("node.added", added ? 1 : 0);
    this.recordHistogram("node.add.duration.ms", duration, { unit: "ms" });
  }

  /**
   * Record entity removal event
   *
   * @param duration - Operation duration in milliseconds
   * @param removed - Whether removal succeeded
   *
   * @description
   * - Conditionally records entity.removed counter (only if removed=true)
   * - Always records entity.remove.duration.ms histogram
   * - Tracks removal success and timing
   */
  recordEntityRemoval(duration: number, removed: boolean): void {
    if (removed) {
      this.recordCounter("entity.removed", 1);
    }
    this.recordHistogram("entity.remove.duration.ms", duration, { unit: "ms" });
  }

  /**
   * Record entity removal event (immediate recording)
   *
   * Directly records entity removal without duration info.
   * Use recordEntityRemoval() for detailed timing.
   */
  recordEntityRemoved(): void {
    this.scoped.counter("entity.removed").add(1);
  }

  /**
   * Record entity creation event
   *
   * @param type - Entity type being created
   * @param duration - Creation operation duration in milliseconds
   *
   * @description
   * - Increments entity.created counter with type attribute
   * - Records entity.create.duration.ms histogram with type dimension
   * - Type attribute enables per-type performance tracking
   *
   * @example
   * ```typescript
   * metrics.recordEntityCreated('FlowNode', 50);
   * ```
   */
  recordEntityCreated(type: string, duration: number): void {
    const attrs = { type } satisfies Attributes;
    this.recordCounter("entity.created", 1, attrs);
    this.recordHistogram("entity.create.duration.ms", duration, {
      unit: "ms",
      ...attrs,
    });
  }

  /**
   * Record entity creation cancellation
   *
   * @param type - Entity type that failed to create
   *
   * @description
   * - Increments entity.create.cancelled counter with type attribute
   * - Tracks which entity types encounter creation issues
   */
  recordEntityCreationCancelled(type: string): void {
    this.recordCounter("entity.create.cancelled", 1, { type });
  }

  /**
   * Record entity update event
   *
   * @param duration - Update operation duration in milliseconds
   * @param updated - Whether update succeeded
   *
   * @description
   * - Conditionally records entity.updated counter (only if updated=true)
   * - Always records entity.update.duration.ms histogram
   * - Tracks update success and timing
   */
  recordEntityUpdate(duration: number, updated: boolean): void {
    if (updated) {
      this.recordCounter("entity.updated", 1);
    }
    this.recordHistogram("entity.update.duration.ms", duration, { unit: "ms" });
  }

  /**
   * Record batch entity update operation
   *
   * @param size - Number of entities in batch
   * @param duration - Total batch update duration in milliseconds
   *
   * @description
   * - Increments entity.batch_update.count counter
   * - Records entity.batch_update.size histogram with batch size
   * - Records entity.batch_update.duration.ms histogram with total time
   * - Useful for tracking bulk operation performance
   */
  recordEntityBatchUpdate(size: number, duration: number): void {
    this.scoped.counter("entity.batch_update.count").add(1);
    this.scoped.histogram("entity.batch_update.size", { unit: "count" }).record(size);
    this.scoped.histogram("entity.batch_update.duration.ms", { unit: "ms" }).record(duration);
  }

  /**
   * Record flow serialization event
   *
   * @param duration - Serialization duration in milliseconds
   * @param entityCount - Number of entities serialized
   *
   * @description
   * - Records serialize.duration.ms histogram
   * - Records serialize.entities.count histogram for volume tracking
   * - Useful for identifying serialization bottlenecks
   */
  recordSerialization(duration: number, entityCount: number): void {
    this.scoped.histogram("serialize.duration.ms", { unit: "ms" }).record(duration);
    this.scoped.histogram("serialize.entities.count", { unit: "count" }).record(entityCount);
  }

  /**
   * Record flow loading completion
   *
   * @param duration - Load operation duration in milliseconds
   *
   * @description
   * - Increments flow.loaded counter
   * - Records load.duration.ms histogram
   * - Called after flow is successfully loaded from storage
   */
  recordFlowLoaded(duration: number): void {
    this.scoped.counter("flow.loaded").add(1);
    this.scoped.histogram("load.duration.ms", { unit: "ms" }).record(duration);
  }

  /**
   * Record successful graph link operation
   *
   * @param mode - Link mode identifier for categorization
   * @param extra - Optional additional attributes for metrics dimensions
   *
   * @description
   * - Increments graph.link.success counter
   * - Includes mode attribute for link type tracking
   * - Supports extra attributes for flexible dimensioning
   */
  recordGraphLinkSuccess(mode: string, extra?: Attributes): void {
    this.scoped.counter("graph.link.success").add(1, {
      mode,
      ...extra,
    });
  }

  /**
   * Record failed graph link operation
   *
   * @param mode - Link mode identifier
   * @param extra - Optional additional attributes
   *
   * @description
   * - Increments graph.link.failed counter
   * - Tracks link failures by mode for debugging
   */
  recordGraphLinkFailure(mode: string, extra?: Attributes): void {
    this.scoped.counter("graph.link.failed").add(1, {
      mode,
      ...extra,
    });
  }

  /**
   * Record graph link error message length
   *
   * @param length - Length of error message
   *
   * @description
   * - Records graph.link.error.length histogram
   * - Useful for identifying verbose error messages
   */
  recordGraphLinkErrorLength(length: number): void {
    this.scoped.histogram("graph.link.error.length").record(length);
  }

  /**
   * Record graph link removal event
   *
   * Increments graph.link.removed counter.
   * Called when a graph link is disconnected.
   */
  recordGraphLinkRemoved(): void {
    this.scoped.counter("graph.link.removed").add(1);
  }

  /**
   * Record edge entity creation failure
   *
   * @param type - Edge entity type that failed
   *
   * @description
   * - Increments edge.entity.create.failed counter with type
   * - Tracks edge creation failures by type
   */
  recordEdgeEntityCreateFailed(type: string): void {
    this.scoped.counter("edge.entity.create.failed").add(1, { type });
  }

  /**
   * Record invalid edge entity creation attempt
   *
   * @param type - Edge entity type that is invalid
   *
   * @description
   * - Increments edge.entity.create.invalid counter with type
   * - Distinguishes from creation failure (invalid vs. failed)
   */
  recordEdgeEntityCreateInvalid(type: string): void {
    this.scoped.counter("edge.entity.create.invalid").add(1, { type });
  }

  /**
   * Record successful edge entity creation
   *
   * @param type - Edge entity type created
   * @param duration - Creation duration in milliseconds
   *
   * @description
   * - Increments edge.entity.created counter with type
   * - Records edge.entity.create.duration.ms histogram with type dimension
   * - Tracks per-type edge creation performance
   */
  recordEdgeEntityCreated(type: string, duration: number): void {
    const attrs = { type } satisfies Attributes;
    this.scoped.counter("edge.entity.created").add(1, attrs);
    this.scoped.histogram("edge.entity.create.duration.ms", { unit: "ms" }).record(duration, attrs);
  }

  /**
   * Record edge entity addition event
   *
   * Increments edge.entity.added counter.
   * Called when an edge entity is added to the graph.
   */
  recordEdgeEntityAdded(): void {
    this.scoped.counter("edge.entity.added").add(1);
  }

  /**
   * Record edge entity removal event
   *
   * Increments edge.entity.removed counter.
   * Called when an edge entity is removed from the graph.
   */
  recordEdgeEntityRemoved(): void {
    this.scoped.counter("edge.entity.removed").add(1);
  }

  /**
   * Cleanup and dispose metrics
   *
   * Disposes entity gauge and stops batch flushing if enabled.
   * Should be called when metrics are no longer needed.
   *
   * @description
   * - Removes entity gauge and its callback
   * - Stops batch flush timer if running
   * - Should be called before discarding metrics instance
   * - Essential for cleanup to prevent resource leaks
   *
   * @example
   * ```typescript
   * metrics.dispose();
   * // metrics no longer usable after disposal
   * ```
   */
  dispose(): void {
    this.disposeEntityGauge();
    this.stopBatchFlushing();
  }

  /**
   * Set sampling rate for metric recording
   *
   * @param rate - Sampling rate between 0 and 1 (0=no sampling, 1=always sample)
   *
   * @description
   * - Clamps rate to valid range [0, 1]
   * - Lower rates reduce metric volume in production (e.g., 0.1 = 10%)
   * - Useful for production deployments with high operation volumes
   * - Changes apply to subsequent recordings
   *
   * @example
   * ```typescript
   * metrics.setSamplingRate(0.05); // 5% sampling
   * ```
   */
  setSamplingRate(rate: number): void {
    this.samplingRate = Math.max(0, Math.min(1, rate));
  }

  /**
   * Enable or disable batch mode
   *
   * @param enabled - true to enable batching, false to disable
   *
   * @description
   * - Starts or stops batch flushing based on enabled state
   * - No-op if state hasn't changed
   * - Enabling starts automatic flush timer
   * - Disabling stops timer and flushes remaining metrics
   * - Useful for toggling batching at runtime
   *
   * @example
   * ```typescript
   * metrics.setBatchEnabled(true);  // Enable batch mode
   * metrics.setBatchEnabled(false); // Disable and flush
   * ```
   */
  setBatchEnabled(enabled: boolean): void {
    if (enabled === this.batchEnabled) return;
    this.batchEnabled = enabled;
    if (enabled) {
      this.startBatchFlushing();
    } else {
      this.stopBatchFlushing();
    }
  }

  /**
   * Manually flush pending metrics
   *
   * Submits all pending batched metrics to the meter.
   * No-op if batching is not enabled.
   *
   * @returns Promise resolving when flush completes
   *
   * @description
   * - Only flushes if batch mode enabled
   * - Submits both pending counters and histograms
   * - Clears batch queue after submission
   * - Safe to call multiple times
   * - Non-blocking async operation
   *
   * @example
   * ```typescript
   * const metrics = new FlowMetrics({ batchEnabled: true });
   * // ... queue metrics ...
   * await metrics.flushMetrics(); // Flush all pending
   * ```
   */
  async flushMetrics(): Promise<void> {
    if (!this.batchEnabled) return;

    // Algorithm: Drain-and-swap pattern for lock-free metric flushing
    // 1. Capture current batch (atomic operation in single-threaded JS)
    // 2. Create new empty batch for incoming metrics
    // 3. Process captured batch asynchronously without blocking new metrics
    // Benefits: Allows concurrent recording while flushing in background
    const batch = this.pendingBatch;
    this.pendingBatch = {
      counters: new Map(),
      histograms: new Map(),
    };

    // Step 1: Submit all accumulated counters
    // Each counter represents sum of values for a metric over the batch period
    // Attributes carry dimension data (e.g., entity_type, operation_result)
    for (const [key, data] of batch.counters) {
      const counter = this.scoped.counter(key);
      if (data.attrs !== undefined) {
        counter.add(data.value, data.attrs);
      } else {
        counter.add(data.value);
      }
    }

    // Step 2: Submit all accumulated histogram values
    // Histogram values represent duration/latency measurements
    // Multiple values can be recorded per histogram (for each operation invocation)
    // Each value is submitted separately to preserve distribution information
    for (const [key, values] of batch.histograms) {
      const hist = this.scoped.histogram(key);
      for (const { value, attrs } of values) {
        if (attrs !== undefined) {
          hist.record(value, attrs);
        } else {
          hist.record(value);
        }
      }
    }
  }

  /**
   * Check if current operation should be sampled
   */
  private shouldSample(): boolean {
    return Math.random() < this.samplingRate;
  }

  /**
   * Record a counter value (with sampling and batching support)
   * @param name
   * @param value
   * @param attrs
   */
  private recordCounter(name: string, value: number, attrs?: Attributes): void {
    if (!this.shouldSample()) return;

    if (this.batchEnabled) {
      const existing = this.pendingBatch.counters.get(name);
      if (existing) {
        existing.value += value;
        if (attrs !== undefined) {
          existing.attrs = attrs;
        }
      } else {
        this.pendingBatch.counters.set(name, attrs !== undefined ? { value, attrs } : { value });
      }
    } else {
      const counter = this.scoped.counter(name);
      if (attrs !== undefined) {
        counter.add(value, attrs);
      } else {
        counter.add(value);
      }
    }
  }

  /**
   * Record a histogram value (with sampling and batching support)
   * @param name
   * @param value
   * @param attrs
   */
  private recordHistogram(name: string, value: number, attrs?: Attributes): void {
    if (!this.shouldSample()) return;

    if (this.batchEnabled) {
      const existing = this.pendingBatch.histograms.get(name);
      if (existing) {
        existing.push(attrs !== undefined ? { value, attrs } : { value });
      } else {
        this.pendingBatch.histograms.set(name, [
          attrs !== undefined ? { value, attrs } : { value },
        ]);
      }
    } else {
      const histogram = this.scoped.histogram(name);
      if (attrs !== undefined) {
        histogram.record(value, attrs);
      } else {
        histogram.record(value);
      }
    }
  }

  private startBatchFlushing(): void {
    this.batchFlushTimer = setInterval(() => {
      this.flushMetrics().catch((error) => {
        console.error("Failed to flush metrics:", error);
      });
    }, this.batchFlushInterval);
  }

  private stopBatchFlushing(): void {
    if (this.batchFlushTimer) {
      clearInterval(this.batchFlushTimer);
      this.batchFlushTimer = undefined;
    }
    // Flush remaining metrics
    this.flushMetrics().catch((error) => {
      console.error("Failed to flush final metrics:", error);
    });
  }

  private observeEntities(observe: (o: Observation) => void): void {
    const provider = this.entityCountProvider;
    if (!provider) return;
    const value = provider();
    observe({ value });
  }

  private disposeEntityGauge(): void {
    const gauge = this.entitiesGauge;
    const cb = this.entitiesGaugeCallback;
    if (gauge && cb) {
      gauge.removeCallback(cb);
    }
    this.entitiesGauge = undefined;
    this.entitiesGaugeCallback = undefined;
  }
}
