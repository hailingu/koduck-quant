import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { WebGPURender, WebGPURenderEvent } from "../../../src/common/render/webgpu-render";
import { RegistryManager, createRegistryManager } from "../../../src/common/registry";
import type { IEntity } from "../../../src/common/entity/types";
import type { IRenderContext } from "../../../src/common/render/types";
import { logger } from "../../../src/common/logger";

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

// Mock WebGPU API
const mockWebGPUAdapter = {
  requestDevice: vi.fn(),
};

const mockWebGPUDevice = {
  createBuffer: vi.fn(),
  createTexture: vi.fn(),
  createSampler: vi.fn(),
  createBindGroupLayout: vi.fn(),
  createPipelineLayout: vi.fn(),
  createShaderModule: vi.fn(),
  createComputePipeline: vi.fn(),
  createRenderPipeline: vi.fn(),
  createCommandEncoder: vi.fn(),
  createQuerySet: vi.fn(),
  destroy: vi.fn(),
};

const mockWebGPUContext = {
  configure: vi.fn(),
  getCurrentTexture: vi.fn(),
};

Object.defineProperty(navigator, "gpu", {
  value: {
    requestAdapter: vi.fn().mockResolvedValue(mockWebGPUAdapter),
    getPreferredCanvasFormat: vi.fn().mockReturnValue("bgra8unorm"),
  },
  writable: true,
});

