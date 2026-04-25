/**
 * @file FlowNodeProgress Tests
 * @description Unit tests for FlowNodeProgress component and related sub-components.
 * Tests rendering, position variants, progress width, indeterminate state, and accessibility.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 3.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import React from "react";
import {
  FlowNodeProgress,
  FlowNodeProgressTop,
  FlowNodeProgressBottom,
  FlowNodeProgressOverlay,
  getProgressClassName,
  shouldShowProgressForState,
  type FlowNodeProgressProps,
} from "../../../../src/components/flow-entity/node/FlowNodeProgress";
import { FlowEntityProvider } from "../../../../src/components/flow-entity/context";
import {
  ExecutionStateProvider,
  ExecutionStateManager,
} from "../../../../src/components/flow-entity/execution";
import type {
  ExecutionState,
  ProgressPosition,
} from "../../../../src/components/flow-entity/types";

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Renders a component with both FlowEntityProvider and ExecutionStateProvider
 */
function renderWithProviders(component: React.ReactElement, manager?: ExecutionStateManager) {
  const testManager = manager ?? new ExecutionStateManager();
  return {
    manager: testManager,
    ...render(
      <FlowEntityProvider>
        <ExecutionStateProvider manager={testManager}>{component}</ExecutionStateProvider>
      </FlowEntityProvider>
    ),
  };
}

/**
 * Get the progress bar element and extract its width
 */
function getProgressBarWidth(testId: string): string | null {
  const bar = screen.queryByTestId(`${testId}-bar`);
  return bar ? bar.style.width : null;
}

// =============================================================================
// FlowNodeProgress Tests
// =============================================================================

