/**
 * @file Flow Execution Visualization Integration Tests
 * @description Integration tests verifying that after execution events fire,
 * node/edge states and animations work together correctly.
 *
 * This test suite validates:
 * - Node DOM elements have expected state classes
 * - Edge DOM elements have animation classes
 * - State transitions propagate correctly through the component tree
 * - Progress indicators update in sync with execution state
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 3.6
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup, within } from "@testing-library/react";
import React from "react";
import { FlowEntityProvider } from "../../../../src/components/flow-entity/context";
import {
  ExecutionStateProvider,
  ExecutionStateManager,
} from "../../../../src/components/flow-entity/execution";
import { FlowNodeStatus } from "../../../../src/components/flow-entity/node/FlowNodeStatus";
import { FlowNodeProgress } from "../../../../src/components/flow-entity/node/FlowNodeProgress";
import { EdgeAnimation } from "../../../../src/components/flow-entity/edge/EdgeAnimation";
import type {
  ExecutionState,
  EdgeAnimationState,
} from "../../../../src/components/flow-entity/types";

// =============================================================================
// Test Graph Components
// =============================================================================

/**
 * Test graph structure with 3 nodes and 2 edges:
 *
 *   [node-1] ---(edge-1-2)---> [node-2] ---(edge-2-3)---> [node-3]
 *
 * This represents a simple sequential execution flow.
 */
interface TestGraphProps {
  manager: ExecutionStateManager;
  showProgress?: boolean;
  edgeStates?: {
    "edge-1-2"?: EdgeAnimationState;
    "edge-2-3"?: EdgeAnimationState;
  };
}

/**
 * Test graph component that renders nodes with status and progress indicators,
 * and edges with animation overlays.
 */
const TestGraph: React.FC<TestGraphProps> = ({ manager, showProgress = true, edgeStates = {} }) => {
  // Simple SVG path for edges (horizontal line)
  const edgePath = "M 0 10 L 100 10";

  return (
    <FlowEntityProvider>
      <ExecutionStateProvider manager={manager}>
        <div data-testid="test-graph" style={{ position: "relative" }}>
          {/* Node 1 */}
          <div data-testid="node-1-container" className="flow-node">
            <FlowNodeStatus entityId="node-1" data-testid="node-1-status" />
            {showProgress && <FlowNodeProgress entityId="node-1" data-testid="node-1-progress" />}
          </div>

          {/* Edge 1-2 */}
          <svg data-testid="edge-1-2-container" width="100" height="20">
            <EdgeAnimation
              path={edgePath}
              state={edgeStates["edge-1-2"] ?? "idle"}
              data-testid="edge-1-2-animation"
            />
          </svg>

          {/* Node 2 */}
          <div data-testid="node-2-container" className="flow-node">
            <FlowNodeStatus entityId="node-2" data-testid="node-2-status" />
            {showProgress && <FlowNodeProgress entityId="node-2" data-testid="node-2-progress" />}
          </div>

          {/* Edge 2-3 */}
          <svg data-testid="edge-2-3-container" width="100" height="20">
            <EdgeAnimation
              path={edgePath}
              state={edgeStates["edge-2-3"] ?? "idle"}
              data-testid="edge-2-3-animation"
            />
          </svg>

          {/* Node 3 */}
          <div data-testid="node-3-container" className="flow-node">
            <FlowNodeStatus entityId="node-3" data-testid="node-3-status" />
            {showProgress && <FlowNodeProgress entityId="node-3" data-testid="node-3-progress" />}
          </div>
        </div>
      </ExecutionStateProvider>
    </FlowEntityProvider>
  );
};

/**
 * Dynamic test graph that can update edge states based on manager state
 */
interface DynamicTestGraphProps {
  manager: ExecutionStateManager;
}

