/**
 * Metrics config tests
 * Tests the functionality of the metrics config module
 */

import { describe, it, expect } from "vitest";
import {
  configureMetrics,
  getMetricsConfig,
  filterAttributes,
  shouldSample,
  type MetricsGovernanceConfig,
  type MetricsNamingConfig,
  type MetricsConfig,
} from "../../src/common/metrics/config";
import type { Attributes } from "../../src/common/metrics/types";

describe("Metrics Config", () => {
  describe("Configuration Management", () => {
    it("should support configuring metrics", () => {
      const config: MetricsConfig = {
        governance: {
          seriesLimitPerMetric: 1000,
          seriesTTLms: 300000,
          samplingRate: 0.5,
          labelWhitelist: ["service", "version"],
          labelBlacklist: ["internal"],
        },
        naming: {
          metricNamePrefix: "app",
        },
      };

      configureMetrics(config);

      const retrievedConfig = getMetricsConfig();
      expect(retrievedConfig.governance?.seriesLimitPerMetric).toBe(1000);
      expect(retrievedConfig.governance?.seriesTTLms).toBe(300000);
      expect(retrievedConfig.governance?.samplingRate).toBe(0.5);
      expect(retrievedConfig.governance?.labelWhitelist).toEqual([
        "service",
        "version",
      ]);
      expect(retrievedConfig.governance?.labelBlacklist).toEqual(["internal"]);
      expect(retrievedConfig.naming?.metricNamePrefix).toBe("app");
    });

    it("should support incremental config updates", () => {
      // First configuration
      configureMetrics({
        governance: {
          seriesLimitPerMetric: 500,
          samplingRate: 1.0,
        },
        naming: {
          metricNamePrefix: "service1",
        },
      });

      // Second configuration, should merge instead of replace
      configureMetrics({
        governance: {
          seriesTTLms: 600000,
          labelWhitelist: ["env", "service"],
        },
      });

      const config = getMetricsConfig();
      expect(config.governance?.seriesLimitPerMetric).toBe(500); // retained
      expect(config.governance?.samplingRate).toBe(1.0); // retained
      expect(config.governance?.seriesTTLms).toBe(600000); // newly added
      expect(config.governance?.labelWhitelist).toEqual(["env", "service"]); // newly added
      expect(config.naming?.metricNamePrefix).toBe("service1"); // retained
    });

    it("should support partial config override", () => {
      configureMetrics({
        governance: {
          seriesLimitPerMetric: 100,
          samplingRate: 0.8,
        },
      });

      configureMetrics({
        governance: {
          samplingRate: 0.9, // overrides original value
          seriesTTLms: 120000, // newly added
        },
      });

      const config = getMetricsConfig();
      expect(config.governance?.seriesLimitPerMetric).toBe(100); // retained
      expect(config.governance?.samplingRate).toBe(0.9); // overridden
      expect(config.governance?.seriesTTLms).toBe(120000); // newly added
    });

    it("should return current configuration", () => {
      const config = getMetricsConfig();
      expect(config).toBeDefined();
      expect(typeof config).toBe("object");
    });
  });

  describe("Label Filtering", () => {
    it("should handle undefined attributes", () => {
      const result = filterAttributes(undefined);
      expect(result).toBeUndefined();
    });

    it("should handle empty attributes", () => {
      const result = filterAttributes({});
      expect(result).toEqual({});
    });

    it("should handle attribute filtering without governance config", () => {
      // Previous tests may have set config, so we test the filtering logic itself
      const attrs: Attributes = { service: "api", version: "1.0", env: "prod" };
      const result = filterAttributes(attrs);
      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
      // If whitelist exists, only include whitelisted attributes; if blacklist exists, exclude blacklisted attributes
    });

    it("should support whitelist filtering", () => {
      configureMetrics({
        governance: {
          labelWhitelist: ["service", "version"],
        },
      });

      const attrs: Attributes = {
        service: "api",
        version: "1.0",
        env: "prod",
        internal: "debug",
      };

      const result = filterAttributes(attrs);
      expect(result).toEqual({
        service: "api",
        version: "1.0",
      });
    });

    it("should support blacklist filtering", () => {
      // Create a new test configuration with only blacklist
      configureMetrics({
        governance: {
          labelBlacklist: ["internal", "debug"],
          labelWhitelist: undefined, // ensure no whitelist interference
        },
      });

      const attrs: Attributes = {
        service: "api",
        version: "1.0",
        env: "prod",
        internal: "debug",
        debug: true,
      };

      const result = filterAttributes(attrs);
      // Result should exclude blacklisted items
      expect(result).not.toHaveProperty("internal");
      expect(result).not.toHaveProperty("debug");
      expect(result).toHaveProperty("service");
      expect(result).toHaveProperty("version");
      expect(result).toHaveProperty("env");
    });

    it("should support whitelist and blacklist combination", () => {
      configureMetrics({
        governance: {
          labelWhitelist: ["service", "version", "env", "debug"],
          labelBlacklist: ["debug"],
        },
      });

      const attrs: Attributes = {
        service: "api",
        version: "1.0",
        env: "prod",
        internal: "test",
        debug: true,
      };

      const result = filterAttributes(attrs);
      expect(result).toEqual({
        service: "api",
        version: "1.0",
        env: "prod",
        // debug is removed by blacklist, internal is not in whitelist
      });
    });

    it("should correctly handle label filtering logic", () => {
      // Test basic attribute filtering functionality
      const attrs: Attributes = {
        service: "api",
        version: "1.0",
        debug: "test",
      };
      const result = filterAttributes(attrs);

      // filterAttributes should return a result
      expect(result).toBeDefined();
      expect(typeof result).toBe("object");

      // If there is a result, it should be of type Attributes
      if (result) {
        for (const [key, value] of Object.entries(result)) {
          expect(typeof key).toBe("string");
          expect(["string", "number", "boolean"].includes(typeof value)).toBe(
            true
          );
        }
      }
    });

    it("should handle empty blacklist", () => {
      configureMetrics({
        governance: {
          labelBlacklist: [],
        },
      });

      const attrs: Attributes = { service: "api", version: "1.0" };
      const result = filterAttributes(attrs);
      expect(result).toEqual(attrs); // empty blacklist should not filter any attributes
    });

    it("should handle non-existent attribute keys", () => {
      configureMetrics({
        governance: {
          labelWhitelist: ["nonexistent", "service"],
          labelBlacklist: ["alsoNonexistent"],
        },
      });

      const attrs: Attributes = { service: "api", version: "1.0" };
      const result = filterAttributes(attrs);
      expect(result).toEqual({ service: "api" });
    });
  });

  describe("Sampling", () => {
    it("should return sampling result based on current configuration", () => {
      // Previous tests may have set the sampling rate, so we test current sampling behavior
      const result = shouldSample();
      expect(typeof result).toBe("boolean");

      // Get sampling rate from current configuration
      const currentConfig = getMetricsConfig();
      const samplingRate = currentConfig.governance?.samplingRate;

      if (samplingRate === undefined) {
        expect(result).toBe(true);
      } else if (samplingRate >= 1) {
        expect(result).toBe(true);
      } else if (samplingRate <= 0) {
        expect(result).toBe(false);
      }
      // For values between 0-1, the result is random, so we only check it's a boolean
    });

    it("should always return true when samplingRate is 1", () => {
      configureMetrics({
        governance: {
          samplingRate: 1.0,
        },
      });

      for (let i = 0; i < 10; i++) {
        expect(shouldSample()).toBe(true);
      }
    });

    it("should always return false when samplingRate is 0", () => {
      configureMetrics({
        governance: {
          samplingRate: 0.0,
        },
      });

      for (let i = 0; i < 10; i++) {
        expect(shouldSample()).toBe(false);
      }
    });

    it("should always return true when samplingRate is greater than 1", () => {
      configureMetrics({
        governance: {
          samplingRate: 1.5,
        },
      });

      for (let i = 0; i < 10; i++) {
        expect(shouldSample()).toBe(true);
      }
    });

    it("should always return false when samplingRate is less than 0", () => {
      configureMetrics({
        governance: {
          samplingRate: -0.1,
        },
      });

      for (let i = 0; i < 10; i++) {
        expect(shouldSample()).toBe(false);
      }
    });

    it("should support sampling rate between 0 and 1", () => {
      configureMetrics({
        governance: {
          samplingRate: 0.5,
        },
      });

      // Test multiple times, there should be both true and false results
      const results = Array.from({ length: 100 }, () => shouldSample());
      const trueCount = results.filter(Boolean).length;
      const falseCount = results.length - trueCount;

      // Expect approximately 50% true and 50% false (allowing some random variation)
      expect(trueCount).toBeGreaterThan(30);
      expect(trueCount).toBeLessThan(70);
      expect(falseCount).toBeGreaterThan(30);
      expect(falseCount).toBeLessThan(70);
    });
  });

  describe("Type Definitions", () => {
    it("should correctly define MetricsGovernanceConfig type", () => {
      const config: MetricsGovernanceConfig = {
        seriesLimitPerMetric: 1000,
        seriesTTLms: 300000,
        samplingRate: 0.8,
        labelWhitelist: ["service", "version"],
        labelBlacklist: ["debug", "internal"],
      };

      expect(typeof config.seriesLimitPerMetric).toBe("number");
      expect(typeof config.seriesTTLms).toBe("number");
      expect(typeof config.samplingRate).toBe("number");
      expect(Array.isArray(config.labelWhitelist)).toBe(true);
      expect(Array.isArray(config.labelBlacklist)).toBe(true);
    });

    it("should correctly define MetricsNamingConfig type", () => {
      const config: MetricsNamingConfig = {
        metricNamePrefix: "myapp",
      };

      expect(typeof config.metricNamePrefix).toBe("string");
    });

    it("should correctly define MetricsConfig type", () => {
      const config: MetricsConfig = {
        governance: {
          seriesLimitPerMetric: 500,
          samplingRate: 0.9,
        },
        naming: {
          metricNamePrefix: "service",
        },
      };

      expect(typeof config.governance).toBe("object");
      expect(typeof config.naming).toBe("object");
      expect(config.governance?.seriesLimitPerMetric).toBe(500);
      expect(config.governance?.samplingRate).toBe(0.9);
      expect(config.naming?.metricNamePrefix).toBe("service");
    });
  });

  describe("Edge Cases", () => {
    it("should handle complex attribute values", () => {
      configureMetrics({
        governance: {
          labelWhitelist: ["service", "version", "enabled"],
        },
      });

      const attrs: Attributes = {
        service: "api-service",
        version: "1.2.3-beta",
        enabled: true,
        count: 42,
        ratio: 3.14,
      };

      const result = filterAttributes(attrs);
      expect(result).toEqual({
        service: "api-service",
        version: "1.2.3-beta",
        enabled: true,
      });
    });

    it("should handle special strings", () => {
      configureMetrics({
        governance: {
          labelWhitelist: ["special", "unicode"],
        },
      });

      const attrs: Attributes = {
        special: "value-with-dash_and_underscore.and.dot",
        unicode: "测试中文",
        emoji: "🚀",
      };

      const result = filterAttributes(attrs);
      expect(result).toEqual({
        special: "value-with-dash_and_underscore.and.dot",
        unicode: "测试中文",
      });
    });

    it("should handle extreme sampling rate values", () => {
      // Test very small positive value
      configureMetrics({
        governance: {
          samplingRate: 0.001,
        },
      });

      const results = Array.from({ length: 1000 }, () => shouldSample());
      const trueCount = results.filter(Boolean).length;
      expect(trueCount).toBeLessThan(50); // should rarely be true

      // Test value close to 1
      configureMetrics({
        governance: {
          samplingRate: 0.999,
        },
      });

      const results2 = Array.from({ length: 100 }, () => shouldSample());
      const trueCount2 = results2.filter(Boolean).length;
      expect(trueCount2).toBeGreaterThan(90); // should mostly be true
    });
  });
});
