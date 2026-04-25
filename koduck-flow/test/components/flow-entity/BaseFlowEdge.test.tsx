/**
 * @file BaseFlowEdge Component Tests
 * @description Unit tests for BaseFlowEdge and EdgePath components.
 * Tests rendering, theme integration, path calculation, and click handling.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 1.10
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import {
  BaseFlowEdge,
  EdgeArrowMarker,
  type BaseFlowEdgeProps,
} from "../../../src/components/flow-entity/edge/BaseFlowEdge";
import {
  EdgePath,
  calculatePath,
  type EdgePathProps,
} from "../../../src/components/flow-entity/edge/EdgePath";
import { FlowEntityProvider } from "../../../src/components/flow-entity/context";
import { FlowEdgeEntity } from "../../../src/common/flow/flow-edge-entity";
import type { IFlowEdgeEntityData, Position } from "../../../src/components/flow-entity/types";

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Creates a test FlowEdgeEntity with default values
 */
function createTestEntity(overrides: Partial<IFlowEdgeEntityData> = {}): FlowEdgeEntity {
  return new FlowEdgeEntity({
    edgeType: "data",
    sourceNodeId: "node1",
    targetNodeId: "node2",
    sourcePortId: "output1",
    targetPortId: "input1",
    ...overrides,
  });
}

/**
 * Default source and target positions for tests
 */
const defaultSourcePosition: Position = { x: 100, y: 50 };
const defaultTargetPosition: Position = { x: 300, y: 150 };

/**
 * Renders BaseFlowEdge wrapped in FlowEntityProvider and SVG
 */
function renderWithProvider(props: Partial<BaseFlowEdgeProps> & { entity?: FlowEdgeEntity } = {}) {
  const entity = props.entity ?? createTestEntity();
  return render(
    <FlowEntityProvider>
      <svg data-testid="test-svg">
        <defs>
          <EdgeArrowMarker />
        </defs>
        <BaseFlowEdge
          entity={entity}
          sourcePosition={props.sourcePosition ?? defaultSourcePosition}
          targetPosition={props.targetPosition ?? defaultTargetPosition}
          {...props}
        />
      </svg>
    </FlowEntityProvider>
  );
}

/**
 * Renders EdgePath wrapped in SVG
 */
function renderEdgePath(props: Partial<EdgePathProps> = {}) {
  return render(
    <svg data-testid="test-svg">
      <EdgePath
        source={props.source ?? defaultSourcePosition}
        target={props.target ?? defaultTargetPosition}
        {...props}
      />
    </svg>
  );
}

// =============================================================================
// EdgePath Tests
// =============================================================================

