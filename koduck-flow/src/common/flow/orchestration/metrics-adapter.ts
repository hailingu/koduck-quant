/**
 * @module orchestration/metrics-adapter
 * @description Metrics adapter layer for Flow operations
 */

import type { Attributes } from "../../metrics";
import { FlowMetrics } from "../metrics";

/**
 * Result of a timed operation, containing the operation result and duration in milliseconds.
 */
export interface TimingResult<T> {
  /** Value returned by the wrapped function */
  readonly result: T;
  /** Duration of the wrapped function in milliseconds */
  readonly duration: number;
}

/**
 * MetricsAdapter - Adapter for FlowMetrics
 */
export class MetricsAdapter {
  private readonly metrics: FlowMetrics;

  /**
   * Constructor
   * @param metricsInstance - The underlying FlowMetrics instance
   */
  constructor(metricsInstance: FlowMetrics) {
    this.metrics = metricsInstance;
  }

  /**
   * Get underlying FlowMetrics instance
   * @returns The metrics instance
   */
  getUnderlying(): FlowMetrics {
    return this.metrics;
  }

  /**
   * Wrap a synchronous function with timing measurement.
   *
   * @template T - Return type of the wrapped function
   * @param _label - Logical label for the operation (reserved for future use)
   * @param fn - Function to execute and measure
   * @returns Operation result paired with the measured duration
   */
  withTiming<T>(_label: string, fn: () => T): TimingResult<T> {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;
    return { result, duration };
  }

  /**
   * Record entity creation timing and counters.
   *
   * @param type - Entity type identifier
   * @param duration - Creation duration in milliseconds
   */
  recordEntityCreated(type: string, duration: number): void {
    this.metrics.recordEntityCreated(type, duration);
  }

  /**
   * Record node addition metrics.
   *
   * @param duration - Operation duration in milliseconds
   * @param added - Whether the node was successfully added
   */
  recordNodeAddition(duration: number, added: boolean): void {
    this.metrics.recordNodeAddition(duration, added);
  }

  /**
   * Record graph link failure.
   *
   * @param mode - Failure mode identifier
   * @param extra - Optional dimensional attributes
   */
  recordGraphLinkFailure(mode: string, extra?: Attributes): void {
    this.metrics.recordGraphLinkFailure(mode, extra);
  }

  /**
   * Record traversal operation timing.
   *
   * @param duration - Traversal duration in milliseconds
   */
  recordTraversal(duration: number): void {
    this.metrics.recordTraversal(duration);
  }

  /**
   * Record serialization metrics.
   *
   * @param entityCount - Number of entities included in the serialization snapshot
   * @param duration - Serialization duration in milliseconds
   */
  recordSerialization(entityCount: number, duration: number): void {
    this.metrics.recordSerialization(duration, entityCount);
  }

  /**
   * Record successful flow load completion metrics.
   *
   * @param duration - Deserialization duration in milliseconds
   */
  recordFlowLoaded(duration: number): void {
    this.metrics.recordFlowLoaded(duration);
  }

  /**
   * Record entity removal timing and counters.
   *
   * @param duration - Removal duration in milliseconds
   * @param removed - Whether the entity was successfully removed
   */
  recordEntityRemoval(duration: number, removed: boolean): void {
    this.metrics.recordEntityRemoval(duration, removed);
  }

  /**
   * Record successful graph link operation.
   *
   * @param mode - Link mode identifier for categorization
   * @param extra - Optional additional attributes for metrics dimensions
   */
  recordGraphLinkSuccess(mode: string, extra?: Attributes): void {
    this.metrics.recordGraphLinkSuccess(mode, extra);
  }

  /**
   * Record graph link error message length.
   *
   * @param length - Error message length
   */
  recordGraphLinkErrorLength(length: number): void {
    this.metrics.recordGraphLinkErrorLength(length);
  }
}
