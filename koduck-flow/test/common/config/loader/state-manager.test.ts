/**
 * Config state manager unit tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ConfigStateManager } from "../../../../src/common/config/loader/state-manager";
import type { KoduckFlowConfig } from "../../../../src/common/config/schema";
import type { ConfigChangeListener } from "../../../../src/common/config/loader/types/config-state.interface";

describe("ConfigStateManager", () => {
  let stateManager: ConfigStateManager;
  let mockConfig: KoduckFlowConfig;

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
    } as KoduckFlowConfig;

    stateManager = new ConfigStateManager(mockConfig);
  });

  describe("getCurrentConfig", () => {
    it("should return current config", () => {
      const config = stateManager.getCurrentConfig();
      expect(config).toEqual(mockConfig);
    });
  });

  describe("setCurrentConfig", () => {
    it("should update current config", () => {
      const newConfig = {
        ...mockConfig,
        render: { ...mockConfig.render, frameRate: 120 },
      } as KoduckFlowConfig;

      stateManager.setCurrentConfig(newConfig);

      expect(stateManager.getCurrentConfig()).toEqual(newConfig);
      expect(stateManager.getPreviousConfig()).toEqual(mockConfig);
    });

    it("should trigger config change listeners", () => {
      const listener = vi.fn();
      stateManager.subscribe(listener);

      const newConfig = {
        ...mockConfig,
        render: { ...mockConfig.render, fps: 120 },
      } as KoduckFlowConfig;

      stateManager.setCurrentConfig(newConfig);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(newConfig, mockConfig);
    });

    it("should not trigger listeners in silent mode", () => {
      const listener = vi.fn();
      stateManager.subscribe(listener);

      const newConfig = {
        ...mockConfig,
        render: { ...mockConfig.render, fps: 120 },
      } as KoduckFlowConfig;

      stateManager.setCurrentConfig(newConfig, true);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("subscribe/unsubscribe", () => {
    it("should be able to subscribe to config changes", () => {
      const listener = vi.fn();
      const unsubscribe = stateManager.subscribe(listener);

      expect(typeof unsubscribe).toBe("function");
      expect(stateManager.getListenerCount()).toBe(1);
    });

    it("should be able to unsubscribe", () => {
      const listener = vi.fn();
      const unsubscribe = stateManager.subscribe(listener);

      unsubscribe();

      expect(stateManager.getListenerCount()).toBe(0);
    });

    it("should support multiple listeners", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      stateManager.subscribe(listener1);
      stateManager.subscribe(listener2);

      const newConfig = {
        ...mockConfig,
        render: { ...mockConfig.render, fps: 120 },
      } as KoduckFlowConfig;

      stateManager.setCurrentConfig(newConfig);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it("listener errors should not affect other listeners", () => {
      const listener1 = vi.fn(() => {
        throw new Error("Listener 1 error");
      });
      const listener2 = vi.fn();

      stateManager.subscribe(listener1);
      stateManager.subscribe(listener2);

      const newConfig = {
        ...mockConfig,
        render: { ...mockConfig.render, fps: 120 },
      } as KoduckFlowConfig;

      // Should not throw error
      expect(() => stateManager.setCurrentConfig(newConfig)).not.toThrow();

      // listener2 should still be called
      expect(listener2).toHaveBeenCalledTimes(1);
    });
  });

  describe("clearListeners", () => {
    it("should clear all listeners", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      stateManager.subscribe(listener1);
      stateManager.subscribe(listener2);

      stateManager.clearListeners();

      expect(stateManager.getListenerCount()).toBe(0);
    });
  });

  describe("getHistory", () => {
    it("should include initial config", () => {
      const history = stateManager.getHistory();

      expect(history).toHaveLength(1);
      expect(history[0].config).toEqual(mockConfig);
      expect(history[0].trigger).toBe("initialization");
    });

    it("should record config change history", () => {
      const config2 = {
        ...mockConfig,
        render: { ...mockConfig.render, fps: 120 },
      } as KoduckFlowConfig;
      const config3 = {
        ...mockConfig,
        render: { ...mockConfig.render, fps: 144 },
      } as KoduckFlowConfig;

      stateManager.setCurrentConfig(config2);
      stateManager.setCurrentConfig(config3);

      const history = stateManager.getHistory();

      expect(history).toHaveLength(3);
      expect(history[0].config).toEqual(mockConfig);
      expect(history[1].config).toEqual(config2);
      expect(history[2].config).toEqual(config3);
    });

    it("should support limiting history record count", () => {
      for (let i = 0; i < 10; i++) {
        const config = {
          ...mockConfig,
          render: { ...mockConfig.render, fps: 60 + i },
        } as KoduckFlowConfig;
        stateManager.setCurrentConfig(config);
      }

      const history = stateManager.getHistory(5);

      expect(history).toHaveLength(5);
    });

    it("should limit the maximum history size", () => {
      const smallStateManager = new ConfigStateManager(mockConfig, 3);

      for (let i = 0; i < 10; i++) {
        const config = {
          ...mockConfig,
          render: { ...mockConfig.render, fps: 60 + i },
        } as KoduckFlowConfig;
        smallStateManager.setCurrentConfig(config);
      }

      const history = smallStateManager.getHistory();

      expect(history.length).toBeLessThanOrEqual(3);
    });
  });

  describe("clearHistory", () => {
    it("should clear history but keep the latest entry", () => {
      const config2 = {
        ...mockConfig,
        render: { ...mockConfig.render, fps: 120 },
      } as KoduckFlowConfig;
      const config3 = {
        ...mockConfig,
        render: { ...mockConfig.render, fps: 144 },
      } as KoduckFlowConfig;

      stateManager.setCurrentConfig(config2);
      stateManager.setCurrentConfig(config3);

      stateManager.clearHistory();

      const history = stateManager.getHistory();

      expect(history).toHaveLength(1);
      expect(history[0].config).toEqual(config3);
    });
  });

  describe("updateConfig", () => {
    it("should update config and record trigger", () => {
      const newConfig = {
        ...mockConfig,
        render: { ...mockConfig.render, fps: 120 },
      } as KoduckFlowConfig;

      stateManager.updateConfig(newConfig, "test-trigger");

      const history = stateManager.getHistory();
      const lastEntry = history[history.length - 1];

      expect(lastEntry.config).toEqual(newConfig);
      expect(lastEntry.trigger).toBe("test-trigger");
    });

    it("should trigger listeners", () => {
      const listener = vi.fn();
      stateManager.subscribe(listener);

      const newConfig = {
        ...mockConfig,
        render: { ...mockConfig.render, fps: 120 },
      } as KoduckFlowConfig;

      stateManager.updateConfig(newConfig, "test-trigger");

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe("Concurrent access", () => {
    it("should correctly handle concurrent subscribe and unsubscribe", () => {
      const listeners: ConfigChangeListener[] = [];

      // Concurrent subscribe
      for (let i = 0; i < 10; i++) {
        const listener = vi.fn();
        listeners.push(listener);
        stateManager.subscribe(listener);
      }

      expect(stateManager.getListenerCount()).toBe(10);

      // Concurrent unsubscribe half
      for (let i = 0; i < 5; i++) {
        stateManager.unsubscribe(listeners[i]);
      }

      expect(stateManager.getListenerCount()).toBe(5);
    });

    it("should correctly handle concurrent config updates", () => {
      const listener = vi.fn();
      stateManager.subscribe(listener);

      // Rapid consecutive config updates
      for (let i = 0; i < 10; i++) {
        const config = {
          ...mockConfig,
          render: { ...mockConfig.render, fps: 60 + i },
        } as KoduckFlowConfig;
        stateManager.setCurrentConfig(config);
      }

      expect(listener).toHaveBeenCalledTimes(10);
    });
  });

  describe("Error handling", () => {
    it("listener exceptions should not affect the state manager", () => {
      const errorListener = vi.fn(() => {
        throw new Error("Test error");
      });
      const normalListener = vi.fn();

      stateManager.subscribe(errorListener);
      stateManager.subscribe(normalListener);

      const newConfig = {
        ...mockConfig,
        render: { ...mockConfig.render, fps: 120 },
      } as KoduckFlowConfig;

      // Should not throw error
      expect(() => stateManager.setCurrentConfig(newConfig)).not.toThrow();

      // Config should have been updated
      expect(stateManager.getCurrentConfig()).toEqual(newConfig);

      // Normal listener should be called
      expect(normalListener).toHaveBeenCalledTimes(1);
    });
  });
});
