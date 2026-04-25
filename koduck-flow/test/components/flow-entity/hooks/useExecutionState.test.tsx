/**
 * @file useExecutionState unit tests
 * @description Tests for useExecutionState hook including state subscriptions,
 * progress tracking, callbacks, and convenience hooks.
 *
 * @see docs/design/flow-entity-step-plan-en.md Phase 3 - Task 3.2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup, renderHook } from "@testing-library/react";
import React from "react";

import {
  useExecutionState,
  useExecutionStateValue,
  useExecutionStateWithProgress,
  useIsExecutionState,
  createUseExecutionState,
  type UseExecutionStateOptions,
} from "../../../../src/components/flow-entity/hooks/useExecutionState";
import {
  ExecutionStateProvider,
  ExecutionStateManager,
} from "../../../../src/components/flow-entity/execution";
import type { ExecutionState } from "../../../../src/components/flow-entity/types";

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Wrapper component for testing hooks with ExecutionStateProvider
 */
function createWrapper(manager?: ExecutionStateManager) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <ExecutionStateProvider manager={manager}>{children}</ExecutionStateProvider>;
  };
}

/**
 * Test component for useExecutionState hook
 */
function TestComponent({
  entityId,
  onStateChange,
  onProgressChange,
  subscribeToProgress = true,
}: UseExecutionStateOptions): React.JSX.Element {
  const result = useExecutionState({
    entityId,
    onStateChange,
    onProgressChange,
    subscribeToProgress,
  });

  return (
    <div>
      <span data-testid="state">{result.state}</span>
      <span data-testid="previous-state">{result.previousState ?? "none"}</span>
      <span data-testid="progress">{result.progress ?? "none"}</span>
      <span data-testid="is-executing">{String(result.isExecuting)}</span>
      <span data-testid="is-completed">{String(result.isCompleted)}</span>
      <span data-testid="is-error">{String(result.isError)}</span>
      <span data-testid="is-success">{String(result.isSuccess)}</span>
      <span data-testid="is-idle">{String(result.isIdle)}</span>
      <button data-testid="set-running" onClick={() => result.setState("running")}>
        Set Running
      </button>
      <button data-testid="set-progress" onClick={() => result.setProgress(50)}>
        Set Progress
      </button>
      <button data-testid="reset" onClick={() => result.reset()}>
        Reset
      </button>
    </div>
  );
}

// =============================================================================
// Tests
// =============================================================================

