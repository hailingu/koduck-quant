import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { VirtualList } from "../../src/components/virtualized/VirtualList";

describe("VirtualList", () => {
  const mockItems = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `Item ${i}` }));
  const itemHeight = 50;
  const containerHeight = 200;

  const renderItem = (item: { id: number; name: string }) => (
    <div data-testid={`item-${item.id}`}>{item.name}</div>
  );

  it("should render visible items correctly", () => {
    render(
      <VirtualList
        items={mockItems}
        itemHeight={itemHeight}
        containerHeight={containerHeight}
        renderItem={renderItem}
      />
    );

    // Should render items 0-5 (containerHeight / itemHeight = 4, plus bufferSize = 5*2 = 10, but limited by total)
    expect(screen.getByTestId("item-0")).toBeInTheDocument();
    expect(screen.getByTestId("item-1")).toBeInTheDocument();
    expect(screen.getByTestId("item-2")).toBeInTheDocument();
    expect(screen.getByTestId("item-3")).toBeInTheDocument();
    expect(screen.getByTestId("item-4")).toBeInTheDocument();
    expect(screen.getByTestId("item-5")).toBeInTheDocument();
  });

  it("should handle scrolling and update visible range", () => {
    const onScroll = vi.fn();
    const { container } = render(
      <VirtualList
        items={mockItems}
        itemHeight={itemHeight}
        containerHeight={containerHeight}
        renderItem={renderItem}
        onScroll={onScroll}
      />
    );

    const scrollContainer = container.firstChild as HTMLElement;
    fireEvent.scroll(scrollContainer, { target: { scrollTop: 100 } });

    // After scrolling 100px, startIndex should be around 2 (100 / 50 = 2)
    expect(onScroll).toHaveBeenCalledWith({ start: expect.any(Number), end: expect.any(Number) });
  });

  it("should handle empty items array", () => {
    render(
      <VirtualList
        items={[]}
        itemHeight={itemHeight}
        containerHeight={containerHeight}
        renderItem={renderItem}
      />
    );

    // Should not crash and render nothing
    expect(screen.queryByTestId("item-0")).not.toBeInTheDocument();
  });

  it("should handle small items array", () => {
    const smallItems = [{ id: 0, name: "Item 0" }];
    render(
      <VirtualList
        items={smallItems}
        itemHeight={itemHeight}
        containerHeight={containerHeight}
        renderItem={renderItem}
      />
    );

    expect(screen.getByTestId("item-0")).toBeInTheDocument();
  });

  it("should apply custom bufferSize", () => {
    render(
      <VirtualList
        items={mockItems}
        itemHeight={itemHeight}
        containerHeight={containerHeight}
        renderItem={renderItem}
        bufferSize={10}
      />
    );

    // With bufferSize 10, should render more items
    expect(screen.getByTestId("item-0")).toBeInTheDocument();
    expect(screen.getByTestId("item-10")).toBeInTheDocument();
  });

  it("should handle very large datasets", () => {
    const largeItems = Array.from({ length: 100000 }, (_, i) => ({ id: i, name: `Item ${i}` }));
    render(
      <VirtualList
        items={largeItems}
        itemHeight={itemHeight}
        containerHeight={containerHeight}
        renderItem={renderItem}
      />
    );

    // Should handle large arrays without performance issues
    expect(screen.getByTestId("item-0")).toBeInTheDocument();
  });

  it("should call onScroll with correct range on mount", () => {
    const onScroll = vi.fn();
    render(
      <VirtualList
        items={mockItems}
        itemHeight={itemHeight}
        containerHeight={containerHeight}
        renderItem={renderItem}
        onScroll={onScroll}
      />
    );

    expect(onScroll).toHaveBeenCalledWith({ start: 0, end: expect.any(Number) });
  });

  it("should handle zero container height", () => {
    render(
      <VirtualList
        items={mockItems}
        itemHeight={itemHeight}
        containerHeight={0}
        renderItem={renderItem}
      />
    );

    // Should not crash
    expect(screen.queryByTestId("item-0")).not.toBeInTheDocument();
  });

  it("should handle zero item height", () => {
    render(
      <VirtualList
        items={mockItems}
        itemHeight={0}
        containerHeight={containerHeight}
        renderItem={renderItem}
      />
    );

    // Should not crash, but may not render items
    expect(screen.queryByTestId("item-0")).not.toBeInTheDocument();
  });

  it("should support adaptive item heights with function", () => {
    const adaptiveItems = Array.from({ length: 10 }, (_, i) => ({ id: i, name: `Item ${i}` }));
    const adaptiveItemHeight = (item: { id: number; name: string }, index: number) =>
      30 + index * 10; // 30, 40, 50, ...

    render(
      <VirtualList
        items={adaptiveItems}
        itemHeight={adaptiveItemHeight}
        containerHeight={100}
        renderItem={renderItem}
      />
    );

    // Should render items with varying heights
    expect(screen.getByTestId("item-0")).toBeInTheDocument();
    expect(screen.getByTestId("item-1")).toBeInTheDocument();
  });

  it("should handle scrolling with adaptive heights", () => {
    const adaptiveItems = Array.from({ length: 20 }, (_, i) => ({ id: i, name: `Item ${i}` }));
    const adaptiveItemHeight = (item: { id: number; name: string }, index: number) =>
      50 + index * 5;
    const onScroll = vi.fn();

    const { container } = render(
      <VirtualList
        items={adaptiveItems}
        itemHeight={adaptiveItemHeight}
        containerHeight={100}
        renderItem={renderItem}
        onScroll={onScroll}
      />
    );

    const scrollContainer = container.firstChild as HTMLElement;
    fireEvent.scroll(scrollContainer, { target: { scrollTop: 100 } });

    expect(onScroll).toHaveBeenCalledWith({ start: expect.any(Number), end: expect.any(Number) });
  });
});