describe("EdgePath", () => {
  describe("basic rendering", () => {
    it("renders without crashing", () => {
      renderEdgePath();
      expect(screen.getByTestId("flow-edge-path")).toBeInTheDocument();
    });

    it("renders with correct default path type", () => {
      renderEdgePath();
      const path = screen.getByTestId("flow-edge-path");
      expect(path).toHaveAttribute("data-path-type", "bezier");
    });

    it("renders with custom test id when provided", () => {
      renderEdgePath({ "data-testid": "custom-path" });
      expect(screen.getByTestId("custom-path")).toBeInTheDocument();
    });

    it("applies correct className when provided", () => {
      renderEdgePath({ className: "custom-class" });
      const path = screen.getByTestId("flow-edge-path");
      expect(path).toHaveClass("custom-class");
    });
  });

  describe("path types", () => {
    it("renders straight path", () => {
      renderEdgePath({ pathType: "straight" });
      const path = screen.getByTestId("flow-edge-path");
      expect(path).toHaveAttribute("data-path-type", "straight");
      expect(path.getAttribute("d")).toContain("M 100 50");
      expect(path.getAttribute("d")).toContain("L 300 150");
    });

    it("renders bezier path", () => {
      renderEdgePath({ pathType: "bezier" });
      const path = screen.getByTestId("flow-edge-path");
      expect(path).toHaveAttribute("data-path-type", "bezier");
      expect(path.getAttribute("d")).toContain("C");
    });

    it("renders step path", () => {
      renderEdgePath({ pathType: "step" });
      const path = screen.getByTestId("flow-edge-path");
      expect(path).toHaveAttribute("data-path-type", "step");
      expect(path.getAttribute("d")).toMatch(/M.*L.*L.*L/);
    });

    it("renders smoothstep path", () => {
      renderEdgePath({ pathType: "smoothstep" });
      const path = screen.getByTestId("flow-edge-path");
      expect(path).toHaveAttribute("data-path-type", "smoothstep");
      expect(path.getAttribute("d")).toContain("Q");
    });
  });

  describe("styling", () => {
    it("applies stroke color", () => {
      renderEdgePath({ strokeColor: "#ff0000" });
      const path = screen.getByTestId("flow-edge-path");
      expect(path).toHaveAttribute("stroke", "#ff0000");
    });

    it("applies stroke width", () => {
      renderEdgePath({ strokeWidth: 4 });
      const path = screen.getByTestId("flow-edge-path");
      expect(path).toHaveAttribute("stroke-width", "4");
    });

    it("applies stroke dasharray", () => {
      renderEdgePath({ strokeDasharray: "5,5" });
      const path = screen.getByTestId("flow-edge-path");
      expect(path).toHaveAttribute("stroke-dasharray", "5,5");
    });

    it("applies opacity", () => {
      renderEdgePath({ opacity: 0.5 });
      const path = screen.getByTestId("flow-edge-path");
      expect(path).toHaveAttribute("opacity", "0.5");
    });
  });

  describe("selection state", () => {
    it("applies selected color when selected", () => {
      renderEdgePath({ selected: true, selectedColor: "#0000ff" });
      const path = screen.getByTestId("flow-edge-path");
      expect(path).toHaveAttribute("stroke", "#0000ff");
    });

    it("increases stroke width when selected", () => {
      renderEdgePath({ selected: true, strokeWidth: 2 });
      const path = screen.getByTestId("flow-edge-path");
      expect(path).toHaveAttribute("stroke-width", "3");
    });

    it("adds selected class when selected", () => {
      renderEdgePath({ selected: true });
      const path = screen.getByTestId("flow-edge-path");
      expect(path).toHaveClass("flow-edge-path--selected");
    });

    it("sets data-selected attribute", () => {
      renderEdgePath({ selected: true });
      const path = screen.getByTestId("flow-edge-path");
      expect(path).toHaveAttribute("data-selected", "true");
    });
  });

  describe("arrow marker", () => {
    it("includes marker-end when showArrow and markerEnd provided", () => {
      renderEdgePath({ showArrow: true, markerEnd: "arrow-id" });
      const path = screen.getByTestId("flow-edge-path");
      expect(path).toHaveAttribute("marker-end", "url(#arrow-id)");
    });

    it("does not include marker-end when showArrow is false", () => {
      renderEdgePath({ showArrow: false, markerEnd: "arrow-id" });
      const path = screen.getByTestId("flow-edge-path");
      expect(path).not.toHaveAttribute("marker-end");
    });
  });
});

// =============================================================================
// calculatePath Tests
// =============================================================================

