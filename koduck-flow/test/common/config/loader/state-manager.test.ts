/**
 * 配置状态管理器单元测试
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ConfigStateManager } from "../../../../src/common/config/loader/state-manager";
import type { DuckFlowConfig } from "../../../../src/common/config/schema";
import type { ConfigChangeListener } from "../../../../src/common/config/loader/types/config-state.interface";

describe("ConfigStateManager", () => {
  let stateManager: ConfigStateManager;
  let mockConfig: DuckFlowConfig;

  beforeEach(() => {
    mockConfig = {
      environment: "development",
      event: {
        batchSize: 10,
        batchInterval: 16,
        maxQueueSize: 1000,
        enableDedup: true,
        concurrencyLimit: 5,
        maxListeners: 100,
      },
      render: {
        frameRate: 60,
        cacheTTL: 5000,
        maxCacheSize: 100,
        defaultRenderer: "canvas",
        enableDirtyRegion: true,
        constants: { SMALL: 10, MEDIUM: 50, LARGE: 100 },
      },
      entity: {
        maxEntities: 1000,
        gcInterval: 60000,
        enableEntityPool: true,
      },
      performance: {
        enableProfiling: false,
        metricsInterval: 1000,
        enableVerboseLogging: false,
      },
      plugin: {
        sandboxTimeout: 5000,
        capabilityCache: {
          enabled: true,
          defaultTtlMs: 60000,
          maxSize: 100,
        },
        execution: {
          defaultTimeoutMs: 30000,
          maxRetries: 3,
        },
      },
    } as DuckFlowConfig;

    stateManager = new ConfigStateManager(mockConfig);
  });

  describe("getCurrentConfig", () => {
    it("应该返回当前配置", () => {
      const config = stateManager.getCurrentConfig();
      expect(config).toEqual(mockConfig);
    });
  });

  describe("setCurrentConfig", () => {
    it("应该更新当前配置", () => {
      const newConfig = {
        ...mockConfig,
        render: { ...mockConfig.render, frameRate: 120 },
      } as DuckFlowConfig;

      stateManager.setCurrentConfig(newConfig);

      expect(stateManager.getCurrentConfig()).toEqual(newConfig);
      expect(stateManager.getPreviousConfig()).toEqual(mockConfig);
    });

    it("应该触发配置变更监听器", () => {
      const listener = vi.fn();
      stateManager.subscribe(listener);

      const newConfig = {
        ...mockConfig,
        render: { ...mockConfig.render, fps: 120 },
      } as DuckFlowConfig;

      stateManager.setCurrentConfig(newConfig);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(newConfig, mockConfig);
    });

    it("静默模式下不应触发监听器", () => {
      const listener = vi.fn();
      stateManager.subscribe(listener);

      const newConfig = {
        ...mockConfig,
        render: { ...mockConfig.render, fps: 120 },
      } as DuckFlowConfig;

      stateManager.setCurrentConfig(newConfig, true);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("subscribe/unsubscribe", () => {
    it("应该能够订阅配置变更", () => {
      const listener = vi.fn();
      const unsubscribe = stateManager.subscribe(listener);

      expect(typeof unsubscribe).toBe("function");
      expect(stateManager.getListenerCount()).toBe(1);
    });

    it("应该能够取消订阅", () => {
      const listener = vi.fn();
      const unsubscribe = stateManager.subscribe(listener);

      unsubscribe();

      expect(stateManager.getListenerCount()).toBe(0);
    });

    it("应该支持多个监听器", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      stateManager.subscribe(listener1);
      stateManager.subscribe(listener2);

      const newConfig = {
        ...mockConfig,
        render: { ...mockConfig.render, fps: 120 },
      } as DuckFlowConfig;

      stateManager.setCurrentConfig(newConfig);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it("监听器抛出错误不应影响其他监听器", () => {
      const listener1 = vi.fn(() => {
        throw new Error("Listener 1 error");
      });
      const listener2 = vi.fn();

      stateManager.subscribe(listener1);
      stateManager.subscribe(listener2);

      const newConfig = {
        ...mockConfig,
        render: { ...mockConfig.render, fps: 120 },
      } as DuckFlowConfig;

      // 不应抛出错误
      expect(() => stateManager.setCurrentConfig(newConfig)).not.toThrow();

      // listener2 仍应被调用
      expect(listener2).toHaveBeenCalledTimes(1);
    });
  });

  describe("clearListeners", () => {
    it("应该清空所有监听器", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      stateManager.subscribe(listener1);
      stateManager.subscribe(listener2);

      stateManager.clearListeners();

      expect(stateManager.getListenerCount()).toBe(0);
    });
  });

  describe("getHistory", () => {
    it("应该包含初始配置", () => {
      const history = stateManager.getHistory();

      expect(history).toHaveLength(1);
      expect(history[0].config).toEqual(mockConfig);
      expect(history[0].trigger).toBe("initialization");
    });

    it("应该记录配置变更历史", () => {
      const config2 = {
        ...mockConfig,
        render: { ...mockConfig.render, fps: 120 },
      } as DuckFlowConfig;
      const config3 = {
        ...mockConfig,
        render: { ...mockConfig.render, fps: 144 },
      } as DuckFlowConfig;

      stateManager.setCurrentConfig(config2);
      stateManager.setCurrentConfig(config3);

      const history = stateManager.getHistory();

      expect(history).toHaveLength(3);
      expect(history[0].config).toEqual(mockConfig);
      expect(history[1].config).toEqual(config2);
      expect(history[2].config).toEqual(config3);
    });

    it("应该支持限制历史记录数量", () => {
      for (let i = 0; i < 10; i++) {
        const config = {
          ...mockConfig,
          render: { ...mockConfig.render, fps: 60 + i },
        } as DuckFlowConfig;
        stateManager.setCurrentConfig(config);
      }

      const history = stateManager.getHistory(5);

      expect(history).toHaveLength(5);
    });

    it("应该限制历史记录最大大小", () => {
      const smallStateManager = new ConfigStateManager(mockConfig, 3);

      for (let i = 0; i < 10; i++) {
        const config = {
          ...mockConfig,
          render: { ...mockConfig.render, fps: 60 + i },
        } as DuckFlowConfig;
        smallStateManager.setCurrentConfig(config);
      }

      const history = smallStateManager.getHistory();

      expect(history.length).toBeLessThanOrEqual(3);
    });
  });

  describe("clearHistory", () => {
    it("应该清空历史记录但保留最新一条", () => {
      const config2 = {
        ...mockConfig,
        render: { ...mockConfig.render, fps: 120 },
      } as DuckFlowConfig;
      const config3 = {
        ...mockConfig,
        render: { ...mockConfig.render, fps: 144 },
      } as DuckFlowConfig;

      stateManager.setCurrentConfig(config2);
      stateManager.setCurrentConfig(config3);

      stateManager.clearHistory();

      const history = stateManager.getHistory();

      expect(history).toHaveLength(1);
      expect(history[0].config).toEqual(config3);
    });
  });

  describe("updateConfig", () => {
    it("应该更新配置并记录触发器", () => {
      const newConfig = {
        ...mockConfig,
        render: { ...mockConfig.render, fps: 120 },
      } as DuckFlowConfig;

      stateManager.updateConfig(newConfig, "test-trigger");

      const history = stateManager.getHistory();
      const lastEntry = history[history.length - 1];

      expect(lastEntry.config).toEqual(newConfig);
      expect(lastEntry.trigger).toBe("test-trigger");
    });

    it("应该触发监听器", () => {
      const listener = vi.fn();
      stateManager.subscribe(listener);

      const newConfig = {
        ...mockConfig,
        render: { ...mockConfig.render, fps: 120 },
      } as DuckFlowConfig;

      stateManager.updateConfig(newConfig, "test-trigger");

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe("并发访问", () => {
    it("应该正确处理并发订阅和取消订阅", () => {
      const listeners: ConfigChangeListener[] = [];

      // 并发订阅
      for (let i = 0; i < 10; i++) {
        const listener = vi.fn();
        listeners.push(listener);
        stateManager.subscribe(listener);
      }

      expect(stateManager.getListenerCount()).toBe(10);

      // 并发取消订阅一半
      for (let i = 0; i < 5; i++) {
        stateManager.unsubscribe(listeners[i]);
      }

      expect(stateManager.getListenerCount()).toBe(5);
    });

    it("应该正确处理并发配置更新", () => {
      const listener = vi.fn();
      stateManager.subscribe(listener);

      // 快速连续更新配置
      for (let i = 0; i < 10; i++) {
        const config = {
          ...mockConfig,
          render: { ...mockConfig.render, fps: 60 + i },
        } as DuckFlowConfig;
        stateManager.setCurrentConfig(config);
      }

      expect(listener).toHaveBeenCalledTimes(10);
    });
  });

  describe("错误处理", () => {
    it("监听器异常不应影响状态管理器", () => {
      const errorListener = vi.fn(() => {
        throw new Error("Test error");
      });
      const normalListener = vi.fn();

      stateManager.subscribe(errorListener);
      stateManager.subscribe(normalListener);

      const newConfig = {
        ...mockConfig,
        render: { ...mockConfig.render, fps: 120 },
      } as DuckFlowConfig;

      // 不应抛出错误
      expect(() => stateManager.setCurrentConfig(newConfig)).not.toThrow();

      // 配置应该已更新
      expect(stateManager.getCurrentConfig()).toEqual(newConfig);

      // 正常监听器应该被调用
      expect(normalListener).toHaveBeenCalledTimes(1);
    });
  });
});
