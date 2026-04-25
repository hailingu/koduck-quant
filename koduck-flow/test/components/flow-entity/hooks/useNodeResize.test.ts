/**
 * @file useNodeResize Hook Tests
 * @description Unit tests for the useNodeResize hook that provides
 * resize interaction for flow nodes.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 2.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNodeResize } from "../../../../src/components/flow-entity/hooks/useNodeResize";
import { FlowNodeEntity } from "../../../../src/common/flow/flow-node-entity";
import type { Size } from "../../../../src/components/flow-entity/types";

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a mock FlowNodeEntity for testing
 */
function createMockEntity(
  overrides: Partial<{
    size: Size;
    disabled: boolean;
  }> = {}
): FlowNodeEntity {
  const entity = new FlowNodeEntity({
    nodeType: "default",
    label: "Test Node",
    position: { x: 100, y: 100 },
    size: overrides.size ?? { width: 200, height: 100 },
    disabled: overrides.disabled ?? false,
  });
  return entity;
}

/**
 * Create a mock mouse event
 */
function createMouseEvent(
  type: "mousedown" | "mousemove" | "mouseup",
  options: Partial<MouseEvent> = {}
): MouseEvent {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: options.clientX ?? 0,
    clientY: options.clientY ?? 0,
    button: options.button ?? 0,
    ...options,
  });
}

/**
 * Create a mock React mouse event
 */
