/**
 * @file useFlowNode Hook Tests
 * @description Unit tests for the useFlowNode hook that encapsulates
 * flow node view state and interaction handlers.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 2.1
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFlowNode } from "../../../../src/components/flow-entity/hooks/useFlowNode";
import { FlowNodeEntity } from "../../../../src/common/flow/flow-node-entity";
import type { Position, Size } from "../../../../src/components/flow-entity/types";

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a mock FlowNodeEntity for testing
 */
function createMockEntity(
  overrides: Partial<{
    id: string;
    position: Position;
    size: Size;
    label: string;
    disabled: boolean;
    executionState: string;
  }> = {}
): FlowNodeEntity {
  const entity = new FlowNodeEntity({
    nodeType: "default",
    label: overrides.label ?? "Test Node",
    position: overrides.position ?? { x: 100, y: 200 },
    size: overrides.size ?? { width: 250, height: 150 },
    disabled: overrides.disabled ?? false,
    executionState: overrides.executionState ?? "idle",
  });
  return entity;
}

// =============================================================================
// Tests
// =============================================================================

describe("useFlowNode", () => {
  let entity: FlowNodeEntity;

  beforeEach(() => {
    entity = createMockEntity();
  });

  describe("state extraction", () => {
    it("extracts position from entity data", () => {
      const { result } = renderHook(() => useFlowNode(entity));

      expect(result.current.position).toEqual({ x: 100, y: 200 });
    });

    it("extracts size from entity data", () => {
      const { result } = renderHook(() => useFlowNode(entity));

      expect(result.current.size).toEqual({ width: 250, height: 150 });
    });

    it("reflects external entity size changes on rerender", () => {
      const { result, rerender } = renderHook(() => useFlowNode(entity));

      expect(result.current.size).toEqual({ width: 250, height: 150 });

      entity.setSize({ width: 320, height: 180 });
      rerender();

      expect(result.current.size).toEqual({ width: 320, height: 180 });
    });

    it("provides default size when not specified", () => {
      const entityWithoutSize = createMockEntity();
      const mutableData = entityWithoutSize.data as { size?: Size };
      delete mutableData.size;

      const { result } = renderHook(() => useFlowNode(entityWithoutSize));

      expect(result.current.size).toEqual({ width: 200, height: 100 });
    });

    it("extracts label from entity data", () => {
      const { result } = renderHook(() => useFlowNode(entity));

      expect(result.current.label).toBe("Test Node");
    });

    it("extracts disabled state from entity data", () => {
      const disabledEntity = createMockEntity({ disabled: true });
      const { result } = renderHook(() => useFlowNode(disabledEntity));

      expect(result.current.isDisabled).toBe(true);
    });

    it("extracts execution state from entity data", () => {
      const runningEntity = createMockEntity({ executionState: "running" });
      const { result } = renderHook(() => useFlowNode(runningEntity));

      expect(result.current.executionState).toBe("running");
    });
  });

  describe("selection state", () => {
    it("uses controlled selection from props", () => {
      const { result } = renderHook(() => useFlowNode(entity, { selected: true }));

      expect(result.current.isSelected).toBe(true);
    });

    it("defaults to unselected", () => {
      const { result } = renderHook(() => useFlowNode(entity));

      expect(result.current.isSelected).toBe(false);
    });

    it("uses local selection state when useLocalSelection is true", () => {
      const { result } = renderHook(() => useFlowNode(entity, { useLocalSelection: true }));

      expect(result.current.isSelected).toBe(false);

      act(() => {
        result.current.setSelected(true);
      });

      expect(result.current.isSelected).toBe(true);
    });

    it("toggles local selection state", () => {
      const { result } = renderHook(() => useFlowNode(entity, { useLocalSelection: true }));

      expect(result.current.isSelected).toBe(false);

      act(() => {
        result.current.toggleSelect();
      });

      expect(result.current.isSelected).toBe(true);

      act(() => {
        result.current.toggleSelect();
      });

      expect(result.current.isSelected).toBe(false);
    });
  });

  describe("handleSelect", () => {
    it("calls onSelect callback with entity", () => {
      const onSelect = vi.fn();
      const { result } = renderHook(() => useFlowNode(entity, { onSelect }));

      act(() => {
        result.current.handleSelect();
      });

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith(entity);
    });

    it("does not call onSelect when disabled", () => {
      const onSelect = vi.fn();
      const disabledEntity = createMockEntity({ disabled: true });
      const { result } = renderHook(() => useFlowNode(disabledEntity, { onSelect }));

      act(() => {
        result.current.handleSelect();
      });

      expect(onSelect).not.toHaveBeenCalled();
    });

    it("updates local selection state when useLocalSelection is true", () => {
      const onSelect = vi.fn();
      const { result } = renderHook(() =>
        useFlowNode(entity, { onSelect, useLocalSelection: true })
      );

      expect(result.current.isSelected).toBe(false);

      act(() => {
        result.current.handleSelect();
      });

      expect(result.current.isSelected).toBe(true);
      expect(onSelect).toHaveBeenCalledWith(entity);
    });
  });

  describe("handleMove", () => {
    it("calls onMove callback with entity and new position", () => {
      const onMove = vi.fn();
      const { result } = renderHook(() => useFlowNode(entity, { onMove }));

      const newPosition: Position = { x: 300, y: 400 };

      act(() => {
        result.current.handleMove(newPosition);
      });

      expect(onMove).toHaveBeenCalledTimes(1);
      expect(onMove).toHaveBeenCalledWith(entity, newPosition);
    });

    it("updates entity position", () => {
      const setPositionSpy = vi.spyOn(entity, "setPosition");
      const { result } = renderHook(() => useFlowNode(entity));

      const newPosition: Position = { x: 300, y: 400 };

      act(() => {
        result.current.handleMove(newPosition);
      });

      expect(setPositionSpy).toHaveBeenCalledWith(newPosition);
    });

    it("does not call onMove when disabled", () => {
      const onMove = vi.fn();
      const disabledEntity = createMockEntity({ disabled: true });
      const { result } = renderHook(() => useFlowNode(disabledEntity, { onMove }));

      act(() => {
        result.current.handleMove({ x: 300, y: 400 });
      });

      expect(onMove).not.toHaveBeenCalled();
    });
  });

  describe("handleResize", () => {
    it("calls onResize callback with entity and new size", () => {
      const onResize = vi.fn();
      const { result } = renderHook(() => useFlowNode(entity, { onResize }));

      const newSize: Size = { width: 400, height: 300 };

      act(() => {
        result.current.handleResize(newSize);
      });

      expect(onResize).toHaveBeenCalledTimes(1);
      expect(onResize).toHaveBeenCalledWith(entity, newSize);
    });

    it("updates entity size", () => {
      const setSizeSpy = vi.spyOn(entity, "setSize");
      const { result } = renderHook(() => useFlowNode(entity));

      const newSize: Size = { width: 400, height: 300 };

      act(() => {
        result.current.handleResize(newSize);
      });

      expect(setSizeSpy).toHaveBeenCalledWith(newSize);
    });

    it("renders resized size from the entity snapshot", () => {
      const { result } = renderHook(() => useFlowNode(entity));

      const newSize: Size = { width: 400, height: 300 };

      act(() => {
        result.current.handleResize(newSize);
      });

      expect(entity.getSize()).toEqual(newSize);
      expect(result.current.size).toEqual(newSize);
    });

    it("does not call onResize when disabled", () => {
      const onResize = vi.fn();
      const disabledEntity = createMockEntity({ disabled: true });
      const { result } = renderHook(() => useFlowNode(disabledEntity, { onResize }));

      act(() => {
        result.current.handleResize({ width: 400, height: 300 });
      });

      expect(onResize).not.toHaveBeenCalled();
    });
  });

  describe("handlePortConnect", () => {
    it("calls onPortConnect callback with entity and port id", () => {
      const onPortConnect = vi.fn();
      const { result } = renderHook(() => useFlowNode(entity, { onPortConnect }));

      act(() => {
        result.current.handlePortConnect("port-1");
      });

      expect(onPortConnect).toHaveBeenCalledTimes(1);
      expect(onPortConnect).toHaveBeenCalledWith(entity, "port-1");
    });

    it("does not call onPortConnect when disabled", () => {
      const onPortConnect = vi.fn();
      const disabledEntity = createMockEntity({ disabled: true });
      const { result } = renderHook(() => useFlowNode(disabledEntity, { onPortConnect }));

      act(() => {
        result.current.handlePortConnect("port-1");
      });

      expect(onPortConnect).not.toHaveBeenCalled();
    });
  });

  describe("handleFormChange", () => {
    it("calls onFormChange callback with entity and values", () => {
      const onFormChange = vi.fn();
      const { result } = renderHook(() => useFlowNode(entity, { onFormChange }));

      const values = { name: "Updated", value: 42 };

      act(() => {
        result.current.handleFormChange(values);
      });

      expect(onFormChange).toHaveBeenCalledTimes(1);
      expect(onFormChange).toHaveBeenCalledWith(entity, values);
    });

    it("updates entity form data", () => {
      const updateFormDataSpy = vi.spyOn(entity, "updateFormData");
      const { result } = renderHook(() => useFlowNode(entity));

      const values = { name: "Updated" };

      act(() => {
        result.current.handleFormChange(values);
      });

      expect(updateFormDataSpy).toHaveBeenCalledWith(values);
    });

    it("does not call onFormChange when disabled", () => {
      const onFormChange = vi.fn();
      const disabledEntity = createMockEntity({ disabled: true });
      const { result } = renderHook(() => useFlowNode(disabledEntity, { onFormChange }));

      act(() => {
        result.current.handleFormChange({ name: "Updated" });
      });

      expect(onFormChange).not.toHaveBeenCalled();
    });
  });

  describe("memoization", () => {
    it("returns stable position reference when position unchanged", () => {
      const { result, rerender } = renderHook(() => useFlowNode(entity));

      const position1 = result.current.position;
      rerender();
      const position2 = result.current.position;

      expect(position1).toBe(position2);
    });

    it("returns stable size reference when size unchanged", () => {
      const { result, rerender } = renderHook(() => useFlowNode(entity));

      const size1 = result.current.size;
      rerender();
      const size2 = result.current.size;

      expect(size1).toBe(size2);
    });

    it("returns stable handler references", () => {
      const { result, rerender } = renderHook(() => useFlowNode(entity));

      const handlers1 = {
        handleSelect: result.current.handleSelect,
        handleMove: result.current.handleMove,
        handleResize: result.current.handleResize,
        handlePortConnect: result.current.handlePortConnect,
        handleFormChange: result.current.handleFormChange,
      };

      rerender();

      expect(result.current.handleSelect).toBe(handlers1.handleSelect);
      expect(result.current.handleMove).toBe(handlers1.handleMove);
      expect(result.current.handleResize).toBe(handlers1.handleResize);
      expect(result.current.handlePortConnect).toBe(handlers1.handlePortConnect);
      expect(result.current.handleFormChange).toBe(handlers1.handleFormChange);
    });
  });

  describe("edge cases", () => {
    it("handles entity with missing data gracefully", () => {
      const entityWithNoData = createMockEntity();
      const mutableData = entityWithNoData.data as {
        position?: Position;
        label?: string;
      };
      delete mutableData.position;
      delete mutableData.label;

      const { result } = renderHook(() => useFlowNode(entityWithNoData));

      // Should use default values
      expect(result.current.position).toEqual({ x: 0, y: 0 });
      expect(result.current.label).toBe("");
    });

    it("works without any options", () => {
      const { result } = renderHook(() => useFlowNode(entity));

      expect(result.current.position).toEqual({ x: 100, y: 200 });
      expect(result.current.isSelected).toBe(false);
      expect(typeof result.current.handleSelect).toBe("function");
    });

    it("handles rapid selection changes", () => {
      const onSelect = vi.fn();
      const { result } = renderHook(() =>
        useFlowNode(entity, { onSelect, useLocalSelection: true })
      );

      act(() => {
        result.current.handleSelect();
        result.current.handleSelect();
        result.current.handleSelect();
      });

      // All calls should trigger the callback
      expect(onSelect).toHaveBeenCalledTimes(3);
      expect(result.current.isSelected).toBe(true);
    });
  });
});
