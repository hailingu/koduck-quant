/**
 * @file EdgeAnimation Tests
 * @description Unit tests for EdgeAnimation component and related utilities.
 * Tests rendering, state visualization, animations, and configuration.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 3.4
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import React from "react";
import {
  EdgeAnimation,
  EdgeAnimationParticles,
  getEdgeAnimationClassName,
  isEdgeAnimating,
  getEdgeStateColor,
  type EdgeAnimationProps,
} from "../../../../src/components/flow-entity/edge/EdgeAnimation";
import { FlowEntityProvider } from "../../../../src/components/flow-entity/context";
import type {
  EdgeAnimationState,
  FlowEdgeTheme,
} from "../../../../src/components/flow-entity/types";

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Default test path
 */
const TEST_PATH = "M 0 0 L 100 100";

/**
 * Renders EdgeAnimation with FlowEntityProvider
 */
function renderWithProvider(props: Partial<EdgeAnimationProps> = {}) {
  const defaultProps: EdgeAnimationProps = {
    path: TEST_PATH,
    ...props,
  };

  return render(
    <FlowEntityProvider>
      <svg>
        <EdgeAnimation {...defaultProps} />
      </svg>
    </FlowEntityProvider>
  );
}

// =============================================================================
// EdgeAnimation Tests
// =============================================================================

describe("EdgeAnimation", () => {
  afterEach(() => {
    cleanup();
  });

  describe("basic rendering", () => {
    it("renders without crashing", () => {
      const { container } = renderWithProvider();
      expect(container.querySelector("path")).toBeTruthy();
    });

    it("renders with correct default test id", () => {
      renderWithProvider();
      expect(screen.getByTestId("flow-edge-animation-idle")).toBeInTheDocument();
    });

    it("renders with custom test id when provided", () => {
      renderWithProvider({ "data-testid": "custom-animation" });
      expect(screen.getByTestId("custom-animation")).toBeInTheDocument();
    });

    it("renders the provided path", () => {
      const { container } = renderWithProvider({ path: "M 10 20 L 30 40" });
      const path = container.querySelector("path");
      expect(path?.getAttribute("d")).toBe("M 10 20 L 30 40");
    });

    it("has pointer-events none", () => {
      const { container } = renderWithProvider();
      const path = container.querySelector("path");
      expect(path).toHaveStyle({ pointerEvents: "none" });
    });
  });

  describe("state visualization", () => {
    it("shows idle state by default", () => {
      renderWithProvider();
      const animation = screen.getByTestId("flow-edge-animation-idle");
      expect(animation).toHaveAttribute("data-state", "idle");
      expect(animation.getAttribute("class")).toContain("flow-edge-animation--idle");
    });

    it("displays flowing state correctly", () => {
      renderWithProvider({ state: "flowing" });
      const animation = screen.getByTestId("flow-edge-animation-flowing");
      expect(animation).toHaveAttribute("data-state", "flowing");
      expect(animation.getAttribute("class")).toContain("flow-edge-animation--flowing");
    });

    it("displays success state correctly", () => {
      renderWithProvider({ state: "success" });
      const animation = screen.getByTestId("flow-edge-animation-success");
      expect(animation).toHaveAttribute("data-state", "success");
      expect(animation.getAttribute("class")).toContain("flow-edge-animation--success");
    });

    it("displays error state correctly", () => {
      renderWithProvider({ state: "error" });
      const animation = screen.getByTestId("flow-edge-animation-error");
      expect(animation).toHaveAttribute("data-state", "error");
      expect(animation.getAttribute("class")).toContain("flow-edge-animation--error");
    });

    it("displays highlight state correctly", () => {
      renderWithProvider({ state: "highlight" });
      const animation = screen.getByTestId("flow-edge-animation-highlight");
      expect(animation).toHaveAttribute("data-state", "highlight");
      expect(animation.getAttribute("class")).toContain("flow-edge-animation--highlight");
    });
  });

  describe("animation configuration", () => {
    it("applies custom stroke color", () => {
      const { container } = renderWithProvider({
        strokeColor: "#ff0000",
        state: "flowing",
      });
      const path = container.querySelector("path");
      expect(path).toHaveStyle({ stroke: "#ff0000" });
    });

    it("applies custom stroke width", () => {
      const { container } = renderWithProvider({
        strokeWidth: 5,
        state: "flowing",
      });
      const path = container.querySelector("path");
      expect(path).toHaveStyle({ strokeWidth: 5 });
    });

    it("respects animationsEnabled false", () => {
      renderWithProvider({
        animationsEnabled: false,
        state: "flowing",
      });
      const animation = screen.getByTestId("flow-edge-animation-flowing");
      expect(animation).toHaveAttribute("data-animations-enabled", "false");
    });

    it("marks animations enabled by default", () => {
      renderWithProvider({ state: "flowing" });
      const animation = screen.getByTestId("flow-edge-animation-flowing");
      expect(animation).toHaveAttribute("data-animations-enabled", "true");
    });

    it("adds animating class when state is not idle", () => {
      renderWithProvider({ state: "flowing" });
      const animation = screen.getByTestId("flow-edge-animation-flowing");
      expect(animation.getAttribute("class")).toContain("flow-edge-animation--animating");
    });

    it("does not add animating class for idle state", () => {
      renderWithProvider({ state: "idle" });
      const animation = screen.getByTestId("flow-edge-animation-idle");
      expect(animation.getAttribute("class")).not.toContain("flow-edge-animation--animating");
    });
  });

  describe("config options", () => {
    it("applies config for particle speed", () => {
      const { container } = renderWithProvider({
        state: "flowing",
        config: { particleSpeed: 2 },
      });
      const path = container.querySelector("path");
      // Animation should have duration adjusted by speed
      const style = path?.getAttribute("style") ?? "";
      expect(style).toContain("animation");
    });

    it("applies config for particle size", () => {
      const { container } = renderWithProvider({
        state: "flowing",
        config: { particleSize: 10 },
      });
      const path = container.querySelector("path");
      const style = path?.getAttribute("style") ?? "";
      expect(style).toContain("stroke-dasharray");
    });

    it("respects config.enabled = false", () => {
      renderWithProvider({
        state: "flowing",
        config: { enabled: false },
      });
      const animation = screen.getByTestId("flow-edge-animation-flowing");
      expect(animation).toHaveAttribute("data-animations-enabled", "false");
    });
  });

  describe("styling", () => {
    it("applies custom className", () => {
      renderWithProvider({ className: "custom-class" });
      const animation = screen.getByTestId("flow-edge-animation-idle");
      expect(animation.getAttribute("class")).toContain("custom-class");
    });

    it("applies custom styles", () => {
      const { container } = renderWithProvider({
        style: { opacity: 0.5 },
      });
      const path = container.querySelector("path");
      expect(path).toHaveStyle({ opacity: 0.5 });
    });

    it("has correct SVG path style attributes", () => {
      const { container } = renderWithProvider();
      const path = container.querySelector("path");
      // fill, strokeLinecap, strokeLinejoin are applied via style
      expect(path).toHaveStyle({ fill: "none" });
      expect(path).toHaveStyle({ strokeLinecap: "round" });
      expect(path).toHaveStyle({ strokeLinejoin: "round" });
    });
  });

  describe("state colors", () => {
    it("uses green for success state", () => {
      const { container } = renderWithProvider({ state: "success" });
      const path = container.querySelector("path");
      expect(path).toHaveStyle({ stroke: "#10b981" });
    });

    it("uses red for error state", () => {
      const { container } = renderWithProvider({ state: "error" });
      const path = container.querySelector("path");
      expect(path).toHaveStyle({ stroke: "#ef4444" });
    });
  });
});

