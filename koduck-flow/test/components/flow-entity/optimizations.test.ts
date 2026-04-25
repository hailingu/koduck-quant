/**
 * @file Optimizations Unit Tests
 * @description Tests for performance optimization utilities including path memoization,
 * component props comparison, and viewport-based virtualization.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 5.4
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  createMemoizedPathCalculator,
  memoizedPathCalculator,
  generatePathCacheKey,
  arePositionsEqual,
  areSizesEqual,
  areArraysShallowEqual,
  areNodePropsEqual,
  areEdgePropsEqual,
  useVirtualizedNodes,
  isNodeInViewport,
  calculateNodeBounds,
  useStableCallback,
  throttle,
  debounce,
  measurePerformance,
  type Viewport,
} from "../../../src/components/flow-entity/optimizations";
import type {
  Position,
  Size,
  IFlowNodeEntityData,
} from "../../../src/components/flow-entity/types";

// =============================================================================
// Test Data Factories
// =============================================================================

/**
 * Creates a mock node for testing
 * @param overrides - Partial node data to override defaults
 * @returns Mock node data
 */
function createMockNode(overrides: Partial<IFlowNodeEntityData> = {}): IFlowNodeEntityData {
  return {
    id: `node-${Math.random().toString(36).slice(2, 9)}`,
    nodeType: "default",
    label: "Test Node",
    position: { x: 0, y: 0 },
    size: { width: 200, height: 100 },
    executionState: "idle",
    inputPorts: [],
    outputPorts: [],
    ...overrides,
  } as IFlowNodeEntityData;
}

/**
 * Creates multiple mock nodes
 * @param count - Number of nodes to create
 * @param startX - Starting x position
 * @param startY - Starting y position
 * @param spacing - Spacing between nodes
 * @returns Array of mock nodes
 */
function createMockNodes(
  count: number,
  startX = 0,
  startY = 0,
  spacing = 250
): IFlowNodeEntityData[] {
  return Array.from({ length: count }, (_, i) => {
    const node = createMockNode({
      label: `Node ${i}`,
      position: { x: startX + (i % 10) * spacing, y: startY + Math.floor(i / 10) * spacing },
    });
    // Override the id after creation
    (node as unknown as { id: string }).id = `node-${i}`;
    return node;
  });
}

/**
 * Creates a mock viewport
 * @param overrides - Partial viewport data
 * @returns Mock viewport
 */
function createMockViewport(overrides: Partial<Viewport> = {}): Viewport {
  return {
    x: 0,
    y: 0,
    width: 1000,
    height: 800,
    scale: 1,
    ...overrides,
  };
}

// =============================================================================
// Path Memoization Tests
// =============================================================================

