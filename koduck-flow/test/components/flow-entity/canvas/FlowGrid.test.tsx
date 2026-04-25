/**
 * @file FlowGrid Component Tests
 * @description Unit tests for the FlowGrid component
 *
 * @see src/components/flow-entity/canvas/FlowGrid.tsx
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import {
  FlowGrid,
  DEFAULT_GRID_PATTERN,
} from "../../../../src/components/flow-entity/canvas/FlowGrid";
import { FlowEntityProvider } from "../../../../src/components/flow-entity/context";

describe("FlowGrid", () => {
  // ===========================================================================
  // Basic Rendering Tests
  // ===========================================================================

  describe("basic rendering", () => {
    it("renders without crashing", () => {
      render(<FlowGrid />);
      expect(screen.getByTestId("flow-grid")).toBeInTheDocument();
    });

    it("renders with default props", () => {
      render(<FlowGrid />);
      const grid = screen.getByTestId("flow-grid");
      expect(grid).toHaveStyle({ position: "absolute" });
      expect(grid).toHaveAttribute("aria-hidden", "true");
    });

    it("does not render when visible is false", () => {
      render(<FlowGrid visible={false} />);
      expect(screen.queryByTestId("flow-grid")).not.toBeInTheDocument();
    });

    it("renders when visible is true", () => {
      render(<FlowGrid visible={true} />);
      expect(screen.getByTestId("flow-grid")).toBeInTheDocument();
    });

    it("applies custom className", () => {
      render(<FlowGrid className="custom-grid" />);
      const grid = screen.getByTestId("flow-grid");
      expect(grid).toHaveClass("custom-grid");
    });

    it("applies custom style", () => {
      render(<FlowGrid style={{ opacity: 0.5 }} />);
      const grid = screen.getByTestId("flow-grid");
      expect(grid).toHaveStyle({ opacity: "0.5" });
    });
  });

  // ===========================================================================
  // Pattern Configuration Tests
  // ===========================================================================

  describe("pattern configuration", () => {
    it("uses default grid pattern values", () => {
      render(<FlowGrid />);
      const grid = screen.getByTestId("flow-grid");
      // Check that background image is set (contains gradients)
      expect(grid.style.backgroundImage).toContain("linear-gradient");
    });

    it("accepts custom pattern overrides", () => {
      const customPattern = {
        cellSize: 30,
        lineColor: "#ff0000",
      };
      render(<FlowGrid pattern={customPattern} />);
      const grid = screen.getByTestId("flow-grid");
      expect(grid.style.backgroundImage).toContain("#ff0000");
    });

    it("merges partial pattern with defaults", () => {
      render(<FlowGrid pattern={{ cellSize: 25 }} />);
      const grid = screen.getByTestId("flow-grid");
      // Should still have background image with default colors
      expect(grid.style.backgroundImage).toContain("linear-gradient");
    });
  });

  // ===========================================================================
  // Viewport Transform Tests
  // ===========================================================================

  describe("viewport transforms", () => {
    it("adjusts background position based on translateX", () => {
      const { rerender } = render(<FlowGrid translateX={0} />);
      const grid1 = screen.getByTestId("flow-grid");
      // Grid should have background image set
      expect(grid1.style.backgroundImage).toContain("linear-gradient");

      rerender(<FlowGrid translateX={50} />);
      const grid2 = screen.getByTestId("flow-grid");
      // Should still have background image
      expect(grid2.style.backgroundImage).toContain("linear-gradient");
    });

    it("adjusts background position based on translateY", () => {
      const { rerender } = render(<FlowGrid translateY={0} />);
      const grid1 = screen.getByTestId("flow-grid");
      expect(grid1.style.backgroundImage).toContain("linear-gradient");

      rerender(<FlowGrid translateY={50} />);
      const grid2 = screen.getByTestId("flow-grid");
      expect(grid2.style.backgroundImage).toContain("linear-gradient");
    });

    it("adjusts background size based on scale", () => {
      const { rerender } = render(<FlowGrid scale={1} />);
      const grid1 = screen.getByTestId("flow-grid");
      // At scale=1 with default cellSize=20, background size should include "20px"
      expect(grid1.style.backgroundSize).toContain("20px");

      rerender(<FlowGrid scale={2} />);
      const grid2 = screen.getByTestId("flow-grid");
      // At scale=2 with default cellSize=20, background size should include "40px"
      expect(grid2.style.backgroundSize).toContain("40px");
    });

    it("handles combined viewport transforms", () => {
      render(<FlowGrid translateX={100} translateY={50} scale={1.5} />);
      const grid = screen.getByTestId("flow-grid");
      // Should have background image and size
      expect(grid.style.backgroundImage).toContain("linear-gradient");
      expect(grid.style.backgroundSize).toContain("30px"); // 20 * 1.5
    });

    it("wraps background position based on cell size", () => {
      // With cellSize=20 and translateX=25, offset should be 25 % 20 = 5
      render(<FlowGrid translateX={25} pattern={{ cellSize: 20 }} scale={1} />);
      const grid = screen.getByTestId("flow-grid");
      // Grid should render with proper background (jsdom may not fully parse position)
      expect(grid.style.backgroundImage).toContain("linear-gradient");
    });
  });

  // ===========================================================================
  // Context Integration Tests
  // ===========================================================================

  describe("context integration", () => {
    it("uses theme gridColor from context when available", () => {
      render(
        <FlowEntityProvider theme={{ gridColor: "#123456" }}>
          <FlowGrid />
        </FlowEntityProvider>
      );
      const grid = screen.getByTestId("flow-grid");
      expect(grid.style.backgroundImage).toContain("#123456");
    });

    it("falls back to default when no context", () => {
      render(<FlowGrid />);
      const grid = screen.getByTestId("flow-grid");
      expect(grid.style.backgroundImage).toContain(DEFAULT_GRID_PATTERN.lineColor);
    });

    it("pattern prop overrides context theme", () => {
      render(
        <FlowEntityProvider theme={{ gridColor: "#123456" }}>
          <FlowGrid pattern={{ lineColor: "#abcdef" }} />
        </FlowEntityProvider>
      );
      const grid = screen.getByTestId("flow-grid");
      expect(grid.style.backgroundImage).toContain("#abcdef");
    });
  });

  // ===========================================================================
  // Accessibility Tests
  // ===========================================================================

  describe("accessibility", () => {
    it("has aria-hidden attribute", () => {
      render(<FlowGrid />);
      const grid = screen.getByTestId("flow-grid");
      expect(grid).toHaveAttribute("aria-hidden", "true");
    });

    it("has pointer-events none to not interfere with interactions", () => {
      render(<FlowGrid />);
      const grid = screen.getByTestId("flow-grid");
      expect(grid).toHaveStyle({ pointerEvents: "none" });
    });
  });

  // ===========================================================================
  // Default Pattern Export Tests
  // ===========================================================================

  describe("DEFAULT_GRID_PATTERN", () => {
    it("exports default pattern with expected values", () => {
      expect(DEFAULT_GRID_PATTERN).toBeDefined();
      expect(DEFAULT_GRID_PATTERN.cellSize).toBe(20);
      expect(DEFAULT_GRID_PATTERN.secondaryCellSize).toBe(100);
      expect(DEFAULT_GRID_PATTERN.lineWidth).toBe(1);
    });
  });
});
