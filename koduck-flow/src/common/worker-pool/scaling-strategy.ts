/**
 * Scaling Strategy Module
 *
 * Provides flexible and composable scaling strategies for the Worker Pool.
 * Supports multiple decision-making criteria including:
 * - Queue length based scaling
 * - Worker utilization based scaling
 * - Task wait time based scaling
 * - Resource based scaling (memory, CPU)
 *
 * Strategies can be combined with AND/OR logic and weighted scoring.
 *
 * @module ScalingStrategy
 */

/**
 * Metrics snapshot for strategy decision making
 */
export interface PoolMetrics {
  /** Total number of workers in pool */
  totalWorkers: number;
  /** Number of idle workers */
  idleWorkers: number;
  /** Number of busy workers */
  busyWorkers: number;
  /** Current length of task queue */
  queueLength: number;
  /** Total memory usage in MB */
  totalMemory: number;
  /** Average task wait time in ms */
  avgWaitTime: number;
  /** Worker utilization rate (0-1) */
  utilization: number;
  /** Average response time per worker in ms */
  avgResponseTime: number;
}

/**
 * Scaling decision result
 */
export interface ScalingDecision {
  /** Whether to scale up (positive count) or down (negative count) */
  action: "scale-up" | "scale-down" | "none";
  /** Number of workers to add/remove */
  delta: number;
  /** Reason for the decision */
  reason: string;
  /** Confidence score (0-1) */
  confidence: number;
}

/**
 * Scaling strategy configuration
 */
export interface ScalingStrategyConfig {
  /** Strategy type */
  type: "queue-length" | "utilization" | "wait-time" | "composite";
  /** Minimum workers to maintain */
  minWorkers: number;
  /** Maximum workers allowed */
  maxWorkers: number;
  /** Maximum change per scaling operation */
  maxDeltaPerScale: number;
  /** Cooldown time between scaling operations (ms) */
  cooldownMs: number;
  /** Scaling rate limit (max operations per minute) */
  maxScalingOperationsPerMinute: number;
  /** Enable this strategy */
  enabled: boolean;
  /** Strategy-specific configuration */
  config?: Record<string, unknown>;
}

/**
 * Base scaling strategy class
 */
export abstract class ScalingStrategy {
  protected config: ScalingStrategyConfig;

  /**
   * Create a new scaling strategy
   *
   * @param config - Strategy configuration
   */
  constructor(config: ScalingStrategyConfig) {
    this.validateConfig(config);
    this.config = config;
  }

  /**
   * Validate scaling strategy configuration
   *
   * @param config - Configuration to validate
   * @throws Error if configuration is invalid
   */
  protected validateConfig(config: ScalingStrategyConfig): void {
    if (config.minWorkers < 1) {
      throw new Error("minWorkers must be at least 1");
    }
    if (config.maxWorkers < config.minWorkers) {
      throw new Error("maxWorkers must be >= minWorkers");
    }
    if (config.maxDeltaPerScale < 1) {
      throw new Error("maxDeltaPerScale must be at least 1");
    }
    if (config.cooldownMs < 0) {
      throw new Error("cooldownMs must be >= 0");
    }
    if (config.maxScalingOperationsPerMinute < 1) {
      throw new Error("maxScalingOperationsPerMinute must be at least 1");
    }
  }

  /**
   * Make scaling decision based on pool metrics
   *
   * @param metrics - Pool metrics snapshot
   * @returns Scaling decision
   */
  abstract decide(metrics: PoolMetrics): ScalingDecision;

  /**
   * Clamp delta to valid range
   *
   * @param delta - Requested worker count change
   * @param metrics - Current pool metrics
   * @returns Clamped delta within valid bounds
   */
  protected clampDelta(delta: number, metrics: PoolMetrics): number {
    const newTotal = metrics.totalWorkers + delta;

    // Enforce bounds
    if (newTotal > this.config.maxWorkers) {
      return this.config.maxWorkers - metrics.totalWorkers;
    }
    if (newTotal < this.config.minWorkers) {
      return this.config.minWorkers - metrics.totalWorkers;
    }

    // Enforce max delta per scale
    return Math.max(-this.config.maxDeltaPerScale, Math.min(this.config.maxDeltaPerScale, delta));
  }
}

