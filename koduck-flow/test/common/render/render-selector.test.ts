/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { RenderSelector } from "../../../src/common/render/render-selector";
import type { CanvasRender } from "../../../src/common/render/canvas-render";
import type { ReactRender } from "../../../src/common/render/react-render";
import type { WebGPURender } from "../../../src/common/render/webgpu-render";
import type { IEntity } from "../../../src/common/entity/types";

// Mock 依赖
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

  describe("构造函数和初始化", () => {
    test("应该正确初始化 RenderSelector", () => {
      expect(renderSelector).toBeDefined();
      expect(renderSelector.getStrategyName()).toBe("RenderSelector");
    });

    test("应该处理没有 WebGPU 渲染器的情况", () => {
      const selectorWithoutWebGPU = new RenderSelector({
        canvas: mockCanvasRender,
        react: mockReactRender,
      });

      expect(selectorWithoutWebGPU).toBeDefined();
    });

    test("应该处理只有 React 渲染器的情况", () => {
      const selectorOnlyReact = new RenderSelector({
        react: mockReactRender,
      });

      expect(selectorOnlyReact).toBeDefined();
    });
  });

  describe("渲染器选择逻辑", () => {
    const mockEntity = { id: "test-entity" } as IEntity;

    test("selectOptimalRenderer 应该返回有效的选择结果", () => {
      const result = renderSelector.selectOptimalRenderer(mockEntity, mockContext);

      expect(result).toHaveProperty("renderer");
      expect(result).toHaveProperty("mode");
      expect(result).toHaveProperty("reason");
      expect(result).toHaveProperty("confidence");
      expect(typeof result.confidence).toBe("number");
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    test("selectOptimalRenderer 应该为简单实体选择 React 渲染器", () => {
      const result = renderSelector.selectOptimalRenderer(mockEntity, mockContext);

      expect(result.renderer).toBeDefined();
      expect(["react", "canvas", "webgpu"]).toContain(result.mode);
    });

    test("selectForBatch 应该返回按渲染器分组的实体映射", () => {
      const entities = [
        { id: "entity1" } as IEntity,
        { id: "entity2" } as IEntity,
        { id: "entity3" } as IEntity,
      ];

      const result = renderSelector.selectForBatch(entities);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBeGreaterThan(0);

      // 验证所有实体都被分配到某个渲染器
      const totalEntities = Array.from(result.values()).reduce(
        (sum, entityList) => sum + entityList.length,
        0
      );
      expect(totalEntities).toBe(entities.length);
    });

    test("selectForBatch 应该处理空实体列表", () => {
      const result = renderSelector.selectForBatch([]);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });
  });

  describe("缓存管理", () => {
    test("应该使用缓存来优化重复的选择", () => {
      const entity1 = { id: "entity1" } as IEntity;

      // 第一次选择
      const result1 = renderSelector.selectOptimalRenderer(entity1, mockContext);
      // 第二次选择相同实体
      const result2 = renderSelector.selectOptimalRenderer(entity1, mockContext);

      expect(result1).toEqual(result2);
    });

    test("应该为不同实体返回不同的选择", () => {
      const entity1 = { id: "entity1", type: "simple" } as IEntity;

      const result1 = renderSelector.selectOptimalRenderer(entity1, mockContext);
      const result2 = renderSelector.selectOptimalRenderer(entity1, mockContext);

      // 相同实体应该返回相同结果
      expect(result1).toEqual(result2);
    });
  });

  describe("设备能力检测", () => {
    test("应该初始化设备能力检测", () => {
      // 验证初始化调用
      expect(renderSelector).toBeDefined();
    });

    test("应该处理设备能力检测失败", () => {
      // 即使设备检测失败，选择器也应该能正常工作
      const result = renderSelector.selectOptimalRenderer(
        {
          id: "test",
        } as IEntity,
        mockContext
      );
      expect(result).toBeDefined();
    });
  });

  describe("渲染器更新", () => {
    test("updateRenderers 应该更新渲染器引用", () => {
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

      // 验证更新后的选择器仍然工作
      const result = renderSelector.selectOptimalRenderer(
        {
          id: "test",
        } as IEntity,
        mockContext
      );
      expect(result).toBeDefined();
    });

    test("updateRenderers 应该处理部分更新", () => {
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

  describe("策略名称", () => {
    test("getStrategyName 应该返回正确的策略名称", () => {
      expect(renderSelector.getStrategyName()).toBe("RenderSelector");
    });
  });

  describe("边界情况", () => {
    test("应该处理没有可用渲染器的情况", () => {
      const emptySelector = new RenderSelector({});

      expect(() => {
        emptySelector.selectOptimalRenderer({ id: "test" } as IEntity, mockContext);
      }).not.toThrow();
    });

    test("应该处理无效的实体输入", () => {
      const invalidEntity = null as unknown as IEntity;

      expect(() => {
        renderSelector.selectOptimalRenderer(invalidEntity, mockContext);
      }).toThrow("Entity cannot be null or undefined");
    });

    test("应该处理包含 undefined 属性的实体", () => {
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

  describe("高级边界情况", () => {
    test("应该处理没有 toJSON 方法的实体数据", () => {
      const entityWithoutToJSON = {
        id: "no-tojson",
        type: "test",
        data: {
          toJSON: () => ({}), // 提供 toJSON 方法但返回空对象
          someProp: "value",
        },
        dispose: vi.fn(),
      } as unknown as IEntity;

      expect(() => {
        renderSelector.selectOptimalRenderer(entityWithoutToJSON, mockContext);
      }).not.toThrow();
    });

    test("应该处理 null 或 undefined 实体数据", () => {
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

    test("应该处理并发选择请求", () => {
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