// =============================================================================
// EdgeAnimationParticles Tests
// =============================================================================

describe("EdgeAnimationParticles", () => {
  afterEach(() => {
    cleanup();
  });

  function renderParticles(
    props: Partial<React.ComponentProps<typeof EdgeAnimationParticles>> = {}
  ) {
    return render(
      <FlowEntityProvider>
        <svg>
          <EdgeAnimationParticles path={TEST_PATH} {...props} />
        </svg>
      </FlowEntityProvider>
    );
  }

  describe("basic rendering", () => {
    it("renders without crashing", () => {
      const { container } = renderParticles();
      expect(container.querySelector("g.flow-edge-particles")).toBeTruthy();
    });

    it("renders correct number of particles", () => {
      const { container } = renderParticles({ count: 5 });
      const particles = container.querySelectorAll("circle");
      expect(particles.length).toBe(5);
    });

    it("uses default count of 3", () => {
      const { container } = renderParticles();
      const particles = container.querySelectorAll("circle");
      expect(particles.length).toBe(3);
    });

    it("renders with custom test id", () => {
      renderParticles({ "data-testid": "custom-particles" });
      expect(screen.getByTestId("custom-particles")).toBeInTheDocument();
    });

    it("sets particle count data attribute", () => {
      renderParticles({ count: 4 });
      const group = screen.getByTestId("flow-edge-particles");
      expect(group).toHaveAttribute("data-particle-count", "4");
    });
  });

  describe("visibility", () => {
    it("does not render when visible is false", () => {
      const { container } = renderParticles({ visible: false });
      expect(container.querySelector("g.flow-edge-particles")).toBeFalsy();
    });

    it("renders when visible is true", () => {
      const { container } = renderParticles({ visible: true });
      expect(container.querySelector("g.flow-edge-particles")).toBeTruthy();
    });
  });

  describe("particle styling", () => {
    it("applies custom color to particles", () => {
      const { container } = renderParticles({ color: "#ff0000" });
      const particle = container.querySelector("circle");
      expect(particle).toHaveAttribute("fill", "#ff0000");
    });

    it("applies custom size to particles", () => {
      const { container } = renderParticles({ size: 8 });
      const particle = container.querySelector("circle");
      expect(particle).toHaveAttribute("r", "4"); // r = size / 2
    });

    it("particles have flow-edge-particle class", () => {
      const { container } = renderParticles();
      const particle = container.querySelector("circle");
      expect(particle).toHaveClass("flow-edge-particle");
    });
  });
});

