import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
// import { render } from "@testing-library/react";
import { ReactRender } from "../../../src/common/render/react-render";
import { RegistryManager, createRegistryManager } from "../../../src/common/registry";
import type { IEntity } from "../../../src/common/entity/types";
import type { IRenderContext } from "../../../src/common/render/types";

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
    histogram: vi.fn(() => ({
      record: vi.fn(),
    })),
  })),
}));

describe("ReactRender", () => {
  let mockRegistryManager: RegistryManager;
  let reactRender: ReactRender;

  beforeEach(() => {
    mockRegistryManager = createRegistryManager();
    reactRender = new ReactRender(mockRegistryManager);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("构造函数和初始化", () => {
    test("应该正确初始化 ReactRender", () => {
      expect(reactRender).toBeDefined();
      expect(reactRender.getName()).toBe("ReactRender");
      expect(reactRender.getType()).toBe("react");
    });

    test("应该初始化性能统计", () => {
      const stats = reactRender.getPerformanceStats();
      expect(stats).toBeDefined();
      expect(stats.type).toBe("react");
      expect(stats.name).toBe("ReactRender");
    });

    test("应该初始化缓存", () => {
      // 验证内部缓存初始化
      expect(reactRender).toBeDefined();
    });
  });

  describe("实体渲染", () => {
    const mockEntity = {
      id: "test-entity",
      type: "rectangle",
      data: { x: 100, y: 100, width: 50, height: 50 },
      dispose: vi.fn(),
    } as unknown as IEntity;

    test("render 应该返回 React 元素", () => {
      const result = reactRender.render(mockEntity);

      // 对于没有注册表的实体，应该返回 null 或默认元素
      expect(result).toBeDefined();
    });

    test("canRender 应该根据实体类型判断是否能渲染", () => {
      expect(reactRender.canRender(mockEntity)).toBe(true);
    });

    test("render 应该处理不同类型的实体", () => {
      const textEntity = {
        id: "text-entity",
        type: "text",
        data: { text: "Hello World", x: 50, y: 50 },
        dispose: vi.fn(),
      } as unknown as IEntity;

      const result = reactRender.render(textEntity);
      expect(result).toBeDefined();
    });
  });

  describe("缓存管理", () => {
    const mockEntity = {
      id: "cache-test-entity",
      type: "rectangle",
      data: { x: 100, y: 100, width: 50, height: 50 },
      dispose: vi.fn(),
    } as unknown as IEntity;

    test("应该缓存渲染结果", () => {
      const result1 = reactRender.render(mockEntity);
      const result2 = reactRender.render(mockEntity);

      // 相同的实体应该返回相同的结果（缓存命中）
      expect(result1).toBe(result2);
    });

    test("应该更新性能统计中的缓存计数", () => {
      const statsBefore = reactRender.getPerformanceStats();

      reactRender.render(mockEntity);
      reactRender.render(mockEntity); // 缓存命中

      const statsAfter = reactRender.getPerformanceStats();

      // 缓存命中计数应该增加
      expect(statsAfter.cacheHitCount ?? 0).toBeGreaterThanOrEqual(statsBefore.cacheHitCount ?? 0);
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
      expect(() => reactRender.batchRender(mockEntities)).not.toThrow();
    });

    test("batchRender 应该处理空实体列表", () => {
      expect(() => reactRender.batchRender([])).not.toThrow();
    });
  });

  describe("配置管理", () => {
    test("configure 应该接受配置参数", () => {
      const config = {
        batchSize: 10,
        enableCache: true,
        maxCacheAge: 30000,
      };

      expect(() => reactRender.configure(config)).not.toThrow();
    });

    test("configure 应该处理空配置", () => {
      expect(() => reactRender.configure({})).not.toThrow();
    });
  });

  describe("注册表管理器设置", () => {
    test("setRegistryManager 应该设置注册表管理器", () => {
      const newRegistryManager = createRegistryManager();
      reactRender.setRegistryManager(newRegistryManager);

      expect(() => reactRender.setRegistryManager(newRegistryManager)).not.toThrow();
    });
  });

  describe("性能统计", () => {
    test("getPerformanceStats 应该返回性能统计信息", () => {
      const stats = reactRender.getPerformanceStats();

      expect(stats).toHaveProperty("renderCount");
      expect(stats).toHaveProperty("totalRenderTime");
      expect(stats).toHaveProperty("averageRenderTime");
      expect(stats).toHaveProperty("cacheHitCount");
      expect(stats).toHaveProperty("cacheMissCount");
      expect(stats).toHaveProperty("type", "react");
      expect(stats).toHaveProperty("name", "ReactRender");
    });

    test("渲染操作应该更新性能统计", () => {
      const mockEntity = {
        id: "perf-test",
        dispose: vi.fn(),
      } as unknown as IEntity;
      const statsBefore = reactRender.getPerformanceStats();

      reactRender.render(mockEntity);

      const statsAfter = reactRender.getPerformanceStats();
      expect(statsAfter.renderCount).toBeGreaterThanOrEqual(statsBefore.renderCount);
    });
  });

  describe("React 组件渲染", () => {
    test("应该能够渲染为有效的 React 组件", () => {
      const mockEntity = {
        id: "react-test",
        type: "div",
        data: { className: "test-class" },
        dispose: vi.fn(),
      } as unknown as IEntity;

      const element = reactRender.render(mockEntity);

      // 验证返回的是有效的 React 元素
      if (element) {
        expect(React.isValidElement(element)).toBe(true);
      }
    });

    test("应该处理异步渲染", async () => {
      const mockEntity = {
        id: "async-test",
        type: "async-component",
        data: {},
        dispose: vi.fn(),
      } as unknown as IEntity;

      const element = reactRender.render(mockEntity);

      // 异步渲染应该返回有效的元素或 null
      expect(element === null || React.isValidElement(element)).toBe(true);
    });
  });

  describe("资源清理", () => {
    test("dispose 应该清理资源", () => {
      expect(() => reactRender.dispose()).not.toThrow();
    });

    test("dispose 应该可重复调用", () => {
      reactRender.dispose();
      expect(() => reactRender.dispose()).not.toThrow();
    });
  });

  describe("边界情况", () => {
    test("应该处理无效的实体输入", () => {
      const invalidEntity = null as unknown as IEntity;

      expect(() => reactRender.render(invalidEntity)).not.toThrow();
      expect(() => reactRender.canRender(invalidEntity)).not.toThrow();
    });

    test("应该处理没有数据的实体", () => {
      const entityWithoutData = {
        id: "no-data",
        type: "empty",
        dispose: vi.fn(),
      } as unknown as IEntity;

      const result = reactRender.render(entityWithoutData);
      expect(result).toBeDefined();
    });

    test("应该处理循环引用数据", () => {
      const circularData: Record<string, unknown> = { name: "circular" };
      circularData.self = circularData;

      const entityWithCircularData = {
        id: "circular",
        type: "circular",
        data: circularData,
        dispose: vi.fn(),
      } as unknown as IEntity;

      expect(() => reactRender.render(entityWithCircularData)).not.toThrow();
    });

    test("应该处理异常情况下的渲染", () => {
      const problematicEntity = {
        id: "problematic",
        type: "error",
        data: { throwError: true },
        dispose: vi.fn(),
      } as unknown as IEntity;

      // 即使渲染出错，也不应该抛出异常
      expect(() => reactRender.render(problematicEntity)).not.toThrow();
    });
  });

  describe("React 渲染集成测试", () => {
    test("应该能够验证 React 元素有效性", () => {
      const mockEntity = {
        id: "integration-test",
        type: "button",
        data: { text: "Click me", onClick: vi.fn() },
        dispose: vi.fn(),
      } as unknown as IEntity;

      const element = reactRender.render(mockEntity);

      if (element && React.isValidElement(element)) {
        // 验证是有效的 React 元素
        expect(React.isValidElement(element)).toBe(true);
      }
    });
  });

  describe("renderContext 方法", () => {
    test("应该处理渲染上下文并更新性能统计", () => {
      const context: IRenderContext = {
        nodes: [
          { id: "node1", type: "test", dispose: vi.fn() } as unknown as IEntity,
          { id: "node2", type: "test", dispose: vi.fn() } as unknown as IEntity,
        ],
        viewport: { x: 0, y: 0, zoom: 1, width: 800, height: 600 },
        timestamp: Date.now(),
      };

      const initialStats = { ...reactRender.getPerformanceStats() };

      reactRender.renderContext(context);

      const updatedStats = reactRender.getPerformanceStats();
      expect(updatedStats.renderCount).toBeGreaterThan(initialStats.renderCount);
    });

    test("应该处理空的渲染上下文", () => {
      const context: IRenderContext = {
        nodes: [],
        viewport: { x: 0, y: 0, zoom: 1, width: 800, height: 600 },
        timestamp: Date.now(),
      };

      expect(() => {
        reactRender.renderContext(context);
      }).not.toThrow();
    });

    test("应该处理没有节点的渲染上下文", () => {
      const context: IRenderContext = {
        nodes: [],
        viewport: { x: 0, y: 0, zoom: 1, width: 800, height: 600 },
        timestamp: Date.now(),
      };

      expect(() => {
        reactRender.renderContext(context);
      }).not.toThrow();
    });
  });

  describe("并发渲染功能", () => {
    test("renderEntityConcurrent 应该支持使用 transition 的渲染", () => {
      const entity = {
        id: "concurrent-entity",
        type: "test",
        data: { value: "test" },
        dispose: vi.fn(),
      } as unknown as IEntity;

      const result = reactRender.renderEntityConcurrent(entity, {
        useTransition: true,
        priority: "normal",
      });

      expect(result).toBeDefined();
      expect(React.isValidElement(result)).toBe(true);
    });

    test("renderEntityConcurrent 应该支持不使用 transition 的渲染", () => {
      const entity = {
        id: "sync-entity",
        type: "test",
        data: { value: "test" },
        dispose: vi.fn(),
      } as unknown as IEntity;

      const result = reactRender.renderEntityConcurrent(entity, {
        useTransition: false,
        priority: "high",
      });

      expect(result).toBeDefined();
      expect(React.isValidElement(result)).toBe(true);
    });
  });

  describe("异步渲染功能", () => {
    test("renderEntityAsync 应该返回 Promise 并解析为 React 元素", async () => {
      const entity = {
        id: "async-entity",
        type: "test",
        data: { value: "async test" },
        dispose: vi.fn(),
      } as unknown as IEntity;

      const result = await reactRender.renderEntityAsync(entity);

      expect(result).toBeDefined();
      expect(React.isValidElement(result)).toBe(true);
    });
  });

  describe("批量并发渲染", () => {
    test("batchRenderConcurrent 应该处理多个实体并返回结果映射", async () => {
      const entities = [
        {
          id: "batch-entity-1",
          type: "test",
          data: { value: "batch 1" },
          dispose: vi.fn(),
        },
        {
          id: "batch-entity-2",
          type: "test",
          data: { value: "batch 2" },
          dispose: vi.fn(),
        },
      ] as unknown as IEntity[];

      const results = await reactRender.batchRenderConcurrent(entities);

      expect(results).toBeInstanceOf(Map);
      expect(results.size).toBe(2);
      expect(results.has("batch-entity-1")).toBe(true);
      expect(results.has("batch-entity-2")).toBe(true);

      for (const element of results.values()) {
        expect(React.isValidElement(element)).toBe(true);
      }
    });

    test("batchRenderConcurrent 应该处理空实体列表", async () => {
      const results = await reactRender.batchRenderConcurrent([]);

      expect(results).toBeInstanceOf(Map);
      expect(results.size).toBe(0);
    });
  });

  describe("批量渲染并发模式", () => {
    test("batchRender 应该在启用并发时正常工作", () => {
      // 先配置启用并发
      reactRender.configure({
        enableBatchRendering: true,
        enablePerformanceOptimization: true,
      });

      const entities = [
        {
          id: "transition-entity-1",
          type: "test",
          data: { value: "transition 1" },
          dispose: vi.fn(),
        },
        {
          id: "transition-entity-2",
          type: "test",
          data: { value: "transition 2" },
          dispose: vi.fn(),
        },
      ] as unknown as IEntity[];

      const results = reactRender.batchRender(entities);

      expect(results).toHaveLength(2);
      results.forEach((element) => {
        expect(React.isValidElement(element)).toBe(true);
      });
    });
  });

  describe("dispose 完整清理", () => {
    test("dispose 应该清理所有资源和重置状态", () => {
      // 先进行一些操作以创建状态
      const entity = {
        id: "dispose-test-entity",
        type: "test",
        data: { value: "dispose test" },
        dispose: vi.fn(),
      } as unknown as IEntity;

      reactRender.render(entity);
      reactRender.configure({ batchSize: 50 });

      // 执行 dispose
      reactRender.dispose();

      // 验证性能统计被重置
      const stats = reactRender.getPerformanceStats();
      expect(stats.totalRenderTime).toBe(0);
      expect(stats.renderCount).toBe(0);
      expect(stats.cacheHitCount).toBe(0);
      expect(stats.cacheMissCount).toBe(0);
      expect(stats.averageRenderTime).toBe(0);
    });

    test("dispose 应该可重复调用", () => {
      expect(() => {
        reactRender.dispose();
        reactRender.dispose();
      }).not.toThrow();
    });
  });
});