/**
 * Queue length based scaling strategy
 *
 * Scales up when queue grows, scales down when queue shrinks
 */
export class QueueLengthStrategy extends ScalingStrategy {
  private readonly scaleUpThreshold: number;
  private readonly scaleDownThreshold: number;
  private readonly scaleUpWorkers: number;
  private readonly scaleDownWorkers: number;

  /**
   * Create queue length based scaling strategy
   *
   * @param config - Strategy configuration
   */
  constructor(config: ScalingStrategyConfig) {
    super(config);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const strategyConfig = (config.config as any) || {};
    this.scaleUpThreshold = strategyConfig.scaleUpThreshold ?? 10;
    this.scaleDownThreshold = strategyConfig.scaleDownThreshold ?? 2;
    this.scaleUpWorkers = strategyConfig.scaleUpWorkers ?? 2;
    this.scaleDownWorkers = strategyConfig.scaleDownWorkers ?? 1;
  }

  /**
   * Make scaling decision based on queue length
   *
   * @param metrics - Pool metrics snapshot
   * @returns Scaling decision
   */
  decide(metrics: PoolMetrics): ScalingDecision {
    if (!this.config.enabled) {
      return { action: "none", delta: 0, reason: "Strategy disabled", confidence: 0 };
    }

    // Scale up if queue is growing and workers available
    if (metrics.queueLength > this.scaleUpThreshold && metrics.idleWorkers < 1) {
      const delta = this.clampDelta(this.scaleUpWorkers, metrics);
      return {
        action: delta > 0 ? "scale-up" : "none",
        delta,
        reason: `Queue length ${metrics.queueLength} > threshold ${this.scaleUpThreshold}`,
        confidence: Math.min(1, metrics.queueLength / (this.scaleUpThreshold * 2)),
      };
    }

    // Scale down if queue is empty and workers idle
    if (metrics.queueLength < this.scaleDownThreshold && metrics.idleWorkers > 1) {
      const delta = this.clampDelta(-this.scaleDownWorkers, metrics);
      return {
        action: delta < 0 ? "scale-down" : "none",
        delta,
        reason: `Queue length ${metrics.queueLength} < threshold ${this.scaleDownThreshold}`,
        confidence: Math.min(1, 1 - metrics.queueLength / this.scaleDownThreshold),
      };
    }

    return { action: "none", delta: 0, reason: "Queue length within thresholds", confidence: 0 };
  }
}

/**
 * Worker utilization based scaling strategy
 *
 * Scales up when workers heavily utilized, scales down when underutilized
 */
export class UtilizationStrategy extends ScalingStrategy {
  private readonly scaleUpThreshold: number;
  private readonly scaleDownThreshold: number;

  /**
   * Create utilization based scaling strategy
   *
   * @param config - Strategy configuration
   */
  constructor(config: ScalingStrategyConfig) {
    super(config);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const strategyConfig = (config.config as any) || {};
    this.scaleUpThreshold = strategyConfig.scaleUpThreshold ?? 0.8; // 80%
    this.scaleDownThreshold = strategyConfig.scaleDownThreshold ?? 0.3; // 30%
  }

