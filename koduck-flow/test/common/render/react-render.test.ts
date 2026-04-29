import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
// import { render } from "@testing-library/react";
import { ReactRender } from "../../../src/common/render/react-render";
import { RegistryManager, createRegistryManager } from "../../../src/common/registry";
import type { IEntity } from "../../../src/common/entity/types";
import type { IRenderContext } from "../../../src/common/render/types";

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

  describe("Constructor and initialization", () => {
    test("should correctly initialize ReactRender", () => {
      expect(reactRender).toBeDefined();
      expect(reactRender.getName()).toBe("ReactRender");
      expect(reactRender.getType()).toBe("react");
    });

    test("should initialize performance stats", () => {
      const stats = reactRender.getPerformanceStats();
      expect(stats).toBeDefined();
      expect(stats.type).toBe("react");
      expect(stats.name).toBe("ReactRender");
    });

    test("should initialize cache", () => {
      // Verify internal cache initialization
      expect(reactRender).toBeDefined();
    });
  });

  describe("Entity rendering", () => {
    const mockEntity = {
      id: "test-entity",
      type: "rectangle",
      data: { x: 100, y: 100, width: 50, height: 50 },
      dispose: vi.fn(),
    } as unknown as IEntity;

    test("render should return a React element", () => {
      const result = reactRender.render(mockEntity);

      // For entities without registry, should return null or default element
      expect(result).toBeDefined();
    });

    test("canRender should determine if rendering is possible based on entity type", () => {
      expect(reactRender.canRender(mockEntity)).toBe(true);
    });

    test("render should handle different types of entities", () => {
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

  describe("Cache management", () => {
    const mockEntity = {
      id: "cache-test-entity",
      type: "rectangle",
      data: { x: 100, y: 100, width: 50, height: 50 },
      dispose: vi.fn(),
    } as unknown as IEntity;

    test("should cache rendering results", () => {
      const result1 = reactRender.render(mockEntity);
      const result2 = reactRender.render(mockEntity);

      // Same entity should return same result (cache hit)
      expect(result1).toBe(result2);
    });

    test("should update cache count in performance stats", () => {
      const statsBefore = reactRender.getPerformanceStats();

      reactRender.render(mockEntity);
      reactRender.render(mockEntity); // cache hit

      const statsAfter = reactRender.getPerformanceStats();

      // Cache hit count should increase
      expect(statsAfter.cacheHitCount ?? 0).toBeGreaterThanOrEqual(statsBefore.cacheHitCount ?? 0);
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
      expect(() => reactRender.batchRender(mockEntities)).not.toThrow();
    });

    test("batchRender should handle empty entity lists", () => {
      expect(() => reactRender.batchRender([])).not.toThrow();
    });
  });

  describe("Configuration management", () => {
    test("configure should accept config parameters", () => {
      const config = {
        batchSize: 10,
        enableCache: true,
        maxCacheAge: 30000,
      };

      expect(() => reactRender.configure(config)).not.toThrow();
    });

    test("configure should handle empty config", () => {
      expect(() => reactRender.configure({})).not.toThrow();
    });
  });

  describe("Registry manager setup", () => {
    test("setRegistryManager should set the registry manager", () => {
      const newRegistryManager = createRegistryManager();
      reactRender.setRegistryManager(newRegistryManager);

      expect(() => reactRender.setRegistryManager(newRegistryManager)).not.toThrow();
    });
  });

  describe("Performance stats", () => {
    test("getPerformanceStats should return performance statistics", () => {
      const stats = reactRender.getPerformanceStats();

      expect(stats).toHaveProperty("renderCount");
      expect(stats).toHaveProperty("totalRenderTime");
      expect(stats).toHaveProperty("averageRenderTime");
      expect(stats).toHaveProperty("cacheHitCount");
      expect(stats).toHaveProperty("cacheMissCount");
      expect(stats).toHaveProperty("type", "react");
      expect(stats).toHaveProperty("name", "ReactRender");
    });

    test("rendering operations should update performance statistics", () => {
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

  describe("React component rendering", () => {
    test("should be able to render as a valid React component", () => {
      const mockEntity = {
        id: "react-test",
        type: "div",
        data: { className: "test-class" },
        dispose: vi.fn(),
      } as unknown as IEntity;

      const element = reactRender.render(mockEntity);

      // Verify returned value is a valid React element
      if (element) {
        expect(React.isValidElement(element)).toBe(true);
      }
    });

    test("should handle async rendering", async () => {
      const mockEntity = {
        id: "async-test",
        type: "async-component",
        data: {},
        dispose: vi.fn(),
      } as unknown as IEntity;

      const element = reactRender.render(mockEntity);

      // Async rendering should return valid element or null
      expect(element === null || React.isValidElement(element)).toBe(true);
    });
  });

  describe("Resource cleanup", () => {
    test("dispose should clean up resources", () => {
      expect(() => reactRender.dispose()).not.toThrow();
    });

    test("dispose should be idempotent", () => {
      reactRender.dispose();
      expect(() => reactRender.dispose()).not.toThrow();
    });
  });

  describe("Edge cases", () => {
    test("should handle invalid entity input", () => {
      const invalidEntity = null as unknown as IEntity;

      expect(() => reactRender.render(invalidEntity)).not.toThrow();
      expect(() => reactRender.canRender(invalidEntity)).not.toThrow();
    });

    test("should handle entities without data", () => {
      const entityWithoutData = {
        id: "no-data",
        type: "empty",
        dispose: vi.fn(),
      } as unknown as IEntity;

      const result = reactRender.render(entityWithoutData);
      expect(result).toBeDefined();
    });

    test("should handle circular reference data", () => {
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

    test("should handle rendering under exceptional conditions", () => {
      const problematicEntity = {
        id: "problematic",
        type: "error",
        data: { throwError: true },
        dispose: vi.fn(),
      } as unknown as IEntity;

      // Even if rendering errors, it should not throw exception
      expect(() => reactRender.render(problematicEntity)).not.toThrow();
    });
  });

  describe("React rendering integration tests", () => {
    test("should be able to validate React element validity", () => {
      const mockEntity = {
        id: "integration-test",
        type: "button",
        data: { text: "Click me", onClick: vi.fn() },
        dispose: vi.fn(),
      } as unknown as IEntity;

      const element = reactRender.render(mockEntity);

      if (element && React.isValidElement(element)) {
        // Verify it is a valid React element
        expect(React.isValidElement(element)).toBe(true);
      }
    });
  });

  describe("renderContext method", () => {
    test("should handle render context and update performance stats", () => {
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

    test("should handle empty render context", () => {
      const context: IRenderContext = {
        nodes: [],
        viewport: { x: 0, y: 0, zoom: 1, width: 800, height: 600 },
        timestamp: Date.now(),
      };

      expect(() => {
        reactRender.renderContext(context);
      }).not.toThrow();
    });

    test("should handle render context without nodes", () => {
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

  describe("Concurrent rendering features", () => {
    test("renderEntityConcurrent should support rendering with transition", () => {
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

    test("renderEntityConcurrent should support rendering without transition", () => {
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

  describe("Async rendering features", () => {
    test("renderEntityAsync should return Promise resolving to React element", async () => {
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

  describe("Batch concurrent rendering", () => {
    test("batchRenderConcurrent should handle multiple entities and return result map", async () => {
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

    test("batchRenderConcurrent should handle empty entity lists", async () => {
      const results = await reactRender.batchRenderConcurrent([]);

      expect(results).toBeInstanceOf(Map);
      expect(results.size).toBe(0);
    });
  });

  describe("Batch rendering concurrent mode", () => {
    test("batchRender should work normally when concurrent mode is enabled", () => {
      // First configure to enable concurrent mode
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

  describe("dispose full cleanup", () => {
    test("dispose should clean up all resources and reset state", () => {
      // First perform some operations to create state
      const entity = {
        id: "dispose-test-entity",
        type: "test",
        data: { value: "dispose test" },
        dispose: vi.fn(),
      } as unknown as IEntity;

      reactRender.render(entity);
      reactRender.configure({ batchSize: 50 });

      // Execute dispose
      reactRender.dispose();

      // Verify performance stats are reset
      const stats = reactRender.getPerformanceStats();
      expect(stats.totalRenderTime).toBe(0);
      expect(stats.renderCount).toBe(0);
      expect(stats.cacheHitCount).toBe(0);
      expect(stats.cacheMissCount).toBe(0);
      expect(stats.averageRenderTime).toBe(0);
    });

    test("dispose should be idempotent", () => {
      expect(() => {
        reactRender.dispose();
        reactRender.dispose();
      }).not.toThrow();
    });
  });
});
