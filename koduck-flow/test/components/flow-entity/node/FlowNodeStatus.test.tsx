/**
 * @file FlowNodeStatus Tests
 * @description Unit tests for FlowNodeStatus component and related sub-components.
 * Tests rendering, state visualization, animations, progress display, and callbacks.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 3.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import React from "react";
import {
  FlowNodeStatus,
  FlowNodeStatusDot,
  FlowNodeStatusBadge,
  type FlowNodeStatusProps,
} from "../../../../src/components/flow-entity/node/FlowNodeStatus";
import { FlowEntityProvider } from "../../../../src/components/flow-entity/context";
import {
  ExecutionStateProvider,
  ExecutionStateManager,
} from "../../../../src/components/flow-entity/execution";
import type { ExecutionState } from "../../../../src/components/flow-entity/types";

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

// =============================================================================
// FlowNodeStatus Tests
// =============================================================================

describe("FlowNodeStatus", () => {
  let manager: ExecutionStateManager;

  beforeEach(() => {
    manager = new ExecutionStateManager();
  });

  afterEach(() => {
    cleanup();
    manager.dispose();
  });

  describe("basic rendering", () => {
    it("renders without crashing", () => {
      const { container } = renderWithProviders(<FlowNodeStatus entityId="node-1" />, manager);
      expect(container.firstChild).toBeTruthy();
    });

    it("renders with correct default test id", () => {
      renderWithProviders(<FlowNodeStatus entityId="node-1" />, manager);
      expect(screen.getByTestId("flow-node-status-node-1")).toBeInTheDocument();
    });

    it("renders with custom test id when provided", () => {
      renderWithProviders(
        <FlowNodeStatus entityId="node-1" data-testid="custom-status" />,
        manager
      );
      expect(screen.getByTestId("custom-status")).toBeInTheDocument();
    });

    it("has correct accessibility attributes", () => {
      renderWithProviders(<FlowNodeStatus entityId="node-1" />, manager);
      const status = screen.getByTestId("flow-node-status-node-1");
      expect(status).toHaveAttribute("role", "status");
      expect(status).toHaveAttribute("aria-label", "Execution state: Idle");
    });

    it("renders with custom className", () => {
      renderWithProviders(<FlowNodeStatus entityId="node-1" className="custom-class" />, manager);
      const status = screen.getByTestId("flow-node-status-node-1");
      expect(status.className).toContain("custom-class");
    });

    it("applies custom styles", () => {
      renderWithProviders(<FlowNodeStatus entityId="node-1" style={{ marginTop: 10 }} />, manager);
      const status = screen.getByTestId("flow-node-status-node-1");
      expect(status).toHaveStyle({ marginTop: "10px" });
    });
  });

  describe("state visualization", () => {
    it("shows idle state by default", () => {
      renderWithProviders(<FlowNodeStatus entityId="node-1" />, manager);
      const status = screen.getByTestId("flow-node-status-node-1");
      expect(status).toHaveAttribute("data-state", "idle");
      expect(status.className).toContain("flow-node-status--idle");
    });

    it("updates CSS class based on state", async () => {
      renderWithProviders(<FlowNodeStatus entityId="node-1" />, manager);
      const status = screen.getByTestId("flow-node-status-node-1");
      expect(status.className).toContain("flow-node-status--idle");

      // Change state to running
      await act(async () => {
        manager.setState("node-1", "running");
      });

      expect(status).toHaveAttribute("data-state", "running");
      expect(status.className).toContain("flow-node-status--running");
    });

    it("updates aria-label based on state", async () => {
      renderWithProviders(<FlowNodeStatus entityId="node-1" />, manager);
      const status = screen.getByTestId("flow-node-status-node-1");
      expect(status).toHaveAttribute("aria-label", "Execution state: Idle");

      await act(async () => {
        manager.setState("node-1", "success");
      });

      expect(status).toHaveAttribute("aria-label", "Execution state: Success");
    });
  });

  describe("label display", () => {
    it("does not show label by default", () => {
      renderWithProviders(<FlowNodeStatus entityId="node-1" />, manager);
      expect(screen.queryByText("Idle")).not.toBeInTheDocument();
    });

    it("shows label when showLabel is true", () => {
      renderWithProviders(<FlowNodeStatus entityId="node-1" showLabel />, manager);
      expect(screen.getByText("Idle")).toBeInTheDocument();
    });

    it("updates label when state changes", async () => {
      renderWithProviders(<FlowNodeStatus entityId="node-1" showLabel />, manager);
      expect(screen.getByText("Idle")).toBeInTheDocument();

      await act(async () => {
        manager.setState("node-1", "running");
      });

      expect(screen.getByText("Running")).toBeInTheDocument();
    });
  });

  describe("progress display", () => {
    it("shows progress bar for running state", async () => {
      renderWithProviders(<FlowNodeStatus entityId="node-1" showProgress />, manager);

      // Initially no progress bar for idle state
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

      await act(async () => {
        manager.setState("node-1", "running");
        manager.setProgress("node-1", 50);
      });

      // Progress bar should appear for running state
      const progressBar = screen.getByRole("progressbar");
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveAttribute("aria-valuenow", "50");
    });

    it("hides progress bar when showProgress is false", async () => {
      renderWithProviders(<FlowNodeStatus entityId="node-1" showProgress={false} />, manager);

      await act(async () => {
        manager.setState("node-1", "running");
        manager.setProgress("node-1", 50);
      });

      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });
  });

  describe("size options", () => {
    it("renders small size correctly", () => {
      renderWithProviders(<FlowNodeStatus entityId="node-1" size="small" />, manager);
      const indicator = screen.getByTestId("flow-node-status-node-1").querySelector("span");
      expect(indicator).toHaveStyle({ width: "8px", height: "8px" });
    });

    it("renders medium size correctly", () => {
      renderWithProviders(<FlowNodeStatus entityId="node-1" size="medium" />, manager);
      const indicator = screen.getByTestId("flow-node-status-node-1").querySelector("span");
      expect(indicator).toHaveStyle({ width: "12px", height: "12px" });
    });

    it("renders large size correctly", () => {
      renderWithProviders(<FlowNodeStatus entityId="node-1" size="large" />, manager);
      const indicator = screen.getByTestId("flow-node-status-node-1").querySelector("span");
      expect(indicator).toHaveStyle({ width: "16px", height: "16px" });
    });

    it("renders custom numeric size correctly", () => {
      renderWithProviders(<FlowNodeStatus entityId="node-1" size={24} />, manager);
      const indicator = screen.getByTestId("flow-node-status-node-1").querySelector("span");
      expect(indicator).toHaveStyle({ width: "24px", height: "24px" });
    });
  });

  describe("click handling", () => {
    it("calls onClick when clicked", () => {
      const handleClick = vi.fn();
      renderWithProviders(<FlowNodeStatus entityId="node-1" onClick={handleClick} />, manager);

      fireEvent.click(screen.getByTestId("flow-node-status-node-1"));
      expect(handleClick).toHaveBeenCalledWith("idle");
    });

    it("has button role when onClick is provided", () => {
      const handleClick = vi.fn();
      renderWithProviders(<FlowNodeStatus entityId="node-1" onClick={handleClick} />, manager);

      expect(screen.getByTestId("flow-node-status-node-1")).toHaveAttribute("role", "button");
    });

    it("has pointer cursor when onClick is provided", () => {
      const handleClick = vi.fn();
      renderWithProviders(<FlowNodeStatus entityId="node-1" onClick={handleClick} />, manager);

      expect(screen.getByTestId("flow-node-status-node-1")).toHaveStyle({ cursor: "pointer" });
    });
  });

  describe("custom icon renderer", () => {
    it("uses custom icon renderer when provided", () => {
      const iconRenderer = vi.fn().mockReturnValue(<span data-testid="custom-icon">🔵</span>);
      renderWithProviders(
        <FlowNodeStatus entityId="node-1" iconRenderer={iconRenderer} />,
        manager
      );

      expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
      expect(iconRenderer).toHaveBeenCalledWith("idle", expect.any(Object));
    });
  });

  describe("execution states", () => {
    const testStates: ExecutionState[] = [
      "idle",
      "pending",
      "running",
      "success",
      "error",
      "skipped",
      "cancelled",
    ];

    testStates.forEach((expectedState) => {
      it(`displays ${expectedState} state correctly`, async () => {
        renderWithProviders(<FlowNodeStatus entityId="node-1" showLabel />, manager);

        if (expectedState !== "idle") {
          await act(async () => {
            manager.setState("node-1", expectedState);
          });
        }

        const status = screen.getByTestId("flow-node-status-node-1");
        expect(status).toHaveAttribute("data-state", expectedState);
        expect(status.className).toContain(`flow-node-status--${expectedState}`);
      });
    });
  });
});

// =============================================================================
// FlowNodeStatusDot Tests
// =============================================================================

describe("FlowNodeStatusDot", () => {
  let manager: ExecutionStateManager;

  beforeEach(() => {
    manager = new ExecutionStateManager();
  });

  afterEach(() => {
    cleanup();
    manager.dispose();
  });

  it("renders a compact status dot", () => {
    renderWithProviders(<FlowNodeStatusDot entityId="node-1" />, manager);
    expect(screen.getByTestId("flow-node-status-node-1")).toBeInTheDocument();
  });

  it("uses small size by default", () => {
    renderWithProviders(<FlowNodeStatusDot entityId="node-1" />, manager);
    const indicator = screen.getByTestId("flow-node-status-node-1").querySelector("span");
    expect(indicator).toHaveStyle({ width: "8px", height: "8px" });
  });

  it("does not show progress bar", async () => {
    renderWithProviders(<FlowNodeStatusDot entityId="node-1" />, manager);

    await act(async () => {
      manager.setState("node-1", "running");
      manager.setProgress("node-1", 50);
    });

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("applies custom className", () => {
    renderWithProviders(<FlowNodeStatusDot entityId="node-1" className="dot-class" />, manager);
    expect(screen.getByTestId("flow-node-status-node-1").className).toContain("dot-class");
  });
});

// =============================================================================
// FlowNodeStatusBadge Tests
// =============================================================================

describe("FlowNodeStatusBadge", () => {
  let manager: ExecutionStateManager;

  beforeEach(() => {
    manager = new ExecutionStateManager();
  });

  afterEach(() => {
    cleanup();
    manager.dispose();
  });

  it("renders a status badge with label", () => {
    renderWithProviders(<FlowNodeStatusBadge entityId="node-1" />, manager);
    expect(screen.getByText("Idle")).toBeInTheDocument();
  });

  it("shows progress bar by default", async () => {
    renderWithProviders(<FlowNodeStatusBadge entityId="node-1" />, manager);

    await act(async () => {
      manager.setState("node-1", "running");
      manager.setProgress("node-1", 75);
    });

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute("aria-valuenow", "75");
  });

  it("hides progress bar when showProgress is false", async () => {
    renderWithProviders(<FlowNodeStatusBadge entityId="node-1" showProgress={false} />, manager);

    await act(async () => {
      manager.setState("node-1", "running");
      manager.setProgress("node-1", 75);
    });

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("uses medium size", () => {
    renderWithProviders(<FlowNodeStatusBadge entityId="node-1" />, manager);
    const indicator = screen.getByTestId("flow-node-status-node-1").querySelector("span");
    expect(indicator).toHaveStyle({ width: "12px", height: "12px" });
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe("FlowNodeStatus Integration", () => {
  let manager: ExecutionStateManager;

  beforeEach(() => {
    manager = new ExecutionStateManager();
  });

  afterEach(() => {
    cleanup();
    manager.dispose();
  });

  it("handles complete execution lifecycle", async () => {
    renderWithProviders(<FlowNodeStatus entityId="node-1" showLabel showProgress />, manager);

    const status = screen.getByTestId("flow-node-status-node-1");

    // Initial: idle
    expect(status).toHaveAttribute("data-state", "idle");
    expect(screen.getByText("Idle")).toBeInTheDocument();

    // Transition to pending
    await act(async () => {
      manager.setState("node-1", "pending");
    });
    expect(status).toHaveAttribute("data-state", "pending");
    expect(screen.getByText("Pending")).toBeInTheDocument();

    // Transition to running with progress
    await act(async () => {
      manager.setState("node-1", "running");
      manager.setProgress("node-1", 25);
    });
    expect(status).toHaveAttribute("data-state", "running");
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");

    // Progress to 75%
    await act(async () => {
      manager.setProgress("node-1", 75);
    });
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "75");

    // Complete with success
    await act(async () => {
      manager.setState("node-1", "success");
    });
    expect(status).toHaveAttribute("data-state", "success");
    expect(screen.getByText("Success")).toBeInTheDocument();
    // Progress bar should be hidden for completed state
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("handles error state", async () => {
    renderWithProviders(<FlowNodeStatus entityId="node-1" showLabel />, manager);

    await act(async () => {
      manager.setState("node-1", "running");
    });

    expect(screen.getByText("Running")).toBeInTheDocument();

    await act(async () => {
      manager.setState("node-1", "error");
    });

    const status = screen.getByTestId("flow-node-status-node-1");
    expect(status).toHaveAttribute("data-state", "error");
    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it("handles multiple entities independently", async () => {
    renderWithProviders(
      <>
        <FlowNodeStatus entityId="node-1" showLabel data-testid="status-1" />
        <FlowNodeStatus entityId="node-2" showLabel data-testid="status-2" />
      </>,
      manager
    );

    // Both start as idle
    expect(screen.getByTestId("status-1")).toHaveAttribute("data-state", "idle");
    expect(screen.getByTestId("status-2")).toHaveAttribute("data-state", "idle");

    // Change node-1 to running
    await act(async () => {
      manager.setState("node-1", "running");
    });

    expect(screen.getByTestId("status-1")).toHaveAttribute("data-state", "running");
    expect(screen.getByTestId("status-2")).toHaveAttribute("data-state", "idle");

    // Change node-2 to success
    await act(async () => {
      manager.setState("node-2", "success");
    });

    expect(screen.getByTestId("status-1")).toHaveAttribute("data-state", "running");
    expect(screen.getByTestId("status-2")).toHaveAttribute("data-state", "success");
  });
});
