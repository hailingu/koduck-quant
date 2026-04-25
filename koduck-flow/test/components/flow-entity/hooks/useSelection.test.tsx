/**
 * @file useSelection Hook Tests
 * @description Unit tests for the useSelection hook and SelectionProvider
 * that provides centralized selection state management for flow nodes and edges.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 2.4
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React, { type ReactNode } from "react";
import {
  useSelection,
  useSelectionContext,
  useSelectionContextOptional,
  SelectionProvider,
  type SelectionProviderProps,
} from "../../../../src/components/flow-entity/hooks/useSelection.jsx";

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a wrapper component with SelectionProvider
 */
function createWrapper(props: Partial<SelectionProviderProps> = {}) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <SelectionProvider {...props}>{children}</SelectionProvider>;
  };
}

// =============================================================================
// SelectionProvider Tests
// =============================================================================

describe("SelectionProvider", () => {
  describe("context access", () => {
    it("provides context value to children", () => {
      const { result } = renderHook(() => useSelectionContext(), {
        wrapper: createWrapper(),
      });

      expect(result.current).toBeDefined();
      expect(result.current.state).toBeDefined();
      expect(result.current.selectOne).toBeDefined();
      expect(result.current.toggle).toBeDefined();
      expect(result.current.clearSelection).toBeDefined();
    });

    it("throws error when useSelectionContext is used outside provider", () => {
      expect(() => {
        renderHook(() => useSelectionContext());
      }).toThrow("useSelectionContext must be used within a SelectionProvider");
    });

    it("returns undefined when useSelectionContextOptional is used outside provider", () => {
      const { result } = renderHook(() => useSelectionContextOptional());

      expect(result.current).toBeUndefined();
    });
  });

  describe("initial state", () => {
    it("starts with empty selection by default", () => {
      const { result } = renderHook(() => useSelectionContext(), {
        wrapper: createWrapper(),
      });

      expect(result.current.state.selectedIds.size).toBe(0);
      expect(result.current.state.focusedId).toBeNull();
      expect(result.current.state.lastSelectedId).toBeNull();
    });

    it("respects initialSelectedIds prop", () => {
      const { result } = renderHook(() => useSelectionContext(), {
        wrapper: createWrapper({ initialSelectedIds: ["node1", "node2"] }),
      });

      expect(result.current.state.selectedIds.size).toBe(2);
      expect(result.current.isSelected("node1")).toBe(true);
      expect(result.current.isSelected("node2")).toBe(true);
      expect(result.current.state.lastSelectedId).toBe("node2");
    });
  });

  describe("selectOne", () => {
    it("selects a single entity", () => {
      const { result } = renderHook(() => useSelectionContext(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.selectOne("node1");
      });

      expect(result.current.state.selectedIds.size).toBe(1);
      expect(result.current.isSelected("node1")).toBe(true);
      expect(result.current.state.focusedId).toBe("node1");
    });

    it("replaces previous selection with single select", () => {
      const { result } = renderHook(() => useSelectionContext(), {
        wrapper: createWrapper({ initialSelectedIds: ["node1", "node2"] }),
      });

      act(() => {
        result.current.selectOne("node3");
      });

      expect(result.current.state.selectedIds.size).toBe(1);
      expect(result.current.isSelected("node1")).toBe(false);
      expect(result.current.isSelected("node2")).toBe(false);
      expect(result.current.isSelected("node3")).toBe(true);
    });

    it("does nothing when disabled", () => {
      const { result } = renderHook(() => useSelectionContext(), {
        wrapper: createWrapper({ disabled: true }),
      });

      act(() => {
        result.current.selectOne("node1");
      });

      expect(result.current.state.selectedIds.size).toBe(0);
    });
  });

  describe("toggle", () => {
    it("adds entity when not selected", () => {
      const { result } = renderHook(() => useSelectionContext(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.toggle("node1");
      });

      expect(result.current.isSelected("node1")).toBe(true);
    });

    it("removes entity when already selected", () => {
      const { result } = renderHook(() => useSelectionContext(), {
        wrapper: createWrapper({ initialSelectedIds: ["node1"] }),
      });

      act(() => {
        result.current.toggle("node1");
      });

      expect(result.current.isSelected("node1")).toBe(false);
    });

    it("preserves other selections when toggling", () => {
      const { result } = renderHook(() => useSelectionContext(), {
        wrapper: createWrapper({ initialSelectedIds: ["node1", "node2"] }),
      });

      act(() => {
        result.current.toggle("node1");
      });

      expect(result.current.isSelected("node1")).toBe(false);
      expect(result.current.isSelected("node2")).toBe(true);
    });
  });

  describe("selectRange", () => {
    it("selects multiple entities at once", () => {
      const { result } = renderHook(() => useSelectionContext(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.selectRange(["node1", "node2", "node3"]);
      });

      expect(result.current.state.selectedIds.size).toBe(3);
      expect(result.current.isSelected("node1")).toBe(true);
      expect(result.current.isSelected("node2")).toBe(true);
      expect(result.current.isSelected("node3")).toBe(true);
    });

    it("replaces selection by default", () => {
      const { result } = renderHook(() => useSelectionContext(), {
        wrapper: createWrapper({ initialSelectedIds: ["existing"] }),
      });

      act(() => {
        result.current.selectRange(["node1", "node2"]);
      });

      expect(result.current.state.selectedIds.size).toBe(2);
      expect(result.current.isSelected("existing")).toBe(false);
      expect(result.current.isSelected("node1")).toBe(true);
      expect(result.current.isSelected("node2")).toBe(true);
    });

    it("adds to selection when additive is true", () => {
      const { result } = renderHook(() => useSelectionContext(), {
        wrapper: createWrapper({ initialSelectedIds: ["existing"] }),
      });

      act(() => {
        result.current.selectRange(["node1", "node2"], true);
      });

      expect(result.current.state.selectedIds.size).toBe(3);
      expect(result.current.isSelected("existing")).toBe(true);
      expect(result.current.isSelected("node1")).toBe(true);
      expect(result.current.isSelected("node2")).toBe(true);
    });

    it("sets focusedId to last item in range", () => {
      const { result } = renderHook(() => useSelectionContext(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.selectRange(["node1", "node2", "node3"]);
      });

      expect(result.current.state.focusedId).toBe("node3");
    });
  });

  describe("clearSelection", () => {
    it("removes all selections", () => {
      const { result } = renderHook(() => useSelectionContext(), {
        wrapper: createWrapper({ initialSelectedIds: ["node1", "node2", "node3"] }),
      });

      act(() => {
        result.current.clearSelection();
      });

      expect(result.current.state.selectedIds.size).toBe(0);
      expect(result.current.state.focusedId).toBeNull();
      expect(result.current.state.lastSelectedId).toBeNull();
    });

    it("does not trigger change when already empty", () => {
      const onSelectionChange = vi.fn();
      const { result } = renderHook(() => useSelectionContext(), {
        wrapper: createWrapper({ onSelectionChange }),
      });

      // Initial render may trigger callback, so reset
      onSelectionChange.mockClear();

      act(() => {
        result.current.clearSelection();
      });

      // Should not call onSelectionChange when already empty
      expect(onSelectionChange).not.toHaveBeenCalled();
    });
  });

  describe("select with options", () => {
    it("performs single select by default", () => {
      const { result } = renderHook(() => useSelectionContext(), {
        wrapper: createWrapper({ initialSelectedIds: ["node1"] }),
      });

      act(() => {
        result.current.select("node2");
      });

      expect(result.current.state.selectedIds.size).toBe(1);
      expect(result.current.isSelected("node1")).toBe(false);
      expect(result.current.isSelected("node2")).toBe(true);
    });

    it("performs multi-select with toggle when multi option is true", () => {
      const { result } = renderHook(() => useSelectionContext(), {
        wrapper: createWrapper({ initialSelectedIds: ["node1"] }),
      });

      act(() => {
        result.current.select("node2", { multi: true });
      });

      expect(result.current.state.selectedIds.size).toBe(2);
      expect(result.current.isSelected("node1")).toBe(true);
      expect(result.current.isSelected("node2")).toBe(true);
    });

    it("toggles existing selection when multi and toggle are true", () => {
      const { result } = renderHook(() => useSelectionContext(), {
        wrapper: createWrapper({ initialSelectedIds: ["node1", "node2"] }),
      });

      act(() => {
        result.current.select("node1", { multi: true, toggle: true });
      });

      expect(result.current.state.selectedIds.size).toBe(1);
      expect(result.current.isSelected("node1")).toBe(false);
      expect(result.current.isSelected("node2")).toBe(true);
    });

    it("only adds when multi is true and toggle is false", () => {
      const { result } = renderHook(() => useSelectionContext(), {
        wrapper: createWrapper({ initialSelectedIds: ["node1"] }),
      });

      act(() => {
        result.current.select("node1", { multi: true, toggle: false });
      });

      // Already selected, toggle false means it stays selected
      expect(result.current.isSelected("node1")).toBe(true);
    });
  });

  describe("helper methods", () => {
    it("getSelectedIds returns array of selected ids", () => {
      const { result } = renderHook(() => useSelectionContext(), {
        wrapper: createWrapper({ initialSelectedIds: ["node1", "node2"] }),
      });

      const ids = result.current.getSelectedIds();

      expect(Array.isArray(ids)).toBe(true);
      expect(ids).toContain("node1");
      expect(ids).toContain("node2");
      expect(ids.length).toBe(2);
    });

    it("getSelectionCount returns number of selected items", () => {
      const { result } = renderHook(() => useSelectionContext(), {
        wrapper: createWrapper({ initialSelectedIds: ["node1", "node2", "node3"] }),
      });

      expect(result.current.getSelectionCount()).toBe(3);
    });

    it("setFocused updates focusedId", () => {
      const { result } = renderHook(() => useSelectionContext(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setFocused("node1");
      });

      expect(result.current.state.focusedId).toBe("node1");

      act(() => {
        result.current.setFocused(null);
      });

      expect(result.current.state.focusedId).toBeNull();
    });
  });

  describe("onSelectionChange callback", () => {
    it("calls onSelectionChange when selection changes", () => {
      const onSelectionChange = vi.fn();
      const { result } = renderHook(() => useSelectionContext(), {
        wrapper: createWrapper({ onSelectionChange }),
      });

      act(() => {
        result.current.selectOne("node1");
      });

      expect(onSelectionChange).toHaveBeenCalledWith(["node1"]);
    });

    it("calls onSelectionChange with array of all selected ids", () => {
      const onSelectionChange = vi.fn();
      const { result } = renderHook(() => useSelectionContext(), {
        wrapper: createWrapper({ onSelectionChange }),
      });

      act(() => {
        result.current.selectRange(["node1", "node2", "node3"]);
      });

      expect(onSelectionChange).toHaveBeenCalledWith(
        expect.arrayContaining(["node1", "node2", "node3"])
      );
    });
  });
});