// =============================================================================
// Utility Function Tests
// =============================================================================

describe("getEdgeAnimationClassName", () => {
  it("returns empty string for idle state", () => {
    expect(getEdgeAnimationClassName("idle")).toBe("");
  });

  it("returns empty string when animations disabled", () => {
    expect(getEdgeAnimationClassName("flowing", false)).toBe("");
  });

  it("returns flowing class for flowing state", () => {
    expect(getEdgeAnimationClassName("flowing")).toBe("flow-edge--flowing");
  });

  it("returns success class for success state", () => {
    expect(getEdgeAnimationClassName("success")).toBe("flow-edge--success");
  });

  it("returns error class for error state", () => {
    expect(getEdgeAnimationClassName("error")).toBe("flow-edge--error");
  });

  it("returns highlight class for highlight state", () => {
    expect(getEdgeAnimationClassName("highlight")).toBe("flow-edge--highlight");
  });
});

describe("isEdgeAnimating", () => {
  it("returns false for idle state", () => {
    expect(isEdgeAnimating("idle")).toBe(false);
  });

  it("returns true for flowing state", () => {
    expect(isEdgeAnimating("flowing")).toBe(true);
  });

  it("returns true for success state", () => {
    expect(isEdgeAnimating("success")).toBe(true);
  });

  it("returns true for error state", () => {
    expect(isEdgeAnimating("error")).toBe(true);
  });

  it("returns true for highlight state", () => {
    expect(isEdgeAnimating("highlight")).toBe(true);
  });
});

describe("getEdgeStateColor", () => {
  const mockTheme: FlowEdgeTheme = {
    strokeColor: "#999999",
    selectedColor: "#0000ff",
  };

  it("returns theme stroke color for idle state", () => {
    expect(getEdgeStateColor("idle", mockTheme)).toBe("#999999");
  });

  it("returns theme stroke color for flowing state", () => {
    expect(getEdgeStateColor("flowing", mockTheme)).toBe("#999999");
  });

  it("returns green for success state", () => {
    expect(getEdgeStateColor("success", mockTheme)).toBe("#10b981");
  });

  it("returns red for error state", () => {
    expect(getEdgeStateColor("error", mockTheme)).toBe("#ef4444");
  });

  it("returns selected color for highlight state", () => {
    expect(getEdgeStateColor("highlight", mockTheme)).toBe("#0000ff");
  });
});

// =============================================================================
// Integration with BaseFlowEdge Tests
// =============================================================================

describe("EdgeAnimation Integration", () => {
  afterEach(() => {
    cleanup();
  });

  it("all animation states are valid", () => {
    const states: EdgeAnimationState[] = ["idle", "flowing", "success", "error", "highlight"];

    states.forEach((state) => {
      cleanup();
      renderWithProvider({ state });
      const animation = screen.getByTestId(`flow-edge-animation-${state}`);
      expect(animation).toBeInTheDocument();
      expect(animation).toHaveAttribute("data-state", state);
    });
  });

  it("transitions between states correctly", () => {
    const { rerender } = render(
      <FlowEntityProvider>
        <svg>
          <EdgeAnimation path={TEST_PATH} state="idle" />
        </svg>
      </FlowEntityProvider>
    );

    // Initial state
    expect(screen.getByTestId("flow-edge-animation-idle")).toBeInTheDocument();

    // Transition to flowing
    rerender(
      <FlowEntityProvider>
        <svg>
          <EdgeAnimation path={TEST_PATH} state="flowing" />
        </svg>
      </FlowEntityProvider>
    );
    expect(screen.getByTestId("flow-edge-animation-flowing")).toBeInTheDocument();

    // Transition to success
    rerender(
      <FlowEntityProvider>
        <svg>
          <EdgeAnimation path={TEST_PATH} state="success" />
        </svg>
      </FlowEntityProvider>
    );
    expect(screen.getByTestId("flow-edge-animation-success")).toBeInTheDocument();
  });
});
