/**
 * @file Performance Optimization Utilities
 * @description Memoization and virtualization utilities for optimizing large graph rendering.
 * Provides path calculation memoization, component memoization wrappers, and viewport-based
 * node virtualization for smooth interactions with 500-1000+ nodes.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 5.4
 */

import { useMemo, useCallback, useRef, type ComponentType } from "react";
import type { Position, PathType, PathConfig, IFlowNodeEntityData, Size } from "./types";
import { calculatePath } from "./edge/EdgePath";

// =============================================================================
// Types
// =============================================================================

/**
 * Cache key for path calculation memoization
 */
export interface PathCacheKey {
  /** Source position x coordinate */
  sourceX: number;
  /** Source position y coordinate */
  sourceY: number;
  /** Target position x coordinate */
  targetX: number;
  /** Target position y coordinate */
  targetY: number;
  /** Path calculation type */
  pathType: PathType;
  /** Path curvature (for bezier) */
  curvature?: number;
  /** Border radius (for smoothstep) */
  borderRadius?: number;
}

/**
 * Viewport bounds for virtualization
 */
export interface Viewport {
  /** Viewport x offset (scroll position) */
  x: number;
  /** Viewport y offset (scroll position) */
  y: number;
  /** Viewport width in pixels */
  width: number;
  /** Viewport height in pixels */
  height: number;
  /** Current zoom/scale factor */
  scale: number;
}

/**
 * Options for useVirtualizedNodes hook
 */
export interface UseVirtualizedNodesOptions {
  /**
   * Overscan distance in pixels beyond the viewport
   * Nodes within this buffer zone are also rendered to prevent pop-in
   * @default 100
   */
  overscan?: number;
  /**
   * Whether virtualization is enabled
   * @default true
   */
  enabled?: boolean;
  /**
   * Minimum number of nodes to trigger virtualization
   * Below this threshold, all nodes are rendered
   * @default 50
   */
  threshold?: number;
}

/**
 * Result of useVirtualizedNodes hook
 */
export interface UseVirtualizedNodesResult<T extends IFlowNodeEntityData> {
  /** Nodes that should be rendered (visible + overscan) */
  visibleNodes: T[];
  /** Total number of nodes */
  totalCount: number;
  /** Number of visible nodes (currently rendered) */
  visibleCount: number;
  /** Whether virtualization is active */
  isVirtualized: boolean;
  /** Bounding box of all nodes for minimap/overview */
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
}

/**
 * Cache statistics for debugging and performance monitoring
 */
export interface CacheStats {
  /** Number of cache hits */
  hits: number;
  /** Number of cache misses */
  misses: number;
  /** Current cache size */
  size: number;
  /** Hit rate percentage */
  hitRate: number;
}

// =============================================================================
// Path Memoization
// =============================================================================

/**
 * Default maximum cache size for path calculations
 */
const DEFAULT_MAX_CACHE_SIZE = 1000;

/**
 * Generates a cache key string from path parameters
 * @param source - Source position
 * @param target - Target position
 * @param pathType - Path calculation type
 * @param pathConfig - Optional path configuration
 * @returns Unique cache key string
 */
export function generatePathCacheKey(
  source: Position,
  target: Position,
  pathType: PathType,
  pathConfig?: PathConfig
): string {
  // Round coordinates to 2 decimal places to handle floating point imprecision
  const sx = Math.round(source.x * 100) / 100;
  const sy = Math.round(source.y * 100) / 100;
  const tx = Math.round(target.x * 100) / 100;
  const ty = Math.round(target.y * 100) / 100;

  const curvature = pathConfig?.curvature ?? 0.5;
  const borderRadius = pathConfig?.borderRadius ?? 8;

  return `${sx},${sy}:${tx},${ty}:${pathType}:${curvature}:${borderRadius}`;
}