describe("FlowNodeProgress", () => {
  let manager: ExecutionStateManager;

  beforeEach(() => {
    manager = new ExecutionStateManager();
  });

  afterEach(() => {
    cleanup();
    manager.dispose();
  });

  describe("basic rendering", () => {
    it("renders without crashing when state is running", async () => {
      await act(async () => {
        manager.setState("node-1", "running");
      });
      const { container } = renderWithProviders(<FlowNodeProgress entityId="node-1" />, manager);
      expect(container.firstChild).toBeTruthy();
    });

    it("does not render when state is idle", () => {
      renderWithProviders(<FlowNodeProgress entityId="node-1" />, manager);
      expect(screen.queryByTestId("flow-node-progress-node-1")).not.toBeInTheDocument();
    });

    it("renders with correct default test id", async () => {
      await act(async () => {
        manager.setState("node-1", "running");
      });
      renderWithProviders(<FlowNodeProgress entityId="node-1" />, manager);
      expect(screen.getByTestId("flow-node-progress-node-1")).toBeInTheDocument();
    });

    it("renders with custom test id when provided", async () => {
      await act(async () => {
        manager.setState("node-1", "running");
      });
      renderWithProviders(
        <FlowNodeProgress entityId="node-1" data-testid="custom-progress" />,
        manager
      );
      expect(screen.getByTestId("custom-progress")).toBeInTheDocument();
    });

    it("has correct accessibility attributes", async () => {
      await act(async () => {
        manager.setState("node-1", "running");
        manager.setProgress("node-1", 50);
      });
      renderWithProviders(<FlowNodeProgress entityId="node-1" />, manager);
      const progress = screen.getByTestId("flow-node-progress-node-1");
      expect(progress).toHaveAttribute("role", "progressbar");
      expect(progress).toHaveAttribute("aria-valuemin", "0");
      expect(progress).toHaveAttribute("aria-valuemax", "100");
      expect(progress).toHaveAttribute("aria-valuenow", "50");
    });

    it("renders with custom className", async () => {
      await act(async () => {
        manager.setState("node-1", "running");
      });
      renderWithProviders(<FlowNodeProgress entityId="node-1" className="custom-class" />, manager);
      const progress = screen.getByTestId("flow-node-progress-node-1");
      expect(progress.className).toContain("custom-class");
    });

    it("renders track and bar elements", async () => {
      await act(async () => {
        manager.setState("node-1", "running");
      });
      renderWithProviders(<FlowNodeProgress entityId="node-1" />, manager);
      expect(screen.getByTestId("flow-node-progress-node-1-track")).toBeInTheDocument();
      expect(screen.getByTestId("flow-node-progress-node-1-bar")).toBeInTheDocument();
    });

    it("does not render outside ExecutionStateProvider", () => {
      render(
        <FlowEntityProvider>
          <FlowNodeProgress entityId="node-1" />
        </FlowEntityProvider>
      );
      expect(screen.queryByTestId("flow-node-progress-node-1")).not.toBeInTheDocument();
    });
  });

  describe("progress width", () => {
    it("sets bar width to 50% when progress is 50", async () => {
      await act(async () => {
        manager.setState("node-1", "running");
        manager.setProgress("node-1", 50);
      });
      renderWithProviders(<FlowNodeProgress entityId="node-1" />, manager);
      expect(getProgressBarWidth("flow-node-progress-node-1")).toBe("50%");
    });

    it("sets bar width to 0% when progress is 0", async () => {
      await act(async () => {
        manager.setState("node-1", "running");
        manager.setProgress("node-1", 0);
      });
      renderWithProviders(<FlowNodeProgress entityId="node-1" />, manager);
      expect(getProgressBarWidth("flow-node-progress-node-1")).toBe("0%");
    });

    it("sets bar width to 100% when progress is 100", async () => {
      await act(async () => {
        manager.setState("node-1", "running");
        manager.setProgress("node-1", 100);
      });
      renderWithProviders(<FlowNodeProgress entityId="node-1" />, manager);
      expect(getProgressBarWidth("flow-node-progress-node-1")).toBe("100%");
    });

    it("clamps bar width to 100% when progress exceeds 100", async () => {
      await act(async () => {
        manager.setState("node-1", "running");
        manager.setProgress("node-1", 150);
      });
      renderWithProviders(<FlowNodeProgress entityId="node-1" />, manager);
      expect(getProgressBarWidth("flow-node-progress-node-1")).toBe("100%");
    });

    it("shows 0% width when progress is set to negative (clamped by manager)", async () => {
      await act(async () => {
        manager.setState("node-1", "running");
        manager.setProgress("node-1", -10);
      });
      renderWithProviders(<FlowNodeProgress entityId="node-1" />, manager);
      // Negative progress is clamped to 0 by ExecutionStateManager
      expect(getProgressBarWidth("flow-node-progress-node-1")).toBe("0%");
    });

    it("updates bar width when progress changes", async () => {
      await act(async () => {
        manager.setState("node-1", "running");
        manager.setProgress("node-1", 25);
      });
      renderWithProviders(<FlowNodeProgress entityId="node-1" />, manager);
      expect(getProgressBarWidth("flow-node-progress-node-1")).toBe("25%");

      await act(async () => {
        manager.setProgress("node-1", 75);
      });
      expect(getProgressBarWidth("flow-node-progress-node-1")).toBe("75%");
    });
  });

  describe("position variants", () => {
    it("defaults to bottom position", async () => {
      await act(async () => {
        manager.setState("node-1", "running");
      });
      renderWithProviders(<FlowNodeProgress entityId="node-1" />, manager);
      const progress = screen.getByTestId("flow-node-progress-node-1");
      expect(progress).toHaveAttribute("data-position", "bottom");
      expect(progress.className).toContain("flow-node-progress--bottom");
    });

    it("applies top position", async () => {
      await act(async () => {
        manager.setState("node-1", "running");
      });
      renderWithProviders(<FlowNodeProgress entityId="node-1" position="top" />, manager);
      const progress = screen.getByTestId("flow-node-progress-node-1");
      expect(progress).toHaveAttribute("data-position", "top");
      expect(progress.className).toContain("flow-node-progress--top");
    });

    it("applies overlay position", async () => {
      await act(async () => {
        manager.setState("node-1", "running");
      });
      renderWithProviders(<FlowNodeProgress entityId="node-1" position="overlay" />, manager);
      const progress = screen.getByTestId("flow-node-progress-node-1");
      expect(progress).toHaveAttribute("data-position", "overlay");
      expect(progress.className).toContain("flow-node-progress--overlay");
    });
  });

  describe("indeterminate state", () => {
    it("shows indeterminate when progress is undefined", async () => {
      await act(async () => {
        manager.setState("node-1", "running");
        // Don't set progress
      });
      renderWithProviders(<FlowNodeProgress entityId="node-1" />, manager);
      const progress = screen.getByTestId("flow-node-progress-node-1");
      expect(progress).toHaveAttribute("data-indeterminate", "true");
      expect(progress.className).toContain("flow-node-progress--indeterminate");
    });

    it("shows 0% progress when progress set to negative (clamped by manager)", async () => {
      await act(async () => {
        manager.setState("node-1", "running");
        manager.setProgress("node-1", -1);
      });
      renderWithProviders(<FlowNodeProgress entityId="node-1" />, manager);
      // Negative values are clamped to 0 by ExecutionStateManager
      expect(getProgressBarWidth("flow-node-progress-node-1")).toBe("0%");
    });

    it("hides indeterminate when showIndeterminate is false", async () => {
      await act(async () => {
        manager.setState("node-1", "running");
      });
      renderWithProviders(
        <FlowNodeProgress entityId="node-1" showIndeterminate={false} />,
        manager
      );
      const progress = screen.getByTestId("flow-node-progress-node-1");
      expect(progress).not.toHaveAttribute("data-indeterminate");
    });

    it("does not show indeterminate when progress is set", async () => {
      await act(async () => {
        manager.setState("node-1", "running");
        manager.setProgress("node-1", 50);
      });
      renderWithProviders(<FlowNodeProgress entityId="node-1" />, manager);
      const progress = screen.getByTestId("flow-node-progress-node-1");
      expect(progress).not.toHaveAttribute("data-indeterminate");
    });

    it("has correct aria-label for indeterminate state", async () => {
      await act(async () => {
        manager.setState("node-1", "running");
      });
      renderWithProviders(<FlowNodeProgress entityId="node-1" />, manager);
      const progress = screen.getByTestId("flow-node-progress-node-1");
      expect(progress).toHaveAttribute("aria-label", "Execution progress: loading");
    });

    it("has correct aria-label for determinate state", async () => {
      await act(async () => {
        manager.setState("node-1", "running");
        manager.setProgress("node-1", 50);
      });
      renderWithProviders(<FlowNodeProgress entityId="node-1" />, manager);
      const progress = screen.getByTestId("flow-node-progress-node-1");
      expect(progress).toHaveAttribute("aria-label", "Execution progress: 50%");
    });
  });

  describe("state visibility", () => {
    it("shows progress for running state", async () => {
      await act(async () => {
        manager.setState("node-1", "running");
      });
      renderWithProviders(<FlowNodeProgress entityId="node-1" />, manager);
      expect(screen.getByTestId("flow-node-progress-node-1")).toBeInTheDocument();
    });

    it("shows progress for pending state", async () => {
      await act(async () => {
        manager.setState("node-1", "pending");
      });
      renderWithProviders(<FlowNodeProgress entityId="node-1" />, manager);
      expect(screen.getByTestId("flow-node-progress-node-1")).toBeInTheDocument();
    });

    it("hides progress for success state", async () => {
      await act(async () => {
        manager.setState("node-1", "success");
      });
      renderWithProviders(<FlowNodeProgress entityId="node-1" />, manager);
      expect(screen.queryByTestId("flow-node-progress-node-1")).not.toBeInTheDocument();
    });

    it("hides progress for error state", async () => {
      await act(async () => {
        manager.setState("node-1", "error");
      });
      renderWithProviders(<FlowNodeProgress entityId="node-1" />, manager);
      expect(screen.queryByTestId("flow-node-progress-node-1")).not.toBeInTheDocument();
    });

    it("hides progress for skipped state", async () => {
      await act(async () => {
        manager.setState("node-1", "skipped");
      });
      renderWithProviders(<FlowNodeProgress entityId="node-1" />, manager);
      expect(screen.queryByTestId("flow-node-progress-node-1")).not.toBeInTheDocument();
    });

    it("hides progress for cancelled state", async () => {
      await act(async () => {
        manager.setState("node-1", "cancelled");
      });
      renderWithProviders(<FlowNodeProgress entityId="node-1" />, manager);
      expect(screen.queryByTestId("flow-node-progress-node-1")).not.toBeInTheDocument();
    });
  });

  describe("custom colors", () => {
    it("applies custom color to progress bar", async () => {
      await act(async () => {
        manager.setState("node-1", "running");
        manager.setProgress("node-1", 50);
      });
      renderWithProviders(<FlowNodeProgress entityId="node-1" color="#22c55e" />, manager);
      const bar = screen.getByTestId("flow-node-progress-node-1-bar");
      expect(bar).toHaveStyle({ backgroundColor: "#22c55e" });
    });

    it("applies custom track color", async () => {
      await act(async () => {
        manager.setState("node-1", "running");
        manager.setProgress("node-1", 50);
      });
      renderWithProviders(<FlowNodeProgress entityId="node-1" trackColor="#dcfce7" />, manager);
      const track = screen.getByTestId("flow-node-progress-node-1-track");
      expect(track).toHaveStyle({ backgroundColor: "#dcfce7" });
    });
  });

  describe("custom height", () => {
    it("applies custom height via prop", async () => {
      await act(async () => {
        manager.setState("node-1", "running");
      });
      renderWithProviders(<FlowNodeProgress entityId="node-1" height={8} />, manager);
      const progress = screen.getByTestId("flow-node-progress-node-1");
      expect(progress).toHaveStyle({ height: "8px" });
    });

    it("defaults to 4px height", async () => {
      await act(async () => {
        manager.setState("node-1", "running");
      });
      renderWithProviders(<FlowNodeProgress entityId="node-1" />, manager);
      const progress = screen.getByTestId("flow-node-progress-node-1");
      expect(progress).toHaveStyle({ height: "4px" });
    });
  });

  describe("animations", () => {
    it("enables animations by default", async () => {
      await act(async () => {
        manager.setState("node-1", "running");
        manager.setProgress("node-1", 50);
      });
      renderWithProviders(<FlowNodeProgress entityId="node-1" />, manager);
      const bar = screen.getByTestId("flow-node-progress-node-1-bar");
      expect(bar.style.transition).toContain("width");
    });

    it("disables animations when enableAnimations is false", async () => {
      await act(async () => {
        manager.setState("node-1", "running");
        manager.setProgress("node-1", 50);
      });
      renderWithProviders(<FlowNodeProgress entityId="node-1" enableAnimations={false} />, manager);
      const bar = screen.getByTestId("flow-node-progress-node-1-bar");
      expect(bar).toHaveStyle({ transition: "none" });
    });
  });
});

