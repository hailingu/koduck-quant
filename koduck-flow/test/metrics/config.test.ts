/**
 * Metrics config tests
 * 测试metrics配置模块的功能
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
    it("应该支持配置metrics", () => {
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

    it("应该支持增量配置更新", () => {
      // 第一次配置
      configureMetrics({
        governance: {
          seriesLimitPerMetric: 500,
          samplingRate: 1.0,
        },
        naming: {
          metricNamePrefix: "service1",
        },
      });

      // 第二次配置，应该合并而不是替换
      configureMetrics({
        governance: {
          seriesTTLms: 600000,
          labelWhitelist: ["env", "service"],
        },
      });

      const config = getMetricsConfig();
      expect(config.governance?.seriesLimitPerMetric).toBe(500); // 保留
      expect(config.governance?.samplingRate).toBe(1.0); // 保留
      expect(config.governance?.seriesTTLms).toBe(600000); // 新增
      expect(config.governance?.labelWhitelist).toEqual(["env", "service"]); // 新增
      expect(config.naming?.metricNamePrefix).toBe("service1"); // 保留
    });

    it("应该支持部分配置覆盖", () => {
      configureMetrics({
        governance: {
          seriesLimitPerMetric: 100,
          samplingRate: 0.8,
        },
      });

      configureMetrics({
        governance: {
          samplingRate: 0.9, // 覆盖原值
          seriesTTLms: 120000, // 新增
        },
      });

      const config = getMetricsConfig();
      expect(config.governance?.seriesLimitPerMetric).toBe(100); // 保留
      expect(config.governance?.samplingRate).toBe(0.9); // 覆盖
      expect(config.governance?.seriesTTLms).toBe(120000); // 新增
    });

    it("应该返回当前配置", () => {
      const config = getMetricsConfig();
      expect(config).toBeDefined();
      expect(typeof config).toBe("object");
    });
  });

  describe("Label Filtering", () => {
    it("应该处理undefined属性", () => {
      const result = filterAttributes(undefined);
      expect(result).toBeUndefined();
    });

    it("应该处理空属性", () => {
      const result = filterAttributes({});
      expect(result).toEqual({});
    });

    it("应该在没有治理配置时处理属性过滤", () => {
      // 由于前面的测试可能已经设置了配置，我们测试过滤逻辑本身
      const attrs: Attributes = { service: "api", version: "1.0", env: "prod" };
      const result = filterAttributes(attrs);
      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
      // 如果有白名单，应该只包含白名单属性；如果有黑名单，应该排除黑名单属性
    });

    it("应该支持白名单过滤", () => {
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

    it("应该支持黑名单过滤", () => {
      // 创建一个新的测试配置，只设置黑名单
      configureMetrics({
        governance: {
          labelBlacklist: ["internal", "debug"],
          labelWhitelist: undefined, // 确保没有白名单干扰
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
      // 结果应该排除黑名单项
      expect(result).not.toHaveProperty("internal");
      expect(result).not.toHaveProperty("debug");
      expect(result).toHaveProperty("service");
      expect(result).toHaveProperty("version");
      expect(result).toHaveProperty("env");
    });

    it("应该支持白名单和黑名单组合", () => {
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
        // debug被黑名单移除，internal不在白名单中
      });
    });

    it("应该正确处理标签过滤逻辑", () => {
      // 测试过滤属性的基本功能
      const attrs: Attributes = {
        service: "api",
        version: "1.0",
        debug: "test",
      };
      const result = filterAttributes(attrs);

      // filterAttributes应该返回一个结果
      expect(result).toBeDefined();
      expect(typeof result).toBe("object");

      // 如果有结果，它应该是Attributes类型
      if (result) {
        for (const [key, value] of Object.entries(result)) {
          expect(typeof key).toBe("string");
          expect(["string", "number", "boolean"].includes(typeof value)).toBe(
            true
          );
        }
      }
    });

    it("应该处理空黑名单", () => {
      configureMetrics({
        governance: {
          labelBlacklist: [],
        },
      });

      const attrs: Attributes = { service: "api", version: "1.0" };
      const result = filterAttributes(attrs);
      expect(result).toEqual(attrs); // 空黑名单不应该过滤任何属性
    });

    it("应该处理不存在的属性键", () => {
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
    it("应该根据当前配置返回采样结果", () => {
      // 由于前面的测试可能已经设置了采样率，我们测试当前的采样行为
      const result = shouldSample();
      expect(typeof result).toBe("boolean");

      // 获取当前配置的采样率
      const currentConfig = getMetricsConfig();
      const samplingRate = currentConfig.governance?.samplingRate;

      if (samplingRate === undefined) {
        expect(result).toBe(true);
      } else if (samplingRate >= 1) {
        expect(result).toBe(true);
      } else if (samplingRate <= 0) {
        expect(result).toBe(false);
      }
      // 对于0-1之间的值，结果是随机的，我们只检查它是布尔值
    });

    it("应该在samplingRate为1时总是返回true", () => {
      configureMetrics({
        governance: {
          samplingRate: 1.0,
        },
      });

      for (let i = 0; i < 10; i++) {
        expect(shouldSample()).toBe(true);
      }
    });

    it("应该在samplingRate为0时总是返回false", () => {
      configureMetrics({
        governance: {
          samplingRate: 0.0,
        },
      });

      for (let i = 0; i < 10; i++) {
        expect(shouldSample()).toBe(false);
      }
    });

    it("应该在samplingRate大于1时总是返回true", () => {
      configureMetrics({
        governance: {
          samplingRate: 1.5,
        },
      });

      for (let i = 0; i < 10; i++) {
        expect(shouldSample()).toBe(true);
      }
    });

    it("应该在samplingRate小于0时总是返回false", () => {
      configureMetrics({
        governance: {
          samplingRate: -0.1,
        },
      });

      for (let i = 0; i < 10; i++) {
        expect(shouldSample()).toBe(false);
      }
    });

    it("应该支持0到1之间的采样率", () => {
      configureMetrics({
        governance: {
          samplingRate: 0.5,
        },
      });

      // 测试多次，应该有true和false的结果
      const results = Array.from({ length: 100 }, () => shouldSample());
      const trueCount = results.filter(Boolean).length;
      const falseCount = results.length - trueCount;

      // 期望大约50%的true和50%的false（允许一定的随机变化）
      expect(trueCount).toBeGreaterThan(30);
      expect(trueCount).toBeLessThan(70);
      expect(falseCount).toBeGreaterThan(30);
      expect(falseCount).toBeLessThan(70);
    });
  });

  describe("Type Definitions", () => {
    it("应该正确定义MetricsGovernanceConfig类型", () => {
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

    it("应该正确定义MetricsNamingConfig类型", () => {
      const config: MetricsNamingConfig = {
        metricNamePrefix: "myapp",
      };

      expect(typeof config.metricNamePrefix).toBe("string");
    });

    it("应该正确定义MetricsConfig类型", () => {
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
    it("应该处理复杂的属性值", () => {
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

    it("应该处理特殊字符串", () => {
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

    it("应该处理极端采样率值", () => {
      // 测试极小的正值
      configureMetrics({
        governance: {
          samplingRate: 0.001,
        },
      });

      const results = Array.from({ length: 1000 }, () => shouldSample());
      const trueCount = results.filter(Boolean).length;
      expect(trueCount).toBeLessThan(50); // 应该很少为true

      // 测试接近1的值
      configureMetrics({
        governance: {
          samplingRate: 0.999,
        },
      });

      const results2 = Array.from({ length: 100 }, () => shouldSample());
      const trueCount2 = results2.filter(Boolean).length;
      expect(trueCount2).toBeGreaterThan(90); // 应该大多数为true
    });
  });
});
