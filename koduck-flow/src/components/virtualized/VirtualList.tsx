import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  buildVirtualListMetrics,
  calculateVirtualRange,
  type VirtualListMetrics,
} from "./virtual-list-math";

export type { VirtualListMetrics, VirtualRange } from "./virtual-list-math";

/**
 * Configuration options for the virtual list component.
 */
export interface VirtualListProps<T> {
  readonly items: T[];
  readonly itemHeight: number | ((item: T, index: number) => number);
  readonly containerHeight: number;
  readonly renderItem: (item: T, index: number) => React.ReactNode;
  readonly onScroll?: (range: { start: number; end: number }) => void;
  readonly bufferSize?: number;
  readonly getItemKey?: (item: T, index: number) => React.Key;
  readonly containerProps?: React.HTMLAttributes<HTMLDivElement>;
  readonly containerRef?: React.Ref<HTMLDivElement>;
}

/**
 * Lightweight virtualized list that renders only the items within the viewport.
 *
 * @template T
 * @param props - Virtual list configuration.
 * @returns Scrollable element containing virtualized rows.
 */
export function VirtualList<T>(props: VirtualListProps<T>) {
  const {
    items,
    itemHeight,
    containerHeight,
    renderItem,
    onScroll,
    bufferSize = 5,
    getItemKey,
    containerProps,
    containerRef,
  } = props;
  const [scrollTop, setScrollTop] = useState(0);

  const metrics: VirtualListMetrics = useMemo(
    () => buildVirtualListMetrics(items, itemHeight),
    [items, itemHeight]
  );

  const { startIndex, endIndex, offsetY } = useMemo(() => {
    return calculateVirtualRange(metrics, {
      scrollTop,
      containerHeight,
      bufferSize,
      itemCount: items.length,
    });
  }, [containerHeight, items.length, metrics, bufferSize, scrollTop]);

  const visibleItems =
    containerHeight === 0 || metrics.totalHeight === 0 ? [] : items.slice(startIndex, endIndex + 1);

  const externalOnScroll = containerProps?.onScroll;
  const lastNotifiedRangeRef = useRef<{ start: number; end: number } | null>(null);

  const notifyVisibleRange = useCallback(
    (range: { start: number; end: number }) => {
      if (!onScroll) {
        return;
      }

      const previous = lastNotifiedRangeRef.current;
      if (previous?.start === range.start && previous.end === range.end) {
        return;
      }

      lastNotifiedRangeRef.current = range;
      onScroll(range);
    },
    [onScroll]
  );

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const newScrollTop = e.currentTarget.scrollTop;
      setScrollTop(newScrollTop);

      const nextRange = calculateVirtualRange(metrics, {
        scrollTop: newScrollTop,
        containerHeight,
        bufferSize,
        itemCount: items.length,
      });
      notifyVisibleRange({
        start: nextRange.startIndex,
        end: nextRange.endIndex,
      });

      if (externalOnScroll) {
        externalOnScroll(e);
      }
    },
    [bufferSize, containerHeight, externalOnScroll, items.length, metrics, notifyVisibleRange]
  );

  useEffect(() => {
    notifyVisibleRange({
      start: startIndex,
      end: endIndex,
    });
  }, [startIndex, endIndex, notifyVisibleRange]);

  const baseStyle = {
    height: containerHeight,
    overflow: "auto",
    position: "relative" as const,
  };

  const mergedStyle = containerProps?.style
    ? {
        ...baseStyle,
        ...containerProps.style,
      }
    : baseStyle;

  return (
    <div ref={containerRef} {...containerProps} style={mergedStyle} onScroll={handleScroll}>
      <div style={{ height: metrics.totalHeight, position: "relative" }}>
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          {visibleItems.map((item, index) => {
            const actualIndex = startIndex + index;
            const height = metrics.heights[actualIndex];
            return (
              <div
                key={getItemKey ? getItemKey(item, actualIndex) : actualIndex}
                style={{
                  height: height,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {renderItem(item, actualIndex)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