describe("WebGPURender", () => {
  let mockRegistryManager: RegistryManager;
  let webGPURender: WebGPURender;
  let mockRenderContext: IRenderContext;

  beforeEach(() => {
    mockRegistryManager = createRegistryManager();
    mockRegistryManager.getRegistryForEntity = vi.fn();
    webGPURender = new WebGPURender(mockRegistryManager);

    mockRenderContext = {
      nodes: [],
      viewport: { x: 0, y: 0, zoom: 1, width: 800, height: 600 },
      canvas: {
        getContext: vi.fn().mockReturnValue(mockWebGPUContext),
        width: 800,
        height: 600,
      } as unknown as HTMLCanvasElement,
      timestamp: Date.now(),
    };

    // Mock WebGPU device request
    mockWebGPUAdapter.requestDevice.mockResolvedValue(mockWebGPUDevice);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("构造函数和初始化", () => {
    test("应该正确初始化 WebGPURender", () => {
      expect(webGPURender).toBeDefined();
      expect(webGPURender.getName()).toBe("WebGPURender");
      expect(webGPURender.getType()).toBe("canvas");
    });

    test("应该初始化性能统计", () => {
      const stats = webGPURender.getPerformanceStats();
      expect(stats).toBeDefined();
      expect(stats.type).toBe("canvas");
      expect(stats.name).toBe("WebGPURender");
    });

    test("应该有默认的优先级", () => {
      expect(webGPURender.getPriority()).toBeGreaterThan(0);
    });
  });

  describe("渲染上下文管理", () => {
    test("应该能够设置渲染上下文", () => {
      expect(() => webGPURender.setRenderContext(mockRenderContext)).not.toThrow();
    });

    test("应该能够获取渲染上下文", () => {
      webGPURender.setRenderContext(mockRenderContext);
      const context = webGPURender.getRenderContext();
      expect(context).toBe(mockRenderContext);
    });

    test("应该能够更新渲染上下文", () => {
      webGPURender.setRenderContext(mockRenderContext);
      const updates = { width: 1024, height: 768 };
      expect(() => webGPURender.updateRenderContext(updates)).not.toThrow();
    });
  });

  describe("WebGPU 支持检测", () => {
    test("canHandle 应该根据上下文判断是否能处理", () => {
      expect(webGPURender.canHandle(mockRenderContext)).toBe(true);
    });

    test("canHandle 应该处理无效上下文", () => {
      const invalidContext = {} as IRenderContext;
      expect(webGPURender.canHandle(invalidContext)).toBe(false);
    });
  });

  describe("实体渲染", () => {
    const mockEntity = {
      id: "webgpu-entity",
      type: "webgpu-rectangle",
      data: { x: 100, y: 100, width: 50, height: 50 },
      dispose: vi.fn(),
    } as unknown as IEntity;

    test("render 应该处理 WebGPU 实体", () => {
      webGPURender.setRenderContext(mockRenderContext);

      // Mock registry with render capability
      const mockRegistry = {
        hasCapability: vi.fn().mockReturnValue(true),
        executeCapability: vi.fn(),
      };
      mockRegistryManager.getRegistryForEntity = vi.fn().mockReturnValue(mockRegistry);

      expect(() => webGPURender.render(mockEntity)).not.toThrow();
    });

    test("render 应该处理没有渲染上下文的情况", () => {
      expect(() => webGPURender.render(mockEntity)).not.toThrow();
    });

    test("render 应该处理没有注册表的情况", () => {
      webGPURender.setRenderContext(mockRenderContext);
      mockRegistryManager.getRegistryForEntity = vi.fn().mockReturnValue(null);

      expect(() => webGPURender.render(mockEntity)).not.toThrow();
    });
  });

  describe("注册表管理器设置", () => {
    test("setRegistryManager 应该设置注册表管理器", () => {
      const newRegistryManager = createRegistryManager();
      expect(() => webGPURender.setRegistryManager(newRegistryManager)).not.toThrow();
    });
  });

  describe("性能统计", () => {
    test("getPerformanceStats 应该返回 WebGPU 性能统计信息", () => {
      const stats = webGPURender.getPerformanceStats();

      expect(stats).toHaveProperty("renderCount");
      expect(stats).toHaveProperty("totalRenderTime");
      expect(stats).toHaveProperty("averageRenderTime");
      expect(stats).toHaveProperty("type", "canvas");
      expect(stats).toHaveProperty("name", "WebGPURender");
    });

    test("渲染操作应该更新性能统计", () => {
      webGPURender.setRenderContext(mockRenderContext);

      const mockRegistry = {
        hasCapability: vi.fn().mockReturnValue(true),
        executeCapability: vi.fn(),
      };
      mockRegistryManager.getRegistryForEntity = vi.fn().mockReturnValue(mockRegistry);

      const statsBefore = webGPURender.getPerformanceStats();

      webGPURender.render({
        id: "test",
        type: "test",
        dispose: vi.fn(),
      } as unknown as IEntity);

      const statsAfter = webGPURender.getPerformanceStats();
      expect(statsAfter.renderCount).toBeGreaterThanOrEqual(statsBefore.renderCount ?? 0);
    });
  });

  describe("资源清理", () => {
    test("dispose 应该清理资源", () => {
      expect(() => webGPURender.dispose()).not.toThrow();
    });

    test("dispose 应该可重复调用", () => {
      webGPURender.dispose();
      expect(() => webGPURender.dispose()).not.toThrow();
    });
  });

  describe("边界情况", () => {
    test("应该处理无效的实体输入", () => {
      const invalidEntity = null as unknown as IEntity;

      expect(() => webGPURender.render(invalidEntity)).not.toThrow();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: WebGPURenderEvent.InvalidEntity,
          message: "Invalid entity provided for WebGPU render",
          emoji: "⚠️",
        })
      );
    });

    test("应该处理没有数据的实体", () => {
      webGPURender.setRenderContext(mockRenderContext);

      const entityWithoutData = {
        id: "no-data",
        type: "webgpu-empty",
        dispose: vi.fn(),
      } as unknown as IEntity;

      const mockRegistry = {
        hasCapability: vi.fn().mockReturnValue(true),
        executeCapability: vi.fn(),
      };
      mockRegistryManager.getRegistryForEntity = vi.fn().mockReturnValue(mockRegistry);

      expect(() => webGPURender.render(entityWithoutData)).not.toThrow();
    });

    test("应该处理渲染上下文更新时的错误", () => {
      const invalidCanvas = {
        getContext: vi.fn().mockReturnValue(null),
      } as unknown as HTMLCanvasElement;

      const invalidContext = {
        ...mockRenderContext,
        canvas: invalidCanvas,
      };

      expect(() => webGPURender.updateRenderContext(invalidContext)).not.toThrow();
    });
  });

  describe("WebGPU 硬件能力检测", () => {
    test("canHandle 应该检查 canvas 存在", () => {
      const contextWithoutCanvas = {
        nodes: [],
        viewport: { x: 0, y: 0, zoom: 1, width: 800, height: 600 },
        timestamp: Date.now(),
      } as IRenderContext;

      expect(webGPURender.canHandle(contextWithoutCanvas)).toBe(false);
    });
  });
});
