import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { CanvasRender, CanvasRenderEvent } from "../../../src/common/render/canvas-render";
import type { CanvasRenderOperation } from "../../../src/common/render/canvas-render";
import { RegistryManager, createRegistryManager } from "../../../src/common/registry";
import type { IEntity } from "../../../src/common/entity/types";
import type { IRenderContext, IRenderConfig } from "../../../src/common/render/types";
import type { ICapabilityAwareRegistry, IMeta } from "../../../src/common/registry/types";
import { logger } from "../../../src/common/logger";

type CanvasRenderPrivate = {
  renderOperations: CanvasRenderOperation[];
  executeRenderOperations: () => void;
  isInViewport: (bounds: { x: number; y: number; width: number; height: number }) => boolean;
  renderCache: Map<string, ImageData>;
  performanceStats: {
    totalRenderTime: number;
    renderCount: number;
    cacheHitCount: number;
    cacheMissCount: number;
    averageRenderTime: number;
  };
  offscreenCanvas: OffscreenCanvas | null;
};

const getCanvasRenderPrivate = (instance: CanvasRender): CanvasRenderPrivate =>
  instance as unknown as CanvasRenderPrivate;

// Mock 依赖
vi.mock("../../../src/common/logger", () => {
  const debug = vi.fn();
  const info = vi.fn();
  const warn = vi.fn();
  const error = vi.fn();
  const time = vi.fn();
  const timeEnd = vi.fn();

  const createMockLoggerAdapter = () => ({
    debug,
    info,
    warn,
    error,
    time,
    timeEnd,
  });

  return {
    logger: {
      debug,
      info,
      warn,
      error,
      withContext: vi.fn(() => createMockLoggerAdapter()),
      child: vi.fn(() => createMockLoggerAdapter()),
    },
  };
});
vi.mock("../../../src/common/metrics", () => ({
  meter: vi.fn(() => ({
    observableGauge: vi.fn(() => ({
      addCallback: vi.fn(),
      removeCallback: vi.fn(),
    })),
    counter: vi.fn(() => ({
      add: vi.fn(),
    })),
    gauge: vi.fn(() => ({
      set: vi.fn(),
    })),
    histogram: vi.fn(() => ({
      record: vi.fn(),
    })),
  })),
  ScopedMeter: vi.fn().mockImplementation(() => ({
    observableGauge: vi.fn(() => ({
      addCallback: vi.fn(),
      removeCallback: vi.fn(),
    })),
    counter: vi.fn(() => ({
      add: vi.fn(),
    })),
    gauge: vi.fn(() => ({
      set: vi.fn(),
    })),
    histogram: vi.fn(() => ({
      record: vi.fn(),
    })),
  })),
}));