describe("Path Memoization", () => {
  describe("generatePathCacheKey", () => {
    it("generates consistent keys for same inputs", () => {
      const source: Position = { x: 100, y: 50 };
      const target: Position = { x: 300, y: 150 };

      const key1 = generatePathCacheKey(source, target, "bezier");
      const key2 = generatePathCacheKey(source, target, "bezier");

      expect(key1).toBe(key2);
    });

    it("generates different keys for different positions", () => {
      const source1: Position = { x: 100, y: 50 };
      const source2: Position = { x: 101, y: 50 };
      const target: Position = { x: 300, y: 150 };

      const key1 = generatePathCacheKey(source1, target, "bezier");
      const key2 = generatePathCacheKey(source2, target, "bezier");

      expect(key1).not.toBe(key2);
    });

    it("generates different keys for different path types", () => {
      const source: Position = { x: 100, y: 50 };
      const target: Position = { x: 300, y: 150 };

      const key1 = generatePathCacheKey(source, target, "bezier");
      const key2 = generatePathCacheKey(source, target, "straight");

      expect(key1).not.toBe(key2);
    });

    it("handles floating point coordinates with rounding", () => {
      const source1: Position = { x: 100.001, y: 50.002 };
      const source2: Position = { x: 100.003, y: 50.004 };
      const target: Position = { x: 300, y: 150 };

      const key1 = generatePathCacheKey(source1, target, "bezier");
      const key2 = generatePathCacheKey(source2, target, "bezier");

      // Small differences should round to same key
      expect(key1).toBe(key2);
    });

    it("includes path config in key", () => {
      const source: Position = { x: 100, y: 50 };
      const target: Position = { x: 300, y: 150 };

      const key1 = generatePathCacheKey(source, target, "bezier", {
        type: "bezier",
        curvature: 0.3,
      });
      const key2 = generatePathCacheKey(source, target, "bezier", {
        type: "bezier",
        curvature: 0.7,
      });

      expect(key1).not.toBe(key2);
    });
  });

  describe("createMemoizedPathCalculator", () => {
    let calculator: ReturnType<typeof createMemoizedPathCalculator>;

    beforeEach(() => {
      calculator = createMemoizedPathCalculator(100);
    });

    it("calculates paths correctly", () => {
      const source: Position = { x: 0, y: 0 };
      const target: Position = { x: 100, y: 100 };

      const path = calculator.calculate(source, target, "straight");

      expect(path).toBe("M 0 0 L 100 100");
    });

    it("returns cached result on repeated calls", () => {
      const source: Position = { x: 0, y: 0 };
      const target: Position = { x: 100, y: 100 };

      const path1 = calculator.calculate(source, target, "bezier");
      const path2 = calculator.calculate(source, target, "bezier");

      expect(path1).toBe(path2);
      expect(calculator.getStats().hits).toBe(1);
      expect(calculator.getStats().misses).toBe(1);
    });

    it("tracks cache statistics", () => {
      const source: Position = { x: 0, y: 0 };
      const target: Position = { x: 100, y: 100 };

      // First call - miss
      calculator.calculate(source, target, "bezier");
      expect(calculator.getStats()).toEqual({
        hits: 0,
        misses: 1,
        size: 1,
        hitRate: 0,
      });

      // Second call - hit
      calculator.calculate(source, target, "bezier");
      expect(calculator.getStats()).toEqual({
        hits: 1,
        misses: 1,
        size: 1,
        hitRate: 50,
      });
    });

    it("evicts oldest entries when max size is reached", () => {
      const smallCalculator = createMemoizedPathCalculator(3);
      const source: Position = { x: 0, y: 0 };

      // Fill cache
      smallCalculator.calculate(source, { x: 100, y: 0 }, "straight");
      smallCalculator.calculate(source, { x: 200, y: 0 }, "straight");
      smallCalculator.calculate(source, { x: 300, y: 0 }, "straight");

      expect(smallCalculator.size()).toBe(3);

      // Add one more - should evict first
      smallCalculator.calculate(source, { x: 400, y: 0 }, "straight");

      expect(smallCalculator.size()).toBe(3);
    });

    it("clears cache correctly", () => {
      const source: Position = { x: 0, y: 0 };
      const target: Position = { x: 100, y: 100 };

      calculator.calculate(source, target, "bezier");
      expect(calculator.size()).toBe(1);

      calculator.clear();
      expect(calculator.size()).toBe(0);
      expect(calculator.getStats().hits).toBe(0);
      expect(calculator.getStats().misses).toBe(0);
    });
  });

  describe("memoizedPathCalculator (global instance)", () => {
    it("is available as a global singleton", () => {
      expect(memoizedPathCalculator).toBeDefined();
      expect(typeof memoizedPathCalculator.calculate).toBe("function");
      expect(typeof memoizedPathCalculator.clear).toBe("function");
      expect(typeof memoizedPathCalculator.getStats).toBe("function");
    });
  });
});

// =============================================================================
// Comparison Utilities Tests
// =============================================================================