// =============================================================================
// Convenience Component Tests
// =============================================================================

describe("FlowNodeProgressTop", () => {
  let manager: ExecutionStateManager;

  beforeEach(() => {
    manager = new ExecutionStateManager();
  });

  afterEach(() => {
    cleanup();
    manager.dispose();
  });

  it("renders with top position", async () => {
    await act(async () => {
      manager.setState("node-1", "running");
    });
    renderWithProviders(<FlowNodeProgressTop entityId="node-1" />, manager);
    const progress = screen.getByTestId("flow-node-progress-node-1");
    expect(progress).toHaveAttribute("data-position", "top");
  });
});

describe("FlowNodeProgressBottom", () => {
  let manager: ExecutionStateManager;

  beforeEach(() => {
    manager = new ExecutionStateManager();
  });

  afterEach(() => {
    cleanup();
    manager.dispose();
  });

  it("renders with bottom position", async () => {
    await act(async () => {
      manager.setState("node-1", "running");
    });
    renderWithProviders(<FlowNodeProgressBottom entityId="node-1" />, manager);
    const progress = screen.getByTestId("flow-node-progress-node-1");
    expect(progress).toHaveAttribute("data-position", "bottom");
  });
});

describe("FlowNodeProgressOverlay", () => {
  let manager: ExecutionStateManager;

  beforeEach(() => {
    manager = new ExecutionStateManager();
  });

  afterEach(() => {
    cleanup();
    manager.dispose();
  });

  it("renders with overlay position", async () => {
    await act(async () => {
      manager.setState("node-1", "running");
    });
    renderWithProviders(<FlowNodeProgressOverlay entityId="node-1" />, manager);
    const progress = screen.getByTestId("flow-node-progress-node-1");
    expect(progress).toHaveAttribute("data-position", "overlay");
  });
});

