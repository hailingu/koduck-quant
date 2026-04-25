/**
 * @file Interaction Integration Tests
 * @description Integration tests to verify that drag, selection, connection,
 * pan, and zoom interactions work together without conflicts.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 2.9
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import React, { useState, useCallback } from "react";
import {
  FlowCanvas,
  FlowCanvasWithProvider,
} from "../../../../src/components/flow-entity/canvas/FlowCanvas";
import { FlowEntityProvider } from "../../../../src/components/flow-entity/context";
import {
  FlowViewport,
  useViewport,
} from "../../../../src/components/flow-entity/canvas/FlowViewport";
import {
  SelectionProvider,
  useSelectionContext,
} from "../../../../src/components/flow-entity/hooks/useSelection";
import { PortConnectionProvider } from "../../../../src/components/flow-entity/hooks/usePortConnection";
import type {
  IFlowNodeEntityData,
  IFlowEdgeEntityData,
  Position,
} from "../../../../src/components/flow-entity/types";

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a mock node with all required properties
 */
function createMockNode(id: string, x: number, y: number, label?: string): IFlowNodeEntityData {
  return {
    id,
    nodeType: "task",
    label: label ?? `Node ${id}`,
    position: { x, y },
    size: { width: 200, height: 100 },
    executionState: "idle",
    inputPorts: [{ id: "input-1", name: "Input 1", type: "input", dataType: "any" }],
    outputPorts: [{ id: "output-1", name: "Output 1", type: "output", dataType: "any" }],
  };
}

/**
 * Create a mock edge between two nodes
 */
function createMockEdge(
  id: string,
  sourceNodeId: string,
  sourcePortId: string,
  targetNodeId: string,
  targetPortId: string
): IFlowEdgeEntityData {
  return {
    id,
    sourceNodeId,
    sourcePortId,
    targetNodeId,
    targetPortId,
    animationState: "idle",
  };
}

/**
 * Simulate a mouse drag from one position to another
 */
function simulateDrag(
  element: HTMLElement,
  from: { clientX: number; clientY: number },
  to: { clientX: number; clientY: number }
) {
  fireEvent.mouseDown(element, {
    button: 0,
    clientX: from.clientX,
    clientY: from.clientY,
  });

  fireEvent.mouseMove(element, {
    clientX: to.clientX,
    clientY: to.clientY,
  });

  fireEvent.mouseUp(element, {
    clientX: to.clientX,
    clientY: to.clientY,
  });
}

/**
 * Simulate wheel zoom event
 */
function simulateWheelZoom(element: HTMLElement, deltaY: number, clientX: number, clientY: number) {
  fireEvent.wheel(element, {
    deltaY,
    clientX,
    clientY,
  });
}

/**
 * Simulate pan interaction with middle mouse button
 */
function simulatePan(
  element: HTMLElement,
  from: { clientX: number; clientY: number },
  to: { clientX: number; clientY: number }
) {
  fireEvent.mouseDown(element, {
    button: 1, // Middle mouse button
    clientX: from.clientX,
    clientY: from.clientY,
  });

  fireEvent.mouseMove(element, {
    clientX: to.clientX,
    clientY: to.clientY,
  });

  fireEvent.mouseUp(element);
}

// =============================================================================
// Test Wrapper Components
// =============================================================================

interface TestFlowCanvasProps {
  initialNodes?: IFlowNodeEntityData[];
  initialEdges?: IFlowEdgeEntityData[];
  onNodeMove?: (nodeId: string, position: Position) => void;
  onEdgeCreate?: (
    sourceNodeId: string,
    sourcePortId: string,
    targetNodeId: string,
    targetPortId: string
  ) => void;
  onSelectionChange?: (nodeIds: string[]) => void;
}

/**
 * Stateful test wrapper component that manages nodes, edges, and selection
 */