describe("Comparison Utilities", () => {
  describe("arePositionsEqual", () => {
    it("returns true for equal positions", () => {
      const a: Position = { x: 100, y: 200 };
      const b: Position = { x: 100, y: 200 };
      expect(arePositionsEqual(a, b)).toBe(true);
    });

    it("returns false for different positions", () => {
      const a: Position = { x: 100, y: 200 };
      const b: Position = { x: 101, y: 200 };
      expect(arePositionsEqual(a, b)).toBe(false);
    });

    it("returns true for same reference", () => {
      const a: Position = { x: 100, y: 200 };
      expect(arePositionsEqual(a, a)).toBe(true);
    });

    it("handles undefined values", () => {
      const a: Position = { x: 100, y: 200 };
      expect(arePositionsEqual(undefined, undefined)).toBe(true);
      expect(arePositionsEqual(a, undefined)).toBe(false);
      expect(arePositionsEqual(undefined, a)).toBe(false);
    });
  });

  describe("areSizesEqual", () => {
    it("returns true for equal sizes", () => {
      const a: Size = { width: 100, height: 200 };
      const b: Size = { width: 100, height: 200 };
      expect(areSizesEqual(a, b)).toBe(true);
    });

    it("returns false for different sizes", () => {
      const a: Size = { width: 100, height: 200 };
      const b: Size = { width: 101, height: 200 };
      expect(areSizesEqual(a, b)).toBe(false);
    });

    it("handles undefined values", () => {
      const a: Size = { width: 100, height: 200 };
      expect(areSizesEqual(undefined, undefined)).toBe(true);
      expect(areSizesEqual(a, undefined)).toBe(false);
    });
  });

  describe("areArraysShallowEqual", () => {
    it("returns true for equal arrays", () => {
      expect(areArraysShallowEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    });

    it("returns false for different arrays", () => {
      expect(areArraysShallowEqual([1, 2, 3], [1, 2, 4])).toBe(false);
    });

    it("returns false for different lengths", () => {
      expect(areArraysShallowEqual([1, 2], [1, 2, 3])).toBe(false);
    });

    it("handles undefined values", () => {
      expect(areArraysShallowEqual(undefined, undefined)).toBe(true);
      expect(areArraysShallowEqual([1], undefined)).toBe(false);
    });

    it("returns true for same reference", () => {
      const arr = [1, 2, 3];
      expect(areArraysShallowEqual(arr, arr)).toBe(true);
    });
  });

  describe("areNodePropsEqual", () => {
    it("returns true for identical props", () => {
      const entity = { id: "1", data: { label: "test" } };
      const props = { entity, selected: true, className: "test" };
      expect(areNodePropsEqual(props, props)).toBe(true);
    });

    it("returns true for equal props with different objects", () => {
      const entity = { id: "1", data: { label: "test" } };
      const props1 = { entity, selected: true, className: "test" };
      const props2 = { entity, selected: true, className: "test" };
      expect(areNodePropsEqual(props1, props2)).toBe(true);
    });

    it("returns false when entity ID changes", () => {
      const entity1 = { id: "1", data: { label: "test" } };
      const entity2 = { id: "2", data: { label: "test" } };
      const props1 = { entity: entity1, selected: true };
      const props2 = { entity: entity2, selected: true };
      expect(areNodePropsEqual(props1, props2)).toBe(false);
    });

    it("returns false when entity data changes", () => {
      const entity1 = { id: "1", data: { label: "test1" } };
      const entity2 = { id: "1", data: { label: "test2" } };
      const props1 = { entity: entity1, selected: true };
      const props2 = { entity: entity2, selected: true };
      expect(areNodePropsEqual(props1, props2)).toBe(false);
    });

    it("returns false when selection changes", () => {
      const entity = { id: "1", data: { label: "test" } };
      const props1 = { entity, selected: true };
      const props2 = { entity, selected: false };
      expect(areNodePropsEqual(props1, props2)).toBe(false);
    });

    it("returns false when className changes", () => {
      const entity = { id: "1", data: { label: "test" } };
      const props1 = { entity, className: "class1" };
      const props2 = { entity, className: "class2" };
      expect(areNodePropsEqual(props1, props2)).toBe(false);
    });

    it("compares style objects shallowly", () => {
      const entity = { id: "1", data: {} };
      const props1 = { entity, style: { color: "red" } };
      const props2 = { entity, style: { color: "red" } };
      const props3 = { entity, style: { color: "blue" } };

      expect(areNodePropsEqual(props1, props2)).toBe(true);
      expect(areNodePropsEqual(props1, props3)).toBe(false);
    });
  });

  describe("areEdgePropsEqual", () => {
    it("returns true for identical props", () => {
      const entity = { id: "1", data: {} };
      const sourcePosition = { x: 0, y: 0 };
      const targetPosition = { x: 100, y: 100 };
      const props = { entity, sourcePosition, targetPosition, selected: true };
      expect(areEdgePropsEqual(props, props)).toBe(true);
    });

    it("returns false when source position changes", () => {
      const entity = { id: "1", data: {} };
      const props1 = { entity, sourcePosition: { x: 0, y: 0 }, targetPosition: { x: 100, y: 100 } };
      const props2 = { entity, sourcePosition: { x: 1, y: 0 }, targetPosition: { x: 100, y: 100 } };
      expect(areEdgePropsEqual(props1, props2)).toBe(false);
    });

    it("returns false when target position changes", () => {
      const entity = { id: "1", data: {} };
      const props1 = { entity, sourcePosition: { x: 0, y: 0 }, targetPosition: { x: 100, y: 100 } };
      const props2 = { entity, sourcePosition: { x: 0, y: 0 }, targetPosition: { x: 101, y: 100 } };
      expect(areEdgePropsEqual(props1, props2)).toBe(false);
    });
  });
});

// =============================================================================
// Viewport Virtualization Tests
// =============================================================================

describe("Viewport Virtualization", () => {
  describe("isNodeInViewport", () => {
    it("returns true for node inside viewport", () => {
      const node = createMockNode({
        position: { x: 100, y: 100 },
        size: { width: 200, height: 100 },
      });
      const viewport = createMockViewport();

      expect(isNodeInViewport(node, viewport)).toBe(true);
    });

    it("returns false for node outside viewport", () => {
      const node = createMockNode({
        position: { x: 2000, y: 2000 },
        size: { width: 200, height: 100 },
      });
      const viewport = createMockViewport();

      expect(isNodeInViewport(node, viewport)).toBe(false);
    });

    it("returns true for node partially in viewport", () => {
      const node = createMockNode({
        position: { x: 900, y: 700 },
        size: { width: 200, height: 200 },
      });
      const viewport = createMockViewport();

      expect(isNodeInViewport(node, viewport)).toBe(true);
    });

    it("includes nodes in overscan area", () => {
      const node = createMockNode({
        position: { x: 1050, y: 100 },
        size: { width: 200, height: 100 },
      });
      const viewport = createMockViewport();

      expect(isNodeInViewport(node, viewport, 100)).toBe(true);
      expect(isNodeInViewport(node, viewport, 0)).toBe(false);
    });

    it("handles scaled viewport", () => {
      const node = createMockNode({
        position: { x: 600, y: 500 },
        size: { width: 200, height: 100 },
      });
      const viewport = createMockViewport({ scale: 0.5 });

      // With scale 0.5, viewport covers 2000x1600 canvas area
      expect(isNodeInViewport(node, viewport)).toBe(true);
    });

    it("handles negative positions", () => {
      const node = createMockNode({
        position: { x: -100, y: -50 },
        size: { width: 200, height: 100 },
      });
      const viewport = createMockViewport();

      expect(isNodeInViewport(node, viewport)).toBe(true);
    });
  });

  describe("calculateNodeBounds", () => {
    it("returns zero bounds for empty array", () => {
      const bounds = calculateNodeBounds([]);
      expect(bounds).toEqual({
        minX: 0,
        minY: 0,
        maxX: 0,
        maxY: 0,
        width: 0,
        height: 0,
      });
    });

    it("calculates bounds for single node", () => {
      const node = createMockNode({
        position: { x: 100, y: 200 },
        size: { width: 200, height: 100 },
      });
      const bounds = calculateNodeBounds([node]);

      expect(bounds).toEqual({
        minX: 100,
        minY: 200,
        maxX: 300,
        maxY: 300,
        width: 200,
        height: 100,
      });
    });

    it("calculates bounds for multiple nodes", () => {
      const nodes = [
        createMockNode({ position: { x: 0, y: 0 }, size: { width: 100, height: 100 } }),
        createMockNode({ position: { x: 500, y: 300 }, size: { width: 200, height: 100 } }),
      ];
      const bounds = calculateNodeBounds(nodes);

      expect(bounds).toEqual({
        minX: 0,
        minY: 0,
        maxX: 700,
        maxY: 400,
        width: 700,
        height: 400,
      });
    });

    it("uses default size when not specified", () => {
      const node = createMockNode({
        position: { x: 0, y: 0 },
      });
      // Remove size to test default
      delete (node as { size?: unknown }).size;
      const bounds = calculateNodeBounds([node]);

      // Default size is 200x100
      expect(bounds.width).toBe(200);
      expect(bounds.height).toBe(100);
    });
  });

  describe("useVirtualizedNodes", () => {
    it("returns all nodes when viewport is null", () => {
      const nodes = createMockNodes(100);
      const { result } = renderHook(() => useVirtualizedNodes(nodes, null));

      expect(result.current.visibleNodes).toHaveLength(100);
      expect(result.current.isVirtualized).toBe(false);
    });

    it("returns all nodes when disabled", () => {
      const nodes = createMockNodes(100);
      const viewport = createMockViewport();
      const { result } = renderHook(() => useVirtualizedNodes(nodes, viewport, { enabled: false }));

      expect(result.current.visibleNodes).toHaveLength(100);
      expect(result.current.isVirtualized).toBe(false);
    });

    it("returns all nodes below threshold", () => {
      const nodes = createMockNodes(30);
      const viewport = createMockViewport();
      const { result } = renderHook(() => useVirtualizedNodes(nodes, viewport, { threshold: 50 }));

      expect(result.current.visibleNodes).toHaveLength(30);
      expect(result.current.isVirtualized).toBe(false);
    });

    it("filters nodes based on viewport when above threshold", () => {
      // Create 100 nodes in a 10x10 grid with 250px spacing
      const nodes = createMockNodes(100);
      // Viewport shows only first ~16 nodes (4x4 in 1000x800 viewport)
      const viewport = createMockViewport();

      const { result } = renderHook(() =>
        useVirtualizedNodes(nodes, viewport, { threshold: 50, overscan: 0 })
      );

      expect(result.current.isVirtualized).toBe(true);
      expect(result.current.visibleNodes.length).toBeLessThan(100);
      expect(result.current.totalCount).toBe(100);
    });

    it("includes nodes in overscan area", () => {
      const nodes = createMockNodes(100);
      const viewport = createMockViewport();

      const { result: resultNoOverscan } = renderHook(() =>
        useVirtualizedNodes(nodes, viewport, { threshold: 50, overscan: 0 })
      );
      const { result: resultWithOverscan } = renderHook(() =>
        useVirtualizedNodes(nodes, viewport, { threshold: 50, overscan: 300 })
      );

      expect(resultWithOverscan.current.visibleNodes.length).toBeGreaterThanOrEqual(
        resultNoOverscan.current.visibleNodes.length
      );
    });

    it("calculates bounds correctly", () => {
      const nodes = createMockNodes(100);
      const viewport = createMockViewport();
      const { result } = renderHook(() => useVirtualizedNodes(nodes, viewport));

      expect(result.current.bounds.width).toBeGreaterThan(0);
      expect(result.current.bounds.height).toBeGreaterThan(0);
    });

    it("reports correct counts", () => {
      const nodes = createMockNodes(100);
      const viewport = createMockViewport();
      const { result } = renderHook(() =>
        useVirtualizedNodes(nodes, viewport, { threshold: 50, overscan: 0 })
      );

      expect(result.current.totalCount).toBe(100);
      expect(result.current.visibleCount).toBe(result.current.visibleNodes.length);
    });
  });
});

// =============================================================================
// Utility Hooks Tests - useStableCallback
// =============================================================================

describe("useStableCallback", () => {
  it("returns same function reference across renders", () => {
    let callCount = 0;
    const callback = () => {
      callCount++;
      return callCount;
    };

    const { result, rerender } = renderHook(() => useStableCallback(callback));
    const firstRef = result.current;

    rerender();
    const secondRef = result.current;

    expect(firstRef).toBe(secondRef);
  });

  it("calls the latest callback value", () => {
    const results: number[] = [];

    // Create callback that captures the current value
    const makeCallback = (val: number) => () => {
      results.push(val);
      return val;
    };

    const { result, rerender } = renderHook(({ val }) => useStableCallback(makeCallback(val)), {
      initialProps: { val: 0 },
    });

    result.current();
    expect(results).toEqual([0]);

    rerender({ val: 1 });
    result.current();
    expect(results).toEqual([0, 1]);
  });
});

// =============================================================================
// Performance Utility Tests
// =============================================================================

describe("Performance Utilities", () => {
  describe("measurePerformance", () => {
    it("returns the function result", () => {
      const result = measurePerformance(() => 42);
      expect(result).toBe(42);
    });

    it("measures execution without errors", () => {
      const fn = vi.fn(() => "test");
      const result = measurePerformance(fn, "test-label");

      expect(fn).toHaveBeenCalledOnce();
      expect(result).toBe("test");
    });
  });

  describe("throttle", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("calls function immediately on first call", () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled();
      expect(fn).toHaveBeenCalledOnce();
    });

    it("throttles subsequent calls", () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled();
      throttled();
      throttled();

      expect(fn).toHaveBeenCalledOnce();
    });

    it("allows calls after throttle period", () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled();
      expect(fn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);
      throttled();
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("schedules trailing call", () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled("first");
      throttled("second");

      expect(fn).toHaveBeenCalledWith("first");

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledWith("second");
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe("debounce", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("delays function execution", () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced();
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledOnce();
    });

    it("resets delay on subsequent calls", () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced();
      vi.advanceTimersByTime(50);
      debounced();
      vi.advanceTimersByTime(50);

      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      expect(fn).toHaveBeenCalledOnce();
    });

    it("passes arguments to debounced function", () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced("arg1", "arg2");
      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledWith("arg1", "arg2");
    });

    it("can be cancelled", () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced();
      debounced.cancel();
      vi.advanceTimersByTime(100);

      expect(fn).not.toHaveBeenCalled();
    });
  });
});