  /**
   * Make scaling decision based on worker utilization
   *
   * @param metrics - Pool metrics snapshot
   * @returns Scaling decision
   */
  decide(metrics: PoolMetrics): ScalingDecision {
    if (!this.config.enabled) {
      return { action: "none", delta: 0, reason: "Strategy disabled", confidence: 0 };
    }

    // Scale up if utilization too high
    if (metrics.utilization > this.scaleUpThreshold) {
      const delta = this.clampDelta(Math.ceil(metrics.totalWorkers * 0.25), metrics);
      return {
        action: delta > 0 ? "scale-up" : "none",
        delta,
        reason: `Utilization ${(metrics.utilization * 100).toFixed(1)}% > threshold ${(this.scaleUpThreshold * 100).toFixed(1)}%`,
        confidence: Math.min(1, metrics.utilization),
      };
    }

    // Scale down if utilization too low
    if (metrics.utilization < this.scaleDownThreshold) {
      const delta = this.clampDelta(Math.max(-1, -Math.floor(metrics.totalWorkers * 0.1)), metrics);
      return {
        action: delta < 0 ? "scale-down" : "none",
        delta,
        reason: `Utilization ${(metrics.utilization * 100).toFixed(1)}% < threshold ${(this.scaleDownThreshold * 100).toFixed(1)}%`,
        confidence: Math.min(1, 1 - metrics.utilization),
      };
    }

    return { action: "none", delta: 0, reason: "Utilization within thresholds", confidence: 0 };
  }
}

/**
 * Task wait time based scaling strategy
 *
 * Scales up when tasks wait too long, scales down when wait time is low
 */
export class WaitTimeStrategy extends ScalingStrategy {
  private readonly scaleUpThreshold: number;
  private readonly scaleDownThreshold: number;

  /**
   * Create wait time based scaling strategy
   *
   * @param config - Strategy configuration
   */
  constructor(config: ScalingStrategyConfig) {
    super(config);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const strategyConfig = (config.config as any) || {};
    this.scaleUpThreshold = strategyConfig.scaleUpThreshold ?? 5000; // 5 seconds
    this.scaleDownThreshold = strategyConfig.scaleDownThreshold ?? 500; // 500ms
  }

  /**
   * Make scaling decision based on task wait time
   *
   * @param metrics - Pool metrics snapshot
   * @returns Scaling decision
   */
  decide(metrics: PoolMetrics): ScalingDecision {
    if (!this.config.enabled) {
      return { action: "none", delta: 0, reason: "Strategy disabled", confidence: 0 };
    }

    // Scale up if average wait time is high
    if (metrics.avgWaitTime > this.scaleUpThreshold) {
      const delta = this.clampDelta(2, metrics);
      return {
        action: delta > 0 ? "scale-up" : "none",
        delta,
        reason: `Wait time ${metrics.avgWaitTime.toFixed(0)}ms > threshold ${this.scaleUpThreshold}ms`,
        confidence: Math.min(
          1,
          Math.max(0, (metrics.avgWaitTime - this.scaleUpThreshold) / this.scaleUpThreshold)
        ),
      };
    }

    // Scale down if average wait time is low
    if (metrics.avgWaitTime < this.scaleDownThreshold && metrics.queueLength === 0) {
      const delta = this.clampDelta(-1, metrics);
      return {
        action: delta < 0 ? "scale-down" : "none",
        delta,
        reason: `Wait time ${metrics.avgWaitTime.toFixed(0)}ms < threshold ${this.scaleDownThreshold}ms`,
        confidence: 0.5,
      };
    }

    return { action: "none", delta: 0, reason: "Wait time within thresholds", confidence: 0 };
  }
}

/**
 * Composite scaling strategy combining multiple strategies
 *
 * Supports AND/OR logic and weighted scoring for complex decisions
 */
export class CompositeScalingStrategy extends ScalingStrategy {
  private readonly strategies: Array<{ strategy: ScalingStrategy; weight: number }> = [];
  private readonly combineMode: "AND" | "OR" | "WEIGHTED";

  /**
   * Create composite scaling strategy
   *
   * @param config - Strategy configuration
   * @param combineMode - How to combine strategies (AND/OR/WEIGHTED)
   */
  constructor(config: ScalingStrategyConfig, combineMode: "AND" | "OR" | "WEIGHTED" = "WEIGHTED") {
    super(config);
    this.combineMode = combineMode;
  }

