/**
 * @module src/components/virtual-list-math
 *
 * Virtual list rendering mathematics module for calculating visible ranges,
 * heights, and offsets for virtualized list components. Handles variable item
 * heights and efficient range computation using binary search algorithms.
 */

/**
 * Metrics for a virtual list including item heights and cumulative heights.
 */
export interface VirtualListMetrics {
  /** Array of individual item heights in pixels. */
  readonly heights: number[];

  /**
   * Cumulative height values for binary search.
   * `cumulativeHeights[i]` equals the sum of all heights from index 0 to i (inclusive).
   */
  readonly cumulativeHeights: number[];

  /** Total height of all items combined in pixels. */
  readonly totalHeight: number;
}

/**
 * Visible range for a virtualized list with offset information.
 */
export interface VirtualRange {
  /** Index of the first visible item (inclusive). */
  readonly startIndex: number;

  /** Index of the last visible item (inclusive), or -1 if empty. */
  readonly endIndex: number;

  /**
   * Y-axis offset in pixels from the start of the visible range.
   * Accounts for items that are partially scrolled out of view.
   */
  readonly offsetY: number;
}

/**
 * Clamp scroll position to a valid range.
 *
 * Ensures the scroll value stays between 0 and `totalHeight - containerHeight`.
 *
 * @param value - The raw scroll position.
 * @param totalHeight - Total height of all items.
 * @param containerHeight - Height of the visible viewport.
 * @returns The clamped scroll position.
 */
function clampScrollTop(value: number, totalHeight: number, containerHeight: number): number {
  if (totalHeight <= containerHeight || containerHeight <= 0) {
    return 0;
  }
  const maxScrollTop = Math.max(0, totalHeight - containerHeight);
  return Math.max(0, Math.min(value, maxScrollTop));
}

/**
 * Binary search to find the first element greater than target.
 *
 * Used to locate virtual list items based on cumulative heights.
 * Time complexity: O(log n).
 *
 * @param values - Sorted array of cumulative heights.
 * @param target - The scroll position to compare against.
 * @returns Index of the first element where `values[i] > target`.
 */
function findFirstGreaterThan(values: readonly number[], target: number): number {
  if (values.length === 0) {
    return 0;
  }

  let low = 0;
  let high = values.length - 1;
  let result = values.length - 1;

  while (low <= high) {
    const mid = (low + high) >>> 1;

    if (values[mid] > target) {
      result = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return result;
}

/**
 * Binary search to find the first element greater than or equal to target.
 *
 * Used to locate virtual list items based on cumulative heights.
 * Time complexity: O(log n).
 *
 * @param values - Sorted array of cumulative heights.
 * @param target - The scroll position to compare against.
 * @returns Index of the first element where `values[i] >= target`.
 */
function findFirstGreaterOrEqual(values: readonly number[], target: number): number {
  if (values.length === 0) {
    return 0;
  }

  let low = 0;
  let high = values.length - 1;
  let result = values.length - 1;

  while (low <= high) {
    const mid = (low + high) >>> 1;

    if (values[mid] >= target) {
      result = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return result;
}

/**
 * Build virtual list metrics from items and their heights.
 *
 * Constructs a cumulative height array for O(log n) binary search lookups.
 * For example, `heights = [50, 50, 60]` produces `cumulativeHeights = [50, 100, 160]`.
 *
 * @template T - The item type.
 * @param items - Array of items to measure.
 * @param itemHeight - Either a fixed height in pixels, or a function that
 * returns the height for each item: `(item: T, index: number) => number`.
 * @returns Computed metrics containing heights and cumulative heights arrays.
 *
 * @example
 * // Fixed height
 * const metrics = buildVirtualListMetrics(items, 50);
 *
 * @example
 * // Variable height
 * const metrics = buildVirtualListMetrics(items, (item, index) => {
 *   return item.type === 'header' ? 40 : 50;
 * });
 */
export function buildVirtualListMetrics<T>(
  items: readonly T[],
  itemHeight: number | ((item: T, index: number) => number)
): VirtualListMetrics {
  const heights: number[] = new Array(items.length);
  const cumulativeHeights: number[] = new Array(items.length);
  let total = 0;

  for (let i = 0; i < items.length; i += 1) {
    const h = typeof itemHeight === "function" ? itemHeight(items[i], i) : itemHeight;
    heights[i] = h;
    total += h;
    cumulativeHeights[i] = total;
  }

  return {
    heights,
    cumulativeHeights,
    totalHeight: total,
  } satisfies VirtualListMetrics;
}

/**
 * Calculate the visible range for a virtual list based on scroll position.
 *
 * Uses binary search on cumulative heights for efficient O(log n) lookups.
 * The `bufferSize` parameter renders extra items beyond the visible area to
 * prevent flickering during rapid scrolling.
 *
 * @param metrics - Pre-computed metrics from `buildVirtualListMetrics`.
 * @param params - Configuration parameters.
 * @param params.scrollTop - Current scroll position from top in pixels.
 * @param params.containerHeight - Height of the visible viewport in pixels.
 * @param params.bufferSize - Number of items to render beyond visible range
 * for buffering. Prevents flashing when scrolling rapidly.
 * @param params.itemCount - Total number of items in the list.
 * @returns The calculated visible range with start/end indices and offset.
 *
 * @example
 * const metrics = buildVirtualListMetrics(items, 50);
 * const range = calculateVirtualRange(metrics, {
 *   scrollTop: 500,
 *   containerHeight: 1000,
 *   bufferSize: 5,
 *   itemCount: 1000
 * });
 * // range = { startIndex: 8, endIndex: 27, offsetY: 400 }
 */
export function calculateVirtualRange(
  metrics: VirtualListMetrics,
  params: {
    scrollTop: number;
    containerHeight: number;
    bufferSize: number;
    itemCount: number;
  }
): VirtualRange {
  const { scrollTop, containerHeight, bufferSize, itemCount } = params;

  if (containerHeight === 0 || metrics.totalHeight === 0 || itemCount === 0) {
    return { startIndex: 0, endIndex: -1, offsetY: 0 } satisfies VirtualRange;
  }

  const effectiveScrollTop = clampScrollTop(scrollTop, metrics.totalHeight, containerHeight);
  const lastIndex = Math.max(0, itemCount - 1);

  const visibleStartIndex = findFirstGreaterThan(metrics.cumulativeHeights, effectiveScrollTop);
  const start = Math.max(0, visibleStartIndex - bufferSize);

  const visibleBottom = effectiveScrollTop + containerHeight;
  const visibleEndIndex = findFirstGreaterOrEqual(metrics.cumulativeHeights, visibleBottom);
  const end = Math.min(lastIndex, Math.max(start, visibleEndIndex + bufferSize));

  const offset = start > 0 ? metrics.cumulativeHeights[start - 1] : 0;

  return {
    startIndex: start,
    endIndex: end,
    offsetY: offset,
  } satisfies VirtualRange;
}
