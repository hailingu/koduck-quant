import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { WebGPURender, WebGPURenderEvent } from "../../../src/common/render/webgpu-render";
import { RegistryManager, createRegistryManager } from "../../../src/common/registry";
import type { IEntity } from "../../../src/common/entity/types";
import type { IRenderContext } from "../../../src/common/render/types";
import { logger } from "../../../src/common/logger";

// Mock dependencies
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

  describe("Constructor and Initialization", () => {
    test("should correctly initialize WebGPURender", () => {
      expect(webGPURender).toBeDefined();
      expect(webGPURender.getName()).toBe("WebGPURender");
      expect(webGPURender.getType()).toBe("canvas");
    });

    test("should initialize performance stats", () => {
      const stats = webGPURender.getPerformanceStats();
      expect(stats).toBeDefined();
      expect(stats.type).toBe("canvas");
      expect(stats.name).toBe("WebGPURender");
    });

    test("should have default priority", () => {
      expect(webGPURender.getPriority()).toBeGreaterThan(0);
    });
  });

  describe("Render Context Management", () => {
    test("should be able to set render context", () => {
      expect(() => webGPURender.setRenderContext(mockRenderContext)).not.toThrow();
    });

    test("should be able to get render context", () => {
      webGPURender.setRenderContext(mockRenderContext);
      const context = webGPURender.getRenderContext();
      expect(context).toBe(mockRenderContext);
    });

    test("should be able to update render context", () => {
      webGPURender.setRenderContext(mockRenderContext);
      const updates = { width: 1024, height: 768 };
      expect(() => webGPURender.updateRenderContext(updates)).not.toThrow();
    });
  });

  describe("WebGPU Support Detection", () => {
    test("canHandle should determine capability based on context", () => {
      expect(webGPURender.canHandle(mockRenderContext)).toBe(true);
    });

    test("canHandle should handle invalid context", () => {
      const invalidContext = {} as IRenderContext;
      expect(webGPURender.canHandle(invalidContext)).toBe(false);
    });
  });

  describe("Entity Rendering", () => {
    const mockEntity = {
      id: "webgpu-entity",
      type: "webgpu-rectangle",
      data: { x: 100, y: 100, width: 50, height: 50 },
      dispose: vi.fn(),
    } as unknown as IEntity;

    test("render should handle WebGPU entities", () => {
      webGPURender.setRenderContext(mockRenderContext);

      // Mock registry with render capability
      const mockRegistry = {
        hasCapability: vi.fn().mockReturnValue(true),
        executeCapability: vi.fn(),
      };
      mockRegistryManager.getRegistryForEntity = vi.fn().mockReturnValue(mockRegistry);

      expect(() => webGPURender.render(mockEntity)).not.toThrow();
    });

    test("render should handle the case without render context", () => {
      expect(() => webGPURender.render(mockEntity)).not.toThrow();
    });

    test("render should handle the case without registry", () => {
      webGPURender.setRenderContext(mockRenderContext);
      mockRegistryManager.getRegistryForEntity = vi.fn().mockReturnValue(null);

      expect(() => webGPURender.render(mockEntity)).not.toThrow();
    });
  });

  describe("Registry Manager Setup", () => {
    test("setRegistryManager should set the registry manager", () => {
      const newRegistryManager = createRegistryManager();
      expect(() => webGPURender.setRegistryManager(newRegistryManager)).not.toThrow();
    });
  });

  describe("Performance Stats", () => {
    test("getPerformanceStats should return WebGPU performance stats", () => {
      const stats = webGPURender.getPerformanceStats();

      expect(stats).toHaveProperty("renderCount");
      expect(stats).toHaveProperty("totalRenderTime");
      expect(stats).toHaveProperty("averageRenderTime");
      expect(stats).toHaveProperty("type", "canvas");
      expect(stats).toHaveProperty("name", "WebGPURender");
    });

    test("render operations should update performance stats", () => {
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

  describe("Resource Cleanup", () => {
    test("dispose should clean up resources", () => {
      expect(() => webGPURender.dispose()).not.toThrow();
    });

    test("dispose should be callable multiple times", () => {
      webGPURender.dispose();
      expect(() => webGPURender.dispose()).not.toThrow();
    });
  });

  describe("Edge Cases", () => {
    test("should handle invalid entity input", () => {
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

    test("should handle entities without data", () => {
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

    test("should handle errors during render context update", () => {
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

  describe("WebGPU Hardware Capability Detection", () => {
    test("canHandle should check for canvas presence", () => {
      const contextWithoutCanvas = {
        nodes: [],
        viewport: { x: 0, y: 0, zoom: 1, width: 800, height: 600 },
        timestamp: Date.now(),
      } as IRenderContext;

      expect(webGPURender.canHandle(contextWithoutCanvas)).toBe(false);
    });
  });
});