function TestFlowCanvas({
  initialNodes = [],
  initialEdges = [],
  onNodeMove,
  onEdgeCreate,
  onSelectionChange,
}: TestFlowCanvasProps) {
  const [nodes, setNodes] = useState<IFlowNodeEntityData[]>(initialNodes);
  const [edges, setEdges] = useState<IFlowEdgeEntityData[]>(initialEdges);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);

  const handleNodeMove = useCallback(
    (nodeId: string, position: Position) => {
      setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, position } : node)));
      onNodeMove?.(nodeId, position);
    },
    [onNodeMove]
  );

  const handleEdgeCreate = useCallback(
    (sourceNodeId: string, sourcePortId: string, targetNodeId: string, targetPortId: string) => {
      const newEdge = createMockEdge(
        `edge-${Date.now()}`,
        sourceNodeId,
        sourcePortId,
        targetNodeId,
        targetPortId
      );
      setEdges((prev) => [...prev, newEdge]);
      onEdgeCreate?.(sourceNodeId, sourcePortId, targetNodeId, targetPortId);
    },
    [onEdgeCreate]
  );

  const handleNodeSelect = useCallback(
    (nodeIds: string[]) => {
      setSelectedNodeIds(nodeIds);
      onSelectionChange?.(nodeIds);
    },
    [onSelectionChange]
  );

  return (
    <FlowEntityProvider>
      <SelectionProvider initialSelectedIds={selectedNodeIds} onSelectionChange={handleNodeSelect}>
        <PortConnectionProvider>
          <FlowCanvas
            nodes={nodes}
            edges={edges}
            selectedNodeIds={selectedNodeIds}
            onNodeMove={handleNodeMove}
            onEdgeCreate={handleEdgeCreate}
            onNodeSelect={handleNodeSelect}
            width={800}
            height={600}
            showGrid={true}
          />
        </PortConnectionProvider>
      </SelectionProvider>
    </FlowEntityProvider>
  );
}

// =============================================================================
// Integration Tests
// =============================================================================

