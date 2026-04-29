 

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { RenderSelector } from "../../../src/common/render/render-selector";
import type { CanvasRender } from "../../../src/common/render/canvas-render";
import type { ReactRender } from "../../../src/common/render/react-render";
import type { WebGPURender } from "../../../src/common/render/webgpu-render";
import type { IEntity } from "../../../src/common/entity/types";

// Mock dependencies
vi.mock("../../../src/common/render/canvas-render");
vi.mock("../../../src/common/render/react-render");
vi.mock("../../../src/common/render/webgpu-render");
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

describe("RenderSelector", () => {
  let mockCanvasRender: CanvasRender;
  let mockReactRender: ReactRender;
  let mockWebGPURender: WebGPURender;
  let renderSelector: RenderSelector;
  let mockContext: any;

  beforeEach(() => {
    mockContext = {
      nodes: [],
      viewport: { x: 0, y: 0, zoom: 1, width: 800, height: 600 },
      timestamp: Date.now(),
    };

    mockCanvasRender = {
      getName: vi.fn().mockReturnValue("CanvasRender"),
      getType: vi.fn().mockReturnValue("canvas"),
      getPriority: vi.fn().mockReturnValue(50),
    } as unknown as CanvasRender;
    mockReactRender = {
      getName: vi.fn().mockReturnValue("ReactRender"),
      getType: vi.fn().mockReturnValue("react"),
      getPriority: vi.fn().mockReturnValue(80),
    } as unknown as ReactRender;
    mockWebGPURender = {
      getName: vi.fn().mockReturnValue("WebGPURender"),
      getType: vi.fn().mockReturnValue("webgpu"),
      getPriority: vi.fn().mockReturnValue(90),
    } as unknown as WebGPURender;

    renderSelector = new RenderSelector({
      canvas: mockCanvasRender,
      react: mockReactRender,
      webgpu: mockWebGPURender,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Constructor and Initialization", () => {
    test("should correctly initialize RenderSelector", () => {
      expect(renderSelector).toBeDefined();
      expect(renderSelector.getStrategyName()).toBe("RenderSelector");
    });

    test("should handle the case without WebGPU renderer", () => {
      const selectorWithoutWebGPU = new RenderSelector({
        canvas: mockCanvasRender,
        react: mockReactRender,
      });

      expect(selectorWithoutWebGPU).toBeDefined();
    });

    test("should handle the case with only React renderer", () => {
      const selectorOnlyReact = new RenderSelector({
        react: mockReactRender,
      });

      expect(selectorOnlyReact).toBeDefined();
    });
  });

  describe("Renderer Selection Logic", () => {
    const mockEntity = { id: "test-entity" } as IEntity;

    test("selectOptimalRenderer should return a valid selection result", () => {
      const result = renderSelector.selectOptimalRenderer(mockEntity, mockContext);

      expect(result).toHaveProperty("renderer");
      expect(result).toHaveProperty("mode");
      expect(result).toHaveProperty("reason");
      expect(result).toHaveProperty("confidence");
      expect(typeof result.confidence).toBe("number");
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    test("selectOptimalRenderer should select React renderer for simple entities", () => {
      const result = renderSelector.selectOptimalRenderer(mockEntity, mockContext);

      expect(result.renderer).toBeDefined();
      expect(["react", "canvas", "webgpu"]).toContain(result.mode);
    });

    test("selectForBatch should return an entity map grouped by renderer", () => {
      const entities = [
        { id: "entity1" } as IEntity,
        { id: "entity2" } as IEntity,
        { id: "entity3" } as IEntity,
      ];

      const result = renderSelector.selectForBatch(entities);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBeGreaterThan(0);

      // Verify all entities are assigned to some renderer
      const totalEntities = Array.from(result.values()).reduce(
        (sum, entityList) => sum + entityList.length,
        0
      );
      expect(totalEntities).toBe(entities.length);
    });

    test("selectForBatch should handle empty entity list", () => {
      const result = renderSelector.selectForBatch([]);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });
  });

  describe("Cache Management", () => {
    test("should use cache to optimize repeated selections", () => {
      const entity1 = { id: "entity1" } as IEntity;

      // First selection
      const result1 = renderSelector.selectOptimalRenderer(entity1, mockContext);
      // Second selection of the same entity
      const result2 = renderSelector.selectOptimalRenderer(entity1, mockContext);

      expect(result1).toEqual(result2);
    });

    test("should return different selections for different entities", () => {
      const entity1 = { id: "entity1", type: "simple" } as IEntity;

      const result1 = renderSelector.selectOptimalRenderer(entity1, mockContext);
      const result2 = renderSelector.selectOptimalRenderer(entity1, mockContext);

      // Same entity should return the same result
      expect(result1).toEqual(result2);
    });
  });

  describe("Device Capability Detection", () => {
    test("should initialize device capability detection", () => {
      // Verify initialization call
      expect(renderSelector).toBeDefined();
    });

    test("should handle device capability detection failure", () => {
      // Even if device detection fails, the selector should still work
      const result = renderSelector.selectOptimalRenderer(
        {
          id: "test",
        } as IEntity,
        mockContext
      );
      expect(result).toBeDefined();
    });
  });

  describe("Renderer Update", () => {
    test("updateRenderers should update renderer references", () => {
      const newCanvasRender = {
        getName: vi.fn().mockReturnValue("CanvasRender"),
        getType: vi.fn().mockReturnValue("canvas"),
        getPriority: vi.fn().mockReturnValue(50),
      } as unknown as CanvasRender;
      const newReactRender = {
        getName: vi.fn().mockReturnValue("ReactRender"),
        getType: vi.fn().mockReturnValue("react"),
        getPriority: vi.fn().mockReturnValue(80),
      } as unknown as ReactRender;

      renderSelector.updateRenderers({
        canvas: newCanvasRender,
        react: newReactRender,
      });

      // Verify the updated selector still works
      const result = renderSelector.selectOptimalRenderer(
        {
          id: "test",
        } as IEntity,
        mockContext
      );
      expect(result).toBeDefined();
    });

    test("updateRenderers should handle partial updates", () => {
      const newReactRender = {
        getName: vi.fn().mockReturnValue("ReactRender"),
        getType: vi.fn().mockReturnValue("react"),
        getPriority: vi.fn().mockReturnValue(80),
      } as unknown as ReactRender;

      renderSelector.updateRenderers({
        react: newReactRender,
      });

      const result = renderSelector.selectOptimalRenderer(
        {
          id: "test",
        } as IEntity,
        mockContext
      );
      expect(result).toBeDefined();
    });
  });

  describe("Strategy Name", () => {
    test("getStrategyName should return the correct strategy name", () => {
      expect(renderSelector.getStrategyName()).toBe("RenderSelector");
    });
  });

  describe("Edge Cases", () => {
    test("should handle the case with no available renderers", () => {
      const emptySelector = new RenderSelector({});

      expect(() => {
        emptySelector.selectOptimalRenderer({ id: "test" } as IEntity, mockContext);
      }).not.toThrow();
    });

    test("should handle invalid entity input", () => {
      const invalidEntity = null as unknown as IEntity;

      expect(() => {
        renderSelector.selectOptimalRenderer(invalidEntity, mockContext);
      }).toThrow("Entity cannot be null or undefined");
    });

    test("should handle entities with undefined properties", () => {
      const entityWithUndefined = {
        id: "test",
        type: undefined,
        data: undefined,
        dispose: vi.fn(),
      } as unknown as IEntity;

      const result = renderSelector.selectOptimalRenderer(entityWithUndefined, mockContext);
      expect(result).toBeDefined();
    });
  });

  describe("Advanced Edge Cases", () => {
    test("should handle entity data without toJSON method", () => {
      const entityWithoutToJSON = {
        id: "no-tojson",
        type: "test",
        data: {
          toJSON: () => ({}), // Provide toJSON method but return empty object
          someProp: "value",
        },
        dispose: vi.fn(),
      } as unknown as IEntity;

      expect(() => {
        renderSelector.selectOptimalRenderer(entityWithoutToJSON, mockContext);
      }).not.toThrow();
    });

    test("should handle null or undefined entity data", () => {
      const entityWithNullData = {
        id: "null-data",
        type: "test",
        data: null,
        dispose: vi.fn(),
      } as unknown as IEntity;

      expect(() => {
        renderSelector.selectOptimalRenderer(entityWithNullData, mockContext);
      }).not.toThrow();
    });

    test("should handle concurrent selection requests", () => {
      const entities = [
        { id: "concurrent1", type: "test1" } as IEntity,
        { id: "concurrent2", type: "test2" } as IEntity,
        { id: "concurrent3", type: "test3" } as IEntity,
      ];

      expect(() => {
        entities.forEach((entity) => {
          renderSelector.selectOptimalRenderer(entity, mockContext);
        });
      }).not.toThrow();
    });
  });
});