describe("calculatePath", () => {
  const source: Position = { x: 0, y: 0 };
  const target: Position = { x: 100, y: 100 };

  it("calculates straight path correctly", () => {
    const path = calculatePath(source, target, "straight");
    expect(path).toBe("M 0 0 L 100 100");
  });

  it("calculates bezier path correctly", () => {
    const path = calculatePath(source, target, "bezier");
    expect(path).toContain("M 0 0");
    expect(path).toContain("C");
    expect(path).toContain("100 100");
  });

  it("calculates step path correctly", () => {
    const path = calculatePath(source, target, "step");
    expect(path).toBe("M 0 0 L 50 0 L 50 100 L 100 100");
  });

  it("calculates smoothstep path correctly", () => {
    const path = calculatePath(source, target, "smoothstep");
    expect(path).toContain("M 0 0");
    expect(path).toContain("Q");
    expect(path).toContain("100 100");
  });

  it("respects curvature config for bezier", () => {
    const path1 = calculatePath(source, target, "bezier", { curvature: 0.25 });
    const path2 = calculatePath(source, target, "bezier", { curvature: 0.75 });
    expect(path1).not.toBe(path2);
  });

  it("respects borderRadius config for smoothstep", () => {
    const path1 = calculatePath(source, target, "smoothstep", { borderRadius: 4 });
    const path2 = calculatePath(source, target, "smoothstep", { borderRadius: 16 });
    expect(path1).not.toBe(path2);
  });

  it("defaults to bezier for unknown path type", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const path = calculatePath(source, target, "unknown" as any);
    expect(path).toContain("C");
  });
});

// =============================================================================
// BaseFlowEdge Tests
// =============================================================================

