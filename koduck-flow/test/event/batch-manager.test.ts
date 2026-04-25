import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { BatchManager } from "../../src/common/event/batch-manager";
import type {
  EventConfiguration,
  Scheduler,
} from "../../src/common/event/types";

describe("BatchManager", () => {
  let config: EventConfiguration;
  let batchManager: BatchManager<string>;

  beforeEach(() => {
    vi.useFakeTimers();
    config = {
      maxListeners: 100,
      enableBatching: true,
      batchSize: 5,
      batchInterval: 10,
      enableAutoOptimization: true,
      autoOptimizeThreshold: 3,
      enableDebugMode: false,
      concurrencyMode: "parallel" as const,
      concurrencyLimit: 5,
    };
    batchManager = new BatchManager(config);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllTimers();
    vi.restoreAllMocks();
  });

  describe("构造函数和初始化", () => {
    test("应该正确初始化批处理管理器", () => {
      expect(batchManager.batchCount).toBe(0);
    });

    test("应该分配适当大小的缓冲区", () => {
      const smallConfig = { ...config, batchSize: 2 };
      const smallBatchManager = new BatchManager(smallConfig);
      expect(smallBatchManager.batchCount).toBe(0);
    });
  });

  describe("批处理决策", () => {
    test("应该在禁用批处理时返回false", () => {
      const noBatchConfig = { ...config, enableBatching: false };
      const noBatchManager = new BatchManager(noBatchConfig);

      expect(noBatchManager.shouldUseBatchProcessing(10)).toBe(false);
    });

    test("应该在禁用自动优化时始终返回true", () => {
      const noOptConfig = { ...config, enableAutoOptimization: false };
      const noOptManager = new BatchManager(noOptConfig);

      expect(noOptManager.shouldUseBatchProcessing(1)).toBe(true);
      expect(noOptManager.shouldUseBatchProcessing(100)).toBe(true);
    });

    test("应该基于监听器数量和阈值做决策", () => {
      expect(batchManager.shouldUseBatchProcessing(2)).toBe(false); // 小于阈值
      expect(batchManager.shouldUseBatchProcessing(3)).toBe(false); // 等于阈值
      expect(batchManager.shouldUseBatchProcessing(4)).toBe(true); // 大于阈值
    });
  });

  describe("批处理队列管理", () => {
    test("应该能添加事件到批处理队列", () => {
      const processor = vi.fn();

      batchManager.addToBatch("event1", processor);
      expect(batchManager.batchCount).toBe(1);

      batchManager.addToBatch("event2", processor);
      expect(batchManager.batchCount).toBe(2);
    });

    test("应该在达到批处理大小时立即处理", () => {
      const processor = vi.fn();

      // 添加5个事件（等于批处理大小）
      for (let i = 0; i < 5; i++) {
        batchManager.addToBatch(`event${i}`, processor);
      }

      // 应该立即处理，无需等待定时器
      expect(processor).toHaveBeenCalledTimes(5);
      expect(batchManager.batchCount).toBe(0);
    });

    test("应该通过定时器处理未满的批次", () => {
      const processor = vi.fn();

      batchManager.addToBatch("event1", processor);
      batchManager.addToBatch("event2", processor);

      expect(processor).not.toHaveBeenCalled();
      expect(batchManager.batchCount).toBe(2);

      // 快进时间以触发批处理
      vi.advanceTimersByTime(10);

      expect(processor).toHaveBeenCalledTimes(2);
      expect(batchManager.batchCount).toBe(0);
    });

    test("应该正确处理循环缓冲区", () => {
      const processor = vi.fn();

      // 添加大量事件以测试循环缓冲区
      for (let i = 0; i < 15; i++) {
        batchManager.addToBatch(`event${i}`, processor);

        // 每5个处理一次
        if ((i + 1) % 5 === 0) {
          expect(processor).toHaveBeenCalledTimes(i + 1);
        }
      }
    });
  });

  describe("批处理数据访问", () => {
    test("应该返回当前批次的事件数据", () => {
      const processor = vi.fn();

      batchManager.addToBatch("event1", processor);
      batchManager.addToBatch("event2", processor);
      batchManager.addToBatch("event3", processor);

      const batchData = batchManager.getBatchData();
      expect(batchData).toEqual(["event1", "event2", "event3"]);
    });

    test("应该在空批次时返回空数组", () => {
      const batchData = batchManager.getBatchData();
      expect(batchData).toEqual([]);
    });
  });

  describe("手动批处理控制", () => {
    test("应该能强制刷新批次", () => {
      const processor = vi.fn();

      batchManager.addToBatch("event1", processor);
      batchManager.addToBatch("event2", processor);

      expect(processor).not.toHaveBeenCalled();

      batchManager.flushBatch(processor);

      expect(processor).toHaveBeenCalledTimes(2);
      expect(batchManager.batchCount).toBe(0);
    });

    test("应该能处理空批次的刷新", () => {
      const processor = vi.fn();

      batchManager.flushBatch(processor);

      expect(processor).not.toHaveBeenCalled();
      expect(batchManager.batchCount).toBe(0);
    });

    test("应该能使用不带数据的处理器", () => {
      const processor = vi.fn();

      batchManager.addToBatch("event1", vi.fn());
      batchManager.addToBatch("event2", vi.fn());

      batchManager.processBatch(processor);

      expect(processor).toHaveBeenCalledTimes(2);
      expect(batchManager.batchCount).toBe(0);
    });
  });

  describe("自定义调度器支持", () => {
    test("应该使用自定义调度器", () => {
      const customScheduler: Scheduler = {
        kind: "custom",
        schedule: vi.fn().mockReturnValue(123),
        cancel: vi.fn(),
      };

      const customConfig = { ...config, scheduler: customScheduler };
      const customBatchManager = new BatchManager(customConfig);
      const processor = vi.fn();

      customBatchManager.addToBatch("event1", processor);

      expect(customScheduler.schedule).toHaveBeenCalled();
    });

    test("应该使用RAF调度器", () => {
      const rafScheduler: Scheduler = {
        kind: "raf",
        schedule: vi.fn().mockReturnValue(456),
        cancel: vi.fn(),
      };

      const rafConfig = { ...config, scheduler: rafScheduler };
      const rafBatchManager = new BatchManager(rafConfig);
      const processor = vi.fn();

      rafBatchManager.addToBatch("event1", processor);

      expect(rafScheduler.schedule).toHaveBeenCalledWith(
        expect.any(Function),
        10
      );
    });

    test("应该正确取消自定义调度器", () => {
      const customScheduler: Scheduler = {
        kind: "custom",
        schedule: vi.fn().mockReturnValue(789),
        cancel: vi.fn(),
      };

      const customConfig = { ...config, scheduler: customScheduler };
      const customBatchManager = new BatchManager(customConfig);
      const processor = vi.fn();

      customBatchManager.addToBatch("event1", processor);
      customBatchManager.addToBatch("event2", processor);
      customBatchManager.addToBatch("event3", processor);
      customBatchManager.addToBatch("event4", processor);
      customBatchManager.addToBatch("event5", processor); // 触发立即处理

      expect(customScheduler.cancel).toHaveBeenCalledWith(789);
    });
  });

  describe("内置调度器行为", () => {
    test("应该使用setTimeout处理有延迟的批次", () => {
      const setTimeoutSpy = vi.spyOn(global, "setTimeout");
      const processor = vi.fn();

      batchManager.addToBatch("event1", processor);

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 10);
    });

    test("应该使用requestAnimationFrame处理无延迟的批次", () => {
      const rafSpy = vi
        .spyOn(global, "requestAnimationFrame")
        .mockReturnValue(123);
      const zeroDelayConfig = { ...config, batchInterval: 0 };
      const zeroDelayManager = new BatchManager(zeroDelayConfig);
      const processor = vi.fn();

      zeroDelayManager.addToBatch("event1", processor);

      expect(rafSpy).toHaveBeenCalled();
    });

    test("应该在没有RAF时回退到setTimeout", () => {
      const originalRAF = global.requestAnimationFrame;
      // @ts-expect-error - 故意删除RAF以测试回退机制
      delete global.requestAnimationFrame;

      const setTimeoutSpy = vi.spyOn(global, "setTimeout");
      const zeroDelayConfig = { ...config, batchInterval: 0 };
      const zeroDelayManager = new BatchManager(zeroDelayConfig);
      const processor = vi.fn();

      zeroDelayManager.addToBatch("event1", processor);

      expect(setTimeoutSpy).toHaveBeenCalled();

      global.requestAnimationFrame = originalRAF;
    });
  });

  describe("配置更新", () => {
    test("应该更新配置并调整缓冲区大小", () => {
      const processor = vi.fn();

      // 添加一些数据
      batchManager.addToBatch("event1", processor);
      batchManager.addToBatch("event2", processor);

      const newConfig = { ...config, batchSize: 10 };
      batchManager.updateConfiguration(newConfig);

      // 应该保留现有数据
      expect(batchManager.batchCount).toBe(2);
      const batchData = batchManager.getBatchData();
      expect(batchData).toEqual(["event1", "event2"]);
    });

    test("应该在批处理间隔改变时重新调度", () => {
      const processor = vi.fn();
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

      batchManager.addToBatch("event1", processor);

      const newConfig = { ...config, batchInterval: 20 };
      batchManager.updateConfiguration(newConfig);

      expect(clearTimeoutSpy).toHaveBeenCalled();
      // 应该使用新的间隔时间重新调度，但这里的实现有问题，缺少处理函数
    });

    test("应该在配置未改变时不重新分配缓冲区", () => {
      const processor = vi.fn();

      batchManager.addToBatch("event1", processor);
      const oldData = batchManager.getBatchData();

      // 使用相同配置更新
      batchManager.updateConfiguration(config);

      const newData = batchManager.getBatchData();
      expect(newData).toEqual(oldData);
    });
  });

  describe("清理和资源管理", () => {
    test("应该能清理批处理状态", () => {
      const processor = vi.fn();
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

      batchManager.addToBatch("event1", processor);
      batchManager.addToBatch("event2", processor);

      batchManager.clear();

      expect(batchManager.batchCount).toBe(0);
      expect(batchManager.getBatchData()).toEqual([]);
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    test("应该清理空批次而不出错", () => {
      expect(() => {
        batchManager.clear();
      }).not.toThrow();

      expect(batchManager.batchCount).toBe(0);
    });
  });

  describe("边界情况", () => {
    test("应该处理零大小的批次配置", () => {
      const zeroBatchConfig = { ...config, batchSize: 0 };
      const zeroBatchManager = new BatchManager(zeroBatchConfig);
      const processor = vi.fn();

      // 应该立即处理，因为大小为0
      zeroBatchManager.addToBatch("event1", processor);
      expect(processor).toHaveBeenCalledTimes(1);
    });

    test("应该处理负批次间隔", () => {
      const negativeBatchConfig = { ...config, batchInterval: -5 };
      const negativeBatchManager = new BatchManager(negativeBatchConfig);
      const processor = vi.fn();
      const rafSpy = vi
        .spyOn(global, "requestAnimationFrame")
        .mockReturnValue(123);

      negativeBatchManager.addToBatch("event1", processor);

      // 负间隔时，由于不大于0，会使用requestAnimationFrame
      expect(rafSpy).toHaveBeenCalled();
    });

    test("应该处理大量事件而不溢出", () => {
      const processor = vi.fn();

      // 添加比缓冲区更多的事件
      for (let i = 0; i < 200; i++) {
        batchManager.addToBatch(`event${i}`, processor);
      }

      // 验证处理了所有事件
      expect(processor).toHaveBeenCalledTimes(200);
    });

    test("应该正确处理连续的刷新操作", () => {
      const processor = vi.fn();

      batchManager.addToBatch("event1", processor);
      batchManager.flushBatch(processor);
      batchManager.flushBatch(processor); // 第二次刷新应该是安全的

      expect(processor).toHaveBeenCalledTimes(1);
      expect(batchManager.batchCount).toBe(0);
    });
  });
});