// =============================================================================
// useSelection Hook Tests
// =============================================================================

describe("useSelection hook", () => {
  describe("without context", () => {
    it("works independently without SelectionProvider", () => {
      const { result } = renderHook(() => useSelection());

      expect(result.current.selectedIds).toEqual([]);
      expect(result.current.hasSelection).toBe(false);
      expect(result.current.selectionCount).toBe(0);
    });

    it("manages local selection state", () => {
      const { result } = renderHook(() => useSelection());

      act(() => {
        result.current.select("node1");
      });

      expect(result.current.selectedIds).toContain("node1");
      expect(result.current.hasSelection).toBe(true);
      expect(result.current.selectionCount).toBe(1);
    });

    it("supports multi-select in local mode", () => {
      const { result } = renderHook(() => useSelection());

      act(() => {
        result.current.select("node1");
      });

      act(() => {
        result.current.select("node2", { multi: true });
      });

      expect(result.current.selectedIds).toContain("node1");
      expect(result.current.selectedIds).toContain("node2");
      expect(result.current.selectionCount).toBe(2);
    });

    it("supports toggle in local mode", () => {
      const { result } = renderHook(() => useSelection());

      act(() => {
        result.current.select("node1");
      });

      act(() => {
        result.current.toggle("node1");
      });

      expect(result.current.selectedIds).not.toContain("node1");
      expect(result.current.selectionCount).toBe(0);
    });

    it("supports clearSelection in local mode", () => {
      const { result } = renderHook(() => useSelection());

      act(() => {
        result.current.selectRange(["node1", "node2"]);
      });

      act(() => {
        result.current.clearSelection();
      });

      expect(result.current.selectionCount).toBe(0);
    });

    it("supports selectRange in local mode", () => {
      const { result } = renderHook(() => useSelection());

      act(() => {
        result.current.selectRange(["node1", "node2", "node3"]);
      });

      expect(result.current.selectionCount).toBe(3);
      expect(result.current.selectedIds).toContain("node1");
      expect(result.current.selectedIds).toContain("node2");
      expect(result.current.selectedIds).toContain("node3");
    });
  });

  describe("with context", () => {
    it("uses context selection state", () => {
      const { result } = renderHook(() => useSelection(), {
        wrapper: createWrapper({ initialSelectedIds: ["node1"] }),
      });

      expect(result.current.selectedIds).toContain("node1");
      expect(result.current.hasSelection).toBe(true);
    });

    it("delegates select to context", () => {
      const onSelectionChange = vi.fn();
      const { result } = renderHook(() => useSelection(), {
        wrapper: createWrapper({ onSelectionChange }),
      });

      act(() => {
        result.current.select("node1");
      });

      expect(onSelectionChange).toHaveBeenCalledWith(["node1"]);
    });

    it("delegates toggle to context", () => {
      const { result } = renderHook(() => useSelection(), {
        wrapper: createWrapper({ initialSelectedIds: ["node1"] }),
      });

      act(() => {
        result.current.toggle("node1");
      });

      expect(result.current.selectedIds).not.toContain("node1");
    });
  });

  describe("with entityId option", () => {
    it("reports isSelected for the specified entity", () => {
      const { result } = renderHook(() => useSelection({ entityId: "node1" }), {
        wrapper: createWrapper({ initialSelectedIds: ["node1"] }),
      });

      expect(result.current.isSelected).toBe(true);
    });

    it("reports isSelected as false when entity is not selected", () => {
      const { result } = renderHook(() => useSelection({ entityId: "node2" }), {
        wrapper: createWrapper({ initialSelectedIds: ["node1"] }),
      });

      expect(result.current.isSelected).toBe(false);
    });

    it("allows selecting with just options when entityId is provided", () => {
      const { result } = renderHook(() => useSelection({ entityId: "node1" }), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.select();
      });

      expect(result.current.isSelected).toBe(true);
    });

    it("allows toggling without id when entityId is provided", () => {
      const { result } = renderHook(() => useSelection({ entityId: "node1" }), {
        wrapper: createWrapper({ initialSelectedIds: ["node1"] }),
      });

      act(() => {
        result.current.toggle();
      });

      expect(result.current.isSelected).toBe(false);
    });
  });

  describe("onSelect callback", () => {
    it("calls onSelect when entity selection changes", () => {
      const onSelect = vi.fn();
      const { result } = renderHook(() => useSelection({ entityId: "node1", onSelect }), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.select();
      });

      expect(onSelect).toHaveBeenCalled();
    });
  });

  describe("checkSelected helper", () => {
    it("checks if a specific entity is selected", () => {
      const { result } = renderHook(() => useSelection(), {
        wrapper: createWrapper({ initialSelectedIds: ["node1", "node2"] }),
      });

      expect(result.current.checkSelected("node1")).toBe(true);
      expect(result.current.checkSelected("node2")).toBe(true);
      expect(result.current.checkSelected("node3")).toBe(false);
    });
  });

  describe("focusedId", () => {
    it("tracks focusedId from context", () => {
      const { result } = renderHook(
        () => ({
          selection: useSelection(),
          context: useSelectionContext(),
        }),
        {
          wrapper: createWrapper(),
        }
      );

      act(() => {
        result.current.context.setFocused("node1");
      });

      expect(result.current.selection.focusedId).toBe("node1");
    });

    it("updates focusedId when selecting", () => {
      const { result } = renderHook(() => useSelection(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.select("node1");
      });

      expect(result.current.focusedId).toBe("node1");
    });
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe("Selection integration", () => {
  it("multiple hooks share the same selection state", () => {
    const { result } = renderHook(
      () => ({
        hook1: useSelection({ entityId: "node1" }),
        hook2: useSelection({ entityId: "node2" }),
      }),
      {
        wrapper: createWrapper(),
      }
    );

    // Select node1
    act(() => {
      result.current.hook1.select();
    });

    expect(result.current.hook1.isSelected).toBe(true);
    expect(result.current.hook2.isSelected).toBe(false);

    // Multi-select node2
    act(() => {
      result.current.hook2.select({ multi: true });
    });

    expect(result.current.hook1.isSelected).toBe(true);
    expect(result.current.hook2.isSelected).toBe(true);
    expect(result.current.hook1.selectionCount).toBe(2);
    expect(result.current.hook2.selectionCount).toBe(2);
  });

  it("clearSelection affects all hooks", () => {
    const { result } = renderHook(
      () => ({
        hook1: useSelection({ entityId: "node1" }),
        hook2: useSelection({ entityId: "node2" }),
      }),
      {
        wrapper: createWrapper({ initialSelectedIds: ["node1", "node2"] }),
      }
    );

    expect(result.current.hook1.isSelected).toBe(true);
    expect(result.current.hook2.isSelected).toBe(true);

    act(() => {
      result.current.hook1.clearSelection();
    });

    expect(result.current.hook1.isSelected).toBe(false);
    expect(result.current.hook2.isSelected).toBe(false);
  });

  it("simulates Shift+Click multi-select workflow", () => {
    const { result } = renderHook(
      () => ({
        hook1: useSelection({ entityId: "node1" }),
        hook2: useSelection({ entityId: "node2" }),
        hook3: useSelection({ entityId: "node3" }),
      }),
      {
        wrapper: createWrapper(),
      }
    );

    // Click node1 (single select)
    act(() => {
      result.current.hook1.select();
    });

    expect(result.current.hook1.isSelected).toBe(true);
    expect(result.current.hook2.isSelected).toBe(false);
    expect(result.current.hook3.isSelected).toBe(false);

    // Shift+Click node2 (multi select)
    act(() => {
      result.current.hook2.select({ multi: true });
    });

    expect(result.current.hook1.isSelected).toBe(true);
    expect(result.current.hook2.isSelected).toBe(true);
    expect(result.current.hook3.isSelected).toBe(false);

    // Shift+Click node3 (multi select)
    act(() => {
      result.current.hook3.select({ multi: true });
    });

    expect(result.current.hook1.isSelected).toBe(true);
    expect(result.current.hook2.isSelected).toBe(true);
    expect(result.current.hook3.isSelected).toBe(true);

    // Click node1 without Shift (single select, clears others)
    act(() => {
      result.current.hook1.select();
    });

    expect(result.current.hook1.isSelected).toBe(true);
    expect(result.current.hook2.isSelected).toBe(false);
    expect(result.current.hook3.isSelected).toBe(false);
  });
});
