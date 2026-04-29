import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { SchedulerManager } from "../../src/common/event/scheduler-manager";
import type {
  EventConfiguration,
  Scheduler,
} from "../../src/common/event/types";

describe("SchedulerManager", () => {
  let config: EventConfiguration;
  let schedulerManager: SchedulerManager;

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

  afterEach(() => {
    vi.clearAllTimers();
    vi.restoreAllMocks();
  });

  describe("Constructor and Initialization", () => {
    test("should initialize correctly", () => {
      schedulerManager = new SchedulerManager(config);

      expect(schedulerManager.getSchedulerId()).toBeTruthy();
      expect(typeof schedulerManager.getSchedulerId()).toBe("string");
    });

    test("should support custom scheduler configuration", () => {
      const customScheduler: Scheduler = {
        kind: "custom",
        schedule: vi.fn().mockReturnValue(123),
        cancel: vi.fn(),
      };

      const configWithScheduler = { ...config, scheduler: customScheduler };
      schedulerManager = new SchedulerManager(configWithScheduler);

      const info = schedulerManager.getSchedulerInfo();
      expect(info.kind).toBe("custom");
      expect(info.isCustom).toBe(true);
      expect(info.supportsRAF).toBe(false);
    });

    test("should support RAF scheduler", () => {
      const rafScheduler: Scheduler = {
        kind: "raf",
        schedule: vi.fn().mockReturnValue(456),
        cancel: vi.fn(),
      };

      const configWithScheduler = { ...config, scheduler: rafScheduler };
      schedulerManager = new SchedulerManager(configWithScheduler);

      const info = schedulerManager.getSchedulerInfo();
      expect(info.kind).toBe("raf");
      expect(info.isCustom).toBe(true);
      expect(info.supportsRAF).toBe(true);
    });
  });

  describe("Built-in Scheduler Functions", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      schedulerManager = new SchedulerManager(config);
    });

    test("should use setTimeout for delayed scheduling", () => {
      const mockFn = vi.fn();
      const setTimeoutSpy = vi.spyOn(global, "setTimeout");

      const result = schedulerManager.schedule(mockFn, 100);

      expect(setTimeoutSpy).toHaveBeenCalledWith(mockFn, 100);
      expect(result.isRAF).toBe(false);
      expect(result.id).toBeDefined();
    });

    test("should use requestAnimationFrame for immediate scheduling", () => {
      const mockFn = vi.fn();
      const rafSpy = vi
        .spyOn(global, "requestAnimationFrame")
        .mockReturnValue(789);

      const result = schedulerManager.schedule(mockFn, 0, true);

      expect(rafSpy).toHaveBeenCalled();
      expect(result.isRAF).toBe(true);
      expect(result.id).toBe(789);
    });

    test("should fall back to setTimeout when RAF is unavailable", () => {
      const originalRAF = global.requestAnimationFrame;
      // @ts-expect-error - intentionally remove RAF to test fallback mechanism
      delete global.requestAnimationFrame;

      const mockFn = vi.fn();
      const setTimeoutSpy = vi.spyOn(global, "setTimeout");

      const result = schedulerManager.schedule(mockFn, 0, true);

      expect(setTimeoutSpy).toHaveBeenCalledWith(mockFn, 0);
      expect(result.isRAF).toBe(false);

      global.requestAnimationFrame = originalRAF;
    });

    test("should correctly cancel setTimeout scheduling", () => {
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

      schedulerManager.cancel(123, false);

      expect(clearTimeoutSpy).toHaveBeenCalledWith(123);
    });

    test("should correctly cancel RAF scheduling", () => {
      const cancelRAFSpy = vi
        .spyOn(global, "cancelAnimationFrame")
        .mockImplementation(() => {});

      schedulerManager.cancel(456, true);

      expect(cancelRAFSpy).toHaveBeenCalledWith(456);
    });

    test("should fall back to clearTimeout when cancelAnimationFrame is unavailable", () => {
      const originalCancel = global.cancelAnimationFrame;
      // @ts-expect-error - intentionally remove cancelAnimationFrame to test fallback mechanism
      delete global.cancelAnimationFrame;

      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

      schedulerManager.cancel(789, true);

      expect(clearTimeoutSpy).toHaveBeenCalledWith(789);

      global.cancelAnimationFrame = originalCancel;
    });
  });

  describe("Custom Scheduler Functions", () => {
    let customScheduler: Scheduler;

    beforeEach(() => {
      customScheduler = {
        kind: "custom",
        schedule: vi.fn().mockReturnValue(999),
        cancel: vi.fn(),
      };

      const configWithScheduler = { ...config, scheduler: customScheduler };
      schedulerManager = new SchedulerManager(configWithScheduler);
    });

    test("should use custom scheduler for scheduling", () => {
      const mockFn = vi.fn();

      const result = schedulerManager.schedule(mockFn, 50);

      expect(customScheduler.schedule).toHaveBeenCalledWith(mockFn, 50);
      expect(result.id).toBe(999);
      expect(result.isRAF).toBe(false);
    });

    test("should use custom scheduler for cancellation", () => {
      schedulerManager.cancel(999, false);

      expect(customScheduler.cancel).toHaveBeenCalledWith(999);
    });

    test("should correctly identify RAF-type custom scheduler", () => {
      const rafScheduler: Scheduler = {
        kind: "raf",
        schedule: vi.fn().mockReturnValue(888),
        cancel: vi.fn(),
      };

      const configWithRAF = { ...config, scheduler: rafScheduler };
      const rafSchedulerManager = new SchedulerManager(configWithRAF);

      const mockFn = vi.fn();
      const result = rafSchedulerManager.schedule(mockFn, 0);

      expect(result.isRAF).toBe(true);
      expect(result.id).toBe(888);
    });
  });

  describe("Configuration Management", () => {
    beforeEach(() => {
      schedulerManager = new SchedulerManager(config);
    });

    test("should update configuration correctly", () => {
      const newCustomScheduler: Scheduler = {
        kind: "custom",
        schedule: vi.fn(),
        cancel: vi.fn(),
      };

      const newConfig = { ...config, scheduler: newCustomScheduler };
      const changed = schedulerManager.updateConfiguration(newConfig);

      expect(changed).toBe(true);

      const info = schedulerManager.getSchedulerInfo();
      expect(info.kind).toBe("custom");
      expect(info.isCustom).toBe(true);
    });

    test("should detect scheduler reference changes", () => {
      const scheduler1: Scheduler = {
        kind: "custom",
        schedule: vi.fn(),
        cancel: vi.fn(),
      };

      const scheduler2: Scheduler = {
        kind: "custom", // same kind, but different instance
        schedule: vi.fn(),
        cancel: vi.fn(),
      };

      const config1 = { ...config, scheduler: scheduler1 };
      const config2 = { ...config, scheduler: scheduler2 };

      schedulerManager.updateConfiguration(config1);
      const changed = schedulerManager.updateConfiguration(config2);

      expect(changed).toBe(true);
    });

    test("should detect scheduler identity string changes", () => {
      const scheduler1: Scheduler = {
        kind: "timeout",
        schedule: vi.fn(),
        cancel: vi.fn(),
      };

      const scheduler2: Scheduler = {
        kind: "raf",
        schedule: vi.fn(),
        cancel: vi.fn(),
      };

      const config1 = { ...config, scheduler: scheduler1 };
      const config2 = { ...config, scheduler: scheduler2 };

      schedulerManager.updateConfiguration(config1);
      const changed = schedulerManager.updateConfiguration(config2);

      expect(changed).toBe(true);
    });

    test("should return false when there is no change", () => {
      const scheduler: Scheduler = {
        kind: "custom",
        schedule: vi.fn(),
        cancel: vi.fn(),
      };

      const configWithScheduler = { ...config, scheduler };

      schedulerManager.updateConfiguration(configWithScheduler);
      const changed = schedulerManager.updateConfiguration(configWithScheduler);

      expect(changed).toBe(false);
    });
  });

  describe("Scheduler Identity and Information", () => {
    test("should generate correct identity for built-in scheduler", () => {
      schedulerManager = new SchedulerManager(config);

      const id = schedulerManager.getSchedulerId();
      expect(id).toMatch(/^builtin:(raf|timeout)$/);
    });

    test("should generate correct identity for custom scheduler", () => {
      const customScheduler: Scheduler = {
        kind: "custom",
        schedule: vi.fn(),
        cancel: vi.fn(),
      };

      const configWithScheduler = { ...config, scheduler: customScheduler };
      schedulerManager = new SchedulerManager(configWithScheduler);

      const id = schedulerManager.getSchedulerId();
      expect(id).toBe("custom");
    });

    test("should return correct information for built-in scheduler", () => {
      schedulerManager = new SchedulerManager(config);

      const info = schedulerManager.getSchedulerInfo();
      expect(info.isCustom).toBe(false);
      expect(info.kind).toMatch(/^(raf|timeout)$/);
      expect(typeof info.supportsRAF).toBe("boolean");
    });

    test("should return correct information for custom scheduler", () => {
      const customScheduler: Scheduler = {
        kind: "custom",
        schedule: vi.fn(),
        cancel: vi.fn(),
      };

      const configWithScheduler = { ...config, scheduler: customScheduler };
      schedulerManager = new SchedulerManager(configWithScheduler);

      const info = schedulerManager.getSchedulerInfo();
      expect(info.kind).toBe("custom");
      expect(info.isCustom).toBe(true);
      expect(info.supportsRAF).toBe(false);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    beforeEach(() => {
      schedulerManager = new SchedulerManager(config);
    });

    test("should handle scheduling without delay", () => {
      const mockFn = vi.fn();

      const result1 = schedulerManager.schedule(mockFn);
      const result2 = schedulerManager.schedule(mockFn, 0);

      expect(result1.id).toBeDefined();
      expect(result2.id).toBeDefined();
    });

    test("should handle negative delay", () => {
      const mockFn = vi.fn();
      const setTimeoutSpy = vi.spyOn(global, "setTimeout");

      schedulerManager.schedule(mockFn, -10);

      expect(setTimeoutSpy).toHaveBeenCalledWith(mockFn, -10);
    });

    test("should handle scheduler with undefined configuration", () => {
      const configWithUndefined = { ...config, scheduler: undefined };
      schedulerManager = new SchedulerManager(configWithUndefined);

      const id = schedulerManager.getSchedulerId();
      expect(id).toMatch(/^builtin:/);

      const info = schedulerManager.getSchedulerInfo();
      expect(info.isCustom).toBe(false);
    });
  });
});