/**
 * Creates a memoized path calculator with LRU cache.
 * Caches calculated SVG path strings based on source/target positions and path type.
 *
 * @param maxSize - Maximum number of entries in the cache (default: 1000)
 * @returns Memoized path calculator function and cache management methods
 *
 * @example
 * ```ts
 * const pathCalculator = createMemoizedPathCalculator(500);
 *
 * // Calculate path (will be cached)
 * const path1 = pathCalculator.calculate(
 *   { x: 0, y: 0 },
 *   { x: 100, y: 100 },
 *   'bezier'
 * );
 *
 * // Same calculation returns cached result
 * const path2 = pathCalculator.calculate(
 *   { x: 0, y: 0 },
 *   { x: 100, y: 100 },
 *   'bezier'
 * );
 *
 * // Get cache statistics
 * console.log(pathCalculator.getStats()); // { hits: 1, misses: 1, size: 1, hitRate: 50 }
 * ```
 */
export function createMemoizedPathCalculator(maxSize: number = DEFAULT_MAX_CACHE_SIZE): {
  /**
   * Calculate path with memoization
   * @param source - Source position
   * @param target - Target position
   * @param pathType - Path calculation type
   * @param pathConfig - Optional path configuration
   * @returns Calculated SVG path string
   */
  calculate: (
    source: Position,
    target: Position,
    pathType?: PathType,
    pathConfig?: PathConfig
  ) => string;
  /** Clear the entire cache */
  clear: () => void;
  /** Get current cache statistics */
  getStats: () => CacheStats;
  /** Get current cache size */
  size: () => number;
} {
  // Use Map for LRU-like behavior (maintains insertion order)
  const cache = new Map<string, string>();
  let hits = 0;
  let misses = 0;

  /**
   * Calculate path with memoization
   * @param source - Source position
   * @param target - Target position
   * @param pathType - Path calculation type
   * @param pathConfig - Optional path configuration
   * @returns Calculated SVG path string
   */
  const calculate = (
    source: Position,
    target: Position,
    pathType: PathType = "bezier",
    pathConfig?: PathConfig
  ): string => {
    const key = generatePathCacheKey(source, target, pathType, pathConfig);

    // Check cache
    const cached = cache.get(key);
    if (cached !== undefined) {
      hits++;
      // Move to end for LRU (delete and re-add)
      cache.delete(key);
      cache.set(key, cached);
      return cached;
    }

    // Calculate and cache
    misses++;
    const path = calculatePath(source, target, pathType, pathConfig);

    // Enforce max size (LRU eviction)
    if (cache.size >= maxSize) {
      // Delete oldest entry (first in Map)
      const firstKey = cache.keys().next().value;
      if (firstKey !== undefined) {
        cache.delete(firstKey);
      }
    }

    cache.set(key, path);
    return path;
  };

  /**
   * Clear the cache
   */
  const clear = (): void => {
    cache.clear();
    hits = 0;
    misses = 0;
  };

  /**
   * Get cache statistics
   * @returns Cache statistics object
   */
  const getStats = (): CacheStats => {
    const total = hits + misses;
    return {
      hits,
      misses,
      size: cache.size,
      hitRate: total > 0 ? (hits / total) * 100 : 0,
    };
  };

  /**
   * Get current cache size
   * @returns Current cache size
   */
  const size = (): number => cache.size;

  return { calculate, clear, getStats, size };
}

/**
 * Global shared path calculator instance.
 * Use this for most cases to share cache across components.
 */
export const memoizedPathCalculator = createMemoizedPathCalculator();

// =============================================================================
// Component Memoization Utilities
// =============================================================================

/**
 * Deep equality check for Position objects
 * @param a - First position
 * @param b - Second position
 * @returns True if positions are equal
 */
export function arePositionsEqual(a: Position | undefined, b: Position | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.x === b.x && a.y === b.y;
}

/**
 * Deep equality check for Size objects
 * @param a - First size
 * @param b - Second size
 * @returns True if sizes are equal
 */
export function areSizesEqual(a: Size | undefined, b: Size | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.width === b.width && a.height === b.height;
}