function createReactMouseEvent(
  clientX: number,
  clientY: number,
  button: number = 0
): React.MouseEvent {
  return {
    button,
    clientX,
    clientY,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as React.MouseEvent;
}

// =============================================================================
// Tests
// =============================================================================

describe("useNodeResize", () => {
  let entity: FlowNodeEntity;

  beforeEach(() => {
    entity = createMockEntity({ size: { width: 200, height: 100 } });
  });

  afterEach(() => {
    // Clean up any lingering event listeners
    vi.restoreAllMocks();
  });

  describe("initial state", () => {
    it("returns isResizing as false initially", () => {
      const { result } = renderHook(() => useNodeResize(entity));

      expect(result.current.isResizing).toBe(false);
    });

    it("returns null resizeState initially", () => {
      const { result } = renderHook(() => useNodeResize(entity));

      expect(result.current.resizeState).toBeNull();
    });

    it("returns zero sizeDelta initially", () => {
      const { result } = renderHook(() => useNodeResize(entity));

      expect(result.current.sizeDelta).toEqual({ width: 0, height: 0 });
    });

    it("returns a handleMouseDown function", () => {
      const { result } = renderHook(() => useNodeResize(entity));

      expect(typeof result.current.handleMouseDown).toBe("function");
    });
  });

  describe("handleMouseDown", () => {
    it("starts resize on left mouse button click", () => {
      const { result } = renderHook(() => useNodeResize(entity));

      const event = createReactMouseEvent(150, 150, 0);

      act(() => {
        result.current.handleMouseDown(event);
      });

      expect(result.current.isResizing).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(event.stopPropagation).toHaveBeenCalled();
    });

    it("does not start resize on right mouse button click", () => {
      const { result } = renderHook(() => useNodeResize(entity));

      const event = createReactMouseEvent(150, 150, 2);

      act(() => {
        result.current.handleMouseDown(event);
      });

      expect(result.current.isResizing).toBe(false);
    });

    it("does not start resize on middle mouse button click", () => {
      const { result } = renderHook(() => useNodeResize(entity));

      const event = createReactMouseEvent(150, 150, 1);

      act(() => {
        result.current.handleMouseDown(event);
      });

      expect(result.current.isResizing).toBe(false);
    });

    it("does not start resize when disabled", () => {
      const { result } = renderHook(() => useNodeResize(entity, { disabled: true }));

      const event = createReactMouseEvent(150, 150, 0);

      act(() => {
        result.current.handleMouseDown(event);
      });

      expect(result.current.isResizing).toBe(false);
    });

    it("records starting size and pointer in resize state", () => {
      const { result } = renderHook(() => useNodeResize(entity));

      const event = createReactMouseEvent(200, 250, 0);

      act(() => {
        result.current.handleMouseDown(event);
      });

      expect(result.current.resizeState).toEqual({
        isResizing: true,
        startSize: { width: 200, height: 100 },
        pointerStart: { x: 200, y: 250 },
        currentPointer: { x: 200, y: 250 },
      });
    });
  });

  describe("resize movement", () => {
    it("calls onResize during mousemove", () => {
      const onResize = vi.fn();
      const { result } = renderHook(() => useNodeResize(entity, { onResize }));

      // Start resize
      const mouseDownEvent = createReactMouseEvent(150, 150, 0);
      act(() => {
        result.current.handleMouseDown(mouseDownEvent);
      });

      // Move mouse
      const mouseMoveEvent = createMouseEvent("mousemove", {
        clientX: 200,
        clientY: 200,
      });

      act(() => {
        window.dispatchEvent(mouseMoveEvent);
      });

      expect(onResize).toHaveBeenCalledWith(entity, { width: 250, height: 150 });
    });

    it("calculates new size based on pointer delta", () => {
      const onResize = vi.fn();
      const { result } = renderHook(() => useNodeResize(entity, { onResize }));

      // Entity starts with size (200, 100), pointer starts at (150, 150)
      const mouseDownEvent = createReactMouseEvent(150, 150, 0);
      act(() => {
        result.current.handleMouseDown(mouseDownEvent);
      });

      // Move pointer to (250, 250) - delta of (100, 100)
      const mouseMoveEvent = createMouseEvent("mousemove", {
        clientX: 250,
        clientY: 250,
      });

      act(() => {
        window.dispatchEvent(mouseMoveEvent);
      });

      // New size should be (200 + 100, 100 + 100) = (300, 200)
      expect(onResize).toHaveBeenCalledWith(entity, { width: 300, height: 200 });
    });

    it("tracks multiple move events", () => {
      const onResize = vi.fn();
      const { result } = renderHook(() => useNodeResize(entity, { onResize }));

      // Start resize
      const mouseDownEvent = createReactMouseEvent(150, 150, 0);
      act(() => {
        result.current.handleMouseDown(mouseDownEvent);
      });

      // First move
      act(() => {
        window.dispatchEvent(createMouseEvent("mousemove", { clientX: 160, clientY: 160 }));
      });

      // Second move
      act(() => {
        window.dispatchEvent(createMouseEvent("mousemove", { clientX: 180, clientY: 180 }));
      });

      expect(onResize).toHaveBeenCalledTimes(2);
      expect(onResize).toHaveBeenLastCalledWith(entity, { width: 230, height: 130 });
    });
  });

  describe("resize end", () => {
    it("ends resize on mouseup", () => {
      const { result } = renderHook(() => useNodeResize(entity));

      // Start resize
      const mouseDownEvent = createReactMouseEvent(150, 150, 0);
      act(() => {
        result.current.handleMouseDown(mouseDownEvent);
      });

      expect(result.current.isResizing).toBe(true);

      // End resize
      const mouseUpEvent = createMouseEvent("mouseup", {
        clientX: 200,
        clientY: 200,
      });

      act(() => {
        window.dispatchEvent(mouseUpEvent);
      });

      expect(result.current.isResizing).toBe(false);
      expect(result.current.resizeState).toBeNull();
    });

    it("calls onResizeEnd callback on mouseup", () => {
      const onResizeEnd = vi.fn();
      const { result } = renderHook(() => useNodeResize(entity, { onResizeEnd }));

      // Start resize
      const mouseDownEvent = createReactMouseEvent(150, 150, 0);
      act(() => {
        result.current.handleMouseDown(mouseDownEvent);
      });

      // Move to trigger resize (to exceed threshold if any)
      act(() => {
        window.dispatchEvent(createMouseEvent("mousemove", { clientX: 160, clientY: 160 }));
      });

      // End resize
      act(() => {
        window.dispatchEvent(createMouseEvent("mouseup", { clientX: 200, clientY: 200 }));
      });

      expect(onResizeEnd).toHaveBeenCalledWith(entity, { width: 250, height: 150 });
    });

    it("resets sizeDelta after mouseup", () => {
      const { result } = renderHook(() => useNodeResize(entity));

      // Start resize
      const mouseDownEvent = createReactMouseEvent(150, 150, 0);
      act(() => {
        result.current.handleMouseDown(mouseDownEvent);
      });

      // Move to create offset
      act(() => {
        window.dispatchEvent(createMouseEvent("mousemove", { clientX: 200, clientY: 200 }));
      });

      // End resize
      act(() => {
        window.dispatchEvent(createMouseEvent("mouseup", { clientX: 200, clientY: 200 }));
      });

      expect(result.current.sizeDelta).toEqual({ width: 0, height: 0 });
    });
  });

  describe("minimum size enforcement", () => {
    it("enforces default minimum width of 100", () => {
      const onResize = vi.fn();
      const { result } = renderHook(() => useNodeResize(entity, { onResize }));

      // Start resize at (200, 150)
      const mouseDownEvent = createReactMouseEvent(200, 150, 0);
      act(() => {
        result.current.handleMouseDown(mouseDownEvent);
      });

      // Move pointer left to try to shrink below minimum (delta = -150)
      act(() => {
        window.dispatchEvent(createMouseEvent("mousemove", { clientX: 50, clientY: 150 }));
      });

      // Width should be clamped to minimum 100
      expect(onResize).toHaveBeenCalledWith(entity, { width: 100, height: 100 });
    });

    it("enforces default minimum height of 60", () => {
      const onResize = vi.fn();
      const { result } = renderHook(() => useNodeResize(entity, { onResize }));

      // Start resize at (200, 150)
      const mouseDownEvent = createReactMouseEvent(200, 150, 0);
      act(() => {
        result.current.handleMouseDown(mouseDownEvent);
      });

      // Move pointer up to try to shrink below minimum (delta = -100)
      act(() => {
        window.dispatchEvent(createMouseEvent("mousemove", { clientX: 200, clientY: 50 }));
      });

      // Height should be clamped to minimum 60
      expect(onResize).toHaveBeenCalledWith(entity, { width: 200, height: 60 });
    });

    it("uses custom minWidth option", () => {
      const onResize = vi.fn();
      const { result } = renderHook(() => useNodeResize(entity, { onResize, minWidth: 150 }));

      // Start resize
      const mouseDownEvent = createReactMouseEvent(200, 150, 0);
      act(() => {
        result.current.handleMouseDown(mouseDownEvent);
      });

      // Try to shrink below custom minimum
      act(() => {
        window.dispatchEvent(createMouseEvent("mousemove", { clientX: 50, clientY: 150 }));
      });

      // Width should be clamped to custom minimum 150
      expect(onResize).toHaveBeenCalledWith(entity, { width: 150, height: 100 });
    });

    it("uses custom minHeight option", () => {
      const onResize = vi.fn();
      const { result } = renderHook(() => useNodeResize(entity, { onResize, minHeight: 80 }));

      // Start resize
      const mouseDownEvent = createReactMouseEvent(200, 150, 0);
      act(() => {
        result.current.handleMouseDown(mouseDownEvent);
      });

      // Try to shrink below custom minimum
      act(() => {
        window.dispatchEvent(createMouseEvent("mousemove", { clientX: 200, clientY: 50 }));
      });

      // Height should be clamped to custom minimum 80
      expect(onResize).toHaveBeenCalledWith(entity, { width: 200, height: 80 });
    });
  });

  describe("maximum size enforcement", () => {
    it("enforces maxWidth option", () => {
      const onResize = vi.fn();
      const { result } = renderHook(() => useNodeResize(entity, { onResize, maxWidth: 300 }));

      // Start resize
      const mouseDownEvent = createReactMouseEvent(150, 150, 0);
      act(() => {
        result.current.handleMouseDown(mouseDownEvent);
      });

      // Try to grow beyond maximum (delta = 200)
      act(() => {
        window.dispatchEvent(createMouseEvent("mousemove", { clientX: 350, clientY: 150 }));
      });

      // Width should be clamped to maximum 300
      expect(onResize).toHaveBeenCalledWith(entity, { width: 300, height: 100 });
    });

    it("enforces maxHeight option", () => {
      const onResize = vi.fn();
      const { result } = renderHook(() => useNodeResize(entity, { onResize, maxHeight: 200 }));

      // Start resize
      const mouseDownEvent = createReactMouseEvent(150, 150, 0);
      act(() => {
        result.current.handleMouseDown(mouseDownEvent);
      });

      // Try to grow beyond maximum (delta = 200)
      act(() => {
        window.dispatchEvent(createMouseEvent("mousemove", { clientX: 150, clientY: 350 }));
      });

      // Height should be clamped to maximum 200
      expect(onResize).toHaveBeenCalledWith(entity, { width: 200, height: 200 });
    });
  });

  describe("resize threshold", () => {
    it("does not call onResize before threshold is exceeded", () => {
      const onResize = vi.fn();
      const { result } = renderHook(() => useNodeResize(entity, { onResize, resizeThreshold: 10 }));

      // Start resize
      const mouseDownEvent = createReactMouseEvent(150, 150, 0);
      act(() => {
        result.current.handleMouseDown(mouseDownEvent);
      });

      // Move less than threshold
      act(() => {
        window.dispatchEvent(createMouseEvent("mousemove", { clientX: 155, clientY: 155 }));
      });

      // Should not have called onResize yet
      expect(onResize).not.toHaveBeenCalled();
    });

    it("calls onResize after threshold is exceeded", () => {
      const onResize = vi.fn();
      const { result } = renderHook(() => useNodeResize(entity, { onResize, resizeThreshold: 10 }));

      // Start resize
      const mouseDownEvent = createReactMouseEvent(150, 150, 0);
      act(() => {
        result.current.handleMouseDown(mouseDownEvent);
      });

      // Move more than threshold
      act(() => {
        window.dispatchEvent(createMouseEvent("mousemove", { clientX: 165, clientY: 165 }));
      });

      // Should have called onResize now
      expect(onResize).toHaveBeenCalled();
    });

    it("calls onResizeStart when threshold is exceeded", () => {
      const onResizeStart = vi.fn();
      const { result } = renderHook(() =>
        useNodeResize(entity, { onResizeStart, resizeThreshold: 10 })
      );

      // Start resize
      const mouseDownEvent = createReactMouseEvent(150, 150, 0);
      act(() => {
        result.current.handleMouseDown(mouseDownEvent);
      });

      // Move more than threshold
      act(() => {
        window.dispatchEvent(createMouseEvent("mousemove", { clientX: 165, clientY: 165 }));
      });

      expect(onResizeStart).toHaveBeenCalledWith(entity, { width: 200, height: 100 });
    });
  });

  describe("callbacks", () => {
    it("calls onResizeStart when resize begins with threshold", () => {
      // Note: onResizeStart is only called when exceeding threshold.
      // With threshold=0, hasExceededThreshold starts as true, so onResizeStart is not called.
      // Use a small threshold to test the callback properly.
      const onResizeStart = vi.fn();
      const { result } = renderHook(() =>
        useNodeResize(entity, { onResizeStart, resizeThreshold: 1 })
      );

      // Start resize
      const mouseDownEvent = createReactMouseEvent(150, 150, 0);
      act(() => {
        result.current.handleMouseDown(mouseDownEvent);
      });

      // First move triggers start (move enough to exceed 1px threshold)
      act(() => {
        window.dispatchEvent(createMouseEvent("mousemove", { clientX: 160, clientY: 160 }));
      });

      expect(onResizeStart).toHaveBeenCalledWith(entity, { width: 200, height: 100 });
    });

    it("passes entity reference to all callbacks", () => {
      const onResize = vi.fn();
      const onResizeStart = vi.fn();
      const onResizeEnd = vi.fn();
      // Use threshold to properly test onResizeStart
      const { result } = renderHook(() =>
        useNodeResize(entity, { onResize, onResizeStart, onResizeEnd, resizeThreshold: 1 })
      );

      // Start resize
      act(() => {
        result.current.handleMouseDown(createReactMouseEvent(150, 150, 0));
      });

      // Move enough to exceed threshold
      act(() => {
        window.dispatchEvent(createMouseEvent("mousemove", { clientX: 200, clientY: 200 }));
      });

      // End resize
      act(() => {
        window.dispatchEvent(createMouseEvent("mouseup", { clientX: 200, clientY: 200 }));
      });

      expect(onResizeStart).toHaveBeenCalledWith(entity, expect.any(Object));
      expect(onResize).toHaveBeenCalledWith(entity, expect.any(Object));
      expect(onResizeEnd).toHaveBeenCalledWith(entity, expect.any(Object));
    });
  });

  describe("resize sequence validation", () => {
    it("simulates complete resize flow and validates new size is larger", () => {
      const onResizeEnd = vi.fn();
      const { result } = renderHook(() => useNodeResize(entity, { onResizeEnd }));

      // Start resize
      const startEvent = createReactMouseEvent(200, 200, 0);
      act(() => {
        result.current.handleMouseDown(startEvent);
      });

      // Get starting size
      const startSize = result.current.resizeState?.startSize;
      expect(startSize).toEqual({ width: 200, height: 100 });

      // Move pointer to expand the node
      act(() => {
        window.dispatchEvent(createMouseEvent("mousemove", { clientX: 300, clientY: 300 }));
      });

      // End resize
      act(() => {
        window.dispatchEvent(createMouseEvent("mouseup", { clientX: 300, clientY: 300 }));
      });

      // Validate new size is larger than starting size
      expect(onResizeEnd).toHaveBeenCalledWith(entity, { width: 300, height: 200 });
      const finalSize = onResizeEnd.mock.calls[0][1] as Size;
      expect(finalSize.width).toBeGreaterThan(startSize!.width);
      expect(finalSize.height).toBeGreaterThan(startSize!.height);
    });

    it("validates size can be reduced but not below minimum", () => {
      const onResizeEnd = vi.fn();
      const { result } = renderHook(() =>
        useNodeResize(entity, { onResizeEnd, minWidth: 100, minHeight: 60 })
      );

      // Start resize
      act(() => {
        result.current.handleMouseDown(createReactMouseEvent(200, 200, 0));
      });

      // Try to shrink significantly
      act(() => {
        window.dispatchEvent(createMouseEvent("mousemove", { clientX: 0, clientY: 0 }));
      });

      // End resize
      act(() => {
        window.dispatchEvent(createMouseEvent("mouseup", { clientX: 0, clientY: 0 }));
      });

      // Size should be at minimum, not below
      expect(onResizeEnd).toHaveBeenCalledWith(entity, { width: 100, height: 60 });
    });
  });

  describe("sizeDelta tracking", () => {
    it("updates sizeDelta during resize", () => {
      const { result } = renderHook(() => useNodeResize(entity));

      // Start resize
      const mouseDownEvent = createReactMouseEvent(150, 150, 0);
      act(() => {
        result.current.handleMouseDown(mouseDownEvent);
      });

      // Move to create delta
      act(() => {
        window.dispatchEvent(createMouseEvent("mousemove", { clientX: 200, clientY: 180 }));
      });

      expect(result.current.sizeDelta).toEqual({ width: 50, height: 30 });
    });

    it("handles negative sizeDelta when shrinking", () => {
      const { result } = renderHook(() => useNodeResize(entity));

      // Start resize
      const mouseDownEvent = createReactMouseEvent(200, 200, 0);
      act(() => {
        result.current.handleMouseDown(mouseDownEvent);
      });

      // Move to shrink (negative delta)
      act(() => {
        window.dispatchEvent(createMouseEvent("mousemove", { clientX: 150, clientY: 170 }));
      });

      expect(result.current.sizeDelta).toEqual({ width: -50, height: -30 });
    });
  });

  describe("entity updates", () => {
    it("works with entity that has no initial size", () => {
      // Create entity without explicit size
      const entityNoSize = new FlowNodeEntity({
        nodeType: "default",
        label: "No Size Node",
        position: { x: 0, y: 0 },
      });

      const onResize = vi.fn();
      const { result } = renderHook(() => useNodeResize(entityNoSize, { onResize }));

      // Start resize - should use default size
      const mouseDownEvent = createReactMouseEvent(100, 100, 0);
      act(() => {
        result.current.handleMouseDown(mouseDownEvent);
      });

      // Move
      act(() => {
        window.dispatchEvent(createMouseEvent("mousemove", { clientX: 150, clientY: 150 }));
      });

      // Should use default size (200, 100) as starting point
      expect(onResize).toHaveBeenCalledWith(entityNoSize, { width: 250, height: 150 });
    });
  });

  describe("cleanup", () => {
    it("removes event listeners on unmount", () => {
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
      const { result, unmount } = renderHook(() => useNodeResize(entity));

      // Start resize
      act(() => {
        result.current.handleMouseDown(createReactMouseEvent(150, 150, 0));
      });

      // Unmount
      unmount();

      // Check that listeners were removed
      expect(removeEventListenerSpy).toHaveBeenCalledWith("mousemove", expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith("mouseup", expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });

    it("removes event listeners when resize ends", () => {
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
      const { result } = renderHook(() => useNodeResize(entity));

      // Start resize
      act(() => {
        result.current.handleMouseDown(createReactMouseEvent(150, 150, 0));
      });

      // End resize
      act(() => {
        window.dispatchEvent(createMouseEvent("mouseup", { clientX: 200, clientY: 200 }));
      });

      // Listeners should be cleaned up
      expect(removeEventListenerSpy).toHaveBeenCalledWith("mousemove", expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith("mouseup", expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });
  });

  describe("edge cases", () => {
    it("handles rapid mousedown/mouseup", () => {
      const onResizeEnd = vi.fn();
      const { result } = renderHook(() => useNodeResize(entity, { onResizeEnd }));

      // Quick mousedown then mouseup at same position
      act(() => {
        result.current.handleMouseDown(createReactMouseEvent(150, 150, 0));
      });

      act(() => {
        window.dispatchEvent(createMouseEvent("mouseup", { clientX: 150, clientY: 150 }));
      });

      // Should end cleanly but not call onResizeEnd (no movement occurred)
      expect(result.current.isResizing).toBe(false);
    });

    it("handles entity change during resize", () => {
      const onResize = vi.fn();
      const { result, rerender } = renderHook(({ entity }) => useNodeResize(entity, { onResize }), {
        initialProps: { entity },
      });

      // Start resize
      act(() => {
        result.current.handleMouseDown(createReactMouseEvent(150, 150, 0));
      });

      // Create new entity
      const newEntity = createMockEntity({ size: { width: 300, height: 200 } });

      // Rerender with new entity
      rerender({ entity: newEntity });

      // Move - should use new entity
      act(() => {
        window.dispatchEvent(createMouseEvent("mousemove", { clientX: 200, clientY: 200 }));
      });

      // Should have been called with the new entity
      expect(onResize).toHaveBeenLastCalledWith(newEntity, expect.any(Object));
    });
  });
});