const DynamicTestGraph: React.FC<DynamicTestGraphProps> = ({ manager }) => {
  const [edgeStates, setEdgeStates] = React.useState<{
    "edge-1-2": EdgeAnimationState;
    "edge-2-3": EdgeAnimationState;
  }>({
    "edge-1-2": "idle",
    "edge-2-3": "idle",
  });

  // Update edge states based on node states
  React.useEffect(() => {
    const updateEdgeStates = () => {
      const node1State = manager.getState("node-1");
      const node2State = manager.getState("node-2");

      // Edge 1-2 flows when node-1 is running or node-2 is pending
      let edge12State: EdgeAnimationState = "idle";
      if (node1State === "running") {
        edge12State = "flowing";
      } else if (node1State === "success") {
        edge12State = "success";
      } else if (node1State === "error") {
        edge12State = "error";
      }

      // Edge 2-3 flows when node-2 is running or node-3 is pending
      let edge23State: EdgeAnimationState = "idle";
      if (node2State === "running") {
        edge23State = "flowing";
      } else if (node2State === "success") {
        edge23State = "success";
      } else if (node2State === "error") {
        edge23State = "error";
      }

      setEdgeStates({
        "edge-1-2": edge12State,
        "edge-2-3": edge23State,
      });
    };

    // Subscribe to all node state changes
    const unsub1 = manager.subscribe("node-1", updateEdgeStates);
    const unsub2 = manager.subscribe("node-2", updateEdgeStates);
    const unsub3 = manager.subscribe("node-3", updateEdgeStates);

    // Initial update
    updateEdgeStates();

    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, [manager]);

  return <TestGraph manager={manager} edgeStates={edgeStates} />;
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the state from a status element's data attribute
 */
function getStatusState(testId: string): ExecutionState | null {
  const element = screen.queryByTestId(testId);
  return element?.getAttribute("data-state") as ExecutionState | null;
}

/**
 * Get the state from an animation element's data attribute
 */
function getAnimationState(testId: string): EdgeAnimationState | null {
  const element = screen.queryByTestId(testId);
  return element?.getAttribute("data-state") as EdgeAnimationState | null;
}

/**
 * Check if an element has a specific class
 */
function hasClass(testId: string, className: string): boolean {
  const element = screen.queryByTestId(testId);
  return element?.classList.contains(className) ?? false;
}

/**
 * Check if progress element is visible
 */
function isProgressVisible(testId: string): boolean {
  return screen.queryByTestId(testId) !== null;
}

/**
 * Get progress bar width percentage
 */
function getProgressWidth(testId: string): string | null {
  const bar = screen.queryByTestId(`${testId}-bar`);
  return bar?.style.width ?? null;
}

// =============================================================================
// Integration Tests
// =============================================================================

describe("Flow Execution Visualization Integration", () => {
  let manager: ExecutionStateManager;

  beforeEach(() => {
    manager = new ExecutionStateManager();
  });

  afterEach(() => {
    cleanup();
    manager.dispose();
  });

  // ===========================================================================
  // Basic State Propagation Tests
  // ===========================================================================

  describe("Node State Visualization", () => {
    it("should render all nodes with idle state initially", () => {
      render(<TestGraph manager={manager} />);

      // All nodes should start with idle state
      expect(getStatusState("node-1-status")).toBe("idle");
      expect(getStatusState("node-2-status")).toBe("idle");
      expect(getStatusState("node-3-status")).toBe("idle");

      // All should have idle class
      expect(hasClass("node-1-status", "flow-node-status--idle")).toBe(true);
      expect(hasClass("node-2-status", "flow-node-status--idle")).toBe(true);
      expect(hasClass("node-3-status", "flow-node-status--idle")).toBe(true);
    });

    it("should update node state classes when execution state changes", async () => {
      render(<TestGraph manager={manager} />);

      // Set node-1 to running
      await act(async () => {
        manager.setState("node-1", "running");
      });

      expect(getStatusState("node-1-status")).toBe("running");
      expect(hasClass("node-1-status", "flow-node-status--running")).toBe(true);
      expect(hasClass("node-1-status", "flow-node-status--idle")).toBe(false);

      // Other nodes remain idle
      expect(getStatusState("node-2-status")).toBe("idle");
      expect(getStatusState("node-3-status")).toBe("idle");
    });

    it("should update node state classes for all execution states", async () => {
      render(<TestGraph manager={manager} />);

      const states: ExecutionState[] = [
        "pending",
        "running",
        "success",
        "error",
        "skipped",
        "cancelled",
      ];

      for (const state of states) {
        await act(async () => {
          manager.setState("node-1", state);
        });

        expect(getStatusState("node-1-status")).toBe(state);
        expect(hasClass("node-1-status", `flow-node-status--${state}`)).toBe(true);
      }
    });
  });

  // ===========================================================================
  // Progress Indicator Tests
  // ===========================================================================

  describe("Progress Indicator Visualization", () => {
    it("should show progress indicator only during executing states", async () => {
      render(<TestGraph manager={manager} showProgress />);

      // Initially no progress visible (idle state)
      expect(isProgressVisible("node-1-progress")).toBe(false);

      // Start running - progress should appear
      await act(async () => {
        manager.setState("node-1", "running");
      });
      expect(isProgressVisible("node-1-progress")).toBe(true);

      // Complete - progress should disappear
      await act(async () => {
        manager.setState("node-1", "success");
      });
      expect(isProgressVisible("node-1-progress")).toBe(false);
    });

    it("should update progress bar width as progress changes", async () => {
      render(<TestGraph manager={manager} showProgress />);

      // Start running
      await act(async () => {
        manager.setState("node-1", "running");
        manager.setProgress("node-1", 0);
      });

      expect(getProgressWidth("node-1-progress")).toBe("0%");

      // Update progress
      await act(async () => {
        manager.setProgress("node-1", 25);
      });
      expect(getProgressWidth("node-1-progress")).toBe("25%");

      await act(async () => {
        manager.setProgress("node-1", 50);
      });
      expect(getProgressWidth("node-1-progress")).toBe("50%");

      await act(async () => {
        manager.setProgress("node-1", 75);
      });
      expect(getProgressWidth("node-1-progress")).toBe("75%");

      await act(async () => {
        manager.setProgress("node-1", 100);
      });
      expect(getProgressWidth("node-1-progress")).toBe("100%");
    });

    it("should show indeterminate progress when progress is undefined", async () => {
      render(<TestGraph manager={manager} showProgress />);

      // Start running without setting progress
      await act(async () => {
        manager.setState("node-1", "running");
      });

      const progress = screen.getByTestId("node-1-progress");
      expect(progress).toHaveAttribute("data-indeterminate", "true");
      expect(hasClass("node-1-progress", "flow-node-progress--indeterminate")).toBe(true);
    });
  });

  // ===========================================================================
  // Edge Animation Tests
  // ===========================================================================

  describe("Edge Animation Visualization", () => {
    it("should render edges with idle state initially", () => {
      render(<TestGraph manager={manager} />);

      expect(getAnimationState("edge-1-2-animation")).toBe("idle");
      expect(getAnimationState("edge-2-3-animation")).toBe("idle");
    });

    it("should show flowing animation class when edge is in flowing state", () => {
      render(
        <TestGraph manager={manager} edgeStates={{ "edge-1-2": "flowing", "edge-2-3": "idle" }} />
      );

      expect(getAnimationState("edge-1-2-animation")).toBe("flowing");
      expect(hasClass("edge-1-2-animation", "flow-edge-animation--flowing")).toBe(true);
      expect(hasClass("edge-1-2-animation", "flow-edge-animation--animating")).toBe(true);

      expect(getAnimationState("edge-2-3-animation")).toBe("idle");
      expect(hasClass("edge-2-3-animation", "flow-edge-animation--idle")).toBe(true);
    });

    it("should show success animation class when edge completes", () => {
      render(
        <TestGraph manager={manager} edgeStates={{ "edge-1-2": "success", "edge-2-3": "idle" }} />
      );

      expect(getAnimationState("edge-1-2-animation")).toBe("success");
      expect(hasClass("edge-1-2-animation", "flow-edge-animation--success")).toBe(true);
    });

    it("should show error animation class when edge fails", () => {
      render(
        <TestGraph manager={manager} edgeStates={{ "edge-1-2": "error", "edge-2-3": "idle" }} />
      );

      expect(getAnimationState("edge-1-2-animation")).toBe("error");
      expect(hasClass("edge-1-2-animation", "flow-edge-animation--error")).toBe(true);
    });

    it("should show highlight animation class when edge is highlighted", () => {
      render(
        <TestGraph manager={manager} edgeStates={{ "edge-1-2": "highlight", "edge-2-3": "idle" }} />
      );

      expect(getAnimationState("edge-1-2-animation")).toBe("highlight");
      expect(hasClass("edge-1-2-animation", "flow-edge-animation--highlight")).toBe(true);
    });
  });

  // ===========================================================================
  // Sequential Execution Flow Tests
  // ===========================================================================

  describe("Sequential Execution Flow", () => {
    it("should visualize a complete sequential execution flow", async () => {
      render(<DynamicTestGraph manager={manager} />);

      // Initial state - all idle
      expect(getStatusState("node-1-status")).toBe("idle");
      expect(getStatusState("node-2-status")).toBe("idle");
      expect(getStatusState("node-3-status")).toBe("idle");

      // Step 1: Node 1 starts running
      await act(async () => {
        manager.setState("node-1", "running");
        manager.setProgress("node-1", 0);
      });

      expect(getStatusState("node-1-status")).toBe("running");
      expect(getAnimationState("edge-1-2-animation")).toBe("flowing");
      expect(isProgressVisible("node-1-progress")).toBe(true);

      // Step 2: Node 1 progress updates
      await act(async () => {
        manager.setProgress("node-1", 50);
      });
      expect(getProgressWidth("node-1-progress")).toBe("50%");

      // Step 3: Node 1 completes, Node 2 starts
      await act(async () => {
        manager.setState("node-1", "success");
        manager.setState("node-2", "running");
        manager.setProgress("node-2", 0);
      });

      expect(getStatusState("node-1-status")).toBe("success");
      expect(hasClass("node-1-status", "flow-node-status--success")).toBe(true);
      expect(getAnimationState("edge-1-2-animation")).toBe("success");
      expect(getStatusState("node-2-status")).toBe("running");
      expect(getAnimationState("edge-2-3-animation")).toBe("flowing");
      expect(isProgressVisible("node-1-progress")).toBe(false);
      expect(isProgressVisible("node-2-progress")).toBe(true);

      // Step 4: Node 2 completes, Node 3 starts
      await act(async () => {
        manager.setState("node-2", "success");
        manager.setState("node-3", "running");
        manager.setProgress("node-3", 0);
      });

      expect(getStatusState("node-2-status")).toBe("success");
      expect(getAnimationState("edge-2-3-animation")).toBe("success");
      expect(getStatusState("node-3-status")).toBe("running");

      // Step 5: Node 3 completes - all done
      await act(async () => {
        manager.setState("node-3", "success");
      });

      expect(getStatusState("node-1-status")).toBe("success");
      expect(getStatusState("node-2-status")).toBe("success");
      expect(getStatusState("node-3-status")).toBe("success");
      expect(isProgressVisible("node-3-progress")).toBe(false);
    });

    it("should visualize error propagation in execution flow", async () => {
      render(<DynamicTestGraph manager={manager} />);

      // Node 1 starts running
      await act(async () => {
        manager.setState("node-1", "running");
      });

      expect(getStatusState("node-1-status")).toBe("running");
      expect(getAnimationState("edge-1-2-animation")).toBe("flowing");

      // Node 1 fails
      await act(async () => {
        manager.setState("node-1", "error");
      });

      expect(getStatusState("node-1-status")).toBe("error");
      expect(hasClass("node-1-status", "flow-node-status--error")).toBe(true);
      expect(getAnimationState("edge-1-2-animation")).toBe("error");

      // Downstream nodes remain idle
      expect(getStatusState("node-2-status")).toBe("idle");
      expect(getStatusState("node-3-status")).toBe("idle");
    });
  });

  // ===========================================================================
  // Multiple Node Concurrent Execution Tests
  // ===========================================================================

  describe("Concurrent Node Execution", () => {
    it("should handle multiple nodes running simultaneously", async () => {
      render(<TestGraph manager={manager} />);

      // Start multiple nodes at once
      await act(async () => {
        manager.setState("node-1", "running");
        manager.setState("node-2", "running");
        manager.setProgress("node-1", 30);
        manager.setProgress("node-2", 60);
      });

      // Both should show running state
      expect(getStatusState("node-1-status")).toBe("running");
      expect(getStatusState("node-2-status")).toBe("running");
      expect(hasClass("node-1-status", "flow-node-status--running")).toBe(true);
      expect(hasClass("node-2-status", "flow-node-status--running")).toBe(true);

      // Both should have progress visible
      expect(isProgressVisible("node-1-progress")).toBe(true);
      expect(isProgressVisible("node-2-progress")).toBe(true);

      // Progress should be independent
      expect(getProgressWidth("node-1-progress")).toBe("30%");
      expect(getProgressWidth("node-2-progress")).toBe("60%");

      // Node 3 remains idle
      expect(getStatusState("node-3-status")).toBe("idle");
    });

    it("should handle mixed completion states", async () => {
      render(<TestGraph manager={manager} />);

      // Set different states for each node
      await act(async () => {
        manager.setState("node-1", "success");
        manager.setState("node-2", "error");
        manager.setState("node-3", "skipped");
      });

      expect(getStatusState("node-1-status")).toBe("success");
      expect(getStatusState("node-2-status")).toBe("error");
      expect(getStatusState("node-3-status")).toBe("skipped");

      expect(hasClass("node-1-status", "flow-node-status--success")).toBe(true);
      expect(hasClass("node-2-status", "flow-node-status--error")).toBe(true);
      expect(hasClass("node-3-status", "flow-node-status--skipped")).toBe(true);
    });
  });

  // ===========================================================================
  // State Transition Stability Tests
  // ===========================================================================

  describe("State Transition Stability", () => {
    it("should handle rapid state transitions without visual glitches", async () => {
      render(<TestGraph manager={manager} />);

      // Rapid state changes
      const transitions: ExecutionState[] = ["pending", "running", "running", "running", "success"];

      for (const state of transitions) {
        await act(async () => {
          manager.setState("node-1", state);
        });
      }

      // Final state should be stable
      expect(getStatusState("node-1-status")).toBe("success");
      expect(hasClass("node-1-status", "flow-node-status--success")).toBe(true);
    });

    it("should handle rapid progress updates smoothly", async () => {
      render(<TestGraph manager={manager} />);

      // Start running
      await act(async () => {
        manager.setState("node-1", "running");
      });

      // Rapid progress updates
      for (let i = 0; i <= 100; i += 10) {
        await act(async () => {
          manager.setProgress("node-1", i);
        });
      }

      // Final progress should be 100%
      expect(getProgressWidth("node-1-progress")).toBe("100%");
    });

    it("should maintain consistent state across multiple re-renders", async () => {
      const { rerender } = render(<TestGraph manager={manager} />);

      // Set initial state
      await act(async () => {
        manager.setState("node-1", "running");
        manager.setProgress("node-1", 50);
      });

      // Multiple re-renders
      for (let i = 0; i < 5; i++) {
        rerender(<TestGraph manager={manager} />);
      }

      // State should remain consistent
      expect(getStatusState("node-1-status")).toBe("running");
      expect(getProgressWidth("node-1-progress")).toBe("50%");
    });
  });

  // ===========================================================================
  // Edge Cases and Error Handling
  // ===========================================================================

  describe("Edge Cases", () => {
    it("should handle state change after component unmount gracefully", async () => {
      const { unmount } = render(<TestGraph manager={manager} />);

      // Set state
      await act(async () => {
        manager.setState("node-1", "running");
      });

      // Unmount
      unmount();

      // State change after unmount should not throw
      await act(async () => {
        expect(() => manager.setState("node-1", "success")).not.toThrow();
      });
    });

    it("should handle missing node gracefully", () => {
      render(<TestGraph manager={manager} />);

      // Query for non-existent node should return null
      expect(screen.queryByTestId("node-99-status")).toBeNull();

      // Getting state for non-existent node should return default
      expect(manager.getState("node-99")).toBe("idle");
    });

    it("should handle edge state changes independently of nodes", () => {
      const edgeStates = {
        "edge-1-2": "flowing" as EdgeAnimationState,
        "edge-2-3": "success" as EdgeAnimationState,
      };

      render(<TestGraph manager={manager} edgeStates={edgeStates} />);

      // Edges should have their states regardless of node states
      expect(getAnimationState("edge-1-2-animation")).toBe("flowing");
      expect(getAnimationState("edge-2-3-animation")).toBe("success");

      // Node states should still be idle
      expect(getStatusState("node-1-status")).toBe("idle");
      expect(getStatusState("node-2-status")).toBe("idle");
    });
  });

  // ===========================================================================
  // Accessibility Tests
  // ===========================================================================

  describe("Accessibility", () => {
    it("should have accessible status indicators", async () => {
      render(<TestGraph manager={manager} />);

      const status = screen.getByTestId("node-1-status");
      expect(status).toHaveAttribute("role", "status");
      expect(status).toHaveAttribute("aria-label");

      await act(async () => {
        manager.setState("node-1", "running");
      });

      expect(status).toHaveAttribute("aria-label", "Execution state: Running");
    });

    it("should have accessible progress indicators", async () => {
      render(<TestGraph manager={manager} />);

      await act(async () => {
        manager.setState("node-1", "running");
        manager.setProgress("node-1", 50);
      });

      const progress = screen.getByTestId("node-1-progress");
      expect(progress).toHaveAttribute("role", "progressbar");
      expect(progress).toHaveAttribute("aria-valuemin", "0");
      expect(progress).toHaveAttribute("aria-valuemax", "100");
      expect(progress).toHaveAttribute("aria-valuenow", "50");
    });
  });
});

// =============================================================================
// Flakiness Prevention Tests
// =============================================================================

describe("Test Stability Verification", () => {
  let manager: ExecutionStateManager;

  beforeEach(() => {
    manager = new ExecutionStateManager();
  });

  afterEach(() => {
    cleanup();
    manager.dispose();
  });

  it("should produce consistent results across multiple runs (run 1)", async () => {
    render(<TestGraph manager={manager} />);

    await act(async () => {
      manager.setState("node-1", "running");
      manager.setProgress("node-1", 50);
    });

    expect(getStatusState("node-1-status")).toBe("running");
    expect(getProgressWidth("node-1-progress")).toBe("50%");
  });

  it("should produce consistent results across multiple runs (run 2)", async () => {
    render(<TestGraph manager={manager} />);

    await act(async () => {
      manager.setState("node-1", "running");
      manager.setProgress("node-1", 50);
    });

    expect(getStatusState("node-1-status")).toBe("running");
    expect(getProgressWidth("node-1-progress")).toBe("50%");
  });

  it("should produce consistent results across multiple runs (run 3)", async () => {
    render(<TestGraph manager={manager} />);

    await act(async () => {
      manager.setState("node-1", "running");
      manager.setProgress("node-1", 50);
    });

    expect(getStatusState("node-1-status")).toBe("running");
    expect(getProgressWidth("node-1-progress")).toBe("50%");
  });
});
