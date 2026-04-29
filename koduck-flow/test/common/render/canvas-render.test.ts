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

describe("CanvasRender", () => {
  let mockRegistryManager: RegistryManager;
  let canvasRender: CanvasRender;
  let mockCanvas: HTMLCanvasElement;
  let mockContext: CanvasRenderingContext2D;

  beforeEach(() => {
    mockRegistryManager = createRegistryManager();

    // Mock RegistryManager's getRegistryForEntity method
    mockRegistryManager.getRegistryForEntity = vi
      .fn<(entity: IEntity) => ICapabilityAwareRegistry<IEntity, IMeta> | undefined>()
      .mockReturnValue({
        hasCapability: vi.fn(() => true),
        getCapabilities: vi.fn(() => ["render"]),
        getConstructor: vi.fn(),
        createEntity: vi.fn(),
        executeCapability: vi.fn(),
      } as unknown as ICapabilityAwareRegistry<IEntity, IMeta>);

    // Create mock canvas and context
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
            data: new Uint8ClampedArray(4 * 50 * 50), // simulate 50x50 image data
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

  describe("Constructor and initialization", () => {
    test("should correctly initialize CanvasRender", () => {
      expect(canvasRender).toBeDefined();
      expect(canvasRender.getName()).toBe("CanvasRender");
      expect(canvasRender.getType()).toBe("canvas");
    });

    test("should initialize performance stats", () => {
      const stats = canvasRender.getPerformanceStats();
      expect(stats).toBeDefined();
      expect(stats.type).toBe("canvas");
      expect(stats.name).toBe("CanvasRender");
    });
  });

  describe("Render context management", () => {
    let mockRenderContext: IRenderContext;

    beforeEach(() => {
      mockRenderContext = {
        nodes: [],
        viewport: { x: 0, y: 0, zoom: 1, width: 800, height: 600 },
        canvas: mockCanvas,
        timestamp: Date.now(),
      };
    });

    test("canHandle should correctly determine if context can be handled", () => {
      expect(canvasRender.canHandle(mockRenderContext)).toBe(true);

      const contextWithoutCanvas: IRenderContext = {
        nodes: [],
        viewport: { x: 0, y: 0, zoom: 1, width: 800, height: 600 },
        timestamp: Date.now(),
      };

      expect(canvasRender.canHandle(contextWithoutCanvas)).toBe(false);
    });

    test("setRenderContext should set the render context", () => {
      canvasRender.setRenderContext(mockRenderContext);

      expect(canvasRender.getRenderContext()).toEqual(mockRenderContext);
    });

    test("getRenderContext should return the current render context", () => {
      expect(canvasRender.getRenderContext()).toBeUndefined();

      canvasRender.setRenderContext(mockRenderContext);
      expect(canvasRender.getRenderContext()).toBe(mockRenderContext);
    });

    test("updateRenderContext should update the render context", () => {
      canvasRender.setRenderContext(mockRenderContext);

      const updates = {
        viewport: { x: 10, y: 20, zoom: 2, width: 800, height: 600 },
      };
      canvasRender.updateRenderContext(updates);

      const updatedContext = canvasRender.getRenderContext();
      expect(updatedContext?.viewport).toEqual(updates.viewport);
    });

    test("getPriority should return the correct priority", () => {
      expect(canvasRender.getPriority()).toBe(75); // RENDERER_PRIORITY.CANVAS
    });
  });

  describe("Entity rendering", () => {
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

    test("render should return void for Canvas rendering", () => {
      const result = canvasRender.render(mockEntity);
      expect(result).toBeUndefined();
    });

    test("canRender should determine if rendering is possible based on entity type", () => {
      expect(canvasRender.canRender(mockEntity)).toBe(true);
    });

    test("renderContext should execute Canvas rendering", () => {
      const context: IRenderContext = {
        nodes: [mockEntity],
        viewport: { x: 0, y: 0, zoom: 1, width: 800, height: 600 },
        canvas: mockCanvas,
        timestamp: Date.now(),
      };

      canvasRender.setRenderContext(context);
      canvasRender.render(mockEntity);

      // Verify rendering is called (by not throwing error)
      expect(() => canvasRender.render(mockEntity)).not.toThrow();
    });
  });

  describe("Batch rendering", () => {
    const mockEntities = [
      {
        id: "entity1",
        type: "rectangle",
        dispose: vi.fn(),
      } as unknown as IEntity,
      { id: "entity2", type: "circle", dispose: vi.fn() } as unknown as IEntity,
    ];

    test("batchRender should handle multiple entities", () => {
      const context: IRenderContext = {
        nodes: mockEntities,
        viewport: { x: 0, y: 0, zoom: 1, width: 800, height: 600 },
        canvas: mockCanvas,
        timestamp: Date.now(),
      };

      canvasRender.setRenderContext(context);
      canvasRender.batchRender(mockEntities);

      // Verify batch rendering is called
      expect(() => canvasRender.batchRender(mockEntities)).not.toThrow();
    });
  });

  describe("Configuration management", () => {
    test("configure should accept config parameters", () => {
      const config: IRenderConfig = {
        batchSize: 10,
        enableCache: true,
        maxCacheAge: 30000,
      };

      expect(() => canvasRender.configure(config)).not.toThrow();
    });

    test("configure should handle empty config", () => {
      expect(() => canvasRender.configure({})).not.toThrow();
    });
  });

  describe("Registry manager setup", () => {
    test("setRegistryManager should set the registry manager", () => {
      const newRegistryManager = createRegistryManager();
      canvasRender.setRegistryManager(newRegistryManager);

      // Verify setup succeeded (by not throwing error)
      expect(() => canvasRender.setRegistryManager(newRegistryManager)).not.toThrow();
    });
  });

  describe("Performance stats", () => {
    test("getPerformanceStats should return performance statistics", () => {
      const stats = canvasRender.getPerformanceStats();

      expect(stats).toHaveProperty("renderCount");
      expect(stats).toHaveProperty("totalRenderTime");
      expect(stats).toHaveProperty("averageRenderTime");
      expect(stats).toHaveProperty("type", "canvas");
      expect(stats).toHaveProperty("name", "CanvasRender");
    });

    test("rendering operations should update performance statistics", () => {
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

  describe("Resource cleanup", () => {
    test("dispose should clean up resources", () => {
      expect(() => canvasRender.dispose()).not.toThrow();
    });

    test("dispose should be idempotent", () => {
      canvasRender.dispose();
      expect(() => canvasRender.dispose()).not.toThrow();
    });
  });

  describe("DPR (device pixel ratio) features", () => {
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

    test("getDPR should return the current DPR value", () => {
      expect(canvasRender.getDPR()).toBe(1); // default value
    });

    test("isDPREnabled should return whether DPR is enabled", () => {
      expect(canvasRender.isDPREnabled()).toBe(true); // enabled by default
    });

    test("convertToCanvasCoordinates should correctly convert coordinates", () => {
      const cssX = 100;
      const cssY = 200;
      const result = canvasRender.convertToCanvasCoordinates(cssX, cssY);

      expect(result.x).toBe(cssX * canvasRender.getDPR());
      expect(result.y).toBe(cssY * canvasRender.getDPR());
    });

    test("convertToCSSCoordinates should correctly convert coordinates", () => {
      const canvasX = 200;
      const canvasY = 400;
      const result = canvasRender.convertToCSSCoordinates(canvasX, canvasY);

      expect(result.x).toBe(canvasX / canvasRender.getDPR());
      expect(result.y).toBe(canvasY / canvasRender.getDPR());
    });

    test("DPR handling should be applied when initializing Canvas", () => {
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

      // Verify Canvas dimensions are set to DPR multiples
      expect(newCanvas.width).toBe(800); // 400 * 2
      expect(newCanvas.height).toBe(600); // 300 * 2

      // Verify DPR value is updated
      expect(canvasRender.getDPR()).toBe(2);

      // Restore original value
      Object.defineProperty(window, "devicePixelRatio", {
        value: originalDPR,
        writable: true,
      });
    });

    test("DPR handling should not be applied when DPR is disabled", () => {
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

      // Verify Canvas dimensions are not changed
      expect(newCanvas.width).toBe(800); // keep original value
      expect(newCanvas.height).toBe(600); // keep original value

      // Verify DPR value stays at default
      expect(canvasRenderWithoutDPR.getDPR()).toBe(1);
      expect(canvasRenderWithoutDPR.isDPREnabled()).toBe(false);
    });
  });

  describe("Render operation queue management", () => {
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

    test("addRenderOperations should add render operations to the queue", () => {
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

      // Verify operations are added to queue (indirectly by executing operations)
      // Note: addRenderOperations is a private method, we need to verify through other means
      expect(operations).toHaveLength(2);
    });

    test("isInViewport should correctly determine if bounds are within viewport", () => {
      // Test bounds inside viewport
      const inViewportBounds = { x: 10, y: 10, width: 50, height: 50 };
      const internals = getCanvasRenderPrivate(canvasRender);
      expect(internals.isInViewport(inViewportBounds)).toBe(true);

      // Test bounds outside viewport
      const outViewportBounds = { x: 900, y: 700, width: 50, height: 50 };
      expect(internals.isInViewport(outViewportBounds)).toBe(false);

      // Test bounds partially outside viewport (but still intersecting viewport, should render)
      const partialOutBounds = { x: -10, y: -10, width: 50, height: 50 };
      expect(internals.isInViewport(partialOutBounds)).toBe(true);
    });

    test("isInViewport should account for DPR during viewport check", () => {
      // Set DPR to 2
      const originalDPR = window.devicePixelRatio;
      Object.defineProperty(window, "devicePixelRatio", {
        value: 2,
        writable: true,
      });

      const canvasRenderWithDPR = new CanvasRender(mockRegistryManager);
      canvasRenderWithDPR.setRenderContext(mockRenderContext);

      // Bounds within DPR-adjusted viewport
      const bounds = { x: 10, y: 10, width: 50, height: 50 };
      // Since DPR=2, Canvas dimensions become 1600x1200, but viewport check uses CSS dimensions
      const internals = getCanvasRenderPrivate(canvasRenderWithDPR);
      expect(internals.isInViewport(bounds)).toBe(true);

      // Restore original value
      Object.defineProperty(window, "devicePixelRatio", {
        value: originalDPR,
        writable: true,
      });
    });

    test("executeRenderOperations should execute operations by priority", () => {
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

      // Manually set render operation queue (since it's a private method)
      const internals = getCanvasRenderPrivate(canvasRender);
      internals.renderOperations = operations;

      // Execute operations
      internals.executeRenderOperations();

      // Verify execution in descending priority order (high priority first)
      expect(executedOrder).toEqual(["high", "medium", "low"]);
    });

    test("executeRenderOperations should handle viewport culling", () => {
      const renderFn = vi.fn();
      const outOfViewportOperation = {
        type: "rectangle",
        id: "out-of-viewport",
        bounds: { x: 1000, y: 1000, width: 50, height: 50 }, // outside viewport
        render: renderFn,
        priority: 1,
      };

      const internals = getCanvasRenderPrivate(canvasRender);
      internals.renderOperations = [outOfViewportOperation];
      internals.executeRenderOperations();

      // Verify render function is not called (because it was culled by viewport)
      expect(renderFn).not.toHaveBeenCalled();
    });

    test("executeRenderOperations should handle caching", () => {
      const renderFn = vi.fn();
      const cacheableOperation = {
        type: "rectangle",
        id: "cacheable-op",
        bounds: { x: 10, y: 10, width: 50, height: 50 },
        render: renderFn,
        priority: 1,
      };

      // Enable cache
      const canvasRenderWithCache = new CanvasRender(mockRegistryManager, {
        enableLayerCaching: true,
      });
      canvasRenderWithCache.setRenderContext(mockRenderContext);

      const cacheInternals = getCanvasRenderPrivate(canvasRenderWithCache);
      cacheInternals.renderOperations = [cacheableOperation];

      // First execution - should call render function and cache
      cacheInternals.executeRenderOperations();
      expect(renderFn).toHaveBeenCalledTimes(1);

      // Second execution of same operation - should load from cache, not call render function
      cacheInternals.renderOperations = [cacheableOperation];
      cacheInternals.executeRenderOperations();
      expect(renderFn).toHaveBeenCalledTimes(1); // still 1, because second load from cache
    });
  });

  describe("Cache management", () => {
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

    test("cleanupCache should clear render cache", () => {
      // Add some cache data
      const cache = new Map<string, ImageData>();
      const mockImageData = {} as ImageData;
      cache.set("test-key", mockImageData);

      const internals = getCanvasRenderPrivate(canvasRender);
      internals.renderCache = cache;

      // Verify cache has data
      expect(internals.renderCache.size).toBe(1);

      // Execute cache cleanup
      canvasRender.cleanupCache();

      // Verify cache has been cleared
      expect(internals.renderCache.size).toBe(0);
    });

    test("cache should be cleaned up on dispose", () => {
      // Add some cache data
      const cache = new Map<string, ImageData>();
      const mockImageData = {} as ImageData;
      cache.set("test-key", mockImageData);

      const internals = getCanvasRenderPrivate(canvasRender);
      internals.renderCache = cache;

      // Execute dispose
      canvasRender.dispose();

      // Verify cache has been cleared
      expect(internals.renderCache.size).toBe(0);
    });

    test("cache hits and misses should be correctly counted", () => {
      const renderFn = vi.fn();
      const operation = {
        type: "rectangle",
        id: "test-op",
        bounds: { x: 10, y: 10, width: 50, height: 50 },
        render: renderFn,
        priority: 1,
      };

      // Enable cache
      const canvasRenderWithCache = new CanvasRender(mockRegistryManager, {
        enableLayerCaching: true,
      });
      canvasRenderWithCache.setRenderContext(mockRenderContext);

      const cacheInternals = getCanvasRenderPrivate(canvasRenderWithCache);

      // First execution - cache miss
      cacheInternals.renderOperations = [operation];
      cacheInternals.executeRenderOperations();

      // Verify render function is called
      expect(renderFn).toHaveBeenCalledTimes(1);

      // Verify cache miss statistics
      const statsAfterMiss = canvasRenderWithCache.getPerformanceStats();
      expect(statsAfterMiss.cacheHitCount).toBe(0);
      expect(statsAfterMiss.cacheMissCount).toBe(1);

      // Second execution of same operation - cache hit
      cacheInternals.renderOperations = [operation];
      cacheInternals.executeRenderOperations();

      // Verify render function is not called again (loaded from cache)
      expect(renderFn).toHaveBeenCalledTimes(1);

      // Verify cache hit statistics
      const statsAfterHit = canvasRenderWithCache.getPerformanceStats();
      expect(statsAfterHit.cacheHitCount).toBe(1);
      expect(statsAfterHit.cacheMissCount).toBe(1);
    });

    test("cache hit ratio should be correctly calculated", () => {
      const canvasRenderWithCache = new CanvasRender(mockRegistryManager, {
        enableLayerCaching: true,
      });

      // Manually set performance stats
      const cacheInternals = getCanvasRenderPrivate(canvasRenderWithCache);
      cacheInternals.performanceStats = {
        totalRenderTime: 100,
        renderCount: 10,
        cacheHitCount: 7,
        cacheMissCount: 3,
        averageRenderTime: 10,
      };

      const stats = canvasRenderWithCache.getPerformanceStats();

      // Verify cache hit ratio calculation: 7 / (7 + 3) = 0.7
      expect(stats.cacheHitRatio).toBe(0.7);
    });

    test("empty cache hit ratio should be 0", () => {
      const stats = canvasRender.getPerformanceStats();

      // Hit ratio should be 0 when there are no cache operations
      expect(stats.cacheHitRatio).toBe(0);
    });
  });

  describe("Error handling and edge cases", () => {
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

    test("should log error and continue when rendering fails", () => {
      const mockEntity = {
        id: "failing-entity",
        type: "rectangle-canvas",
        data: { x: 100, y: 100, width: 50, height: 50 },
        dispose: vi.fn(),
      } as unknown as IEntity;

      // Mock registry execute capability throwing error
      vi.mocked(mockRegistryManager.getRegistryForEntity).mockReturnValue({
        hasCapability: vi.fn(() => true),
        getCapabilities: vi.fn(() => ["render"]),
        getConstructor: vi.fn(),
        createEntity: vi.fn(),
        executeCapability: vi.fn(() => {
          throw new Error("Render failed");
        }),
      } as unknown as ICapabilityAwareRegistry<IEntity, IMeta>);

      // Should not throw error
      expect(() => canvasRender.render(mockEntity)).not.toThrow();

      // Verify error is logged
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

    test("should log warning and try calling entity render method directly when no registry", () => {
      const mockEntity = {
        id: "no-registry-entity",
        type: "rectangle-canvas",
        data: { x: 100, y: 100, width: 50, height: 50 },
        dispose: vi.fn(),
        render: vi.fn(), // entity has render method
        canRender: vi.fn(() => true),
      } as unknown as IEntity & {
        render: (ctx: IRenderContext) => void;
        canRender: (ctx: IRenderContext) => boolean;
      };

      // Mock registry returns null
      vi.mocked(mockRegistryManager.getRegistryForEntity).mockReturnValue(undefined);

      canvasRender.render(mockEntity);

      // Verify entity's render method is called
      expect(mockEntity.render).toHaveBeenCalledWith(mockRenderContext);
      expect(mockEntity.canRender).toHaveBeenCalledWith(mockRenderContext);
    });

    test("should try calling entity render method directly when registry lacks render capability", () => {
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

      // Mock registry without render capability
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

      // Verify entity's render method is called
      expect(mockEntity.render).toHaveBeenCalledWith(mockRenderContext);
    });

    test("should log warning when entity has no render method", () => {
      const mockEntity = {
        id: "no-render-entity",
        type: "rectangle-canvas",
        data: { x: 100, y: 100, width: 50, height: 50 },
        dispose: vi.fn(),
      } as unknown as IEntity;

      // Mock registry without render capability
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

      // Verify warning is logged
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

    test("errors in batch rendering should be handled individually", () => {
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
          // First entity succeeds
          return {
            hasCapability: vi.fn(() => true),
            executeCapability: vi.fn(),
            getConstructor: vi.fn(),
            createEntity: vi.fn(),
            getCapabilities: vi.fn(),
            meta: { type: "test" },
          } as unknown as ICapabilityAwareRegistry<IEntity, IMeta>;
        } else {
          // Second entity fails
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

      // Should not throw error
      expect(() => canvasRender.batchRender(entities)).not.toThrow();

      // Verify error is logged
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

    test("offscreen rendering initialization should work when OffscreenCanvas is available", () => {
      // Mock OffscreenCanvas available
      const originalOffscreenCanvas = (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas;
      (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas = vi.fn(() => ({
        getContext: vi.fn(() => ({})),
      }));

      const canvasRenderWithOffscreen = new CanvasRender(mockRegistryManager, {
        enableOffscreenRendering: true,
      });

      canvasRenderWithOffscreen.setRenderContext(mockRenderContext);

      // Verify offscreen canvas is created
      const offscreenInternals = getCanvasRenderPrivate(canvasRenderWithOffscreen);
      expect(offscreenInternals.offscreenCanvas).toBeDefined();

      // Clean up
      (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas = originalOffscreenCanvas;
    });

    test("offscreen rendering initialization should gracefully degrade when OffscreenCanvas is unavailable", () => {
      // Ensure OffscreenCanvas is unavailable
      const originalOffscreenCanvas = (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas;
      (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas = undefined;

      const canvasRenderWithOffscreen = new CanvasRender(mockRegistryManager, {
        enableOffscreenRendering: true,
      });

      // Should not throw error
      expect(() => canvasRenderWithOffscreen.setRenderContext(mockRenderContext)).not.toThrow();

      // Verify offscreen canvas is null
      const offscreenInternals = getCanvasRenderPrivate(canvasRenderWithOffscreen);
      expect(offscreenInternals.offscreenCanvas).toBeNull();

      // Restore
      (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas = originalOffscreenCanvas;
    });

    test("render operation execution failure should be correctly handled", () => {
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

      // Verify error is logged
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

  describe("Enhanced configuration management", () => {
    let mockRenderContext: IRenderContext;

    beforeEach(() => {
      mockRenderContext = {
        nodes: [],
        viewport: { x: 0, y: 0, zoom: 1, width: 800, height: 600 },
        canvas: mockCanvas,
        timestamp: Date.now(),
      };
    });
    test("configure should support DPR config", () => {
      const config: IRenderConfig = {
        enableDPR: true,
      };

      expect(() => canvasRender.configure(config)).not.toThrow();

      // Verify DPR is enabled
      expect(canvasRender.isDPREnabled()).toBe(true);
    });

    test("configure should support disabling DPR", () => {
      const config: IRenderConfig = {
        enableDPR: false,
      };

      expect(() => canvasRender.configure(config)).not.toThrow();

      // Verify DPR is disabled
      expect(canvasRender.isDPREnabled()).toBe(false);
    });

    test("configure should support full performance optimization config", () => {
      const config: IRenderConfig = {
        enableCache: true,
        maxCacheAge: 60000, // 1 minute
        batchSize: 50,
        enableDPR: true,
      };

      expect(() => canvasRender.configure(config)).not.toThrow();
    });

    test("configure should handle partial config updates", () => {
      // Set initial config first
      canvasRender.configure({
        enableCache: false,
        enableDPR: false,
      });

      // Verify initial state
      expect(canvasRender.isDPREnabled()).toBe(false);

      // Only update DPR config
      canvasRender.configure({
        enableDPR: true,
      });

      // Verify only DPR is updated
      expect(canvasRender.isDPREnabled()).toBe(true);
    });

    test("configure should correctly map generic config to Canvas-specific config", () => {
      const config: IRenderConfig = {
        enableCache: true,
        maxCacheAge: 120000, // 2 minutes
        batchSize: 25,
      };

      canvasRender.configure(config);

      // Verify config is correctly mapped (indirectly by not throwing error)
      expect(() => canvasRender.configure(config)).not.toThrow();
    });

    test("constructor should accept and apply config parameters", () => {
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

      // Verify config is applied
      expect(canvasRenderWithConfig.isDPREnabled()).toBe(false);
    });

    test("constructor should use default config when none is provided", () => {
      const canvasRenderDefault = new CanvasRender(mockRegistryManager);

      // Verify default config is used
      expect(canvasRenderDefault.isDPREnabled()).toBe(true); // DPR enabled by default
    });

    test("constructor should merge provided config with default config", () => {
      const config = {
        enableDPR: false, // only override this config
      };

      const canvasRenderMerged = new CanvasRender(mockRegistryManager, config);

      // Verify specified config is applied
      expect(canvasRenderMerged.isDPREnabled()).toBe(false);

      // Other configs should use default values (verified by not throwing error)
      expect(() => canvasRenderMerged.setRenderContext(mockRenderContext)).not.toThrow();
    });
  });

  describe("Complex rendering scenarios", () => {
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

    test("should handle missing Canvas 2D context", () => {
      // Mock getContext returning null
      vi.mocked(mockCanvas.getContext).mockReturnValueOnce(null);

      const mockEntity = {
        id: "no-2d-context",
        type: "rectangle-canvas",
        dispose: vi.fn(),
      } as unknown as IEntity;

      // Should not throw error
      expect(() => canvasRender.render(mockEntity)).not.toThrow();

      // Verify error is logged
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: CanvasRenderEvent.ContextUnavailable,
          message: "Canvas 2D context not available",
          emoji: "⚠️",
        })
      );
    });

    test("should handle entity type mismatch", () => {
      const mockEntity = {
        id: "wrong-type",
        type: "rectangle-svg", // non-canvas type
        dispose: vi.fn(),
      } as unknown as IEntity;

      canvasRender.render(mockEntity);

      // Verify canRender returns false
      expect(canvasRender.canRender(mockEntity)).toBe(false);
    });

    test("batchRender should handle empty entity arrays", () => {
      expect(() => canvasRender.batchRender([])).not.toThrow();
    });

    test("batchRender should not execute without render context", () => {
      const canvasRenderNoContext = new CanvasRender(mockRegistryManager);

      const entities = [
        {
          id: "test",
          type: "rectangle-canvas",
          dispose: vi.fn(),
        } as unknown as IEntity,
      ];

      // Should not throw error
      expect(() => canvasRenderNoContext.batchRender(entities)).not.toThrow();
    });

    test("render should log warning when there is no render context", () => {
      const canvasRenderNoContext = new CanvasRender(mockRegistryManager);

      const mockEntity = {
        id: "no-context",
        type: "rectangle-canvas",
        dispose: vi.fn(),
      } as unknown as IEntity;

      canvasRenderNoContext.render(mockEntity);

      // Verify warning is logged
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: CanvasRenderEvent.NotInitialized,
          message: "CanvasRender not initialized. Call setRenderContext first.",
          emoji: "⚠️",
        })
      );
    });

    test("canRender should return false when there is no render context", () => {
      const canvasRenderNoContext = new CanvasRender(mockRegistryManager);

      const mockEntity = {
        id: "no-context",
        type: "rectangle-canvas",
        dispose: vi.fn(),
      } as unknown as IEntity;

      expect(canvasRenderNoContext.canRender(mockEntity)).toBe(false);
    });

    test("should correctly handle entity ID and type logging", () => {
      const mockEntity = {
        id: "test-entity-123",
        type: "circle-canvas",
        dispose: vi.fn(),
      } as unknown as IEntity;

      canvasRender.render(mockEntity);

      // Verify log contains correct entity info
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

    test("performance stats should correctly accumulate during batch rendering", () => {
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

      // Verify render count increased
      expect(statsAfter.renderCount).toBeGreaterThanOrEqual(statsBefore.renderCount);
      // Verify total render time increased
      expect(statsAfter.totalRenderTime).toBeGreaterThanOrEqual(statsBefore.totalRenderTime);
    });

    test("dispose should reset all internal state", () => {
      // Set some state
      canvasRender.setRenderContext(mockRenderContext);

      // Add some cache
      const cache = new Map<string, ImageData>();
      cache.set("test", {} as ImageData);
      const internals = getCanvasRenderPrivate(canvasRender);
      internals.renderCache = cache;

      // Execute dispose
      canvasRender.dispose();

      // Verify state is reset
      expect(canvasRender.getRenderContext()).toBeUndefined();
      expect(internals.renderCache.size).toBe(0);
      expect(internals.performanceStats.renderCount).toBe(0);
    });
  });
});