/**
 * Shallow comparison of arrays by reference or primitive values
 * @param a - First array
 * @param b - Second array
 * @returns True if arrays are shallowly equal
 */
export function areArraysShallowEqual<T>(a: T[] | undefined, b: T[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Shallow comparison of style objects
 * @param prevStyle - Previous style
 * @param nextStyle - Next style
 * @returns True if styles are equal
 */
function areStylesEqual(
  prevStyle: React.CSSProperties | undefined,
  nextStyle: React.CSSProperties | undefined
): boolean {
  if (prevStyle === nextStyle) return true;
  if (!prevStyle || !nextStyle) return false;

  const prevKeys = Object.keys(prevStyle);
  const nextKeys = Object.keys(nextStyle);
  if (prevKeys.length !== nextKeys.length) return false;

  for (const key of prevKeys) {
    if (
      prevStyle[key as keyof React.CSSProperties] !== nextStyle[key as keyof React.CSSProperties]
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Props comparison function for BaseFlowNode memoization.
 * Compares only essential props that affect rendering, ignoring
 * callback functions and other non-visual props.
 * @param prevProps - Previous props
 * @param nextProps - Next props
 * @returns True if props are equal (should skip re-render)
 */
export function areNodePropsEqual<
  P extends {
    entity?: { id: string; data?: unknown };
    selected?: boolean;
    className?: string;
    style?: React.CSSProperties;
  },
>(prevProps: P, nextProps: P): boolean {
  // Quick reference equality check
  if (prevProps === nextProps) return true;

  // Check entity identity and data
  const entityChanged =
    prevProps.entity !== nextProps.entity &&
    (prevProps.entity?.id !== nextProps.entity?.id ||
      prevProps.entity?.data !== nextProps.entity?.data);
  if (entityChanged) return false;

  // Check other visual props
  if (prevProps.selected !== nextProps.selected) return false;
  if (prevProps.className !== nextProps.className) return false;
  if (!areStylesEqual(prevProps.style, nextProps.style)) return false;

  return true;
}

/**
 * Props comparison function for BaseFlowEdge memoization.
 * Compares only essential props that affect rendering.
 * @param prevProps - Previous props
 * @param nextProps - Next props
 * @returns True if props are equal (should skip re-render)
 */
export function areEdgePropsEqual<
  P extends {
    entity?: { id: string; data?: unknown };
    sourcePosition?: Position;
    targetPosition?: Position;
    selected?: boolean;
    className?: string;
    style?: React.CSSProperties;
  },
>(prevProps: P, nextProps: P): boolean {
  // Quick reference equality check
  if (prevProps === nextProps) return true;

  // Check entity identity and data
  const entityChanged =
    prevProps.entity !== nextProps.entity &&
    (prevProps.entity?.id !== nextProps.entity?.id ||
      prevProps.entity?.data !== nextProps.entity?.data);
  if (entityChanged) return false;

  // Check positions (critical for edge path calculation)
  if (!arePositionsEqual(prevProps.sourcePosition, nextProps.sourcePosition)) return false;
  if (!arePositionsEqual(prevProps.targetPosition, nextProps.targetPosition)) return false;

  // Check other visual props
  if (prevProps.selected !== nextProps.selected) return false;
  if (prevProps.className !== nextProps.className) return false;
  if (!areStylesEqual(prevProps.style, nextProps.style)) return false;

  return true;
}

/**
 * Creates a memoized version of a component with custom props comparison.
 * This is a utility wrapper around React.memo for consistent memoization patterns.
 *
 * @param Component - Component to memoize
 * @param propsAreEqual - Custom props comparison function
 * @param displayName - Optional display name for the memoized component
 * @returns Memoized component
 *
 * @example
 * ```tsx
 * const MemoizedNode = createMemoizedComponent(
 *   BaseFlowNode,
 *   areNodePropsEqual,
 *   'MemoizedBaseFlowNode'
 * );
 * ```
 */
export function createMemoizedComponent<P extends object>(
  Component: ComponentType<P>,
  propsAreEqual: (prevProps: P, nextProps: P) => boolean,
  displayName?: string
): React.MemoExoticComponent<ComponentType<P>> {
  // We need to import React.memo dynamically to avoid circular dependencies
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { memo } = require("react");

  const MemoizedComponent = memo(Component, propsAreEqual);

  if (displayName) {
    MemoizedComponent.displayName = displayName;
  }

  return MemoizedComponent;
}

// =============================================================================
// Virtualization Hook
// =============================================================================

/**
 * Default node size for bounds calculation when size is not specified
 */
const DEFAULT_NODE_SIZE: Size = { width: 200, height: 100 };

/**
 * Checks if a node is within the visible viewport (including overscan)
 * @param node - Node to check
 * @param viewport - Current viewport bounds
 * @param overscan - Overscan distance in pixels
 * @returns True if node is visible or within overscan area
 */
export function isNodeInViewport(
  node: IFlowNodeEntityData,
  viewport: Viewport,
  overscan: number = 100
): boolean {
  const nodeX = node.position?.x ?? 0;
  const nodeY = node.position?.y ?? 0;
  const nodeWidth = node.size?.width ?? DEFAULT_NODE_SIZE.width;
  const nodeHeight = node.size?.height ?? DEFAULT_NODE_SIZE.height;

  // Calculate viewport bounds in canvas coordinates (accounting for scale)
  const viewLeft = viewport.x / viewport.scale - overscan;
  const viewTop = viewport.y / viewport.scale - overscan;
  const viewRight = (viewport.x + viewport.width) / viewport.scale + overscan;
  const viewBottom = (viewport.y + viewport.height) / viewport.scale + overscan;

  // Check if node bounds intersect with viewport bounds
  const nodeRight = nodeX + nodeWidth;
  const nodeBottom = nodeY + nodeHeight;

  // Node is visible if there's any overlap
  return !(nodeRight < viewLeft || nodeX > viewRight || nodeBottom < viewTop || nodeY > viewBottom);
}

/**
 * Calculate bounds of all nodes
 * @param nodes - Array of nodes
 * @returns Bounding box containing all nodes
 */
export function calculateNodeBounds(nodes: IFlowNodeEntityData[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    const x = node.position?.x ?? 0;
    const y = node.position?.y ?? 0;
    const width = node.size?.width ?? DEFAULT_NODE_SIZE.width;
    const height = node.size?.height ?? DEFAULT_NODE_SIZE.height;

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Hook for virtualizing nodes based on viewport visibility.
 * Only renders nodes that are within the viewport (plus overscan buffer),
 * significantly improving performance for large graphs.
 *
 * @param nodes - Array of all nodes
 * @param viewport - Current viewport state
 * @param options - Virtualization options
 * @returns Object containing visible nodes and metadata
 *
 * @example
 * ```tsx
 * function FlowCanvas({ nodes, viewport }) {
 *   const { visibleNodes, isVirtualized, bounds } = useVirtualizedNodes(
 *     nodes,
 *     viewport,
 *     { overscan: 150, threshold: 100 }
 *   );
 *
 *   return (
 *     <div>
 *       {visibleNodes.map(node => (
 *         <FlowNode key={node.id} node={node} />
 *       ))}
 *       {isVirtualized && (
 *         <div>Showing {visibleNodes.length} of {nodes.length} nodes</div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useVirtualizedNodes<T extends IFlowNodeEntityData>(
  nodes: T[],
  viewport: Viewport | null | undefined,
  options: UseVirtualizedNodesOptions = {}
): UseVirtualizedNodesResult<T> {
  const { overscan = 100, enabled = true, threshold = 50 } = options;

  // Calculate bounds of all nodes (memoized)
  const bounds = useMemo(() => calculateNodeBounds(nodes), [nodes]);

  // Filter visible nodes based on viewport
  const { visibleNodes, isVirtualized } = useMemo(() => {
    // If virtualization is disabled or we don't have viewport, return all nodes
    if (!enabled || !viewport) {
      return { visibleNodes: nodes, isVirtualized: false };
    }

    // Below threshold, don't virtualize
    if (nodes.length < threshold) {
      return { visibleNodes: nodes, isVirtualized: false };
    }

    // Filter nodes that are in viewport
    const visible = nodes.filter((node) => isNodeInViewport(node, viewport, overscan));

    return { visibleNodes: visible, isVirtualized: true };
  }, [nodes, viewport, overscan, enabled, threshold]);

  return {
    visibleNodes,
    totalCount: nodes.length,
    visibleCount: visibleNodes.length,
    isVirtualized,
    bounds,
  };
}

/**
 * Hook for creating a stable callback that doesn't cause re-renders.
 * Useful for event handlers passed to memoized components.
 *
 * @param callback - The callback function
 * @returns Stable callback reference
 *
 * @example
 * ```tsx
 * const handleNodeClick = useStableCallback((nodeId: string) => {
 *   console.log('Clicked:', nodeId);
 * });
 *
 * // handleNodeClick reference never changes, safe to pass to memoized children
 * <MemoizedNode onClick={handleNodeClick} />
 * ```
 */
export function useStableCallback<T extends (...args: unknown[]) => unknown>(callback: T): T {
  const callbackRef = useRef<T>(callback);

  // Update the ref on each render
  callbackRef.current = callback;

  // Return a stable callback that delegates to the ref
  const stableCallback = useCallback((...args: Parameters<T>): ReturnType<T> => {
    return callbackRef.current(...args) as ReturnType<T>;
  }, []) as T;

  return stableCallback;
}

// =============================================================================
// Performance Measurement Utilities
// =============================================================================

/**
 * Measures the execution time of a function
 * @param fn - Function to measure
 * @param label - Optional label for logging
 * @returns Result of the function
 */
export function measurePerformance<T>(fn: () => T, label?: string): T {
  const start = performance.now();
  const result = fn();
  const end = performance.now();

  if (label && typeof console !== "undefined" && console.debug) {
    console.debug(`[Performance] ${label}: ${(end - start).toFixed(2)}ms`);
  }

  return result;
}

/**
 * Creates a throttled version of a function that limits invocations.
 * Useful for expensive operations like layout recalculation.
 *
 * @param fn - Function to throttle
 * @param limit - Minimum time between invocations in ms
 * @returns Throttled function
 *
 * @example
 * ```ts
 * const throttledLayout = throttle(() => {
 *   recalculateLayout(nodes);
 * }, 16); // ~60fps
 *
 * window.addEventListener('resize', throttledLayout);
 * ```
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>): void => {
    const now = Date.now();
    const remaining = limit - (now - lastCall);

    if (remaining <= 0) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      lastCall = now;
      fn(...args);
    } else {
      timeoutId ??= setTimeout(() => {
        lastCall = Date.now();
        timeoutId = null;
        fn(...args);
      }, remaining);
    }
  };
}

/**
 * Creates a debounced version of a function that delays invocation.
 * Useful for search/filter operations that should wait for user to stop typing.
 *
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function with cancel method
 *
 * @example
 * ```ts
 * const debouncedSearch = debounce((query: string) => {
 *   searchNodes(query);
 * }, 300);
 *
 * input.addEventListener('input', (e) => debouncedSearch(e.target.value));
 * ```
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debouncedFn = (...args: Parameters<T>): void => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };

  debouncedFn.cancel = (): void => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debouncedFn;
}

// =============================================================================
// Exports
// =============================================================================

export default {
  // Path memoization
  createMemoizedPathCalculator,
  memoizedPathCalculator,
  generatePathCacheKey,

  // Component memoization
  arePositionsEqual,
  areSizesEqual,
  areArraysShallowEqual,
  areNodePropsEqual,
  areEdgePropsEqual,
  createMemoizedComponent,

  // Virtualization
  useVirtualizedNodes,
  isNodeInViewport,
  calculateNodeBounds,

  // Utilities
  useStableCallback,
  measurePerformance,
  throttle,
  debounce,
};
