import { describe, expect, it } from "vitest";

import {
  validateConfig,
  generateJsonSchema,
  type KoduckFlowConfig,
} from "../../../src/common/config/schema";

const baselineConfig: KoduckFlowConfig = {
  environment: "development",
  event: {
    batchSize: 16,
    batchInterval: 250,
    maxQueueSize: 2000,
    enableDedup: true,
    concurrencyLimit: 4,
    maxListeners: 128,
  },
  render: {
    frameRate: 60,
    cacheTTL: 300000,
    maxCacheSize: 2048,
    defaultRenderer: "react",
    enableDirtyRegion: true,
    constants: {
      SMALL: 64,
      MEDIUM: 512,
      LARGE: 2048,
    },
  },
  entity: {
    maxEntities: 5000,
    gcInterval: 60000,
    enableEntityPool: true,
  },
  performance: {
    enableProfiling: false,
    metricsInterval: 5000,
    enableVerboseLogging: false,
  },
  plugin: {
    sandboxTimeout: 5000,
    capabilityCache: {
      enabled: true,
      defaultTtlMs: 600000,
      maxSize: 256,
    },
    execution: {
      defaultTimeoutMs: 2000,
      maxRetries: 3,
    },
  },
};

describe("validateConfig", () => {
  it("returns a valid result for baseline configuration", () => {
    const result = validateConfig(baselineConfig);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.durationMs).toBeLessThan(5);
  });

  it("surfaces actionable metadata for invalid configuration", () => {
    const invalidConfig: KoduckFlowConfig = {
      ...baselineConfig,
      event: {
        ...baselineConfig.event,
        batchSize: 0,
      },
    };

    const result = validateConfig(invalidConfig);

    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);

    const [issue] = result.errors;
    expect(issue.path).toBe("event.batchSize");
    expect(issue.expected).toBe("数值 ≥ 1");
    expect(issue.hint).toContain("batchSize");
    expect(issue.severity).toBe("error");
  });
});

describe("generateJsonSchema", () => {
  it("exposes environment and renderer enums", () => {
    const schema = generateJsonSchema();

    expect(schema.properties.environment.enum).toContain("development");
    expect(schema.properties.environment.enum).toContain("production");
    expect(schema.properties.render.properties.defaultRenderer.enum).toContain("react");
  });
});
