import { describe, test, expect, beforeEach } from "vitest";
import { DedupeManager } from "../../src/common/event/dedupe-manager";
import type {
  EventConfiguration,
  PayloadDedupeConfig,
} from "../../src/common/event/types";

describe("DedupeManager", () => {
  let config: EventConfiguration;
  let dedupeManager: DedupeManager<unknown>;

  beforeEach(() => {
    config = {
      maxListeners: 100,
      enableBatching: false,
      batchSize: 10,
      batchInterval: 0,
      enableAutoOptimization: false,
      autoOptimizeThreshold: 1000,
      enableDebugMode: false,
      concurrencyMode: "parallel" as const,
      concurrencyLimit: 5,
    };
  });

  describe("构造函数和初始化", () => {
    test("应该正确初始化（不启用去重）", () => {
      dedupeManager = new DedupeManager("TestEvent", config);

      const stats = dedupeManager.getCacheStats();
      expect(stats.enabled).toBe(false);
      expect(stats.size).toBe(0);
    });

    test("应该正确初始化（启用去重）", () => {
      const dedupeConfig: PayloadDedupeConfig = {
        enabled: true,
        ttl: 1000,
        maxEntries: 100,
      };

      const configWithDedupe = { ...config, payloadDedupe: dedupeConfig };
      dedupeManager = new DedupeManager("TestEvent", configWithDedupe);

      const stats = dedupeManager.getCacheStats();
      expect(stats.enabled).toBe(true);
      expect(stats.size).toBe(0);
    });
  });

  describe("去重功能", () => {
    test("应该在禁用去重时不丢弃任何事件", () => {
      dedupeManager = new DedupeManager("TestEvent", config);

      expect(dedupeManager.shouldDropByDedupe("data1")).toBe(false);
      expect(dedupeManager.shouldDropByDedupe("data1")).toBe(false);
      expect(dedupeManager.shouldDropByDedupe("data2")).toBe(false);
    });

    test("应该在启用去重时正确去重", () => {
      const dedupeConfig: PayloadDedupeConfig = {
        enabled: true,
        ttl: 1000,
        maxEntries: 100,
      };

      const configWithDedupe = { ...config, payloadDedupe: dedupeConfig };
      dedupeManager = new DedupeManager("TestEvent", configWithDedupe);

      // 第一次应该不丢弃
      expect(dedupeManager.shouldDropByDedupe("data1")).toBe(false);

      // 第二次相同数据应该丢弃
      expect(dedupeManager.shouldDropByDedupe("data1")).toBe(true);

      // 不同数据应该不丢弃
      expect(dedupeManager.shouldDropByDedupe("data2")).toBe(false);

      // 再次相同的新数据应该丢弃
      expect(dedupeManager.shouldDropByDedupe("data2")).toBe(true);
    });

    test("应该正确处理复杂对象去重", () => {
      const dedupeConfig: PayloadDedupeConfig = {
        enabled: true,
        ttl: 1000,
        maxEntries: 100,
      };

      const configWithDedupe = { ...config, payloadDedupe: dedupeConfig };
      dedupeManager = new DedupeManager("TestEvent", configWithDedupe);

      const obj1 = { id: 1, name: "test" };
      const obj2 = { id: 1, name: "test" }; // 相同内容
      const obj3 = { id: 2, name: "test" }; // 不同内容

      expect(dedupeManager.shouldDropByDedupe(obj1)).toBe(false);
      expect(dedupeManager.shouldDropByDedupe(obj2)).toBe(true); // 应该被去重
      expect(dedupeManager.shouldDropByDedupe(obj3)).toBe(false);
    });

    test("应该支持自定义键生成函数", () => {
      const dedupeConfig: PayloadDedupeConfig = {
        enabled: true,
        ttl: 1000,
        maxEntries: 100,
        key: (data: unknown) =>
          (data as { id?: number }).id?.toString() || "default",
      };

      const configWithDedupe = { ...config, payloadDedupe: dedupeConfig };
      dedupeManager = new DedupeManager("TestEvent", configWithDedupe);

      const obj1 = { id: 1, name: "first" };
      const obj2 = { id: 1, name: "second" }; // 不同名称但相同ID
      const obj3 = { id: 2, name: "first" }; // 不同ID

      expect(dedupeManager.shouldDropByDedupe(obj1)).toBe(false);
      expect(dedupeManager.shouldDropByDedupe(obj2)).toBe(true); // 相同ID，应该被去重
      expect(dedupeManager.shouldDropByDedupe(obj3)).toBe(false); // 不同ID
    });

    test("应该处理键生成函数出错的情况", () => {
      const dedupeConfig: PayloadDedupeConfig = {
        enabled: true,
        ttl: 1000,
        maxEntries: 100,
        key: () => {
          throw new Error("Key generation error");
        },
      };

      const configWithDedupe = { ...config, payloadDedupe: dedupeConfig };
      dedupeManager = new DedupeManager("TestEvent", configWithDedupe);

      // 键生成出错时应该不丢弃事件
      expect(dedupeManager.shouldDropByDedupe("data")).toBe(false);
      expect(dedupeManager.shouldDropByDedupe("data")).toBe(false);
    });

    test("应该处理循环引用对象", () => {
      const dedupeConfig: PayloadDedupeConfig = {
        enabled: true,
        ttl: 1000,
        maxEntries: 100,
      };

      const configWithDedupe = { ...config, payloadDedupe: dedupeConfig };
      dedupeManager = new DedupeManager("TestEvent", configWithDedupe);

      const circular: { id: number; self?: unknown } = { id: 1 };
      circular.self = circular; // 创建循环引用

      // JSON.stringify会失败，应该不丢弃
      expect(dedupeManager.shouldDropByDedupe(circular)).toBe(false);
      expect(dedupeManager.shouldDropByDedupe(circular)).toBe(false);
    });
  });

  describe("配置更新", () => {
    test("应该在启用去重时重建缓存", () => {
      dedupeManager = new DedupeManager("TestEvent", config);

      // 初始状态未启用
      expect(dedupeManager.getCacheStats().enabled).toBe(false);

      const dedupeConfig: PayloadDedupeConfig = {
        enabled: true,
        ttl: 1000,
        maxEntries: 100,
      };

      const newConfig = { ...config, payloadDedupe: dedupeConfig };
      dedupeManager.updateConfiguration(newConfig);

      // 更新后应该启用
      expect(dedupeManager.getCacheStats().enabled).toBe(true);
    });

    test("应该在禁用去重时清除缓存", () => {
      const dedupeConfig: PayloadDedupeConfig = {
        enabled: true,
        ttl: 1000,
        maxEntries: 100,
      };

      const configWithDedupe = { ...config, payloadDedupe: dedupeConfig };
      dedupeManager = new DedupeManager("TestEvent", configWithDedupe);

      // 添加一些数据
      dedupeManager.shouldDropByDedupe("data1");
      expect(dedupeManager.getCacheStats().enabled).toBe(true);

      // 禁用去重
      const newConfig = { ...config };
      dedupeManager.updateConfiguration(newConfig);

      expect(dedupeManager.getCacheStats().enabled).toBe(false);
    });

    test("应该在TTL改变时重建缓存", () => {
      const dedupeConfig1: PayloadDedupeConfig = {
        enabled: true,
        ttl: 1000,
        maxEntries: 100,
      };

      const configWithDedupe1 = { ...config, payloadDedupe: dedupeConfig1 };
      dedupeManager = new DedupeManager("TestEvent", configWithDedupe1);

      // 添加数据
      dedupeManager.shouldDropByDedupe("data1");
      expect(dedupeManager.shouldDropByDedupe("data1")).toBe(true);

      // 改变TTL
      const dedupeConfig2: PayloadDedupeConfig = {
        enabled: true,
        ttl: 2000,
        maxEntries: 100,
      };

      const configWithDedupe2 = { ...config, payloadDedupe: dedupeConfig2 };
      dedupeManager.updateConfiguration(configWithDedupe2);

      // 缓存应该被重建，之前的数据应该丢失
      expect(dedupeManager.shouldDropByDedupe("data1")).toBe(false);
    });

    test("应该在maxEntries改变时重建缓存", () => {
      const dedupeConfig1: PayloadDedupeConfig = {
        enabled: true,
        ttl: 1000,
        maxEntries: 100,
      };

      const configWithDedupe1 = { ...config, payloadDedupe: dedupeConfig1 };
      dedupeManager = new DedupeManager("TestEvent", configWithDedupe1);

      dedupeManager.shouldDropByDedupe("data1");

      // 改变maxEntries
      const dedupeConfig2: PayloadDedupeConfig = {
        enabled: true,
        ttl: 1000,
        maxEntries: 200,
      };

      const configWithDedupe2 = { ...config, payloadDedupe: dedupeConfig2 };
      dedupeManager.updateConfiguration(configWithDedupe2);

      // 缓存应该被重建
      expect(dedupeManager.shouldDropByDedupe("data1")).toBe(false);
    });

    test("应该在配置未改变时不重建缓存", () => {
      const dedupeConfig: PayloadDedupeConfig = {
        enabled: true,
        ttl: 1000,
        maxEntries: 100,
      };

      const configWithDedupe = { ...config, payloadDedupe: dedupeConfig };
      dedupeManager = new DedupeManager("TestEvent", configWithDedupe);

      dedupeManager.shouldDropByDedupe("data1");
      expect(dedupeManager.shouldDropByDedupe("data1")).toBe(true);

      // 使用相同配置更新
      dedupeManager.updateConfiguration(configWithDedupe);

      // 缓存应该保留
      expect(dedupeManager.shouldDropByDedupe("data1")).toBe(true);
    });
  });

  describe("缓存统计", () => {
    test("应该返回正确的缓存统计信息", () => {
      const dedupeConfig: PayloadDedupeConfig = {
        enabled: true,
        ttl: 1000,
        maxEntries: 100,
      };

      const configWithDedupe = { ...config, payloadDedupe: dedupeConfig };
      dedupeManager = new DedupeManager("TestEvent", configWithDedupe);

      let stats = dedupeManager.getCacheStats();
      expect(stats.enabled).toBe(true);
      expect(stats.size).toBe(0);

      // 添加一些数据
      dedupeManager.shouldDropByDedupe("data1");
      dedupeManager.shouldDropByDedupe("data2");

      stats = dedupeManager.getCacheStats();
      expect(stats.size).toBe(2);
    });

    test("应该在禁用时返回正确的统计信息", () => {
      dedupeManager = new DedupeManager("TestEvent", config);

      const stats = dedupeManager.getCacheStats();
      expect(stats.enabled).toBe(false);
      expect(stats.size).toBe(0);
    });
  });

  describe("清理功能", () => {
    test("应该能清理缓存", () => {
      const dedupeConfig: PayloadDedupeConfig = {
        enabled: true,
        ttl: 1000,
        maxEntries: 100,
      };

      const configWithDedupe = { ...config, payloadDedupe: dedupeConfig };
      dedupeManager = new DedupeManager("TestEvent", configWithDedupe);

      // 添加数据
      dedupeManager.shouldDropByDedupe("data1");
      dedupeManager.shouldDropByDedupe("data2");

      expect(dedupeManager.getCacheStats().size).toBe(2);

      // 清理
      dedupeManager.clear();

      expect(dedupeManager.getCacheStats().size).toBe(0);

      // 之前的数据应该不再被去重
      expect(dedupeManager.shouldDropByDedupe("data1")).toBe(false);
    });

    test("应该处理禁用状态下的清理", () => {
      dedupeManager = new DedupeManager("TestEvent", config);

      // 应该不会抛出错误
      expect(() => {
        dedupeManager.clear();
      }).not.toThrow();
    });
  });

  describe("边界情况", () => {
    test("应该处理undefined和null数据", () => {
      const dedupeConfig: PayloadDedupeConfig = {
        enabled: true,
        ttl: 1000,
        maxEntries: 100,
      };

      const configWithDedupe = { ...config, payloadDedupe: dedupeConfig };
      dedupeManager = new DedupeManager("TestEvent", configWithDedupe);

      // JSON.stringify(undefined) 返回 undefined，不是有效的字符串键
      // 所以undefined应该总是不被去重
      expect(dedupeManager.shouldDropByDedupe(undefined)).toBe(false);
      expect(dedupeManager.shouldDropByDedupe(undefined)).toBe(false);

      // JSON.stringify(null) 返回 "null"，是有效键
      expect(dedupeManager.shouldDropByDedupe(null)).toBe(false);
      expect(dedupeManager.shouldDropByDedupe(null)).toBe(true);
    });

    test("应该处理数字和布尔值", () => {
      const dedupeConfig: PayloadDedupeConfig = {
        enabled: true,
        ttl: 1000,
        maxEntries: 100,
      };

      const configWithDedupe = { ...config, payloadDedupe: dedupeConfig };
      dedupeManager = new DedupeManager("TestEvent", configWithDedupe);

      expect(dedupeManager.shouldDropByDedupe(42)).toBe(false);
      expect(dedupeManager.shouldDropByDedupe(42)).toBe(true);

      expect(dedupeManager.shouldDropByDedupe(true)).toBe(false);
      expect(dedupeManager.shouldDropByDedupe(true)).toBe(true);

      expect(dedupeManager.shouldDropByDedupe(false)).toBe(false);
      expect(dedupeManager.shouldDropByDedupe(false)).toBe(true);
    });

    test("应该使用默认maxEntries值", () => {
      const dedupeConfig: PayloadDedupeConfig = {
        enabled: true,
        ttl: 1000,
        // 不指定maxEntries，应该使用默认值1000
      };

      const configWithDedupe = { ...config, payloadDedupe: dedupeConfig };
      dedupeManager = new DedupeManager("TestEvent", configWithDedupe);

      // 应该能正常工作
      expect(dedupeManager.shouldDropByDedupe("test")).toBe(false);
      expect(dedupeManager.shouldDropByDedupe("test")).toBe(true);
    });

    test("应该处理自定义键返回undefined的情况", () => {
      const dedupeConfig: PayloadDedupeConfig = {
        enabled: true,
        ttl: 1000,
        maxEntries: 100,
        key: () => undefined as unknown as string,
      };

      const configWithDedupe = { ...config, payloadDedupe: dedupeConfig };
      dedupeManager = new DedupeManager("TestEvent", configWithDedupe);

      // 键为undefined时应该不去重
      expect(dedupeManager.shouldDropByDedupe("data")).toBe(false);
      expect(dedupeManager.shouldDropByDedupe("data")).toBe(false);
    });

    test("应该处理空字符串键", () => {
      const dedupeConfig: PayloadDedupeConfig = {
        enabled: true,
        ttl: 1000,
        maxEntries: 100,
        key: () => "",
      };

      const configWithDedupe = { ...config, payloadDedupe: dedupeConfig };
      dedupeManager = new DedupeManager("TestEvent", configWithDedupe);

      // 空字符串键应该正常工作
      expect(dedupeManager.shouldDropByDedupe("data1")).toBe(false);
      expect(dedupeManager.shouldDropByDedupe("data2")).toBe(true); // 相同键，应该去重
    });
  });
});