  /**
   * Add a strategy to the composite
   *
   * @param strategy - Strategy to add
   * @param weight - Weight for weighted combination
   */
  addStrategy(strategy: ScalingStrategy, weight: number = 1): void {
    if (weight <= 0) {
      throw new Error("Strategy weight must be > 0");
    }
    this.strategies.push({ strategy, weight });
  }

  /**
   * Remove a strategy from the composite
   *
   * @param strategy - Strategy to remove
   */
  removeStrategy(strategy: ScalingStrategy): void {
    const idx = this.strategies.findIndex((s) => s.strategy === strategy);
    if (idx >= 0) {
      this.strategies.splice(idx, 1);
    }
  }

  /**
   * Make scaling decision by combining strategies
   *
   * @param metrics - Pool metrics snapshot
   * @returns Scaling decision
   */
  decide(metrics: PoolMetrics): ScalingDecision {
    if (!this.config.enabled || this.strategies.length === 0) {
      return {
        action: "none",
        delta: 0,
        reason: "Composite strategy empty or disabled",
        confidence: 0,
      };
    }

    const decisions = this.strategies.map((s) => ({
      decision: s.strategy.decide(metrics),
      weight: s.weight,
    }));

    switch (this.combineMode) {
      case "AND":
        return this.combineAND(decisions, metrics);
      case "OR":
        return this.combineOR(decisions);
      case "WEIGHTED":
      default:
        return this.combineWeighted(decisions, metrics);
    }
  }

  /**
   * AND combination - all strategies must agree
   *
   * @param decisions - Decisions from all strategies
   * @param metrics - Pool metrics snapshot
   * @returns Combined scaling decision
   */
  private combineAND(
    decisions: Array<{ decision: ScalingDecision; weight: number }>,
    metrics: PoolMetrics
  ): ScalingDecision {
    const allDecisions = decisions.map((d) => d.decision);

    // Check if all strategies recommend the same action (including "none")
    if (allDecisions.length === 0) {
      return { action: "none", delta: 0, reason: "No strategies available", confidence: 0 };
    }

    const firstAction = allDecisions[0].action;

    // All must have the same action
    if (!allDecisions.every((d) => d.action === firstAction)) {
      return { action: "none", delta: 0, reason: "Strategies conflict", confidence: 0 };
    }

    // If all agree on "none", return none
    if (firstAction === "none") {
      return {
        action: "none",
        delta: 0,
        reason: "All strategies recommend no action",
        confidence: 0,
      };
    }

    // All agree on scale-up or scale-down - use minimum delta magnitude for safety
    const deltas = allDecisions.map((d) => d.delta);
    const minDelta = Math.min(...deltas.map(Math.abs));
    const delta = this.clampDelta(minDelta * (firstAction === "scale-up" ? 1 : -1), metrics);
    const confidence = allDecisions.reduce((acc, d) => acc + d.confidence, 0) / allDecisions.length;

    return {
      action: firstAction,
      delta,
      reason: `All strategies agree on ${firstAction}`,
      confidence,
    };
  }

  /**
   * OR combination - any strategy recommending action
   *
   * @param decisions - Decisions from all strategies
   * @returns Combined scaling decision
   */
  private combineOR(
    decisions: Array<{ decision: ScalingDecision; weight: number }>
  ): ScalingDecision {
    const validDecisions = decisions.map((d) => d.decision).filter((d) => d.action !== "none");

    if (validDecisions.length === 0) {
      return { action: "none", delta: 0, reason: "No strategies recommend action", confidence: 0 };
    }

    // Pick decision with highest confidence
    let best = validDecisions[0];
    for (const d of validDecisions) {
      if (d.confidence > best.confidence) {
        best = d;
      }
    }

    return best;
  }

