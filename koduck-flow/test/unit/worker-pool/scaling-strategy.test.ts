/**
 * Unit tests for Scaling Strategies
 *
 * Tests cover:
 * - Queue length based strategy
 * - Worker utilization based strategy
 * - Task wait time based strategy
 * - Composite strategy combinations (AND/OR/WEIGHTED)
 * - Configuration validation
 * - Boundary limits enforcement
 * - Scaling decision accuracy
 */

import { describe, expect, it } from "vitest";
import {
  CompositeScalingStrategy,
  QueueLengthStrategy,
  ScalingStrategyFactory,
  UtilizationStrategy,
  WaitTimeStrategy,
  type PoolMetrics,
  type ScalingStrategyConfig,
} from "../../../src/common/worker-pool/scaling-strategy";

describe("Scaling Strategies", () => {
  // Test metrics
  const createMetrics = (overrides: Partial<PoolMetrics> = {}): PoolMetrics => ({
    totalWorkers: 4,
    idleWorkers: 2,
    busyWorkers: 2,
    queueLength: 5,
    totalMemory: 100,
    avgWaitTime: 1000,
    utilization: 0.5,
    avgResponseTime: 100,
    ...overrides,
  });

  // Test config
  const createConfig = (
    type: ScalingStrategyConfig["type"],
    overrides: Partial<ScalingStrategyConfig> = {}
  ): ScalingStrategyConfig => ({
    type,
    minWorkers: 2,
    maxWorkers: 16,
    maxDeltaPerScale: 2,
    cooldownMs: 1000,
    maxScalingOperationsPerMinute: 10,
    enabled: true,
    ...overrides,
  });

  describe("Configuration Validation", () => {
    it("should reject minWorkers < 1", () => {
      expect(() => {
         
        const _s = new QueueLengthStrategy(createConfig("queue-length", { minWorkers: 0 }));
      }).toThrow("minWorkers must be at least 1");
    });

    it("should reject maxWorkers < minWorkers", () => {
      expect(() => {
         
        const _s = new QueueLengthStrategy(
          createConfig("queue-length", { minWorkers: 10, maxWorkers: 5 })
        );
      }).toThrow("maxWorkers must be >= minWorkers");
    });

    it("should reject maxDeltaPerScale < 1", () => {
      expect(() => {
         
        const _s = new QueueLengthStrategy(createConfig("queue-length", { maxDeltaPerScale: 0 }));
      }).toThrow("maxDeltaPerScale must be at least 1");
    });

    it("should reject cooldownMs < 0", () => {
      expect(() => {
         
        const _s = new QueueLengthStrategy(createConfig("queue-length", { cooldownMs: -1 }));
      }).toThrow("cooldownMs must be >= 0");
    });

    it("should reject maxScalingOperationsPerMinute < 1", () => {
      expect(() => {
         
        const _s = new QueueLengthStrategy(
          createConfig("queue-length", { maxScalingOperationsPerMinute: 0 })
        );
      }).toThrow("maxScalingOperationsPerMinute must be at least 1");
    });

    it("should accept valid configuration", () => {
      const strategy = new QueueLengthStrategy(createConfig("queue-length"));
      expect(strategy).toBeDefined();
    });
  });

  describe("QueueLengthStrategy", () => {
    it("should scale up when queue exceeds threshold and no idle workers", () => {
      const strategy = new QueueLengthStrategy(
        createConfig("queue-length", { config: { scaleUpThreshold: 5 } })
      );
      const metrics = createMetrics({ queueLength: 10, idleWorkers: 0 });

      const decision = strategy.decide(metrics);

      expect(decision.action).toBe("scale-up");
      expect(decision.delta).toBeGreaterThan(0);
      expect(decision.confidence).toBeGreaterThan(0);
    });

    it("should not scale up when idle workers available", () => {
      const strategy = new QueueLengthStrategy(
        createConfig("queue-length", { config: { scaleUpThreshold: 5 } })
      );
      const metrics = createMetrics({ queueLength: 10, idleWorkers: 2 });

      const decision = strategy.decide(metrics);

      expect(decision.action).toBe("none");
    });

    it("should scale down when queue is empty and workers idle", () => {
      const strategy = new QueueLengthStrategy(
        createConfig("queue-length", { config: { scaleDownThreshold: 2 } })
      );
      const metrics = createMetrics({ queueLength: 0, idleWorkers: 3 });

      const decision = strategy.decide(metrics);

      expect(decision.action).toBe("scale-down");
      expect(decision.delta).toBeLessThan(0);
    });

    it("should not scale when queue within thresholds", () => {
      const strategy = new QueueLengthStrategy(
        createConfig("queue-length", { config: { scaleUpThreshold: 20, scaleDownThreshold: 1 } })
      );
      const metrics = createMetrics({ queueLength: 5, idleWorkers: 1 });

      const decision = strategy.decide(metrics);

      expect(decision.action).toBe("none");
    });

    it("should respect disabled flag", () => {
      const strategy = new QueueLengthStrategy(
        createConfig("queue-length", { enabled: false, config: { scaleUpThreshold: 1 } })
      );
      const metrics = createMetrics({ queueLength: 100, idleWorkers: 0 });

      const decision = strategy.decide(metrics);

      expect(decision.action).toBe("none");
      expect(decision.confidence).toBe(0);
    });
  });

  describe("UtilizationStrategy", () => {
    it("should scale up when utilization exceeds threshold", () => {
      const strategy = new UtilizationStrategy(
        createConfig("utilization", { config: { scaleUpThreshold: 0.8 } })
      );
      const metrics = createMetrics({ utilization: 0.9 });

      const decision = strategy.decide(metrics);

      expect(decision.action).toBe("scale-up");
      expect(decision.delta).toBeGreaterThan(0);
      expect(decision.confidence).toBeGreaterThan(0);
    });

    it("should scale down when utilization below threshold", () => {
      const strategy = new UtilizationStrategy(
        createConfig("utilization", {
          minWorkers: 1,
          config: { scaleDownThreshold: 0.3, scaleUpThreshold: 0.8 },
        })
      );
      // Use 16 workers so that 10% = 1.6, floor to 1
      const metrics = createMetrics({ utilization: 0.1, totalWorkers: 16 });

      const decision = strategy.decide(metrics);

      expect(decision.action).toBe("scale-down");
      expect(decision.delta).toBeLessThan(0);
    });

    it("should not scale when utilization within thresholds", () => {
      const strategy = new UtilizationStrategy(
        createConfig("utilization", { config: { scaleUpThreshold: 0.8, scaleDownThreshold: 0.3 } })
      );
      const metrics = createMetrics({ utilization: 0.5 });

      const decision = strategy.decide(metrics);

      expect(decision.action).toBe("none");
    });

    it("should increase confidence with higher utilization", () => {
      const strategy = new UtilizationStrategy(
        createConfig("utilization", { config: { scaleUpThreshold: 0.8 } })
      );
      const highUtilization = strategy.decide(createMetrics({ utilization: 0.95 }));
      const lowUtilization = strategy.decide(createMetrics({ utilization: 0.81 }));

      expect(highUtilization.confidence).toBeGreaterThan(lowUtilization.confidence);
    });
  });

  describe("WaitTimeStrategy", () => {
    it("should scale up when wait time exceeds threshold", () => {
      const strategy = new WaitTimeStrategy(
        createConfig("wait-time", { config: { scaleUpThreshold: 1000 } })
      );
      const metrics = createMetrics({ avgWaitTime: 2000 });

      const decision = strategy.decide(metrics);

      expect(decision.action).toBe("scale-up");
      expect(decision.delta).toBeGreaterThan(0);
    });

    it("should scale down when wait time low and queue empty", () => {
      const strategy = new WaitTimeStrategy(
        createConfig("wait-time", { config: { scaleDownThreshold: 500, scaleUpThreshold: 5000 } })
      );
      const metrics = createMetrics({ avgWaitTime: 100, queueLength: 0 });

      const decision = strategy.decide(metrics);

      expect(decision.action).toBe("scale-down");
      expect(decision.delta).toBeLessThan(0);
    });

    it("should not scale down if queue not empty", () => {
      const strategy = new WaitTimeStrategy(
        createConfig("wait-time", { config: { scaleDownThreshold: 500 } })
      );
      const metrics = createMetrics({ avgWaitTime: 100, queueLength: 5 });

      const decision = strategy.decide(metrics);

      expect(decision.action).toBe("none");
    });

    it("should not scale when wait time within thresholds", () => {
      const strategy = new WaitTimeStrategy(
        createConfig("wait-time", { config: { scaleUpThreshold: 5000, scaleDownThreshold: 500 } })
      );
      const metrics = createMetrics({ avgWaitTime: 1000, queueLength: 0 });

      const decision = strategy.decide(metrics);

      expect(decision.action).toBe("none");
    });
  });

  describe("Boundary Limits", () => {
    it("should clamp delta to maxDeltaPerScale", () => {
      const strategy = new QueueLengthStrategy(
        createConfig("queue-length", { maxDeltaPerScale: 1, config: { scaleUpWorkers: 5 } })
      );
      const metrics = createMetrics({ queueLength: 100, idleWorkers: 0 });

      const decision = strategy.decide(metrics);

      expect(Math.abs(decision.delta)).toBeLessThanOrEqual(1);
    });

    it("should enforce minWorkers limit", () => {
      const strategy = new QueueLengthStrategy(
        createConfig("queue-length", {
          minWorkers: 2,
          maxDeltaPerScale: 10,
          config: { scaleDownWorkers: 5 },
        })
      );
      const metrics = createMetrics({ totalWorkers: 3, queueLength: 0, idleWorkers: 3 });

      const decision = strategy.decide(metrics);

      expect(metrics.totalWorkers + decision.delta).toBeGreaterThanOrEqual(2);
    });

    it("should enforce maxWorkers limit", () => {
      const strategy = new QueueLengthStrategy(
        createConfig("queue-length", {
          maxWorkers: 10,
          maxDeltaPerScale: 10,
          config: { scaleUpWorkers: 5 },
        })
      );
      const metrics = createMetrics({ totalWorkers: 9, queueLength: 100, idleWorkers: 0 });

      const decision = strategy.decide(metrics);

      expect(metrics.totalWorkers + decision.delta).toBeLessThanOrEqual(10);
    });
  });

  describe("CompositeScalingStrategy - AND Mode", () => {
    it("should return no action if strategies disagree", () => {
      const config = createConfig("composite", { enabled: true });
      const composite = new CompositeScalingStrategy(config, "AND");

      const strategy1 = new QueueLengthStrategy(
        createConfig("queue-length", { config: { scaleUpThreshold: 1 } })
      );
      const strategy2 = new UtilizationStrategy(
        createConfig("utilization", { config: { scaleUpThreshold: 0.9 } })
      );

      composite.addStrategy(strategy1, 1);
      composite.addStrategy(strategy2, 1);

      const metrics = createMetrics({ queueLength: 10, utilization: 0.5, idleWorkers: 0 });
      const decision = composite.decide(metrics);

      expect(decision.action).toBe("none");
      expect(decision.reason).toBe("Strategies conflict");
    });

    it("should scale up if all strategies agree", () => {
      const config = createConfig("composite", { enabled: true });
      const composite = new CompositeScalingStrategy(config, "AND");

      const strategy1 = new QueueLengthStrategy(
        createConfig("queue-length", { config: { scaleUpThreshold: 1 } })
      );
      const strategy2 = new UtilizationStrategy(
        createConfig("utilization", { config: { scaleUpThreshold: 0.3 } })
      );

      composite.addStrategy(strategy1, 1);
      composite.addStrategy(strategy2, 1);

      const metrics = createMetrics({ queueLength: 10, utilization: 0.9, idleWorkers: 0 });
      const decision = composite.decide(metrics);

      expect(decision.action).toBe("scale-up");
      expect(decision.confidence).toBeGreaterThan(0);
    });
  });

  describe("CompositeScalingStrategy - OR Mode", () => {
    it("should scale if any strategy recommends", () => {
      const config = createConfig("composite", { enabled: true });
      const composite = new CompositeScalingStrategy(config, "OR");

      const strategy1 = new QueueLengthStrategy(
        createConfig("queue-length", { config: { scaleUpThreshold: 100 } })
      );
      const strategy2 = new UtilizationStrategy(
        createConfig("utilization", { config: { scaleUpThreshold: 0.3 } })
      );

      composite.addStrategy(strategy1, 1);
      composite.addStrategy(strategy2, 1);

      const metrics = createMetrics({ queueLength: 5, utilization: 0.9, idleWorkers: 0 });
      const decision = composite.decide(metrics);

      expect(decision.action).toBe("scale-up");
    });

    it("should pick highest confidence decision", () => {
      const config = createConfig("composite", { enabled: true });
      const composite = new CompositeScalingStrategy(config, "OR");

      const strategy1 = new QueueLengthStrategy(
        createConfig("queue-length", { config: { scaleUpThreshold: 100 } })
      );
      const strategy2 = new UtilizationStrategy(
        createConfig("utilization", { config: { scaleUpThreshold: 0.3 } })
      );

      composite.addStrategy(strategy1, 1);
      composite.addStrategy(strategy2, 1);

      const metrics = createMetrics({ queueLength: 5, utilization: 0.95, idleWorkers: 0 });
      const decision = composite.decide(metrics);

      // UtilizationStrategy has higher confidence (0.95 is close to max)
      expect(decision.reason).toContain("Utilization");
    });
  });

  describe("CompositeScalingStrategy - WEIGHTED Mode", () => {
    it("should scale up if weighted score > 0.5", () => {
      const config = createConfig("composite", { enabled: true });
      const composite = new CompositeScalingStrategy(config, "WEIGHTED");

      const strategy1 = new QueueLengthStrategy(
        createConfig("queue-length", { config: { scaleUpThreshold: 1 } })
      );
      const strategy2 = new UtilizationStrategy(
        createConfig("utilization", { config: { scaleDownThreshold: 0.9 } })
      );

      composite.addStrategy(strategy1, 2); // Higher weight
      composite.addStrategy(strategy2, 1);

      const metrics = createMetrics({ queueLength: 10, utilization: 0.5, idleWorkers: 0 });
      const decision = composite.decide(metrics);

      expect(decision.action).toBe("scale-up");
    });

    it("should respect strategy weights", () => {
      const config = createConfig("composite", { enabled: true, minWorkers: 1 });
      const composite = new CompositeScalingStrategy(config, "WEIGHTED");

      const scaleUpStrategy = new QueueLengthStrategy(
        createConfig("queue-length", { minWorkers: 1, config: { scaleUpThreshold: 50 } })
      );
      const scaleDownStrategy = new UtilizationStrategy(
        createConfig("utilization", { minWorkers: 1, config: { scaleDownThreshold: 0.2 } })
      );

      composite.addStrategy(scaleUpStrategy, 0.1); // Low weight
      composite.addStrategy(scaleDownStrategy, 10); // High weight

      // Metrics that trigger scale-down in strategy2 but not scale-up in strategy1
      const metrics = createMetrics({
        queueLength: 3,
        utilization: 0.1,
        idleWorkers: 4,
        totalWorkers: 20,
      });
      const decision = composite.decide(metrics);

      expect(decision.action).toBe("scale-down");
    });

    it("should return no action if no clear consensus", () => {
      const config = createConfig("composite", { enabled: true });
      const composite = new CompositeScalingStrategy(config, "WEIGHTED");

      const strategy1 = new QueueLengthStrategy(
        createConfig("queue-length", { config: { scaleUpThreshold: 1, scaleDownThreshold: 1000 } })
      );
      const strategy2 = new UtilizationStrategy(
        createConfig("utilization", {
          config: { scaleUpThreshold: 0.95, scaleDownThreshold: 0.05 },
        })
      );

      composite.addStrategy(strategy1, 1);
      composite.addStrategy(strategy2, 1);

      const metrics = createMetrics({ queueLength: 5, utilization: 0.5, idleWorkers: 1 });
      const decision = composite.decide(metrics);

      expect(decision.action).toBe("none");
    });
  });

  describe("CompositeScalingStrategy - Management", () => {
    it("should add and remove strategies", () => {
      const config = createConfig("composite", { enabled: true });
      const composite = new CompositeScalingStrategy(config);

      const strategy1 = new QueueLengthStrategy(createConfig("queue-length"));
      const strategy2 = new UtilizationStrategy(createConfig("utilization"));

      composite.addStrategy(strategy1, 1);
      composite.addStrategy(strategy2, 1);

      // Should have 2 strategies and make decision
      let decision = composite.decide(createMetrics());
      expect(decision).toBeDefined();

      // Remove one strategy
      composite.removeStrategy(strategy1);

      // Should still work with 1 strategy
      decision = composite.decide(createMetrics());
      expect(decision).toBeDefined();

      // Remove all
      composite.removeStrategy(strategy2);
      decision = composite.decide(createMetrics());

      expect(decision.action).toBe("none");
    });

    it("should reject invalid strategy weight", () => {
      const config = createConfig("composite", { enabled: true });
      const composite = new CompositeScalingStrategy(config);
      const strategy = new QueueLengthStrategy(createConfig("queue-length"));

      expect(() => {
        composite.addStrategy(strategy, 0);
      }).toThrow("Strategy weight must be > 0");

      expect(() => {
        composite.addStrategy(strategy, -1);
      }).toThrow("Strategy weight must be > 0");
    });
  });

  describe("ScalingStrategyFactory", () => {
    it("should create queue-length strategy", () => {
      const config = createConfig("queue-length");
      const strategy = ScalingStrategyFactory.createStrategy(config);

      expect(strategy).toBeInstanceOf(QueueLengthStrategy);
    });

    it("should create utilization strategy", () => {
      const config = createConfig("utilization");
      const strategy = ScalingStrategyFactory.createStrategy(config);

      expect(strategy).toBeInstanceOf(UtilizationStrategy);
    });

    it("should create wait-time strategy", () => {
      const config = createConfig("wait-time");
      const strategy = ScalingStrategyFactory.createStrategy(config);

      expect(strategy).toBeInstanceOf(WaitTimeStrategy);
    });

    it("should create composite strategy", () => {
      const config = createConfig("composite");
      const strategy = ScalingStrategyFactory.createStrategy(config);

      expect(strategy).toBeInstanceOf(CompositeScalingStrategy);
    });

    it("should throw on unknown strategy type", () => {
       
      const config = createConfig("unknown" as any);

      expect(() => {
        ScalingStrategyFactory.createStrategy(config);
      }).toThrow("Unknown scaling strategy type");
    });

    it("should create aggressive preset", () => {
      const config = ScalingStrategyFactory.createPreset("aggressive", 1, 20);

      expect(config.type).toBe("queue-length");
      expect(config.minWorkers).toBe(1);
      expect(config.maxWorkers).toBe(20);
      expect(config.maxDeltaPerScale).toBe(4);
      expect(config.cooldownMs).toBe(1000);
    });

    it("should create moderate preset", () => {
      const config = ScalingStrategyFactory.createPreset("moderate", 2, 16);

      expect(config.type).toBe("composite");
      expect(config.minWorkers).toBe(2);
      expect(config.maxWorkers).toBe(16);
      expect(config.maxDeltaPerScale).toBe(2);
      expect(config.cooldownMs).toBe(5000);
    });

    it("should create conservative preset", () => {
      const config = ScalingStrategyFactory.createPreset("conservative", 2, 8);

      expect(config.type).toBe("utilization");
      expect(config.minWorkers).toBe(2);
      expect(config.maxWorkers).toBe(8);
      expect(config.maxDeltaPerScale).toBe(1);
      expect(config.cooldownMs).toBe(30000);
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero queue length", () => {
      const strategy = new QueueLengthStrategy(createConfig("queue-length"));
      const metrics = createMetrics({ queueLength: 0 });

      const decision = strategy.decide(metrics);

      expect(decision).toBeDefined();
      expect(decision.action).toBe("scale-down");
    });

    it("should handle zero utilization", () => {
      const strategy = new UtilizationStrategy(createConfig("utilization", { minWorkers: 1 }));
      // 20 workers so that 10% = 2.0, floor to 2, giving us scale-down of -2
      const metrics = createMetrics({ utilization: 0, idleWorkers: 20, totalWorkers: 20 });

      const decision = strategy.decide(metrics);

      expect(decision).toBeDefined();
      expect(decision.action).toBe("scale-down");
    });

    it("should handle 100% utilization", () => {
      const strategy = new UtilizationStrategy(createConfig("utilization"));
      const metrics = createMetrics({ utilization: 1 });

      const decision = strategy.decide(metrics);

      expect(decision).toBeDefined();
      expect(decision.action).toBe("scale-up");
    });

    it("should handle single worker pool", () => {
      const strategy = new QueueLengthStrategy(
        createConfig("queue-length", { minWorkers: 1, config: { scaleDownWorkers: 5 } })
      );
      const metrics = createMetrics({ totalWorkers: 1, idleWorkers: 1 });

      const decision = strategy.decide(metrics);

      // Should not scale below 1
      expect(metrics.totalWorkers + decision.delta).toBeGreaterThanOrEqual(1);
    });

    it("should handle max worker pool", () => {
      const strategy = new QueueLengthStrategy(
        createConfig("queue-length", { maxWorkers: 16, config: { scaleUpWorkers: 5 } })
      );
      const metrics = createMetrics({ totalWorkers: 16, queueLength: 100, idleWorkers: 0 });

      const decision = strategy.decide(metrics);

      // Should not scale above max
      expect(metrics.totalWorkers + decision.delta).toBeLessThanOrEqual(16);
      expect(decision.delta).toBeLessThanOrEqual(0);
    });
  });
});
