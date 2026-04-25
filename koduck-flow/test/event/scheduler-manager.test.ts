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

  describe("构造函数和初始化", () => {
    test("应该正确初始化", () => {
      schedulerManager = new SchedulerManager(config);

      expect(schedulerManager.getSchedulerId()).toBeTruthy();
      expect(typeof schedulerManager.getSchedulerId()).toBe("string");
    });

    test("应该支持自定义调度器配置", () => {
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

    test("应该支持RAF调度器", () => {
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

  describe("内置调度器功能", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      schedulerManager = new SchedulerManager(config);
    });

    test("应该使用setTimeout进行延迟调度", () => {
      const mockFn = vi.fn();
      const setTimeoutSpy = vi.spyOn(global, "setTimeout");

      const result = schedulerManager.schedule(mockFn, 100);

      expect(setTimeoutSpy).toHaveBeenCalledWith(mockFn, 100);
      expect(result.isRAF).toBe(false);
      expect(result.id).toBeDefined();
    });

    test("应该使用requestAnimationFrame进行即时调度", () => {
      const mockFn = vi.fn();
      const rafSpy = vi
        .spyOn(global, "requestAnimationFrame")
        .mockReturnValue(789);

      const result = schedulerManager.schedule(mockFn, 0, true);

      expect(rafSpy).toHaveBeenCalled();
      expect(result.isRAF).toBe(true);
      expect(result.id).toBe(789);
    });

    test("应该在没有RAF时回退到setTimeout", () => {
      const originalRAF = global.requestAnimationFrame;
      // @ts-expect-error - 故意删除RAF以测试回退机制
      delete global.requestAnimationFrame;

      const mockFn = vi.fn();
      const setTimeoutSpy = vi.spyOn(global, "setTimeout");

      const result = schedulerManager.schedule(mockFn, 0, true);

      expect(setTimeoutSpy).toHaveBeenCalledWith(mockFn, 0);
      expect(result.isRAF).toBe(false);

      global.requestAnimationFrame = originalRAF;
    });

    test("应该正确取消setTimeout调度", () => {
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

      schedulerManager.cancel(123, false);

      expect(clearTimeoutSpy).toHaveBeenCalledWith(123);
    });

    test("应该正确取消RAF调度", () => {
      const cancelRAFSpy = vi
        .spyOn(global, "cancelAnimationFrame")
        .mockImplementation(() => {});

      schedulerManager.cancel(456, true);

      expect(cancelRAFSpy).toHaveBeenCalledWith(456);
    });

    test("应该在没有cancelAnimationFrame时回退到clearTimeout", () => {
      const originalCancel = global.cancelAnimationFrame;
      // @ts-expect-error - 故意删除cancelAnimationFrame以测试回退机制
      delete global.cancelAnimationFrame;

      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

      schedulerManager.cancel(789, true);

      expect(clearTimeoutSpy).toHaveBeenCalledWith(789);

      global.cancelAnimationFrame = originalCancel;
    });
  });

  describe("自定义调度器功能", () => {
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

    test("应该使用自定义调度器进行调度", () => {
      const mockFn = vi.fn();

      const result = schedulerManager.schedule(mockFn, 50);

      expect(customScheduler.schedule).toHaveBeenCalledWith(mockFn, 50);
      expect(result.id).toBe(999);
      expect(result.isRAF).toBe(false);
    });

    test("应该使用自定义调度器进行取消", () => {
      schedulerManager.cancel(999, false);

      expect(customScheduler.cancel).toHaveBeenCalledWith(999);
    });

    test("应该正确识别RAF类型的自定义调度器", () => {
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

  describe("配置管理", () => {
    beforeEach(() => {
      schedulerManager = new SchedulerManager(config);
    });

    test("应该正确更新配置", () => {
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

    test("应该检测调度器引用变化", () => {
      const scheduler1: Scheduler = {
        kind: "custom",
        schedule: vi.fn(),
        cancel: vi.fn(),
      };

      const scheduler2: Scheduler = {
        kind: "custom", // 相同kind，但不同实例
        schedule: vi.fn(),
        cancel: vi.fn(),
      };

      const config1 = { ...config, scheduler: scheduler1 };
      const config2 = { ...config, scheduler: scheduler2 };

      schedulerManager.updateConfiguration(config1);
      const changed = schedulerManager.updateConfiguration(config2);

      expect(changed).toBe(true);
    });

    test("应该检测调度器身份字符串变化", () => {
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

    test("应该在无变化时返回false", () => {
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

  describe("调度器身份和信息", () => {
    test("应该为内置调度器生成正确的身份", () => {
      schedulerManager = new SchedulerManager(config);

      const id = schedulerManager.getSchedulerId();
      expect(id).toMatch(/^builtin:(raf|timeout)$/);
    });

    test("应该为自定义调度器生成正确的身份", () => {
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

    test("应该返回内置调度器的正确信息", () => {
      schedulerManager = new SchedulerManager(config);

      const info = schedulerManager.getSchedulerInfo();
      expect(info.isCustom).toBe(false);
      expect(info.kind).toMatch(/^(raf|timeout)$/);
      expect(typeof info.supportsRAF).toBe("boolean");
    });

    test("应该返回自定义调度器的正确信息", () => {
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

  describe("边界情况和错误处理", () => {
    beforeEach(() => {
      schedulerManager = new SchedulerManager(config);
    });

    test("应该处理无延迟的调度", () => {
      const mockFn = vi.fn();

      const result1 = schedulerManager.schedule(mockFn);
      const result2 = schedulerManager.schedule(mockFn, 0);

      expect(result1.id).toBeDefined();
      expect(result2.id).toBeDefined();
    });

    test("应该处理负延迟", () => {
      const mockFn = vi.fn();
      const setTimeoutSpy = vi.spyOn(global, "setTimeout");

      schedulerManager.schedule(mockFn, -10);

      expect(setTimeoutSpy).toHaveBeenCalledWith(mockFn, -10);
    });

    test("应该处理配置为undefined的调度器", () => {
      const configWithUndefined = { ...config, scheduler: undefined };
      schedulerManager = new SchedulerManager(configWithUndefined);

      const id = schedulerManager.getSchedulerId();
      expect(id).toMatch(/^builtin:/);

      const info = schedulerManager.getSchedulerInfo();
      expect(info.isCustom).toBe(false);
    });
  });
});