  /**
   * Weighted combination - weighted average of decisions
   *
   * @param decisions - Decisions from all strategies
   * @param metrics - Pool metrics snapshot
   * @returns Combined scaling decision
   */
  private combineWeighted(
    decisions: Array<{ decision: ScalingDecision; weight: number }>,
    metrics: PoolMetrics
  ): ScalingDecision {
    let totalWeight = 0;
    let scaleUpWeight = 0;
    let scaleDownWeight = 0;

    for (const { decision, weight } of decisions) {
      totalWeight += weight;
      if (decision.action === "scale-up") {
        scaleUpWeight += weight * decision.confidence;
      } else if (decision.action === "scale-down") {
        scaleDownWeight += weight * decision.confidence;
      }
    }

    if (totalWeight === 0) {
      return { action: "none", delta: 0, reason: "No weighted decisions", confidence: 0 };
    }

    const scaleUpScore = scaleUpWeight / totalWeight;
    const scaleDownScore = scaleDownWeight / totalWeight;

    if (scaleUpScore > 0.5) {
      const delta = this.clampDelta(Math.ceil(metrics.totalWorkers * 0.2), metrics);
      return {
        action: "scale-up",
        delta,
        reason: `Weighted score for scale-up: ${(scaleUpScore * 100).toFixed(1)}%`,
        confidence: scaleUpScore,
      };
    }

    if (scaleDownScore > 0.5) {
      const delta = this.clampDelta(-Math.max(1, Math.floor(metrics.totalWorkers * 0.1)), metrics);
      return {
        action: "scale-down",
        delta,
        reason: `Weighted score for scale-down: ${(scaleDownScore * 100).toFixed(1)}%`,
        confidence: scaleDownScore,
      };
    }

    return { action: "none", delta: 0, reason: "No clear consensus", confidence: 0 };
  }
}

/**
 * Scaling strategy factory for creating strategies from configuration
 */
export class ScalingStrategyFactory {
  /**
   * Create a scaling strategy from configuration
   *
   * @param config - Strategy configuration
   * @returns New scaling strategy instance
   */
  static createStrategy(config: ScalingStrategyConfig): ScalingStrategy {
    switch (config.type) {
      case "queue-length":
        return new QueueLengthStrategy(config);
      case "utilization":
        return new UtilizationStrategy(config);
      case "wait-time":
        return new WaitTimeStrategy(config);
      case "composite":
        return new CompositeScalingStrategy(config);
      default:
        throw new Error(`Unknown scaling strategy type: ${config.type}`);
    }
  }

  /**
   * Create a preset strategy configuration
   *
   * @param preset - Preset type (aggressive/moderate/conservative)
   * @param minWorkers - Minimum workers
   * @param maxWorkers - Maximum workers
   * @returns Strategy configuration
   */
  static createPreset(
    preset: "aggressive" | "moderate" | "conservative",
    minWorkers: number = 2,
    maxWorkers: number = 16
  ): ScalingStrategyConfig {
    switch (preset) {
      case "aggressive":
        return {
          type: "queue-length",
          minWorkers,
          maxWorkers,
          maxDeltaPerScale: 4,
          cooldownMs: 1000,
          maxScalingOperationsPerMinute: 30,
          enabled: true,
          config: {
            scaleUpThreshold: 5,
            scaleDownThreshold: 1,
            scaleUpWorkers: 3,
            scaleDownWorkers: 2,
          },
        };
      case "conservative":
        return {
          type: "utilization",
          minWorkers,
          maxWorkers,
          maxDeltaPerScale: 1,
          cooldownMs: 30000,
          maxScalingOperationsPerMinute: 2,
          enabled: true,
          config: {
            scaleUpThreshold: 0.9,
            scaleDownThreshold: 0.2,
          },
        };
      case "moderate":
      default:
        return {
          type: "composite",
          minWorkers,
          maxWorkers,
          maxDeltaPerScale: 2,
          cooldownMs: 5000,
          maxScalingOperationsPerMinute: 10,
          enabled: true,
        };
    }
  }
}