describe("useExecutionState", () => {
  let manager: ExecutionStateManager;

  beforeEach(() => {
    manager = new ExecutionStateManager();
  });

  afterEach(() => {
    cleanup();
    manager.dispose();
  });

  // ===========================================================================
  // Initial State
  // ===========================================================================

  describe("initial state", () => {
    it("should return idle state by default", () => {
      render(
        <ExecutionStateProvider manager={manager}>
          <TestComponent entityId="entity-1" />
        </ExecutionStateProvider>
      );

      expect(screen.getByTestId("state")).toHaveTextContent("idle");
      expect(screen.getByTestId("is-idle")).toHaveTextContent("true");
    });

    it("should return existing state from manager", () => {
      manager.setState("entity-1", "running");

      render(
        <ExecutionStateProvider manager={manager}>
          <TestComponent entityId="entity-1" />
        </ExecutionStateProvider>
      );

      expect(screen.getByTestId("state")).toHaveTextContent("running");
      expect(screen.getByTestId("is-executing")).toHaveTextContent("true");
    });

    it("should return existing progress from manager", () => {
      manager.setProgress("entity-1", 75);

      render(
        <ExecutionStateProvider manager={manager}>
          <TestComponent entityId="entity-1" />
        </ExecutionStateProvider>
      );

      expect(screen.getByTestId("progress")).toHaveTextContent("75");
    });

    it("should show undefined previous state initially", () => {
      render(
        <ExecutionStateProvider manager={manager}>
          <TestComponent entityId="entity-1" />
        </ExecutionStateProvider>
      );

      expect(screen.getByTestId("previous-state")).toHaveTextContent("none");
    });
  });

  // ===========================================================================
  // State Subscription
  // ===========================================================================

  describe("state subscription", () => {
    it("should update when manager state changes", () => {
      render(
        <ExecutionStateProvider manager={manager}>
          <TestComponent entityId="entity-1" />
        </ExecutionStateProvider>
      );

      expect(screen.getByTestId("state")).toHaveTextContent("idle");

      act(() => {
        manager.setState("entity-1", "running");
      });

      expect(screen.getByTestId("state")).toHaveTextContent("running");
    });

    it("should track previous state on change", () => {
      render(
        <ExecutionStateProvider manager={manager}>
          <TestComponent entityId="entity-1" />
        </ExecutionStateProvider>
      );

      act(() => {
        manager.setState("entity-1", "running");
      });

      expect(screen.getByTestId("previous-state")).toHaveTextContent("idle");

      act(() => {
        manager.setState("entity-1", "success");
      });

      expect(screen.getByTestId("previous-state")).toHaveTextContent("running");
    });

    it("should call onStateChange callback when state changes", () => {
      const onStateChange = vi.fn();

      render(
        <ExecutionStateProvider manager={manager}>
          <TestComponent entityId="entity-1" onStateChange={onStateChange} />
        </ExecutionStateProvider>
      );

      act(() => {
        manager.setState("entity-1", "running");
      });

      expect(onStateChange).toHaveBeenCalledWith("running", "idle");
    });

    it("should handle multiple state transitions", () => {
      const onStateChange = vi.fn();

      render(
        <ExecutionStateProvider manager={manager}>
          <TestComponent entityId="entity-1" onStateChange={onStateChange} />
        </ExecutionStateProvider>
      );

      act(() => {
        manager.setState("entity-1", "pending");
      });
      expect(screen.getByTestId("state")).toHaveTextContent("pending");

      act(() => {
        manager.setState("entity-1", "running");
      });
      expect(screen.getByTestId("state")).toHaveTextContent("running");

      act(() => {
        manager.setState("entity-1", "success");
      });
      expect(screen.getByTestId("state")).toHaveTextContent("success");

      expect(onStateChange).toHaveBeenCalledTimes(3);
    });
  });

  // ===========================================================================
  // Progress Subscription
  // ===========================================================================

  describe("progress subscription", () => {
    it("should update when manager progress changes", () => {
      render(
        <ExecutionStateProvider manager={manager}>
          <TestComponent entityId="entity-1" />
        </ExecutionStateProvider>
      );

      expect(screen.getByTestId("progress")).toHaveTextContent("none");

      act(() => {
        manager.setProgress("entity-1", 50);
      });

      expect(screen.getByTestId("progress")).toHaveTextContent("50");
    });

    it("should call onProgressChange callback when progress changes", () => {
      const onProgressChange = vi.fn();

      render(
        <ExecutionStateProvider manager={manager}>
          <TestComponent entityId="entity-1" onProgressChange={onProgressChange} />
        </ExecutionStateProvider>
      );

      act(() => {
        manager.setProgress("entity-1", 75);
      });

      expect(onProgressChange).toHaveBeenCalledWith(75);
    });

    it("should not subscribe to progress when subscribeToProgress is false", () => {
      const onProgressChange = vi.fn();

      render(
        <ExecutionStateProvider manager={manager}>
          <TestComponent
            entityId="entity-1"
            onProgressChange={onProgressChange}
            subscribeToProgress={false}
          />
        </ExecutionStateProvider>
      );

      act(() => {
        manager.setProgress("entity-1", 50);
      });

      expect(onProgressChange).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Derived State Flags
  // ===========================================================================

  describe("derived state flags", () => {
    it("should set isExecuting true for running state", () => {
      render(
        <ExecutionStateProvider manager={manager}>
          <TestComponent entityId="entity-1" />
        </ExecutionStateProvider>
      );

      act(() => {
        manager.setState("entity-1", "running");
      });

      expect(screen.getByTestId("is-executing")).toHaveTextContent("true");
      expect(screen.getByTestId("is-idle")).toHaveTextContent("false");
    });

    it("should set isExecuting true for pending state", () => {
      render(
        <ExecutionStateProvider manager={manager}>
          <TestComponent entityId="entity-1" />
        </ExecutionStateProvider>
      );

      act(() => {
        manager.setState("entity-1", "pending");
      });

      expect(screen.getByTestId("is-executing")).toHaveTextContent("true");
    });

    it("should set isCompleted true for success state", () => {
      render(
        <ExecutionStateProvider manager={manager}>
          <TestComponent entityId="entity-1" />
        </ExecutionStateProvider>
      );

      act(() => {
        manager.setState("entity-1", "success");
      });

      expect(screen.getByTestId("is-completed")).toHaveTextContent("true");
      expect(screen.getByTestId("is-success")).toHaveTextContent("true");
    });

    it("should set isCompleted true for error state", () => {
      render(
        <ExecutionStateProvider manager={manager}>
          <TestComponent entityId="entity-1" />
        </ExecutionStateProvider>
      );

      act(() => {
        manager.setState("entity-1", "error");
      });

      expect(screen.getByTestId("is-completed")).toHaveTextContent("true");
      expect(screen.getByTestId("is-error")).toHaveTextContent("true");
    });

    it("should set isCompleted true for skipped state", () => {
      render(
        <ExecutionStateProvider manager={manager}>
          <TestComponent entityId="entity-1" />
        </ExecutionStateProvider>
      );

      act(() => {
        manager.setState("entity-1", "skipped");
      });

      expect(screen.getByTestId("is-completed")).toHaveTextContent("true");
    });

    it("should set isCompleted true for cancelled state", () => {
      render(
        <ExecutionStateProvider manager={manager}>
          <TestComponent entityId="entity-1" />
        </ExecutionStateProvider>
      );

      act(() => {
        manager.setState("entity-1", "cancelled");
      });

      expect(screen.getByTestId("is-completed")).toHaveTextContent("true");
    });
  });

  // ===========================================================================
  // Actions
  // ===========================================================================

  describe("actions", () => {
    it("should set state through setState action", () => {
      render(
        <ExecutionStateProvider manager={manager}>
          <TestComponent entityId="entity-1" />
        </ExecutionStateProvider>
      );

      act(() => {
        screen.getByTestId("set-running").click();
      });

      expect(screen.getByTestId("state")).toHaveTextContent("running");
      expect(manager.getState("entity-1")).toBe("running");
    });

    it("should set progress through setProgress action", () => {
      render(
        <ExecutionStateProvider manager={manager}>
          <TestComponent entityId="entity-1" />
        </ExecutionStateProvider>
      );

      act(() => {
        screen.getByTestId("set-progress").click();
      });

      expect(screen.getByTestId("progress")).toHaveTextContent("50");
      expect(manager.getProgress("entity-1")).toBe(50);
    });

    it("should reset state through reset action", () => {
      manager.setState("entity-1", "running");
      manager.setProgress("entity-1", 75);

      render(
        <ExecutionStateProvider manager={manager}>
          <TestComponent entityId="entity-1" />
        </ExecutionStateProvider>
      );

      expect(screen.getByTestId("state")).toHaveTextContent("running");

      act(() => {
        screen.getByTestId("reset").click();
      });

      expect(screen.getByTestId("state")).toHaveTextContent("idle");
    });
  });

  // ===========================================================================
  // Entity ID Changes
  // ===========================================================================

  describe("entity ID changes", () => {
    it("should resubscribe when entityId changes", () => {
      manager.setState("entity-1", "running");
      manager.setState("entity-2", "success");

      const { rerender } = render(
        <ExecutionStateProvider manager={manager}>
          <TestComponent entityId="entity-1" />
        </ExecutionStateProvider>
      );

      expect(screen.getByTestId("state")).toHaveTextContent("running");

      rerender(
        <ExecutionStateProvider manager={manager}>
          <TestComponent entityId="entity-2" />
        </ExecutionStateProvider>
      );

      expect(screen.getByTestId("state")).toHaveTextContent("success");
    });
  });

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  describe("cleanup", () => {
    it("should unsubscribe on unmount", () => {
      const onStateChange = vi.fn();

      const { unmount } = render(
        <ExecutionStateProvider manager={manager}>
          <TestComponent entityId="entity-1" onStateChange={onStateChange} />
        </ExecutionStateProvider>
      );

      unmount();

      // Changes after unmount should not trigger callback
      act(() => {
        manager.setState("entity-1", "running");
      });

      expect(onStateChange).not.toHaveBeenCalled();
    });
  });
});

// =============================================================================
// useExecutionStateValue Tests
// =============================================================================

describe("useExecutionStateValue", () => {
  let manager: ExecutionStateManager;

  beforeEach(() => {
    manager = new ExecutionStateManager();
  });

  afterEach(() => {
    cleanup();
    manager.dispose();
  });

  it("should return current state", () => {
    manager.setState("entity-1", "running");

    const { result } = renderHook(() => useExecutionStateValue("entity-1"), {
      wrapper: createWrapper(manager),
    });

    expect(result.current).toBe("running");
  });

  it("should update when state changes", () => {
    const { result } = renderHook(() => useExecutionStateValue("entity-1"), {
      wrapper: createWrapper(manager),
    });

    expect(result.current).toBe("idle");

    act(() => {
      manager.setState("entity-1", "success");
    });

    expect(result.current).toBe("success");
  });
});

// =============================================================================
// useExecutionStateWithProgress Tests
// =============================================================================

describe("useExecutionStateWithProgress", () => {
  let manager: ExecutionStateManager;

  beforeEach(() => {
    manager = new ExecutionStateManager();
  });

  afterEach(() => {
    cleanup();
    manager.dispose();
  });

  it("should return state and progress tuple", () => {
    manager.setState("entity-1", "running");
    manager.setProgress("entity-1", 50);

    const { result } = renderHook(() => useExecutionStateWithProgress("entity-1"), {
      wrapper: createWrapper(manager),
    });

    expect(result.current[0]).toBe("running");
    expect(result.current[1]).toBe(50);
  });

  it("should update both values when they change", () => {
    const { result } = renderHook(() => useExecutionStateWithProgress("entity-1"), {
      wrapper: createWrapper(manager),
    });

    expect(result.current[0]).toBe("idle");
    expect(result.current[1]).toBeUndefined();

    act(() => {
      manager.setState("entity-1", "running");
      manager.setProgress("entity-1", 25);
    });

    expect(result.current[0]).toBe("running");
    expect(result.current[1]).toBe(25);
  });
});

// =============================================================================
// useIsExecutionState Tests
// =============================================================================

describe("useIsExecutionState", () => {
  let manager: ExecutionStateManager;

  beforeEach(() => {
    manager = new ExecutionStateManager();
  });

  afterEach(() => {
    cleanup();
    manager.dispose();
  });

  it("should return true when state matches", () => {
    manager.setState("entity-1", "running");

    const { result } = renderHook(() => useIsExecutionState("entity-1", "running"), {
      wrapper: createWrapper(manager),
    });

    expect(result.current).toBe(true);
  });

  it("should return false when state does not match", () => {
    manager.setState("entity-1", "running");

    const { result } = renderHook(() => useIsExecutionState("entity-1", "success"), {
      wrapper: createWrapper(manager),
    });

    expect(result.current).toBe(false);
  });

  it("should update when state changes", () => {
    const { result } = renderHook(() => useIsExecutionState("entity-1", "running"), {
      wrapper: createWrapper(manager),
    });

    expect(result.current).toBe(false);

    act(() => {
      manager.setState("entity-1", "running");
    });

    expect(result.current).toBe(true);

    act(() => {
      manager.setState("entity-1", "success");
    });

    expect(result.current).toBe(false);
  });
});

// =============================================================================
// createUseExecutionState Tests
// =============================================================================

describe("createUseExecutionState", () => {
  let manager: ExecutionStateManager;

  beforeEach(() => {
    manager = new ExecutionStateManager();
  });

  afterEach(() => {
    cleanup();
    manager.dispose();
  });

  it("should create a hook with default options", () => {
    const onStateChange = vi.fn();
    const useLoggedExecutionState = createUseExecutionState({
      onStateChange,
    });

    const { result } = renderHook(() => useLoggedExecutionState({ entityId: "entity-1" }), {
      wrapper: createWrapper(manager),
    });

    expect(result.current.state).toBe("idle");

    act(() => {
      manager.setState("entity-1", "running");
    });

    expect(onStateChange).toHaveBeenCalledWith("running", "idle");
  });

  it("should allow overriding default options", () => {
    const defaultOnStateChange = vi.fn();
    const overrideOnStateChange = vi.fn();

    const useCustomExecutionState = createUseExecutionState({
      onStateChange: defaultOnStateChange,
    });

    const { result } = renderHook(
      () =>
        useCustomExecutionState({
          entityId: "entity-1",
          onStateChange: overrideOnStateChange,
        }),
      {
        wrapper: createWrapper(manager),
      }
    );

    expect(result.current.state).toBe("idle");

    act(() => {
      manager.setState("entity-1", "running");
    });

    // Override takes precedence
    expect(overrideOnStateChange).toHaveBeenCalledWith("running", "idle");
    expect(defaultOnStateChange).not.toHaveBeenCalled();
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe("useExecutionState Integration", () => {
  let manager: ExecutionStateManager;

  beforeEach(() => {
    manager = new ExecutionStateManager();
  });

  afterEach(() => {
    cleanup();
    manager.dispose();
  });

  it("should handle complete execution lifecycle", () => {
    const stateHistory: ExecutionState[] = [];

    render(
      <ExecutionStateProvider manager={manager}>
        <TestComponent entityId="entity-1" onStateChange={(state) => stateHistory.push(state)} />
      </ExecutionStateProvider>
    );

    // Start execution
    act(() => {
      manager.setState("entity-1", "pending");
    });
    expect(screen.getByTestId("state")).toHaveTextContent("pending");
    expect(screen.getByTestId("is-executing")).toHaveTextContent("true");

    // Running with progress
    act(() => {
      manager.setState("entity-1", "running");
      manager.setProgress("entity-1", 0);
    });
    expect(screen.getByTestId("state")).toHaveTextContent("running");
    expect(screen.getByTestId("progress")).toHaveTextContent("0");

    // Progress updates
    act(() => {
      manager.setProgress("entity-1", 50);
    });
    expect(screen.getByTestId("progress")).toHaveTextContent("50");

    act(() => {
      manager.setProgress("entity-1", 100);
    });
    expect(screen.getByTestId("progress")).toHaveTextContent("100");

    // Complete
    act(() => {
      manager.setState("entity-1", "success");
    });
    expect(screen.getByTestId("state")).toHaveTextContent("success");
    expect(screen.getByTestId("is-completed")).toHaveTextContent("true");
    expect(screen.getByTestId("is-success")).toHaveTextContent("true");
    expect(screen.getByTestId("is-executing")).toHaveTextContent("false");

    // Verify state history
    expect(stateHistory).toEqual(["pending", "running", "success"]);
  });

  it("should handle error state", () => {
    render(
      <ExecutionStateProvider manager={manager}>
        <TestComponent entityId="entity-1" />
      </ExecutionStateProvider>
    );

    act(() => {
      manager.setState("entity-1", "running");
    });

    act(() => {
      manager.setState("entity-1", "error", { errorMessage: "Something went wrong" });
    });

    expect(screen.getByTestId("state")).toHaveTextContent("error");
    expect(screen.getByTestId("is-error")).toHaveTextContent("true");
    expect(screen.getByTestId("is-completed")).toHaveTextContent("true");
  });

  it("should handle multiple entities independently", () => {
    function MultiEntityComponent() {
      const entity1 = useExecutionState({ entityId: "entity-1" });
      const entity2 = useExecutionState({ entityId: "entity-2" });

      return (
        <div>
          <span data-testid="entity-1-state">{entity1.state}</span>
          <span data-testid="entity-2-state">{entity2.state}</span>
        </div>
      );
    }

    render(
      <ExecutionStateProvider manager={manager}>
        <MultiEntityComponent />
      </ExecutionStateProvider>
    );

    expect(screen.getByTestId("entity-1-state")).toHaveTextContent("idle");
    expect(screen.getByTestId("entity-2-state")).toHaveTextContent("idle");

    act(() => {
      manager.setState("entity-1", "running");
    });

    expect(screen.getByTestId("entity-1-state")).toHaveTextContent("running");
    expect(screen.getByTestId("entity-2-state")).toHaveTextContent("idle");

    act(() => {
      manager.setState("entity-2", "success");
    });

    expect(screen.getByTestId("entity-1-state")).toHaveTextContent("running");
    expect(screen.getByTestId("entity-2-state")).toHaveTextContent("success");
  });
});