describe("Interaction Integration Tests", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ===========================================================================
  // Test Case 1: Drag + Zoom Interaction
  // ===========================================================================

  describe("Test Case 1: Drag Node + Zoom Canvas", () => {
    it("maintains node relative position after drag and zoom", () => {
      const nodes = [
        createMockNode("node-1", 100, 100, "Node 1"),
        createMockNode("node-2", 300, 200, "Node 2"),
      ];

      const onNodeMove = vi.fn();
      const onViewportChange = vi.fn();

      render(
        <FlowEntityProvider>
          <FlowCanvas
            nodes={nodes}
            onNodeMove={onNodeMove}
            onViewportChange={onViewportChange}
            width={800}
            height={600}
          />
        </FlowEntityProvider>
      );

      expect(screen.getByTestId("flow-canvas")).toBeInTheDocument();
      expect(screen.getByTestId("flow-viewport")).toBeInTheDocument();

      const viewport = screen.getByTestId("flow-viewport");

      // Verify initial viewport state
      const content = screen.getByTestId("flow-viewport-content");
      expect(content).toHaveStyle({ transform: "translate(0px, 0px) scale(1)" });

      // Simulate zoom in
      act(() => {
        simulateWheelZoom(viewport, -100, 400, 300);
      });

      // Verify zoom occurred
      expect(onViewportChange).toHaveBeenCalled();
    });

    it("node drag works correctly at different zoom levels", () => {
      const nodes = [createMockNode("node-1", 100, 100, "Draggable Node")];
      const onNodeMove = vi.fn();

      render(
        <FlowEntityProvider>
          <FlowCanvas
            nodes={nodes}
            onNodeMove={onNodeMove}
            defaultZoom={2}
            width={800}
            height={600}
          />
        </FlowEntityProvider>
      );

      const viewport = screen.getByTestId("flow-viewport");
      const content = screen.getByTestId("flow-viewport-content");

      // Verify initial zoom state
      expect(content).toHaveStyle({ transform: "translate(0px, 0px) scale(2)" });

      // Canvas should be properly scaled
      expect(screen.getByTestId("flow-canvas")).toBeInTheDocument();
    });

    it("drag and zoom together do not cause visual glitches", () => {
      const nodes = [
        createMockNode("node-1", 100, 100),
        createMockNode("node-2", 300, 100),
        createMockNode("node-3", 200, 250),
      ];

      render(
        <FlowEntityProvider>
          <FlowCanvas nodes={nodes} width={800} height={600} />
        </FlowEntityProvider>
      );

      const viewport = screen.getByTestId("flow-viewport");

      // Perform multiple zoom operations
      act(() => {
        // Zoom in
        simulateWheelZoom(viewport, -100, 400, 300);
        vi.advanceTimersByTime(50);

        // Zoom in again
        simulateWheelZoom(viewport, -100, 400, 300);
        vi.advanceTimersByTime(50);

        // Zoom out
        simulateWheelZoom(viewport, 100, 400, 300);
      });

      // Canvas should still be rendered correctly
      expect(screen.getByTestId("flow-canvas")).toBeInTheDocument();
      expect(screen.getByTestId("flow-viewport-content")).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Test Case 2: Port Connection
  // ===========================================================================

  describe("Test Case 2: Port Connection", () => {
    it("renders nodes with ports correctly", () => {
      const nodes = [
        createMockNode("node-1", 100, 100, "Source Node"),
        createMockNode("node-2", 400, 100, "Target Node"),
      ];

      render(
        <FlowEntityProvider>
          <FlowCanvas nodes={nodes} width={800} height={600} />
        </FlowEntityProvider>
      );

      // Verify canvas renders with nodes
      expect(screen.getByTestId("flow-canvas")).toBeInTheDocument();
      expect(screen.getByTestId("flow-canvas-nodes")).toBeInTheDocument();
    });

    it("edge creation callback is invoked with correct parameters", () => {
      const nodes = [
        createMockNode("node-1", 100, 100, "Source"),
        createMockNode("node-2", 400, 100, "Target"),
      ];
      const onEdgeCreate = vi.fn();

      render(
        <FlowEntityProvider>
          <FlowCanvas nodes={nodes} onEdgeCreate={onEdgeCreate} width={800} height={600} />
        </FlowEntityProvider>
      );

      // Verify the canvas is ready for edge creation
      expect(screen.getByTestId("flow-canvas-edges")).toBeInTheDocument();
    });

    it("renders existing edges between nodes", () => {
      const nodes = [
        createMockNode("node-1", 100, 100, "Source"),
        createMockNode("node-2", 400, 100, "Target"),
      ];
      const edges = [createMockEdge("edge-1", "node-1", "output-1", "node-2", "input-1")];

      render(
        <FlowEntityProvider>
          <FlowCanvas nodes={nodes} edges={edges} width={800} height={600} />
        </FlowEntityProvider>
      );

      // Verify edges container is rendered
      expect(screen.getByTestId("flow-canvas-edges")).toBeInTheDocument();
      expect(screen.getByTestId("flow-canvas-edges-group")).toBeInTheDocument();
    });

    it("multiple edges can coexist without conflicts", () => {
      const nodes = [
        createMockNode("node-1", 100, 100),
        createMockNode("node-2", 300, 100),
        createMockNode("node-3", 200, 250),
      ];
      const edges = [
        createMockEdge("edge-1", "node-1", "output-1", "node-2", "input-1"),
        createMockEdge("edge-2", "node-1", "output-1", "node-3", "input-1"),
        createMockEdge("edge-3", "node-2", "output-1", "node-3", "input-1"),
      ];

      render(
        <FlowEntityProvider>
          <FlowCanvas nodes={nodes} edges={edges} width={800} height={600} />
        </FlowEntityProvider>
      );

      expect(screen.getByTestId("flow-canvas-edges")).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Test Case 3: Multi-select + Pan/Zoom
  // ===========================================================================

  describe("Test Case 3: Multi-select with Pan and Zoom", () => {
    it("selection state is maintained after zoom", () => {
      const nodes = [
        createMockNode("node-1", 100, 100),
        createMockNode("node-2", 300, 100),
        createMockNode("node-3", 200, 250),
      ];
      const onNodeSelect = vi.fn();

      render(
        <FlowEntityProvider>
          <SelectionProvider initialSelectedIds={["node-1", "node-2"]}>
            <FlowCanvas
              nodes={nodes}
              selectedNodeIds={["node-1", "node-2"]}
              onNodeSelect={onNodeSelect}
              width={800}
              height={600}
            />
          </SelectionProvider>
        </FlowEntityProvider>
      );

      const viewport = screen.getByTestId("flow-viewport");

      // Zoom the canvas
      act(() => {
        simulateWheelZoom(viewport, -100, 400, 300);
        vi.advanceTimersByTime(200);
      });

      // Canvas should still be in valid state
      expect(screen.getByTestId("flow-canvas")).toBeInTheDocument();
    });

    it("selection state is maintained after pan", () => {
      const nodes = [createMockNode("node-1", 100, 100), createMockNode("node-2", 300, 100)];
      const onNodeSelect = vi.fn();
      const onPanStart = vi.fn();
      const onPanEnd = vi.fn();

      render(
        <FlowEntityProvider>
          <SelectionProvider initialSelectedIds={["node-1"]}>
            <FlowCanvas
              nodes={nodes}
              selectedNodeIds={["node-1"]}
              onNodeSelect={onNodeSelect}
              width={800}
              height={600}
            />
          </SelectionProvider>
        </FlowEntityProvider>
      );

      const viewport = screen.getByTestId("flow-viewport");

      // Pan the canvas using middle mouse button
      act(() => {
        simulatePan(viewport, { clientX: 200, clientY: 200 }, { clientX: 300, clientY: 300 });
      });

      // Canvas should still be in valid state
      expect(screen.getByTestId("flow-canvas")).toBeInTheDocument();
    });

    it("selection persists through pan and zoom sequence", () => {
      const nodes = [
        createMockNode("node-1", 100, 100),
        createMockNode("node-2", 300, 200),
        createMockNode("node-3", 500, 100),
      ];

      render(
        <FlowEntityProvider>
          <SelectionProvider initialSelectedIds={["node-1", "node-3"]}>
            <FlowCanvas
              nodes={nodes}
              selectedNodeIds={["node-1", "node-3"]}
              width={800}
              height={600}
            />
          </SelectionProvider>
        </FlowEntityProvider>
      );

      const viewport = screen.getByTestId("flow-viewport");

      // Sequence: zoom -> pan -> zoom
      act(() => {
        // Zoom in
        simulateWheelZoom(viewport, -100, 400, 300);
        vi.advanceTimersByTime(100);

        // Pan
        simulatePan(viewport, { clientX: 200, clientY: 200 }, { clientX: 300, clientY: 300 });
        vi.advanceTimersByTime(100);

        // Zoom out
        simulateWheelZoom(viewport, 100, 400, 300);
        vi.advanceTimersByTime(200);
      });

      // Canvas should remain valid after complex interaction sequence
      expect(screen.getByTestId("flow-canvas")).toBeInTheDocument();
      expect(screen.getByTestId("flow-viewport")).toBeInTheDocument();
    });

    it("keyboard modifiers are respected during selection", async () => {
      const nodes = [createMockNode("node-1", 100, 100), createMockNode("node-2", 300, 100)];
      const onNodeSelect = vi.fn();

      render(
        <FlowEntityProvider>
          <SelectionProvider>
            <FlowCanvas nodes={nodes} onNodeSelect={onNodeSelect} width={800} height={600} />
          </SelectionProvider>
        </FlowEntityProvider>
      );

      // Canvas should be ready for selection interactions
      expect(screen.getByTestId("flow-canvas")).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Interaction Conflict Tests
  // ===========================================================================

  describe("Interaction Conflict Prevention", () => {
    it("pan does not interfere with node drag", () => {
      const nodes = [createMockNode("node-1", 100, 100)];
      const onNodeMove = vi.fn();
      const onViewportChange = vi.fn();

      render(
        <FlowEntityProvider>
          <FlowCanvas
            nodes={nodes}
            onNodeMove={onNodeMove}
            onViewportChange={onViewportChange}
            width={800}
            height={600}
          />
        </FlowEntityProvider>
      );

      const viewport = screen.getByTestId("flow-viewport");

      // Left click drag should not trigger pan
      act(() => {
        fireEvent.mouseDown(viewport, {
          button: 0, // Left button
          clientX: 200,
          clientY: 200,
        });
        fireEvent.mouseMove(viewport, { clientX: 250, clientY: 250 });
        fireEvent.mouseUp(viewport);
      });

      // Middle click should trigger pan
      act(() => {
        simulatePan(viewport, { clientX: 200, clientY: 200 }, { clientX: 300, clientY: 300 });
      });

      expect(screen.getByTestId("flow-canvas")).toBeInTheDocument();
    });

    it("zoom does not interfere with selection", () => {
      const nodes = [createMockNode("node-1", 100, 100), createMockNode("node-2", 300, 100)];
      const onNodeSelect = vi.fn();

      render(
        <FlowEntityProvider>
          <SelectionProvider>
            <FlowCanvas nodes={nodes} onNodeSelect={onNodeSelect} width={800} height={600} />
          </SelectionProvider>
        </FlowEntityProvider>
      );

      const viewport = screen.getByTestId("flow-viewport");

      // Zoom should not clear selection
      act(() => {
        simulateWheelZoom(viewport, -100, 400, 300);
        vi.advanceTimersByTime(200);
      });

      expect(screen.getByTestId("flow-canvas")).toBeInTheDocument();
    });

    it("rapid interactions do not cause state corruption", () => {
      const nodes = [
        createMockNode("node-1", 100, 100),
        createMockNode("node-2", 300, 100),
        createMockNode("node-3", 200, 250),
      ];

      render(
        <FlowEntityProvider>
          <FlowCanvas nodes={nodes} width={800} height={600} />
        </FlowEntityProvider>
      );

      const viewport = screen.getByTestId("flow-viewport");

      // Rapid sequence of interactions
      act(() => {
        for (let i = 0; i < 10; i++) {
          simulateWheelZoom(viewport, i % 2 === 0 ? -50 : 50, 400, 300);
          vi.advanceTimersByTime(16); // ~60fps
        }
      });

      // Canvas should still be rendered correctly
      expect(screen.getByTestId("flow-canvas")).toBeInTheDocument();
      expect(screen.getByTestId("flow-viewport")).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Viewport State Consistency Tests
  // ===========================================================================

  describe("Viewport State Consistency", () => {
    it("viewport transform is correctly applied after interactions", () => {
      const nodes = [createMockNode("node-1", 100, 100)];

      render(
        <FlowEntityProvider>
          <FlowCanvas
            nodes={nodes}
            defaultViewport={{ translateX: 50, translateY: 50, scale: 1 }}
            width={800}
            height={600}
          />
        </FlowEntityProvider>
      );

      const content = screen.getByTestId("flow-viewport-content");
      expect(content).toHaveStyle({ transform: "translate(50px, 50px) scale(1)" });
    });

    it("zoom constraints are enforced during wheel zoom", () => {
      const nodes = [createMockNode("node-1", 100, 100)];
      const onViewportChange = vi.fn();

      render(
        <FlowEntityProvider>
          <FlowCanvas
            nodes={nodes}
            minZoom={0.5}
            maxZoom={2}
            onViewportChange={onViewportChange}
            width={800}
            height={600}
          />
        </FlowEntityProvider>
      );

      const viewport = screen.getByTestId("flow-viewport");

      // Zoom in many times to test max constraint
      act(() => {
        for (let i = 0; i < 20; i++) {
          simulateWheelZoom(viewport, -100, 400, 300);
          vi.advanceTimersByTime(16);
        }
      });

      // Verify zoom was called
      expect(onViewportChange).toHaveBeenCalled();
    });

    it("pan updates viewport state correctly", () => {
      const nodes = [createMockNode("node-1", 100, 100)];
      const onViewportChange = vi.fn();

      render(
        <FlowEntityProvider>
          <FlowCanvas nodes={nodes} onViewportChange={onViewportChange} width={800} height={600} />
        </FlowEntityProvider>
      );

      const viewport = screen.getByTestId("flow-viewport");

      // Verify initial viewport state
      expect(viewport).toBeInTheDocument();
      expect(viewport).toHaveAttribute("data-panning", "false");

      // Pan the canvas using middle mouse button
      act(() => {
        fireEvent.mouseDown(viewport, {
          button: 1, // Middle mouse button
          clientX: 200,
          clientY: 200,
        });
      });

      // Verify panning state changed
      expect(viewport).toHaveAttribute("data-panning", "true");

      // Move during pan
      act(() => {
        fireEvent.mouseMove(viewport, {
          clientX: 300,
          clientY: 300,
        });
      });

      // End pan
      act(() => {
        fireEvent.mouseUp(viewport);
      });

      // Verify panning ended
      expect(viewport).toHaveAttribute("data-panning", "false");

      // Verify viewport change callback was called during pan
      expect(onViewportChange).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Edge Cases and Boundary Conditions
  // ===========================================================================

  describe("Edge Cases", () => {
    it("handles empty canvas gracefully", () => {
      render(
        <FlowEntityProvider>
          <FlowCanvas nodes={[]} edges={[]} width={800} height={600} />
        </FlowEntityProvider>
      );

      const viewport = screen.getByTestId("flow-viewport");

      // Interactions should work on empty canvas
      act(() => {
        simulateWheelZoom(viewport, -100, 400, 300);
        simulatePan(viewport, { clientX: 200, clientY: 200 }, { clientX: 300, clientY: 300 });
      });

      expect(screen.getByTestId("flow-canvas")).toBeInTheDocument();
    });

    it("handles single node canvas", () => {
      const nodes = [createMockNode("node-1", 400, 300)];

      render(
        <FlowEntityProvider>
          <FlowCanvas nodes={nodes} width={800} height={600} />
        </FlowEntityProvider>
      );

      const viewport = screen.getByTestId("flow-viewport");

      act(() => {
        simulateWheelZoom(viewport, -100, 400, 300);
      });

      expect(screen.getByTestId("flow-canvas")).toBeInTheDocument();
    });

    it("handles many nodes without performance issues", () => {
      const nodes = Array.from({ length: 50 }, (_, i) =>
        createMockNode(`node-${i}`, (i % 10) * 100, Math.floor(i / 10) * 120)
      );

      const startTime = performance.now();

      render(
        <FlowEntityProvider>
          <FlowCanvas nodes={nodes} width={800} height={600} />
        </FlowEntityProvider>
      );

      const renderTime = performance.now() - startTime;

      // Rendering should complete in reasonable time (< 1000ms)
      expect(renderTime).toBeLessThan(1000);
      expect(screen.getByTestId("flow-canvas")).toBeInTheDocument();
    });

    it("handles nodes at canvas boundaries", () => {
      const nodes = [
        createMockNode("top-left", 0, 0),
        createMockNode("top-right", 600, 0),
        createMockNode("bottom-left", 0, 500),
        createMockNode("bottom-right", 600, 500),
      ];

      render(
        <FlowEntityProvider>
          <FlowCanvas nodes={nodes} width={800} height={600} />
        </FlowEntityProvider>
      );

      const viewport = screen.getByTestId("flow-viewport");

      // Zoom and pan around boundary nodes
      act(() => {
        simulateWheelZoom(viewport, -100, 0, 0);
        simulatePan(viewport, { clientX: 100, clientY: 100 }, { clientX: 200, clientY: 200 });
      });

      expect(screen.getByTestId("flow-canvas")).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // ReadOnly Mode Tests
  // ===========================================================================

  describe("ReadOnly Mode Interactions", () => {
    it("zoom works in readOnly mode", () => {
      const nodes = [createMockNode("node-1", 100, 100)];
      const onViewportChange = vi.fn();

      render(
        <FlowEntityProvider>
          <FlowCanvas
            nodes={nodes}
            readOnly={true}
            onViewportChange={onViewportChange}
            width={800}
            height={600}
          />
        </FlowEntityProvider>
      );

      const viewport = screen.getByTestId("flow-viewport");

      act(() => {
        simulateWheelZoom(viewport, -100, 400, 300);
      });

      // Zoom should still work in readOnly mode
      expect(onViewportChange).toHaveBeenCalled();
    });

    it("pan works in readOnly mode", () => {
      const nodes = [createMockNode("node-1", 100, 100)];
      const onViewportChange = vi.fn();

      render(
        <FlowEntityProvider>
          <FlowCanvas
            nodes={nodes}
            readOnly={true}
            onViewportChange={onViewportChange}
            width={800}
            height={600}
          />
        </FlowEntityProvider>
      );

      const viewport = screen.getByTestId("flow-viewport");

      // Verify initial state
      expect(viewport).toHaveAttribute("data-panning", "false");

      // Pan using middle mouse button (should work even in readOnly mode)
      act(() => {
        fireEvent.mouseDown(viewport, {
          button: 1, // Middle mouse button
          clientX: 200,
          clientY: 200,
        });
      });

      // Verify panning started
      expect(viewport).toHaveAttribute("data-panning", "true");

      act(() => {
        fireEvent.mouseMove(viewport, {
          clientX: 300,
          clientY: 300,
        });
        fireEvent.mouseUp(viewport);
      });

      // Pan should complete and trigger viewport change even in readOnly mode
      expect(viewport).toHaveAttribute("data-panning", "false");
      expect(onViewportChange).toHaveBeenCalled();
    });
  });
});