describe("BaseFlowEdge", () => {
  describe("basic rendering", () => {
    it("renders without crashing", () => {
      renderWithProvider();
      const svg = screen.getByTestId("test-svg");
      expect(svg.querySelector("g.flow-edge")).toBeInTheDocument();
    });

    it("renders with correct test id", () => {
      const entity = createTestEntity();
      renderWithProvider({ entity });
      expect(screen.getByTestId(`flow-edge-${entity.id}`)).toBeInTheDocument();
    });

    it("renders with custom test id when provided", () => {
      renderWithProvider({ "data-testid": "custom-edge" });
      expect(screen.getByTestId("custom-edge")).toBeInTheDocument();
    });

    it("renders edge with correct data attributes", () => {
      const entity = createTestEntity({
        edgeType: "control",
        sourceNodeId: "src",
        targetNodeId: "tgt",
      });
      renderWithProvider({ entity, selected: true });

      const edge = screen.getByTestId(`flow-edge-${entity.id}`);
      expect(edge).toHaveAttribute("data-edge-id", entity.id);
      expect(edge).toHaveAttribute("data-edge-type", "control");
      expect(edge).toHaveAttribute("data-source-node", "src");
      expect(edge).toHaveAttribute("data-target-node", "tgt");
      expect(edge).toHaveAttribute("data-selected", "true");
    });

    it("applies correct className when provided", () => {
      renderWithProvider({ className: "custom-class" });
      const svg = screen.getByTestId("test-svg");
      const edge = svg.querySelector("g.flow-edge");
      expect(edge).toHaveClass("custom-class");
    });
  });

  describe("hit area", () => {
    it("renders invisible hit area for easier clicking", () => {
      const entity = createTestEntity();
      renderWithProvider({ entity });
      const hitArea = screen.getByTestId(`flow-edge-hit-area-${entity.id}`);
      expect(hitArea).toBeInTheDocument();
      expect(hitArea).toHaveAttribute("stroke", "transparent");
    });

    it("hit area has larger stroke width than visible path", () => {
      const entity = createTestEntity();
      renderWithProvider({ entity });
      const hitArea = screen.getByTestId(`flow-edge-hit-area-${entity.id}`);
      const strokeWidth = parseInt(hitArea.getAttribute("stroke-width") || "0", 10);
      expect(strokeWidth).toBeGreaterThanOrEqual(16);
    });
  });

  describe("selection state", () => {
    it("adds selected class when selected", () => {
      renderWithProvider({ selected: true });
      const svg = screen.getByTestId("test-svg");
      const edge = svg.querySelector("g.flow-edge");
      expect(edge).toHaveClass("flow-edge--selected");
    });

    it("does not have selected class when not selected", () => {
      renderWithProvider({ selected: false });
      const svg = screen.getByTestId("test-svg");
      const edge = svg.querySelector("g.flow-edge");
      expect(edge).not.toHaveClass("flow-edge--selected");
    });
  });

  describe("disabled state", () => {
    it("adds disabled class when entity is disabled", () => {
      const entity = createTestEntity({ disabled: true });
      renderWithProvider({ entity });
      const svg = screen.getByTestId("test-svg");
      const edge = svg.querySelector("g.flow-edge");
      expect(edge).toHaveClass("flow-edge--disabled");
    });

    it("sets data-disabled attribute when disabled", () => {
      const entity = createTestEntity({ disabled: true });
      renderWithProvider({ entity });
      const edge = screen.getByTestId(`flow-edge-${entity.id}`);
      expect(edge).toHaveAttribute("data-disabled", "true");
    });
  });

  describe("click handling", () => {
    it("calls onSelect when clicked", () => {
      const onSelect = vi.fn();
      const entity = createTestEntity();
      renderWithProvider({ entity, onSelect });

      const edge = screen.getByTestId(`flow-edge-${entity.id}`);
      fireEvent.click(edge);

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith(entity);
    });

    it("calls onClick with entity and event when clicked", () => {
      const onClick = vi.fn();
      const entity = createTestEntity();
      renderWithProvider({ entity, onClick });

      const edge = screen.getByTestId(`flow-edge-${entity.id}`);
      fireEvent.click(edge);

      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onClick).toHaveBeenCalledWith(entity, expect.any(Object));
    });

    it("does not call callbacks when disabled", () => {
      const onSelect = vi.fn();
      const onClick = vi.fn();
      const entity = createTestEntity({ disabled: true });
      renderWithProvider({ entity, onSelect, onClick });

      const edge = screen.getByTestId(`flow-edge-${entity.id}`);
      fireEvent.click(edge);

      expect(onSelect).not.toHaveBeenCalled();
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe("label rendering", () => {
    it("renders label when provided in entity data", () => {
      const entity = createTestEntity({ label: "Test Label" });
      renderWithProvider({ entity });
      const label = screen.getByTestId(`flow-edge-label-${entity.id}`);
      expect(label).toBeInTheDocument();
      expect(label).toHaveTextContent("Test Label");
    });

    it("does not render label when not provided", () => {
      const entity = createTestEntity({ label: undefined });
      renderWithProvider({ entity });
      expect(screen.queryByTestId(`flow-edge-label-${entity.id}`)).not.toBeInTheDocument();
    });

    it("positions label at midpoint of edge", () => {
      const entity = createTestEntity({ label: "Label" });
      renderWithProvider({
        entity,
        sourcePosition: { x: 0, y: 0 },
        targetPosition: { x: 200, y: 100 },
      });
      const label = screen.getByTestId(`flow-edge-label-${entity.id}`);
      expect(label).toHaveAttribute("x", "100");
      expect(label).toHaveAttribute("y", "50");
    });
  });

  describe("path type", () => {
    it("uses bezier path type by default", () => {
      renderWithProvider();
      const path = screen.getByTestId("flow-edge-path");
      expect(path).toHaveAttribute("data-path-type", "bezier");
    });

    it("respects pathType prop override", () => {
      renderWithProvider({ pathType: "straight" });
      const path = screen.getByTestId("flow-edge-path");
      expect(path).toHaveAttribute("data-path-type", "straight");
    });

    it("uses entity pathType when no prop override", () => {
      const entity = createTestEntity({ pathType: "step" });
      renderWithProvider({ entity });
      const path = screen.getByTestId("flow-edge-path");
      expect(path).toHaveAttribute("data-path-type", "step");
    });
  });

  describe("custom path renderer", () => {
    it("uses custom pathRenderer when provided", () => {
      const customRenderer = vi
        .fn()
        .mockReturnValue(<path data-testid="custom-renderer-path" d="M 0 0 L 100 100" />);
      renderWithProvider({ pathRenderer: customRenderer });

      expect(customRenderer).toHaveBeenCalled();
      expect(screen.getByTestId("custom-renderer-path")).toBeInTheDocument();
    });

    it("passes correct props to custom renderer", () => {
      const customRenderer = vi.fn().mockReturnValue(null);
      const entity = createTestEntity();
      renderWithProvider({
        entity,
        pathRenderer: customRenderer,
        selected: true,
        sourcePosition: { x: 10, y: 20 },
        targetPosition: { x: 30, y: 40 },
      });

      expect(customRenderer).toHaveBeenCalledWith(
        expect.objectContaining({
          path: expect.any(String),
          source: { x: 10, y: 20 },
          target: { x: 30, y: 40 },
          selected: true,
          theme: expect.any(Object),
        })
      );
    });
  });

  describe("accessibility", () => {
    it("has role button", () => {
      renderWithProvider();
      const svg = screen.getByTestId("test-svg");
      const edge = svg.querySelector("g.flow-edge");
      expect(edge).toHaveAttribute("role", "button");
    });

    it("has aria-label with source and target info", () => {
      const entity = createTestEntity({
        sourceNodeId: "source",
        targetNodeId: "target",
      });
      renderWithProvider({ entity });
      const edge = screen.getByTestId(`flow-edge-${entity.id}`);
      expect(edge).toHaveAttribute("aria-label", "Edge from source to target");
    });

    it("includes label in aria-label when present", () => {
      const entity = createTestEntity({
        sourceNodeId: "source",
        targetNodeId: "target",
        label: "Data Flow",
      });
      renderWithProvider({ entity });
      const edge = screen.getByTestId(`flow-edge-${entity.id}`);
      expect(edge).toHaveAttribute("aria-label", "Edge from source to target: Data Flow");
    });

    it("has tabIndex 0 when not disabled", () => {
      renderWithProvider();
      const svg = screen.getByTestId("test-svg");
      const edge = svg.querySelector("g.flow-edge");
      expect(edge).toHaveAttribute("tabindex", "0");
    });

    it("has tabIndex -1 when disabled", () => {
      const entity = createTestEntity({ disabled: true });
      renderWithProvider({ entity });
      const edge = screen.getByTestId(`flow-edge-${entity.id}`);
      expect(edge).toHaveAttribute("tabindex", "-1");
    });
  });
});

// =============================================================================
// EdgeArrowMarker Tests
// =============================================================================

describe("EdgeArrowMarker", () => {
  it("renders marker element", () => {
    const { container } = render(
      <svg>
        <defs>
          <EdgeArrowMarker id="test-arrow" />
        </defs>
      </svg>
    );
    const marker = container.querySelector("marker#test-arrow");
    expect(marker).toBeInTheDocument();
  });

  it("uses default id when not provided", () => {
    const { container } = render(
      <svg>
        <defs>
          <EdgeArrowMarker />
        </defs>
      </svg>
    );
    const marker = container.querySelector("marker#flow-edge-arrow");
    expect(marker).toBeInTheDocument();
  });

  it("applies custom color", () => {
    const { container } = render(
      <svg>
        <defs>
          <EdgeArrowMarker id="test-arrow" color="#ff0000" />
        </defs>
      </svg>
    );
    const arrowPath = container.querySelector("marker#test-arrow path");
    expect(arrowPath).toHaveAttribute("fill", "#ff0000");
  });

  it("applies custom size", () => {
    const { container } = render(
      <svg>
        <defs>
          <EdgeArrowMarker id="test-arrow" size={20} />
        </defs>
      </svg>
    );
    const marker = container.querySelector("marker#test-arrow");
    expect(marker).toHaveAttribute("markerWidth", "20");
    expect(marker).toHaveAttribute("markerHeight", "20");
  });
});
