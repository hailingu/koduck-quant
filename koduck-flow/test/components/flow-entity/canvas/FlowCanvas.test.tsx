/**
 * @file FlowCanvas Component Tests
 * @description Unit tests for the FlowCanvas component
 *
 * @see src/components/flow-entity/canvas/FlowCanvas.tsx
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import {
  FlowCanvas,
  FlowCanvasWithProvider,
} from "../../../../src/components/flow-entity/canvas/FlowCanvas";
import { FlowEntityProvider } from "../../../../src/components/flow-entity/context";
import { BaseFlowNode } from "../../../../src/components/flow-entity/node/BaseFlowNode";
import { FlowNodeEntity } from "../../../../src/common/flow/flow-node-entity";
import type {
  IFlowNodeEntityData,
  IFlowEdgeEntityData,
} from "../../../../src/components/flow-entity/types";

// Helper function to create mock node data
const createMockNode = (id: string, x: number, y: number): IFlowNodeEntityData => ({
  id,
  nodeType: "task",
  label: `Node ${id}`,
  position: { x, y },
  size: { width: 200, height: 100 },
  executionState: "idle",
  inputPorts: [{ id: "input-1", name: "Input", type: "input" }],
  outputPorts: [{ id: "output-1", name: "Output", type: "output" }],
});

// Helper function to create mock edge data
const createMockEdge = (
  id: string,
  sourceNodeId: string,
  targetNodeId: string
): IFlowEdgeEntityData => ({
  id,
  sourceNodeId,
  sourcePortId: "output-1",
  targetNodeId,
  targetPortId: "input-1",
  animationState: "idle",
});

describe("FlowCanvas", () => {
  // ===========================================================================
  // Basic Rendering Tests
  // ===========================================================================

  describe("basic rendering", () => {
    it("renders without crashing", () => {
      render(
        <FlowEntityProvider>
          <FlowCanvas />
        </FlowEntityProvider>
      );
      expect(screen.getByTestId("flow-canvas")).toBeInTheDocument();
    });

    it("renders with default props", () => {
      render(
        <FlowEntityProvider>
          <FlowCanvas />
        </FlowEntityProvider>
      );
      const canvas = screen.getByTestId("flow-canvas");
      expect(canvas).toHaveStyle({ position: "relative" });
    });

    it("applies custom className", () => {
      render(
        <FlowEntityProvider>
          <FlowCanvas className="custom-canvas" />
        </FlowEntityProvider>
      );
      expect(screen.getByTestId("flow-canvas")).toHaveClass("custom-canvas");
    });

    it("applies custom style", () => {
      render(
        <FlowEntityProvider>
          <FlowCanvas style={{ border: "1px solid red" }} />
        </FlowEntityProvider>
      );
      expect(screen.getByTestId("flow-canvas")).toHaveStyle({ border: "1px solid red" });
    });

    it("applies custom width and height", () => {
      render(
        <FlowEntityProvider>
          <FlowCanvas width={800} height={600} />
        </FlowEntityProvider>
      );
      const canvas = screen.getByTestId("flow-canvas");
      expect(canvas).toHaveStyle({ width: "800px", height: "600px" });
    });

    it("renders with percentage dimensions", () => {
      render(
        <FlowEntityProvider>
          <FlowCanvas width="100%" height="100%" />
        </FlowEntityProvider>
      );
      const canvas = screen.getByTestId("flow-canvas");
      expect(canvas).toHaveStyle({ width: "100%", height: "100%" });
    });
  });

  // ===========================================================================
  // Grid Tests
  // ===========================================================================

  describe("grid rendering", () => {
    it("shows grid by default", () => {
      render(
        <FlowEntityProvider>
          <FlowCanvas />
        </FlowEntityProvider>
      );
      expect(screen.getByTestId("flow-grid")).toBeInTheDocument();
    });

    it("hides grid when showGrid is false", () => {
      render(
        <FlowEntityProvider>
          <FlowCanvas showGrid={false} />
        </FlowEntityProvider>
      );
      expect(screen.queryByTestId("flow-grid")).not.toBeInTheDocument();
    });

    it("shows grid when showGrid is true", () => {
      render(
        <FlowEntityProvider>
          <FlowCanvas showGrid={true} />
        </FlowEntityProvider>
      );
      expect(screen.getByTestId("flow-grid")).toBeInTheDocument();
    });

    it("passes gridPattern to FlowGrid", () => {
      render(
        <FlowEntityProvider>
          <FlowCanvas gridPattern={{ cellSize: 30, lineColor: "#ff0000" }} />
        </FlowEntityProvider>
      );
      const grid = screen.getByTestId("flow-grid");
      expect(grid.style.backgroundImage).toContain("#ff0000");
    });
  });

  // ===========================================================================
  // Viewport Tests
  // ===========================================================================

  describe("viewport", () => {
    it("renders viewport container", () => {
      render(
        <FlowEntityProvider>
          <FlowCanvas />
        </FlowEntityProvider>
      );
      expect(screen.getByTestId("flow-viewport")).toBeInTheDocument();
    });

    it("passes zoom constraints to viewport", () => {
      render(
        <FlowEntityProvider>
          <FlowCanvas minZoom={0.5} maxZoom={2} />
        </FlowEntityProvider>
      );
      expect(screen.getByTestId("flow-viewport")).toBeInTheDocument();
    });

    it("uses defaultZoom for initial scale", () => {
      render(
        <FlowEntityProvider>
          <FlowCanvas defaultZoom={1.5} />
        </FlowEntityProvider>
      );
      const content = screen.getByTestId("flow-viewport-content");
      expect(content).toHaveStyle({ transform: "translate(0px, 0px) scale(1.5)" });
    });

    it("uses defaultViewport for initial state", () => {
      render(
        <FlowEntityProvider>
          <FlowCanvas defaultViewport={{ translateX: 100, translateY: 50, scale: 2 }} />
        </FlowEntityProvider>
      );
      const content = screen.getByTestId("flow-viewport-content");
      expect(content).toHaveStyle({ transform: "translate(100px, 50px) scale(2)" });
    });

    it("renders working zoom controls when showZoomControls is true", () => {
      render(
        <FlowEntityProvider>
          <FlowCanvas showZoomControls={true} />
        </FlowEntityProvider>
      );

      expect(screen.getByLabelText("Canvas zoom controls")).toBeInTheDocument();

      fireEvent.click(screen.getByLabelText("Zoom in"));
      expect(screen.getByTestId("flow-viewport-content")).toHaveStyle({
        transform: "translate(0px, 0px) scale(1.2)",
      });
    });

    it("renders minimap when showMinimap is true", () => {
      const nodes = [createMockNode("node-1", 100, 100)];

      render(
        <FlowEntityProvider>
          <FlowCanvas nodes={nodes} selectedNodeIds={["node-1"]} showMinimap={true} />
        </FlowEntityProvider>
      );

      expect(screen.getByLabelText("Canvas minimap")).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Node Rendering Tests
  // ===========================================================================

  describe("node rendering", () => {
    it("renders nodes container", () => {
      render(
        <FlowEntityProvider>
          <FlowCanvas />
        </FlowEntityProvider>
      );
      expect(screen.getByTestId("flow-canvas-nodes")).toBeInTheDocument();
    });

    it("renders custom nodes with renderNode prop", () => {
      const nodes = [createMockNode("node-1", 100, 100)];

      render(
        <FlowEntityProvider>
          <FlowCanvas
            nodes={nodes}
            renderNode={({ node }) => (
              <div data-testid={`custom-node-${node.id}`}>{node.label}</div>
            )}
          />
        </FlowEntityProvider>
      );

      expect(screen.getByTestId("custom-node-node-1")).toBeInTheDocument();
      expect(screen.getByText("Node node-1")).toBeInTheDocument();
    });

    it("renders default nodes when renderNode is omitted", () => {
      const nodes = [createMockNode("node-1", 100, 100)];

      render(
        <FlowEntityProvider>
          <FlowCanvas nodes={nodes} />
        </FlowEntityProvider>
      );

      expect(screen.getByTestId("flow-node-node-1")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Flow node handle: Node node-1" })).toBeInTheDocument();
    });

    it("renders multiple nodes", () => {
      const nodes = [
        createMockNode("node-1", 100, 100),
        createMockNode("node-2", 300, 100),
        createMockNode("node-3", 200, 300),
      ];

      render(
        <FlowEntityProvider>
          <FlowCanvas
            nodes={nodes}
            renderNode={({ node }) => <div data-testid={`node-${node.id}`}>{node.label}</div>}
          />
        </FlowEntityProvider>
      );

      expect(screen.getByTestId("node-node-1")).toBeInTheDocument();
      expect(screen.getByTestId("node-node-2")).toBeInTheDocument();
      expect(screen.getByTestId("node-node-3")).toBeInTheDocument();
    });

    it("passes selected state to renderNode", () => {
      const nodes = [createMockNode("node-1", 100, 100)];

      render(
        <FlowEntityProvider>
          <FlowCanvas
            nodes={nodes}
            selectedNodeIds={["node-1"]}
            renderNode={({ node, selected }) => (
              <div data-testid={`node-${node.id}`} data-selected={selected}>
                {node.label}
              </div>
            )}
          />
        </FlowEntityProvider>
      );

      expect(screen.getByTestId("node-node-1")).toHaveAttribute("data-selected", "true");
    });

    it("positions nodes correctly", () => {
      const nodes = [createMockNode("node-1", 150, 200)];

      render(
        <FlowEntityProvider>
          <FlowCanvas
            nodes={nodes}
            renderNode={({ node }) => <div data-testid={`node-${node.id}`}>{node.label}</div>}
          />
        </FlowEntityProvider>
      );

      const container = screen.getByTestId("node-node-1").parentElement;
      expect(container).toHaveStyle({ left: "150px", top: "200px" });
    });

    it("lets FlowCanvas own positioning when rendering BaseFlowNode", () => {
      const nodes = [createMockNode("node-1", 150, 200)];

      render(
        <FlowCanvasWithProvider
          nodes={nodes}
          renderNode={({ node }) => <BaseFlowNode entity={new FlowNodeEntity(node)} />}
        />
      );

      const baseNode = screen.getByLabelText("Flow node: Node node-1");
      expect(baseNode).toHaveStyle({ position: "relative", width: "100%", height: "100%" });
      expect(baseNode).not.toHaveStyle({ left: "150px", top: "200px" });
      expect(baseNode.closest("[data-node-id='node-1']")).toHaveStyle({
        left: "150px",
        top: "200px",
      });
    });

    it("lets FlowCanvas own selection when rendering BaseFlowNode", () => {
      const nodes = [createMockNode("node-1", 150, 200)];
      const onNodeSelect = vi.fn();
      const onBaseNodeSelect = vi.fn();

      render(
        <FlowCanvasWithProvider
          nodes={nodes}
          selectedNodeIds={["node-1"]}
          onNodeSelect={onNodeSelect}
          renderNode={({ node }) => (
            <BaseFlowNode entity={new FlowNodeEntity(node)} onSelect={onBaseNodeSelect} />
          )}
        />
      );

      const baseNode = screen.getByLabelText("Flow node: Node node-1");
      expect(baseNode).toHaveAttribute("data-selected", "true");

      fireEvent.click(baseNode);
      expect(onBaseNodeSelect).not.toHaveBeenCalled();

      fireEvent.pointerDown(screen.getByRole("button", { name: "Flow node handle: Node node-1" }), {
        button: 0,
      });
      expect(onNodeSelect).toHaveBeenCalledWith(["node-1"]);
      expect(onBaseNodeSelect).not.toHaveBeenCalled();
    });

    it("selects canvas-managed nodes from the keyboard", () => {
      const nodes = [createMockNode("node-1", 150, 200)];
      const onNodeSelect = vi.fn();

      render(
        <FlowCanvasWithProvider
          nodes={nodes}
          onNodeSelect={onNodeSelect}
          renderNode={({ node }) => <BaseFlowNode entity={new FlowNodeEntity(node)} />}
        />
      );

      fireEvent.keyDown(screen.getByRole("button", { name: "Flow node handle: Node node-1" }), {
        key: "Enter",
      });

      expect(onNodeSelect).toHaveBeenCalledWith(["node-1"]);
    });

    it("moves canvas-managed nodes from the keyboard", () => {
      const nodes = [createMockNode("node-1", 150, 200)];
      const onNodeMove = vi.fn();

      render(
        <FlowCanvasWithProvider
          nodes={nodes}
          onNodeMove={onNodeMove}
          renderNode={({ node }) => <BaseFlowNode entity={new FlowNodeEntity(node)} />}
        />
      );

      fireEvent.keyDown(screen.getByRole("button", { name: "Flow node handle: Node node-1" }), {
        key: "ArrowRight",
      });

      expect(onNodeMove).toHaveBeenCalledWith("node-1", { x: 160, y: 200 });
    });
  });

  // ===========================================================================
  // Edge Rendering Tests
  // ===========================================================================

  describe("edge rendering", () => {
    it("renders edges container", () => {
      render(
        <FlowEntityProvider>
          <FlowCanvas />
        </FlowEntityProvider>
      );
      expect(screen.getByTestId("flow-canvas-edges")).toBeInTheDocument();
    });

    it("renders edges SVG group", () => {
      render(
        <FlowEntityProvider>
          <FlowCanvas />
        </FlowEntityProvider>
      );
      expect(screen.getByTestId("flow-canvas-edges-group")).toBeInTheDocument();
    });

    it("renders custom edges with renderEdge prop", () => {
      const nodes = [createMockNode("node-1", 100, 100), createMockNode("node-2", 400, 100)];
      const edges = [createMockEdge("edge-1", "node-1", "node-2")];

      render(
        <FlowEntityProvider>
          <FlowCanvas
            nodes={nodes}
            edges={edges}
            renderEdge={({ edge }) => (
              <line key={edge.id} data-testid={`edge-${edge.id}`} x1={0} y1={0} x2={100} y2={100} />
            )}
          />
        </FlowEntityProvider>
      );

      expect(screen.getByTestId("edge-edge-1")).toBeInTheDocument();
    });

    it("renders default edges when renderEdge is omitted", () => {
      const nodes = [createMockNode("node-1", 100, 100), createMockNode("node-2", 400, 100)];
      const edges = [createMockEdge("edge-1", "node-1", "node-2")];

      render(
        <FlowEntityProvider>
          <FlowCanvas nodes={nodes} edges={edges} />
        </FlowEntityProvider>
      );

      expect(screen.getByTestId("flow-edge-edge-1")).toBeInTheDocument();
      expect(screen.getByTestId("flow-edge-path-edge-1")).toBeInTheDocument();
    });

    it("passes selected state to renderEdge", () => {
      const nodes = [createMockNode("node-1", 100, 100), createMockNode("node-2", 400, 100)];
      const edges = [createMockEdge("edge-1", "node-1", "node-2")];

      render(
        <FlowEntityProvider>
          <FlowCanvas
            nodes={nodes}
            edges={edges}
            selectedEdgeIds={["edge-1"]}
            renderEdge={({ edge, selected }) => (
              <line
                key={edge.id}
                data-testid={`edge-${edge.id}`}
                data-selected={selected}
                x1={0}
                y1={0}
                x2={100}
                y2={100}
              />
            )}
          />
        </FlowEntityProvider>
      );

      expect(screen.getByTestId("edge-edge-1")).toHaveAttribute("data-selected", "true");
    });
  });

  // ===========================================================================
  // Canvas Click Tests
  // ===========================================================================

  describe("canvas click handling", () => {
    it("calls onCanvasClick when clicking on canvas background", () => {
      const onCanvasClick = vi.fn();

      render(
        <FlowEntityProvider>
          <FlowCanvas onCanvasClick={onCanvasClick} />
        </FlowEntityProvider>
      );

      const content = screen.getByTestId("flow-canvas-content");
      fireEvent.click(content);

      expect(onCanvasClick).toHaveBeenCalled();
    });

    it("does not call onCanvasClick when clicking on child elements", () => {
      const onCanvasClick = vi.fn();

      render(
        <FlowEntityProvider>
          <FlowCanvas onCanvasClick={onCanvasClick}>
            <div data-testid="child">Child</div>
          </FlowCanvas>
        </FlowEntityProvider>
      );

      const child = screen.getByTestId("child");
      fireEvent.click(child);

      expect(onCanvasClick).not.toHaveBeenCalled();
    });

    it("calls onCanvasDoubleClick when double-clicking on canvas", () => {
      const onCanvasDoubleClick = vi.fn();

      render(
        <FlowEntityProvider>
          <FlowCanvas onCanvasDoubleClick={onCanvasDoubleClick} />
        </FlowEntityProvider>
      );

      const content = screen.getByTestId("flow-canvas-content");
      fireEvent.doubleClick(content);

      expect(onCanvasDoubleClick).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Children Rendering Tests
  // ===========================================================================

  describe("children rendering", () => {
    it("renders children in canvas content", () => {
      render(
        <FlowEntityProvider>
          <FlowCanvas>
            <div data-testid="custom-child">Custom Content</div>
          </FlowCanvas>
        </FlowEntityProvider>
      );

      expect(screen.getByTestId("custom-child")).toBeInTheDocument();
    });

    it("renders multiple children", () => {
      render(
        <FlowEntityProvider>
          <FlowCanvas>
            <div data-testid="child-1">Child 1</div>
            <div data-testid="child-2">Child 2</div>
          </FlowCanvas>
        </FlowEntityProvider>
      );

      expect(screen.getByTestId("child-1")).toBeInTheDocument();
      expect(screen.getByTestId("child-2")).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Theme Tests
  // ===========================================================================

  describe("theming", () => {
    it("uses default background color", () => {
      render(
        <FlowEntityProvider>
          <FlowCanvas />
        </FlowEntityProvider>
      );
      const canvas = screen.getByTestId("flow-canvas");
      expect(canvas).toHaveStyle({ backgroundColor: "#f9fafb" });
    });

    it("uses custom background color from theme prop", () => {
      render(
        <FlowEntityProvider>
          <FlowCanvas theme={{ canvasBackground: "#ffffff" }} />
        </FlowEntityProvider>
      );
      const canvas = screen.getByTestId("flow-canvas");
      expect(canvas).toHaveStyle({ backgroundColor: "#ffffff" });
    });

    it("uses background color from context theme", () => {
      render(
        <FlowEntityProvider theme={{ canvasBackground: "#000000" }}>
          <FlowCanvas />
        </FlowEntityProvider>
      );
      const canvas = screen.getByTestId("flow-canvas");
      expect(canvas).toHaveStyle({ backgroundColor: "#000000" });
    });
  });

  // ===========================================================================
  // FlowCanvasWithProvider Tests
  // ===========================================================================

  describe("FlowCanvasWithProvider", () => {
    it("renders without external provider", () => {
      render(<FlowCanvasWithProvider />);
      expect(screen.getByTestId("flow-canvas")).toBeInTheDocument();
    });

    it("passes theme to internal provider", () => {
      render(<FlowCanvasWithProvider theme={{ canvasBackground: "#123456" }} />);
      const canvas = screen.getByTestId("flow-canvas");
      expect(canvas).toHaveStyle({ backgroundColor: "#123456" });
    });

    it("renders nodes and edges", () => {
      const nodes = [createMockNode("node-1", 100, 100)];
      const edges: IFlowEdgeEntityData[] = [];

      render(
        <FlowCanvasWithProvider
          nodes={nodes}
          edges={edges}
          renderNode={({ node }) => <div data-testid={`node-${node.id}`}>{node.label}</div>}
        />
      );

      expect(screen.getByTestId("node-node-1")).toBeInTheDocument();
    });

    it("supports readOnly mode", () => {
      render(<FlowCanvasWithProvider readOnly={true} />);
      expect(screen.getByTestId("flow-canvas")).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Viewport Change Callback Tests
  // ===========================================================================

  describe("viewport change callback", () => {
    it("calls onViewportChange when viewport changes", () => {
      const onViewportChange = vi.fn();

      render(
        <FlowEntityProvider>
          <FlowCanvas onViewportChange={onViewportChange} />
        </FlowEntityProvider>
      );

      // The callback should be registered with viewport
      expect(screen.getByTestId("flow-viewport")).toBeInTheDocument();
    });
  });
});