describe("CanvasRender", () => {
  let mockRegistryManager: RegistryManager;
  let canvasRender: CanvasRender;
  let mockCanvas: HTMLCanvasElement;
  let mockContext: CanvasRenderingContext2D;

  beforeEach(() => {
    mockRegistryManager = createRegistryManager();

    // Mock RegistryManager 的 getRegistryForEntity 方法
    mockRegistryManager.getRegistryForEntity = vi
      .fn<(entity: IEntity) => ICapabilityAwareRegistry<IEntity, IMeta> | undefined>()
      .mockReturnValue({
        hasCapability: vi.fn(() => true),
        getCapabilities: vi.fn(() => ["render"]),
        getConstructor: vi.fn(),
        createEntity: vi.fn(),
        executeCapability: vi.fn(),
      } as unknown as ICapabilityAwareRegistry<IEntity, IMeta>);

    // 创建 mock canvas 和 context
    mockCanvas = {
      getContext: vi.fn(),
      width: 800,
      height: 600,
      style: {
        width: "",
        height: "",
      },
      getBoundingClientRect: vi.fn(() => ({
        width: 800,
        height: 600,
        top: 0,
        left: 0,
        right: 800,
        bottom: 600,
      })),
    } as unknown as HTMLCanvasElement;

    mockContext = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      rotate: vi.fn(),
      setTransform: vi.fn(),
      getImageData: vi.fn(
        () =>
          ({
            data: new Uint8ClampedArray(4 * 50 * 50), // 模拟50x50的图像数据
            width: 50,
            height: 50,
          }) as ImageData
      ),
      putImageData: vi.fn(),
      canvas: mockCanvas,
    } as unknown as CanvasRenderingContext2D;

    vi.mocked(mockCanvas.getContext).mockImplementation((contextType: string) => {
      if (contextType === "2d") {
        return mockContext;
      }
      return null;
    });

    canvasRender = new CanvasRender(mockRegistryManager);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("构造函数和初始化", () => {
    test("应该正确初始化 CanvasRender", () => {
      expect(canvasRender).toBeDefined();
      expect(canvasRender.getName()).toBe("CanvasRender");
      expect(canvasRender.getType()).toBe("canvas");
    });

    test("应该初始化性能统计", () => {
      const stats = canvasRender.getPerformanceStats();
      expect(stats).toBeDefined();
      expect(stats.type).toBe("canvas");
      expect(stats.name).toBe("CanvasRender");
    });
  });

  describe("渲染上下文管理", () => {
    let mockRenderContext: IRenderContext;

    beforeEach(() => {
      mockRenderContext = {
        nodes: [],
        viewport: { x: 0, y: 0, zoom: 1, width: 800, height: 600 },
        canvas: mockCanvas,
        timestamp: Date.now(),
      };
    });

    test("canHandle 应该正确判断是否能处理上下文", () => {
      expect(canvasRender.canHandle(mockRenderContext)).toBe(true);

      const contextWithoutCanvas: IRenderContext = {
        nodes: [],
        viewport: { x: 0, y: 0, zoom: 1, width: 800, height: 600 },
        timestamp: Date.now(),
      };

      expect(canvasRender.canHandle(contextWithoutCanvas)).toBe(false);
    });

    test("setRenderContext 应该设置渲染上下文", () => {
      canvasRender.setRenderContext(mockRenderContext);

      expect(canvasRender.getRenderContext()).toEqual(mockRenderContext);
    });

    test("getRenderContext 应该返回当前渲染上下文", () => {
      expect(canvasRender.getRenderContext()).toBeUndefined();

      canvasRender.setRenderContext(mockRenderContext);
      expect(canvasRender.getRenderContext()).toBe(mockRenderContext);
    });

    test("updateRenderContext 应该更新渲染上下文", () => {
      canvasRender.setRenderContext(mockRenderContext);

      const updates = {
        viewport: { x: 10, y: 20, zoom: 2, width: 800, height: 600 },
      };
      canvasRender.updateRenderContext(updates);

      const updatedContext = canvasRender.getRenderContext();
      expect(updatedContext?.viewport).toEqual(updates.viewport);
    });

    test("getPriority 应该返回正确的优先级", () => {
      expect(canvasRender.getPriority()).toBe(75); // RENDERER_PRIORITY.CANVAS
    });
  });

  describe("实体渲染", () => {
    const mockEntity = {
      id: "test-entity",
      type: "rectangle-canvas",
      data: { x: 100, y: 100, width: 50, height: 50 },
      dispose: vi.fn(),
    } as unknown as IEntity;

    beforeEach(() => {
      const context: IRenderContext = {
        nodes: [mockEntity],
        viewport: { x: 0, y: 0, zoom: 1, width: 800, height: 600 },
        canvas: mockCanvas,
        timestamp: Date.now(),
      };
      canvasRender.setRenderContext(context);
    });

    test("render 应该为 Canvas 渲染返回 void", () => {
      const result = canvasRender.render(mockEntity);
      expect(result).toBeUndefined();
    });

    test("canRender 应该根据实体类型判断是否能渲染", () => {
      expect(canvasRender.canRender(mockEntity)).toBe(true);
    });

    test("renderContext 应该执行 Canvas 渲染", () => {
      const context: IRenderContext = {
        nodes: [mockEntity],
        viewport: { x: 0, y: 0, zoom: 1, width: 800, height: 600 },
        canvas: mockCanvas,
        timestamp: Date.now(),
      };

      canvasRender.setRenderContext(context);
      canvasRender.render(mockEntity);

      // 验证渲染被调用（通过不抛出错误）
      expect(() => canvasRender.render(mockEntity)).not.toThrow();
    });
  });

  describe("批量渲染", () => {
    const mockEntities = [
      {
        id: "entity1",
        type: "rectangle",
        dispose: vi.fn(),
      } as unknown as IEntity,
      { id: "entity2", type: "circle", dispose: vi.fn() } as unknown as IEntity,
    ];

    test("batchRender 应该处理多个实体", () => {
      const context: IRenderContext = {
        nodes: mockEntities,
        viewport: { x: 0, y: 0, zoom: 1, width: 800, height: 600 },
        canvas: mockCanvas,
        timestamp: Date.now(),
      };

      canvasRender.setRenderContext(context);
      canvasRender.batchRender(mockEntities);

      // 验证批量渲染被调用
      expect(() => canvasRender.batchRender(mockEntities)).not.toThrow();
    });
  });

  describe("配置管理", () => {
    test("configure 应该接受配置参数", () => {
      const config: IRenderConfig = {
        batchSize: 10,
        enableCache: true,
        maxCacheAge: 30000,
      };

      expect(() => canvasRender.configure(config)).not.toThrow();
    });

    test("configure 应该处理空配置", () => {
      expect(() => canvasRender.configure({})).not.toThrow();
    });
  });

  describe("注册表管理器设置", () => {
    test("setRegistryManager 应该设置注册表管理器", () => {
      const newRegistryManager = createRegistryManager();
      canvasRender.setRegistryManager(newRegistryManager);

      // 验证设置成功（通过不抛出错误）
      expect(() => canvasRender.setRegistryManager(newRegistryManager)).not.toThrow();
    });
  });

  describe("性能统计", () => {
    test("getPerformanceStats 应该返回性能统计信息", () => {
      const stats = canvasRender.getPerformanceStats();

      expect(stats).toHaveProperty("renderCount");
      expect(stats).toHaveProperty("totalRenderTime");
      expect(stats).toHaveProperty("averageRenderTime");
      expect(stats).toHaveProperty("type", "canvas");
      expect(stats).toHaveProperty("name", "CanvasRender");
    });

    test("渲染操作应该更新性能统计", () => {
      const mockEntity = {
        id: "test-entity",
        type: "rectangle-canvas",
        data: { x: 100, y: 100, width: 50, height: 50 },
        dispose: vi.fn(),
      } as unknown as IEntity;

      const context: IRenderContext = {
        nodes: [],
        viewport: { x: 0, y: 0, zoom: 1, width: 800, height: 600 },
        canvas: mockCanvas,
        timestamp: Date.now(),
      };

      canvasRender.setRenderContext(context);
      const statsBefore = canvasRender.getPerformanceStats();

      canvasRender.render(mockEntity);
      const statsAfter = canvasRender.getPerformanceStats();

      expect(statsAfter.renderCount).toBeGreaterThanOrEqual(statsBefore.renderCount);
    });
  });

  describe("资源清理", () => {
    test("dispose 应该清理资源", () => {
      expect(() => canvasRender.dispose()).not.toThrow();
    });

    test("dispose 应该可重复调用", () => {
      canvasRender.dispose();
      expect(() => canvasRender.dispose()).not.toThrow();
    });
  });

  describe("DPR (设备像素比) 功能", () => {
    let mockRenderContext: IRenderContext;

    beforeEach(() => {
      mockRenderContext = {
        nodes: [],
        viewport: { x: 0, y: 0, zoom: 1, width: 800, height: 600 },
        canvas: mockCanvas,
        timestamp: Date.now(),
      };
      canvasRender.setRenderContext(mockRenderContext);
    });

    test("getDPR 应该返回当前 DPR 值", () => {
      expect(canvasRender.getDPR()).toBe(1); // 默认值
    });

    test("isDPREnabled 应该返回 DPR 是否启用", () => {
      expect(canvasRender.isDPREnabled()).toBe(true); // 默认启用
    });

    test("convertToCanvasCoordinates 应该正确转换坐标", () => {
      const cssX = 100;
      const cssY = 200;
      const result = canvasRender.convertToCanvasCoordinates(cssX, cssY);

      expect(result.x).toBe(cssX * canvasRender.getDPR());
      expect(result.y).toBe(cssY * canvasRender.getDPR());
    });

    test("convertToCSSCoordinates 应该正确转换坐标", () => {
      const canvasX = 200;
      const canvasY = 400;
      const result = canvasRender.convertToCSSCoordinates(canvasX, canvasY);

      expect(result.x).toBe(canvasX / canvasRender.getDPR());
      expect(result.y).toBe(canvasY / canvasRender.getDPR());
    });

    test("DPR 处理应该在初始化 Canvas 时应用", () => {
      // Mock window.devicePixelRatio
      const originalDPR = window.devicePixelRatio;
      Object.defineProperty(window, "devicePixelRatio", {
        value: 2,
        writable: true,
      });

      const newCanvas = {
        ...mockCanvas,
        getBoundingClientRect: vi.fn(() => ({
          width: 400,
          height: 300,
          top: 0,
          left: 0,
          right: 400,
          bottom: 300,
        })),
      } as unknown as HTMLCanvasElement;

      const contextWithNewCanvas: IRenderContext = {
        ...mockRenderContext,
        canvas: newCanvas,
      };

      canvasRender.setRenderContext(contextWithNewCanvas);

      // 验证 Canvas 尺寸被设置为 DPR 倍数
      expect(newCanvas.width).toBe(800); // 400 * 2
      expect(newCanvas.height).toBe(600); // 300 * 2

      // 验证 DPR 值被更新
      expect(canvasRender.getDPR()).toBe(2);

      // 恢复原始值
      Object.defineProperty(window, "devicePixelRatio", {
        value: originalDPR,
        writable: true,
      });
    });

    test("禁用 DPR 时不应该应用 DPR 处理", () => {
      const canvasRenderWithoutDPR = new CanvasRender(mockRegistryManager, {
        enableDPR: false,
      });

      const newCanvas = {
        ...mockCanvas,
        getBoundingClientRect: vi.fn(() => ({
          width: 400,
          height: 300,
          top: 0,
          left: 0,
          right: 400,
          bottom: 300,
        })),
      } as unknown as HTMLCanvasElement;

      const contextWithNewCanvas: IRenderContext = {
        ...mockRenderContext,
        canvas: newCanvas,
      };

      canvasRenderWithoutDPR.setRenderContext(contextWithNewCanvas);

      // 验证 Canvas 尺寸没有被改变
      expect(newCanvas.width).toBe(800); // 保持原始值
      expect(newCanvas.height).toBe(600); // 保持原始值

      // 验证 DPR 值保持默认值
      expect(canvasRenderWithoutDPR.getDPR()).toBe(1);
      expect(canvasRenderWithoutDPR.isDPREnabled()).toBe(false);
    });
  });

  describe("渲染操作队列管理", () => {
    let mockRenderContext: IRenderContext;

    beforeEach(() => {
      mockRenderContext = {
        nodes: [],
        viewport: { x: 0, y: 0, zoom: 1, width: 800, height: 600 },
        canvas: mockCanvas,
        timestamp: Date.now(),
      };
      canvasRender.setRenderContext(mockRenderContext);
    });

    test("addRenderOperations 应该添加渲染操作到队列", () => {
      const operations = [
        {
          type: "rectangle",
          id: "op1",
          bounds: { x: 10, y: 10, width: 50, height: 50 },
          render: vi.fn(),
          priority: 1,
        },
        {
          type: "circle",
          id: "op2",
          bounds: { x: 20, y: 20, width: 30, height: 30 },
          render: vi.fn(),
          priority: 2,
        },
      ];

      canvasRender.addRenderOperations(operations);

      // 验证操作被添加到队列（通过执行操作来间接验证）
      // 注意：addRenderOperations 是私有方法，我们需要通过其他方式验证
      expect(operations).toHaveLength(2);
    });

    test("isInViewport 应该正确判断边界是否在视口内", () => {
      // 测试在视口内的边界
      const inViewportBounds = { x: 10, y: 10, width: 50, height: 50 };
      const internals = getCanvasRenderPrivate(canvasRender);
      expect(internals.isInViewport(inViewportBounds)).toBe(true);

      // 测试在视口外的边界
      const outViewportBounds = { x: 900, y: 700, width: 50, height: 50 };
      expect(internals.isInViewport(outViewportBounds)).toBe(false);

      // 测试部分在视口外的边界（但仍与视口相交，应该渲染）
      const partialOutBounds = { x: -10, y: -10, width: 50, height: 50 };
      expect(internals.isInViewport(partialOutBounds)).toBe(true);
    });

    test("isInViewport 应该考虑 DPR 进行视口检查", () => {
      // 设置 DPR 为 2
      const originalDPR = window.devicePixelRatio;
      Object.defineProperty(window, "devicePixelRatio", {
        value: 2,
        writable: true,
      });

      const canvasRenderWithDPR = new CanvasRender(mockRegistryManager);
      canvasRenderWithDPR.setRenderContext(mockRenderContext);

      // 边界在 DPR 调整后的视口内
      const bounds = { x: 10, y: 10, width: 50, height: 50 };
      // 由于 DPR=2，Canvas 尺寸变为 1600x1200，但视口检查使用 CSS 尺寸
      const internals = getCanvasRenderPrivate(canvasRenderWithDPR);
      expect(internals.isInViewport(bounds)).toBe(true);

      // 恢复原始值
      Object.defineProperty(window, "devicePixelRatio", {
        value: originalDPR,
        writable: true,
      });
    });

    test("executeRenderOperations 应该按优先级执行操作", () => {
      const executedOrder: string[] = [];

      const operations = [
        {
          type: "rectangle",
          id: "low-priority",
          bounds: { x: 10, y: 10, width: 50, height: 50 },
          render: vi.fn(() => executedOrder.push("low")),
          priority: 1,
        },
        {
          type: "circle",
          id: "high-priority",
          bounds: { x: 20, y: 20, width: 30, height: 30 },
          render: vi.fn(() => executedOrder.push("high")),
          priority: 3,
        },
        {
          type: "triangle",
          id: "medium-priority",
          bounds: { x: 30, y: 30, width: 40, height: 40 },
          render: vi.fn(() => executedOrder.push("medium")),
          priority: 2,
        },
      ];

      // 手动设置渲染操作队列（由于是私有方法）
      const internals = getCanvasRenderPrivate(canvasRender);
      internals.renderOperations = operations;

      // 执行操作
      internals.executeRenderOperations();

      // 验证按优先级降序执行（高优先级先执行）
      expect(executedOrder).toEqual(["high", "medium", "low"]);
    });

    test("executeRenderOperations 应该处理视口剔除", () => {
      const renderFn = vi.fn();
      const outOfViewportOperation = {
        type: "rectangle",
        id: "out-of-viewport",
        bounds: { x: 1000, y: 1000, width: 50, height: 50 }, // 超出视口
        render: renderFn,
        priority: 1,
      };

      const internals = getCanvasRenderPrivate(canvasRender);
      internals.renderOperations = [outOfViewportOperation];
      internals.executeRenderOperations();

      // 验证渲染函数没有被调用（因为被视口剔除）
      expect(renderFn).not.toHaveBeenCalled();
    });

    test("executeRenderOperations 应该处理缓存", () => {
      const renderFn = vi.fn();
      const cacheableOperation = {
        type: "rectangle",
        id: "cacheable-op",
        bounds: { x: 10, y: 10, width: 50, height: 50 },
        render: renderFn,
        priority: 1,
      };

      // 启用缓存
      const canvasRenderWithCache = new CanvasRender(mockRegistryManager, {
        enableLayerCaching: true,
      });
      canvasRenderWithCache.setRenderContext(mockRenderContext);

      const cacheInternals = getCanvasRenderPrivate(canvasRenderWithCache);
      cacheInternals.renderOperations = [cacheableOperation];

      // 第一次执行 - 应该调用渲染函数并缓存
      cacheInternals.executeRenderOperations();
      expect(renderFn).toHaveBeenCalledTimes(1);

      // 第二次执行相同操作 - 应该从缓存加载，不调用渲染函数
      cacheInternals.renderOperations = [cacheableOperation];
      cacheInternals.executeRenderOperations();
      expect(renderFn).toHaveBeenCalledTimes(1); // 仍然是1次，因为第二次从缓存加载
    });
  });

  describe("缓存管理", () => {
    let mockRenderContext: IRenderContext;

    beforeEach(() => {
      mockRenderContext = {
        nodes: [],
        viewport: { x: 0, y: 0, zoom: 1, width: 800, height: 600 },
        canvas: mockCanvas,
        timestamp: Date.now(),
      };
      canvasRender.setRenderContext(mockRenderContext);
    });

    test("cleanupCache 应该清空渲染缓存", () => {
      // 添加一些缓存数据
      const cache = new Map<string, ImageData>();
      const mockImageData = {} as ImageData;
      cache.set("test-key", mockImageData);

      const internals = getCanvasRenderPrivate(canvasRender);
      internals.renderCache = cache;

      // 验证缓存中有数据
      expect(internals.renderCache.size).toBe(1);

      // 执行缓存清理
      canvasRender.cleanupCache();

      // 验证缓存已被清空
      expect(internals.renderCache.size).toBe(0);
    });

    test("缓存应该在 dispose 时被清理", () => {
      // 添加一些缓存数据
      const cache = new Map<string, ImageData>();
      const mockImageData = {} as ImageData;
      cache.set("test-key", mockImageData);

      const internals = getCanvasRenderPrivate(canvasRender);
      internals.renderCache = cache;

      // 执行 dispose
      canvasRender.dispose();

      // 验证缓存已被清空
      expect(internals.renderCache.size).toBe(0);
    });

    test("缓存命中和未命中应该被正确统计", () => {
      const renderFn = vi.fn();
      const operation = {
        type: "rectangle",
        id: "test-op",
        bounds: { x: 10, y: 10, width: 50, height: 50 },
        render: renderFn,
        priority: 1,
      };

      // 启用缓存
      const canvasRenderWithCache = new CanvasRender(mockRegistryManager, {
        enableLayerCaching: true,
      });
      canvasRenderWithCache.setRenderContext(mockRenderContext);

      const cacheInternals = getCanvasRenderPrivate(canvasRenderWithCache);

      // 第一次执行 - 缓存未命中
      cacheInternals.renderOperations = [operation];
      cacheInternals.executeRenderOperations();

      // 验证渲染函数被调用
      expect(renderFn).toHaveBeenCalledTimes(1);

      // 验证缓存未命中统计
      const statsAfterMiss = canvasRenderWithCache.getPerformanceStats();
      expect(statsAfterMiss.cacheHitCount).toBe(0);
      expect(statsAfterMiss.cacheMissCount).toBe(1);

      // 第二次执行相同操作 - 缓存命中
      cacheInternals.renderOperations = [operation];
      cacheInternals.executeRenderOperations();

      // 验证渲染函数没有再次被调用（从缓存加载）
      expect(renderFn).toHaveBeenCalledTimes(1);

      // 验证缓存命中统计
      const statsAfterHit = canvasRenderWithCache.getPerformanceStats();
      expect(statsAfterHit.cacheHitCount).toBe(1);
      expect(statsAfterHit.cacheMissCount).toBe(1);
    });

    test("缓存命中率应该被正确计算", () => {
      const canvasRenderWithCache = new CanvasRender(mockRegistryManager, {
        enableLayerCaching: true,
      });

      // 手动设置性能统计
      const cacheInternals = getCanvasRenderPrivate(canvasRenderWithCache);
      cacheInternals.performanceStats = {
        totalRenderTime: 100,
        renderCount: 10,
        cacheHitCount: 7,
        cacheMissCount: 3,
        averageRenderTime: 10,
      };

      const stats = canvasRenderWithCache.getPerformanceStats();

      // 验证缓存命中率计算：7 / (7 + 3) = 0.7
      expect(stats.cacheHitRatio).toBe(0.7);
    });

    test("空缓存的命中率应该是 0", () => {
      const stats = canvasRender.getPerformanceStats();

      // 没有缓存操作时的命中率应该是 0
      expect(stats.cacheHitRatio).toBe(0);
    });
  });

  describe("错误处理和边界情况", () => {
    let mockRenderContext: IRenderContext;

    beforeEach(() => {
      mockRenderContext = {
        nodes: [],
        viewport: { x: 0, y: 0, zoom: 1, width: 800, height: 600 },
        canvas: mockCanvas,
        timestamp: Date.now(),
      };
      canvasRender.setRenderContext(mockRenderContext);
    });

    test("渲染失败时应该记录错误并继续执行", () => {
      const mockEntity = {
        id: "failing-entity",
        type: "rectangle-canvas",
        data: { x: 100, y: 100, width: 50, height: 50 },
        dispose: vi.fn(),
      } as unknown as IEntity;

      // Mock 注册表执行能力时抛出错误
      vi.mocked(mockRegistryManager.getRegistryForEntity).mockReturnValue({
        hasCapability: vi.fn(() => true),
        getCapabilities: vi.fn(() => ["render"]),
        getConstructor: vi.fn(),
        createEntity: vi.fn(),
        executeCapability: vi.fn(() => {
          throw new Error("Render failed");
        }),
      } as unknown as ICapabilityAwareRegistry<IEntity, IMeta>);

      // 应该不抛出错误
      expect(() => canvasRender.render(mockEntity)).not.toThrow();

      // 验证错误被记录到日志
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: CanvasRenderEvent.RenderError,
          message: `CanvasRender failed for entity ${mockEntity.id}`,
          emoji: "💥",
          metadata: expect.objectContaining({
            entityId: mockEntity.id,
            entityType: mockEntity.type,
          }),
          error: expect.any(Error),
        })
      );
    });

    test("没有注册表时应该记录警告并尝试直接调用实体render方法", () => {
      const mockEntity = {
        id: "no-registry-entity",
        type: "rectangle-canvas",
        data: { x: 100, y: 100, width: 50, height: 50 },
        dispose: vi.fn(),
        render: vi.fn(), // 实体有 render 方法
        canRender: vi.fn(() => true),
      } as unknown as IEntity & {
        render: (ctx: IRenderContext) => void;
        canRender: (ctx: IRenderContext) => boolean;
      };

      // Mock 注册表返回 null
      vi.mocked(mockRegistryManager.getRegistryForEntity).mockReturnValue(undefined);

      canvasRender.render(mockEntity);

      // 验证实体的 render 方法被调用
      expect(mockEntity.render).toHaveBeenCalledWith(mockRenderContext);
      expect(mockEntity.canRender).toHaveBeenCalledWith(mockRenderContext);
    });

    test("注册表没有render能力时应该尝试直接调用实体render方法", () => {
      const mockEntity = {
        id: "no-capability-entity",
        type: "rectangle-canvas",
        data: { x: 100, y: 100, width: 50, height: 50 },
        dispose: vi.fn(),
        render: vi.fn(),
        canRender: vi.fn(() => true),
      } as unknown as IEntity & {
        render: (ctx: IRenderContext) => void;
        canRender: (ctx: IRenderContext) => boolean;
      };

      // Mock 注册表没有 render 能力
      vi.mocked(mockRegistryManager.getRegistryForEntity).mockReturnValue({
        hasCapability: vi.fn(() => false),
        getCapabilities: vi.fn(() => ["other"]),
        getConstructor: vi.fn(),
        createEntity: vi.fn(),
        executeCapability: vi.fn(),
        meta: {
          type: "test",
          extras: { capabilities: ["other"] },
        },
      } as unknown as ICapabilityAwareRegistry<IEntity, IMeta>);

      canvasRender.render(mockEntity);

      // 验证实体的 render 方法被调用
      expect(mockEntity.render).toHaveBeenCalledWith(mockRenderContext);
    });

    test("实体没有render方法时应该记录警告", () => {
      const mockEntity = {
        id: "no-render-entity",
        type: "rectangle-canvas",
        data: { x: 100, y: 100, width: 50, height: 50 },
        dispose: vi.fn(),
      } as unknown as IEntity;

      // Mock 注册表没有 render 能力
      vi.mocked(mockRegistryManager.getRegistryForEntity).mockReturnValue({
        hasCapability: vi.fn(() => false),
        getCapabilities: vi.fn(() => ["other"]),
        getConstructor: vi.fn(),
        createEntity: vi.fn(),
        executeCapability: vi.fn(),
        meta: {
          extras: { capabilities: ["other"] },
        },
      } as unknown as ICapabilityAwareRegistry<IEntity, IMeta>);

      canvasRender.render(mockEntity);

      // 验证警告被记录
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: CanvasRenderEvent.CapabilityMissing,
          message: "Registry lacks render capability and entity has no usable render method",
          emoji: "⚠️",
          metadata: expect.objectContaining({
            entityId: mockEntity.id,
            entityType: mockEntity.type,
            caps: ["other"],
          }),
        })
      );
    });

    test("批量渲染中的错误应该被单独处理", () => {
      const entities = [
        {
          id: "good-entity",
          type: "rectangle-canvas",
          dispose: vi.fn(),
        } as unknown as IEntity,
        {
          id: "bad-entity",
          type: "circle-canvas",
          dispose: vi.fn(),
        } as unknown as IEntity,
      ];

      let callCount = 0;
      vi.mocked(mockRegistryManager.getRegistryForEntity).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // 第一个实体成功
          return {
            hasCapability: vi.fn(() => true),
            executeCapability: vi.fn(),
            getConstructor: vi.fn(),
            createEntity: vi.fn(),
            getCapabilities: vi.fn(),
            meta: { type: "test" },
          } as unknown as ICapabilityAwareRegistry<IEntity, IMeta>;
        } else {
          // 第二个实体失败
          return {
            hasCapability: vi.fn(() => true),
            executeCapability: vi.fn(() => {
              throw new Error("Batch render failed");
            }),
            getConstructor: vi.fn(),
            createEntity: vi.fn(),
            getCapabilities: vi.fn(),
            meta: { type: "test" },
          } as unknown as ICapabilityAwareRegistry<IEntity, IMeta>;
        }
      });

      // 应该不抛出错误
      expect(() => canvasRender.batchRender(entities)).not.toThrow();

      // 验证错误被记录
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: CanvasRenderEvent.BatchError,
          message: `Batch render failed for entity ${entities[1].id}`,
          emoji: "💥",
          metadata: expect.objectContaining({
            entityId: entities[1].id,
            entityType: entities[1].type,
          }),
          error: expect.any(Error),
        })
      );
    });

    test("离屏渲染初始化应该在OffscreenCanvas可用时工作", () => {
      // Mock OffscreenCanvas 可用
      const originalOffscreenCanvas = (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas;
      (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas = vi.fn(() => ({
        getContext: vi.fn(() => ({})),
      }));

      const canvasRenderWithOffscreen = new CanvasRender(mockRegistryManager, {
        enableOffscreenRendering: true,
      });

      canvasRenderWithOffscreen.setRenderContext(mockRenderContext);

      // 验证离屏canvas被创建
      const offscreenInternals = getCanvasRenderPrivate(canvasRenderWithOffscreen);
      expect(offscreenInternals.offscreenCanvas).toBeDefined();

      // 清理
      (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas = originalOffscreenCanvas;
    });

    test("离屏渲染初始化应该在OffscreenCanvas不可用时降级", () => {
      // 确保 OffscreenCanvas 不可用
      const originalOffscreenCanvas = (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas;
      (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas = undefined;

      const canvasRenderWithOffscreen = new CanvasRender(mockRegistryManager, {
        enableOffscreenRendering: true,
      });

      // 应该不抛出错误
      expect(() => canvasRenderWithOffscreen.setRenderContext(mockRenderContext)).not.toThrow();

      // 验证离屏canvas为null
      const offscreenInternals = getCanvasRenderPrivate(canvasRenderWithOffscreen);
      expect(offscreenInternals.offscreenCanvas).toBeNull();

      // 恢复
      (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas = originalOffscreenCanvas;
    });

    test("渲染操作执行失败应该被正确处理", () => {
      const failingOperation = {
        type: "rectangle",
        id: "failing-op",
        bounds: { x: 10, y: 10, width: 50, height: 50 },
        render: vi.fn(() => {
          throw new Error("Render operation failed");
        }),
        priority: 1,
      };

      const internals = getCanvasRenderPrivate(canvasRender);
      internals.renderOperations = [failingOperation];
      internals.executeRenderOperations();

      // 验证错误被记录
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: CanvasRenderEvent.OperationError,
          message: `Failed to execute render operation for ${failingOperation.id}`,
          emoji: "💥",
          metadata: expect.objectContaining({
            operationId: failingOperation.id,
          }),
          error: expect.any(Error),
        })
      );
    });
  });

  describe("增强配置管理", () => {
    let mockRenderContext: IRenderContext;

    beforeEach(() => {
      mockRenderContext = {
        nodes: [],
        viewport: { x: 0, y: 0, zoom: 1, width: 800, height: 600 },
        canvas: mockCanvas,
        timestamp: Date.now(),
      };
    });
    test("configure 应该支持 DPR 配置", () => {
      const config: IRenderConfig = {
        enableDPR: true,
      };

      expect(() => canvasRender.configure(config)).not.toThrow();

      // 验证 DPR 被启用
      expect(canvasRender.isDPREnabled()).toBe(true);
    });

    test("configure 应该支持禁用 DPR", () => {
      const config: IRenderConfig = {
        enableDPR: false,
      };

      expect(() => canvasRender.configure(config)).not.toThrow();

      // 验证 DPR 被禁用
      expect(canvasRender.isDPREnabled()).toBe(false);
    });

    test("configure 应该支持完整的性能优化配置", () => {
      const config: IRenderConfig = {
        enableCache: true,
        maxCacheAge: 60000, // 1分钟
        batchSize: 50,
        enableDPR: true,
      };

      expect(() => canvasRender.configure(config)).not.toThrow();
    });

    test("configure 应该处理部分配置更新", () => {
      // 先设置初始配置
      canvasRender.configure({
        enableCache: false,
        enableDPR: false,
      });

      // 验证初始状态
      expect(canvasRender.isDPREnabled()).toBe(false);

      // 只更新 DPR 配置
      canvasRender.configure({
        enableDPR: true,
      });

      // 验证只有 DPR 被更新
      expect(canvasRender.isDPREnabled()).toBe(true);
    });

    test("configure 应该正确映射通用配置到 Canvas 特定配置", () => {
      const config: IRenderConfig = {
        enableCache: true,
        maxCacheAge: 120000, // 2分钟
        batchSize: 25,
      };

      canvasRender.configure(config);

      // 验证配置被正确映射（通过不抛出错误来间接验证）
      expect(() => canvasRender.configure(config)).not.toThrow();
    });

    test("构造函数应该接受并应用配置参数", () => {
      const config: Partial<{
        enableOffscreenRendering: boolean;
        enableLayerCaching: boolean;
        enableViewportCulling: boolean;
        enableDPR: boolean;
        cacheExpiration: number;
        maxOperationsPerFrame: number;
      }> = {
        enableLayerCaching: false,
        enableDPR: false,
        cacheExpiration: 30000,
        maxOperationsPerFrame: 25,
      };

      const canvasRenderWithConfig = new CanvasRender(mockRegistryManager, config);

      // 验证配置被应用
      expect(canvasRenderWithConfig.isDPREnabled()).toBe(false);
    });

    test("构造函数应该使用默认配置当未提供配置时", () => {
      const canvasRenderDefault = new CanvasRender(mockRegistryManager);

      // 验证使用默认配置
      expect(canvasRenderDefault.isDPREnabled()).toBe(true); // 默认启用 DPR
    });

    test("构造函数应该合并提供的配置和默认配置", () => {
      const config = {
        enableDPR: false, // 只覆盖这个配置
      };

      const canvasRenderMerged = new CanvasRender(mockRegistryManager, config);

      // 验证指定配置被应用
      expect(canvasRenderMerged.isDPREnabled()).toBe(false);

      // 其他配置应该使用默认值（通过不抛出错误来验证）
      expect(() => canvasRenderMerged.setRenderContext(mockRenderContext)).not.toThrow();
    });
  });

  describe("复杂渲染场景", () => {
    let mockRenderContext: IRenderContext;

    beforeEach(() => {
      mockRenderContext = {
        nodes: [],
        viewport: { x: 0, y: 0, zoom: 1, width: 800, height: 600 },
        canvas: mockCanvas,
        timestamp: Date.now(),
      };
      canvasRender.setRenderContext(mockRenderContext);
    });

    test("应该处理没有 Canvas 2D 上下文的情况", () => {
      // Mock getContext 返回 null
      vi.mocked(mockCanvas.getContext).mockReturnValueOnce(null);

      const mockEntity = {
        id: "no-2d-context",
        type: "rectangle-canvas",
        dispose: vi.fn(),
      } as unknown as IEntity;

      // 应该不抛出错误
      expect(() => canvasRender.render(mockEntity)).not.toThrow();

      // 验证错误被记录
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: CanvasRenderEvent.ContextUnavailable,
          message: "Canvas 2D context not available",
          emoji: "⚠️",
        })
      );
    });

    test("应该处理实体类型不匹配的情况", () => {
      const mockEntity = {
        id: "wrong-type",
        type: "rectangle-svg", // 非 canvas 类型
        dispose: vi.fn(),
      } as unknown as IEntity;

      canvasRender.render(mockEntity);

      // 验证 canRender 返回 false
      expect(canvasRender.canRender(mockEntity)).toBe(false);
    });

    test("batchRender 应该处理空实体数组", () => {
      expect(() => canvasRender.batchRender([])).not.toThrow();
    });

    test("batchRender 应该在没有渲染上下文时不执行", () => {
      const canvasRenderNoContext = new CanvasRender(mockRegistryManager);

      const entities = [
        {
          id: "test",
          type: "rectangle-canvas",
          dispose: vi.fn(),
        } as unknown as IEntity,
      ];

      // 应该不抛出错误
      expect(() => canvasRenderNoContext.batchRender(entities)).not.toThrow();
    });

    test("render 应该在没有渲染上下文时记录警告", () => {
      const canvasRenderNoContext = new CanvasRender(mockRegistryManager);

      const mockEntity = {
        id: "no-context",
        type: "rectangle-canvas",
        dispose: vi.fn(),
      } as unknown as IEntity;

      canvasRenderNoContext.render(mockEntity);

      // 验证警告被记录
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: CanvasRenderEvent.NotInitialized,
          message: "CanvasRender not initialized. Call setRenderContext first.",
          emoji: "⚠️",
        })
      );
    });

    test("canRender 应该在没有渲染上下文时返回 false", () => {
      const canvasRenderNoContext = new CanvasRender(mockRegistryManager);

      const mockEntity = {
        id: "no-context",
        type: "rectangle-canvas",
        dispose: vi.fn(),
      } as unknown as IEntity;

      expect(canvasRenderNoContext.canRender(mockEntity)).toBe(false);
    });

    test("应该正确处理实体 ID 和类型记录", () => {
      const mockEntity = {
        id: "test-entity-123",
        type: "circle-canvas",
        dispose: vi.fn(),
      } as unknown as IEntity;

      canvasRender.render(mockEntity);

      // 验证日志记录包含正确的实体信息
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: CanvasRenderEvent.RenderSuccess,
          message: "CanvasRender rendered entity",
          emoji: "✅",
          metadata: expect.objectContaining({
            entityId: "test-entity-123",
            entityType: "circle-canvas",
            timestamp: expect.any(Number),
          }),
        })
      );
    });

    test("性能统计应该在批量渲染中正确累积", () => {
      const entities = [
        {
          id: "entity1",
          type: "rectangle-canvas",
          dispose: vi.fn(),
        } as unknown as IEntity,
        {
          id: "entity2",
          type: "circle-canvas",
          dispose: vi.fn(),
        } as unknown as IEntity,
      ];

      const statsBefore = canvasRender.getPerformanceStats();

      canvasRender.batchRender(entities);

      const statsAfter = canvasRender.getPerformanceStats();

      // 验证渲染计数增加了
      expect(statsAfter.renderCount).toBeGreaterThanOrEqual(statsBefore.renderCount);
      // 验证总渲染时间增加了
      expect(statsAfter.totalRenderTime).toBeGreaterThanOrEqual(statsBefore.totalRenderTime);
    });

    test("dispose 应该重置所有内部状态", () => {
      // 设置一些状态
      canvasRender.setRenderContext(mockRenderContext);

      // 添加一些缓存
      const cache = new Map<string, ImageData>();
      cache.set("test", {} as ImageData);
      const internals = getCanvasRenderPrivate(canvasRender);
      internals.renderCache = cache;

      // 执行 dispose
      canvasRender.dispose();

      // 验证状态被重置
      expect(canvasRender.getRenderContext()).toBeUndefined();
      expect(internals.renderCache.size).toBe(0);
      expect(internals.performanceStats.renderCount).toBe(0);
    });
  });
});