// =============================================================================
// Utility Function Tests
// =============================================================================

describe("getProgressClassName", () => {
  it("returns correct class for bottom position", () => {
    expect(getProgressClassName("bottom")).toBe("flow-node-progress flow-node-progress--bottom");
  });

  it("returns correct class for top position", () => {
    expect(getProgressClassName("top")).toBe("flow-node-progress flow-node-progress--top");
  });

  it("returns correct class for overlay position", () => {
    expect(getProgressClassName("overlay")).toBe("flow-node-progress flow-node-progress--overlay");
  });

  it("includes indeterminate class when specified", () => {
    expect(getProgressClassName("bottom", true)).toBe(
      "flow-node-progress flow-node-progress--bottom flow-node-progress--indeterminate"
    );
  });
});

describe("shouldShowProgressForState", () => {
  it("returns true for running state", () => {
    expect(shouldShowProgressForState("running")).toBe(true);
  });

  it("returns true for pending state", () => {
    expect(shouldShowProgressForState("pending")).toBe(true);
  });

  it("returns false for idle state", () => {
    expect(shouldShowProgressForState("idle")).toBe(false);
  });

  it("returns false for success state", () => {
    expect(shouldShowProgressForState("success")).toBe(false);
  });

  it("returns false for error state", () => {
    expect(shouldShowProgressForState("error")).toBe(false);
  });

  it("returns false for skipped state", () => {
    expect(shouldShowProgressForState("skipped")).toBe(false);
  });

  it("returns false for cancelled state", () => {
    expect(shouldShowProgressForState("cancelled")).toBe(false);
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe("FlowNodeProgress Integration", () => {
  let manager: ExecutionStateManager;

  beforeEach(() => {
    manager = new ExecutionStateManager();
  });

  afterEach(() => {
    cleanup();
    manager.dispose();
  });

  it("handles full execution lifecycle", async () => {
    renderWithProviders(<FlowNodeProgress entityId="node-1" />, manager);

    // Initial: no progress shown (idle state)
    expect(screen.queryByTestId("flow-node-progress-node-1")).not.toBeInTheDocument();

    // Start execution: progress appears
    await act(async () => {
      manager.setState("node-1", "running");
      manager.setProgress("node-1", 0);
    });
    expect(screen.getByTestId("flow-node-progress-node-1")).toBeInTheDocument();
    expect(getProgressBarWidth("flow-node-progress-node-1")).toBe("0%");

    // Progress updates
    await act(async () => {
      manager.setProgress("node-1", 33);
    });
    expect(getProgressBarWidth("flow-node-progress-node-1")).toBe("33%");

    await act(async () => {
      manager.setProgress("node-1", 66);
    });
    expect(getProgressBarWidth("flow-node-progress-node-1")).toBe("66%");

    await act(async () => {
      manager.setProgress("node-1", 100);
    });
    expect(getProgressBarWidth("flow-node-progress-node-1")).toBe("100%");

    // Complete: progress disappears
    await act(async () => {
      manager.setState("node-1", "success");
    });
    expect(screen.queryByTestId("flow-node-progress-node-1")).not.toBeInTheDocument();
  });

  it("handles multiple nodes independently", async () => {
    renderWithProviders(
      <>
        <FlowNodeProgress entityId="node-1" />
        <FlowNodeProgress entityId="node-2" />
      </>,
      manager
    );

    // Start node 1
    await act(async () => {
      manager.setState("node-1", "running");
      manager.setProgress("node-1", 25);
    });
    expect(screen.getByTestId("flow-node-progress-node-1")).toBeInTheDocument();
    expect(screen.queryByTestId("flow-node-progress-node-2")).not.toBeInTheDocument();
    expect(getProgressBarWidth("flow-node-progress-node-1")).toBe("25%");

    // Start node 2
    await act(async () => {
      manager.setState("node-2", "running");
      manager.setProgress("node-2", 75);
    });
    expect(screen.getByTestId("flow-node-progress-node-2")).toBeInTheDocument();
    expect(getProgressBarWidth("flow-node-progress-node-2")).toBe("75%");

    // Both progress independently
    expect(getProgressBarWidth("flow-node-progress-node-1")).toBe("25%");
    expect(getProgressBarWidth("flow-node-progress-node-2")).toBe("75%");

    // Complete node 1
    await act(async () => {
      manager.setState("node-1", "success");
    });
    expect(screen.queryByTestId("flow-node-progress-node-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("flow-node-progress-node-2")).toBeInTheDocument();
  });

  it("respects ExecutionVisualConfig from context", async () => {
    await act(async () => {
      manager.setState("node-1", "running");
    });

    const { container } = render(
      <FlowEntityProvider executionVisuals={{ progressPosition: "top", progressHeight: 6 }}>
        <ExecutionStateProvider manager={manager}>
          <FlowNodeProgress entityId="node-1" />
        </ExecutionStateProvider>
      </FlowEntityProvider>
    );

    const progress = screen.getByTestId("flow-node-progress-node-1");
    expect(progress).toHaveAttribute("data-position", "top");
    expect(progress).toHaveStyle({ height: "6px" });
  });

  it("prop overrides context config", async () => {
    await act(async () => {
      manager.setState("node-1", "running");
    });

    render(
      <FlowEntityProvider executionVisuals={{ progressPosition: "top" }}>
        <ExecutionStateProvider manager={manager}>
          <FlowNodeProgress entityId="node-1" position="bottom" />
        </ExecutionStateProvider>
      </FlowEntityProvider>
    );

    const progress = screen.getByTestId("flow-node-progress-node-1");
    expect(progress).toHaveAttribute("data-position", "bottom");
  });
});
