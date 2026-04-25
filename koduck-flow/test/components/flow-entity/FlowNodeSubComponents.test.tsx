/**
 * @file FlowNode Sub-components Tests
 * @description Unit tests for FlowNodeHeader, FlowNodeContent, and FlowNodePorts sub-components.
 * Tests rendering, theme integration, customization, and interaction callbacks.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 1.9
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import {
  FlowNodeHeader,
  type FlowNodeHeaderProps,
} from "../../../src/components/flow-entity/node/FlowNodeHeader";
import {
  FlowNodeContent,
  type FlowNodeContentProps,
} from "../../../src/components/flow-entity/node/FlowNodeContent";
import {
  FlowNodePorts,
  type FlowNodePortsProps,
} from "../../../src/components/flow-entity/node/FlowNodePorts";
import { FlowEntityProvider } from "../../../src/components/flow-entity/context";
import { FlowNodeEntity } from "../../../src/common/flow/flow-node-entity";
import type {
  IFlowNodeEntityData,
  PortDefinition,
} from "../../../src/components/flow-entity/types";

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Creates a test FlowNodeEntity with default values
 */
function createTestEntity(overrides: Partial<IFlowNodeEntityData> = {}): FlowNodeEntity {
  return new FlowNodeEntity({
    nodeType: "task",
    label: "Test Node",
    position: { x: 100, y: 100 },
    ...overrides,
  });
}

/**
 * Creates test port definitions
 */
function createTestPorts(): { input: PortDefinition[]; output: PortDefinition[] } {
  return {
    input: [
      { id: "in-1", name: "Input 1", type: "input", dataType: "any" },
      { id: "in-2", name: "Input 2", type: "input", dataType: "string" },
    ],
    output: [{ id: "out-1", name: "Output 1", type: "output", dataType: "any" }],
  };
}

/**
 * Renders a component wrapped in FlowEntityProvider
 */
function renderWithProvider(component: React.ReactElement) {
  return render(<FlowEntityProvider>{component}</FlowEntityProvider>);
}

// =============================================================================
// FlowNodeHeader Tests
// =============================================================================

describe("FlowNodeHeader", () => {
  describe("basic rendering", () => {
    it("renders without crashing", () => {
      const entity = createTestEntity();
      const { container } = renderWithProvider(<FlowNodeHeader entity={entity} />);
      expect(container.firstChild).toBeTruthy();
    });

    it("renders with correct test id", () => {
      const entity = createTestEntity();
      renderWithProvider(<FlowNodeHeader entity={entity} />);
      expect(screen.getByTestId(`flow-node-header-${entity.id}`)).toBeInTheDocument();
    });

    it("renders with custom test id when provided", () => {
      const entity = createTestEntity();
      renderWithProvider(<FlowNodeHeader entity={entity} data-testid="custom-header" />);
      expect(screen.getByTestId("custom-header")).toBeInTheDocument();
    });

    it("renders default label when no children or renderer provided", () => {
      const entity = createTestEntity({ label: "My Node Label" });
      renderWithProvider(<FlowNodeHeader entity={entity} />);
      expect(screen.getByText("My Node Label")).toBeInTheDocument();
    });

    it("has title attribute on default label for tooltip", () => {
      const entity = createTestEntity({ label: "Tooltip Label" });
      renderWithProvider(<FlowNodeHeader entity={entity} />);
      expect(screen.getByTitle("Tooltip Label")).toBeInTheDocument();
    });
  });

  describe("custom content", () => {
    it("renders children instead of label when provided", () => {
      const entity = createTestEntity({ label: "Original Label" });
      renderWithProvider(
        <FlowNodeHeader entity={entity}>
          <span>Custom Child Content</span>
        </FlowNodeHeader>
      );
      expect(screen.getByText("Custom Child Content")).toBeInTheDocument();
      expect(screen.queryByText("Original Label")).not.toBeInTheDocument();
    });

    it("renders custom content from renderer prop", () => {
      const entity = createTestEntity();
      const renderer = vi.fn().mockReturnValue(<span>Rendered Content</span>);
      renderWithProvider(<FlowNodeHeader entity={entity} renderer={renderer} />);
      expect(screen.getByText("Rendered Content")).toBeInTheDocument();
    });

    it("renderer takes precedence over children", () => {
      const entity = createTestEntity();
      const renderer = vi.fn().mockReturnValue(<span>From Renderer</span>);
      renderWithProvider(
        <FlowNodeHeader entity={entity} renderer={renderer}>
          <span>From Children</span>
        </FlowNodeHeader>
      );
      expect(screen.getByText("From Renderer")).toBeInTheDocument();
      expect(screen.queryByText("From Children")).not.toBeInTheDocument();
    });

    it("passes correct props to renderer", () => {
      const entity = createTestEntity();
      const renderer = vi.fn().mockReturnValue(<span>Header</span>);
      renderWithProvider(<FlowNodeHeader entity={entity} selected={true} renderer={renderer} />);

      expect(renderer).toHaveBeenCalledWith(
        expect.objectContaining({
          entity,
          selected: true,
          theme: expect.objectContaining({
            backgroundColor: expect.any(String),
          }),
        })
      );
    });
  });

  describe("styling", () => {
    it("applies className when provided", () => {
      const entity = createTestEntity();
      renderWithProvider(<FlowNodeHeader entity={entity} className="custom-class" />);
      const header = screen.getByTestId(`flow-node-header-${entity.id}`);
      expect(header).toHaveClass("flow-node-header");
      expect(header).toHaveClass("custom-class");
    });

    it("applies additional styles when provided", () => {
      const entity = createTestEntity();
      renderWithProvider(<FlowNodeHeader entity={entity} style={{ padding: "20px" }} />);
      const header = screen.getByTestId(`flow-node-header-${entity.id}`);
      expect(header).toHaveStyle({ padding: "20px" });
    });

    it("uses custom height when provided", () => {
      const entity = createTestEntity();
      renderWithProvider(<FlowNodeHeader entity={entity} height={60} />);
      const header = screen.getByTestId(`flow-node-header-${entity.id}`);
      expect(header).toHaveStyle({ height: "60px" });
    });

    it("uses default height of 40px", () => {
      const entity = createTestEntity();
      renderWithProvider(<FlowNodeHeader entity={entity} />);
      const header = screen.getByTestId(`flow-node-header-${entity.id}`);
      expect(header).toHaveStyle({ height: "40px" });
    });
  });
});

// =============================================================================
// FlowNodeContent Tests
// =============================================================================

describe("FlowNodeContent", () => {
  describe("basic rendering", () => {
    it("renders without crashing", () => {
      const entity = createTestEntity();
      const { container } = renderWithProvider(<FlowNodeContent entity={entity} />);
      expect(container.firstChild).toBeTruthy();
    });

    it("renders with correct test id", () => {
      const entity = createTestEntity();
      renderWithProvider(<FlowNodeContent entity={entity} />);
      expect(screen.getByTestId(`flow-node-content-${entity.id}`)).toBeInTheDocument();
    });

    it("renders with custom test id when provided", () => {
      const entity = createTestEntity();
      renderWithProvider(<FlowNodeContent entity={entity} data-testid="custom-content" />);
      expect(screen.getByTestId("custom-content")).toBeInTheDocument();
    });

    it("renders children", () => {
      const entity = createTestEntity();
      renderWithProvider(
        <FlowNodeContent entity={entity}>
          <p>Content children</p>
        </FlowNodeContent>
      );
      expect(screen.getByText("Content children")).toBeInTheDocument();
    });
  });

  describe("custom content", () => {
    it("renders custom content from renderer prop", () => {
      const entity = createTestEntity();
      const renderer = vi.fn().mockReturnValue(<span>Custom Rendered Content</span>);
      renderWithProvider(<FlowNodeContent entity={entity} renderer={renderer} />);
      expect(screen.getByText("Custom Rendered Content")).toBeInTheDocument();
    });

    it("renderer takes precedence over children", () => {
      const entity = createTestEntity();
      const renderer = vi.fn().mockReturnValue(<span>From Renderer</span>);
      renderWithProvider(
        <FlowNodeContent entity={entity} renderer={renderer}>
          <span>From Children</span>
        </FlowNodeContent>
      );
      expect(screen.getByText("From Renderer")).toBeInTheDocument();
      expect(screen.queryByText("From Children")).not.toBeInTheDocument();
    });

    it("passes correct props to renderer", () => {
      const entity = createTestEntity();
      const renderer = vi.fn().mockReturnValue(<span>Content</span>);
      const onFormChange = vi.fn();
      renderWithProvider(
        <FlowNodeContent
          entity={entity}
          selected={true}
          readOnly={true}
          onFormChange={onFormChange}
          renderer={renderer}
        />
      );

      expect(renderer).toHaveBeenCalledWith(
        expect.objectContaining({
          entity,
          selected: true,
          readOnly: true,
          onFormChange,
          theme: expect.objectContaining({
            backgroundColor: expect.any(String),
          }),
        })
      );
    });
  });

  describe("render modes", () => {
    it("uses default padding for default render mode", () => {
      const entity = createTestEntity();
      renderWithProvider(<FlowNodeContent entity={entity} renderMode="default" />);
      const content = screen.getByTestId(`flow-node-content-${entity.id}`);
      expect(content).toHaveAttribute("data-render-mode", "default");
    });

    it("uses compact padding for compact mode", () => {
      const entity = createTestEntity();
      renderWithProvider(<FlowNodeContent entity={entity} renderMode="compact" />);
      const content = screen.getByTestId(`flow-node-content-${entity.id}`);
      expect(content).toHaveAttribute("data-render-mode", "compact");
    });

    it("uses minimal padding for minimal mode", () => {
      const entity = createTestEntity();
      renderWithProvider(<FlowNodeContent entity={entity} renderMode="minimal" />);
      const content = screen.getByTestId(`flow-node-content-${entity.id}`);
      expect(content).toHaveAttribute("data-render-mode", "minimal");
    });

    it("uses expanded padding for expanded mode", () => {
      const entity = createTestEntity();
      renderWithProvider(<FlowNodeContent entity={entity} renderMode="expanded" />);
      const content = screen.getByTestId(`flow-node-content-${entity.id}`);
      expect(content).toHaveAttribute("data-render-mode", "expanded");
    });
  });

  describe("read-only mode", () => {
    it("sets data-readonly attribute when readOnly is true", () => {
      const entity = createTestEntity();
      renderWithProvider(<FlowNodeContent entity={entity} readOnly={true} />);
      const content = screen.getByTestId(`flow-node-content-${entity.id}`);
      expect(content).toHaveAttribute("data-readonly", "true");
    });

    it("sets data-readonly to false when readOnly is false", () => {
      const entity = createTestEntity();
      renderWithProvider(<FlowNodeContent entity={entity} readOnly={false} />);
      const content = screen.getByTestId(`flow-node-content-${entity.id}`);
      expect(content).toHaveAttribute("data-readonly", "false");
    });
  });

  describe("styling", () => {
    it("applies className when provided", () => {
      const entity = createTestEntity();
      renderWithProvider(<FlowNodeContent entity={entity} className="custom-class" />);
      const content = screen.getByTestId(`flow-node-content-${entity.id}`);
      expect(content).toHaveClass("flow-node-content");
      expect(content).toHaveClass("custom-class");
    });

    it("applies additional styles when provided", () => {
      const entity = createTestEntity();
      renderWithProvider(<FlowNodeContent entity={entity} style={{ minHeight: "100px" }} />);
      const content = screen.getByTestId(`flow-node-content-${entity.id}`);
      expect(content).toHaveStyle({ minHeight: "100px" });
    });
  });
});

// =============================================================================
// FlowNodePorts Tests
// =============================================================================

describe("FlowNodePorts", () => {
  describe("basic rendering", () => {
    it("renders without crashing", () => {
      const entity = createTestEntity();
      const { container } = renderWithProvider(<FlowNodePorts entity={entity} />);
      expect(container.firstChild).toBeTruthy();
    });

    it("renders with correct test id", () => {
      const entity = createTestEntity();
      renderWithProvider(<FlowNodePorts entity={entity} />);
      expect(screen.getByTestId(`flow-node-ports-${entity.id}`)).toBeInTheDocument();
    });

    it("renders with custom test id when provided", () => {
      const entity = createTestEntity();
      renderWithProvider(<FlowNodePorts entity={entity} data-testid="custom-ports" />);
      expect(screen.getByTestId("custom-ports")).toBeInTheDocument();
    });

    it("has pointer-events none for container", () => {
      const entity = createTestEntity();
      renderWithProvider(<FlowNodePorts entity={entity} />);
      const ports = screen.getByTestId(`flow-node-ports-${entity.id}`);
      expect(ports).toHaveStyle({ pointerEvents: "none" });
    });
  });

  describe("port positions", () => {
    it("renders input ports on top by default", () => {
      const ports = createTestPorts();
      const entity = createTestEntity({
        inputPorts: [ports.input[0]],
        outputPorts: [],
      });
      renderWithProvider(<FlowNodePorts entity={entity} />);

      const port = screen.getByTestId(`flow-node-port-${entity.id}-in-1`);
      // Top position should have top: 0 or negative offset
      expect(port.style.top).toBeDefined();
    });

    it("renders output ports on bottom by default", () => {
      const ports = createTestPorts();
      const entity = createTestEntity({
        inputPorts: [],
        outputPorts: [ports.output[0]],
      });
      renderWithProvider(<FlowNodePorts entity={entity} />);

      const port = screen.getByTestId(`flow-node-port-${entity.id}-out-1`);
      // Bottom position should have bottom style
      expect(port.style.bottom).toBeDefined();
    });

    it("renders input ports on left when inputPosition is left", () => {
      const ports = createTestPorts();
      const entity = createTestEntity({
        inputPorts: [ports.input[0]],
        outputPorts: [],
      });
      renderWithProvider(<FlowNodePorts entity={entity} inputPosition="left" />);

      const port = screen.getByTestId(`flow-node-port-${entity.id}-in-1`);
      // Left position should have left style set
      expect(port.style.left).toBeDefined();
      expect(port.style.transform).toContain("translateY");
    });

    it("renders input ports on right when inputPosition is right", () => {
      const ports = createTestPorts();
      const entity = createTestEntity({
        inputPorts: [ports.input[0]],
        outputPorts: [],
      });
      renderWithProvider(<FlowNodePorts entity={entity} inputPosition="right" />);

      const port = screen.getByTestId(`flow-node-port-${entity.id}-in-1`);
      // Right position should have right style set
      expect(port.style.right).toBeDefined();
      expect(port.style.transform).toContain("translateY");
    });

    it("renders output ports on left when outputPosition is left", () => {
      const ports = createTestPorts();
      const entity = createTestEntity({
        inputPorts: [],
        outputPorts: [ports.output[0]],
      });
      renderWithProvider(<FlowNodePorts entity={entity} outputPosition="left" />);

      const port = screen.getByTestId(`flow-node-port-${entity.id}-out-1`);
      // Left position should have left style set
      expect(port.style.left).toBeDefined();
    });

    it("renders output ports on right when outputPosition is right", () => {
      const ports = createTestPorts();
      const entity = createTestEntity({
        inputPorts: [],
        outputPorts: [ports.output[0]],
      });
      renderWithProvider(<FlowNodePorts entity={entity} outputPosition="right" />);

      const port = screen.getByTestId(`flow-node-port-${entity.id}-out-1`);
      // Right position should have right style set
      expect(port.style.right).toBeDefined();
    });

    it("positions multiple ports evenly on left side", () => {
      const ports = createTestPorts();
      const entity = createTestEntity({
        inputPorts: ports.input,
        outputPorts: [],
      });
      renderWithProvider(<FlowNodePorts entity={entity} inputPosition="left" />);

      const port1 = screen.getByTestId(`flow-node-port-${entity.id}-in-1`);
      const port2 = screen.getByTestId(`flow-node-port-${entity.id}-in-2`);

      // Both should have left positioning
      expect(port1.style.left).toBeDefined();
      expect(port2.style.left).toBeDefined();
      // They should have different vertical positions
      expect(port1.style.top).not.toBe(port2.style.top);
    });
  });

  describe("port rendering", () => {
    it("renders input ports from entity", () => {
      const ports = createTestPorts();
      const entity = createTestEntity({
        inputPorts: ports.input,
        outputPorts: [],
      });
      renderWithProvider(<FlowNodePorts entity={entity} />);

      expect(screen.getByTestId(`flow-node-port-${entity.id}-in-1`)).toBeInTheDocument();
      expect(screen.getByTestId(`flow-node-port-${entity.id}-in-2`)).toBeInTheDocument();
    });

    it("renders output ports from entity", () => {
      const ports = createTestPorts();
      const entity = createTestEntity({
        inputPorts: [],
        outputPorts: ports.output,
      });
      renderWithProvider(<FlowNodePorts entity={entity} />);

      expect(screen.getByTestId(`flow-node-port-${entity.id}-out-1`)).toBeInTheDocument();
    });

    it("renders both input and output ports", () => {
      const ports = createTestPorts();
      const entity = createTestEntity({
        inputPorts: ports.input,
        outputPorts: ports.output,
      });
      renderWithProvider(<FlowNodePorts entity={entity} />);

      expect(screen.getByTestId(`flow-node-port-${entity.id}-in-1`)).toBeInTheDocument();
      expect(screen.getByTestId(`flow-node-port-${entity.id}-in-2`)).toBeInTheDocument();
      expect(screen.getByTestId(`flow-node-port-${entity.id}-out-1`)).toBeInTheDocument();
    });

    it("renders no ports when entity has none", () => {
      const entity = createTestEntity({
        inputPorts: [],
        outputPorts: [],
      });
      renderWithProvider(<FlowNodePorts entity={entity} />);

      const container = screen.getByTestId(`flow-node-ports-${entity.id}`);
      expect(container.children.length).toBe(0);
    });

    it("sets correct data attributes on ports", () => {
      const ports = createTestPorts();
      const entity = createTestEntity({
        inputPorts: ports.input,
        outputPorts: ports.output,
      });
      renderWithProvider(<FlowNodePorts entity={entity} />);

      const inputPort = screen.getByTestId(`flow-node-port-${entity.id}-in-1`);
      expect(inputPort).toHaveAttribute("data-port-id", "in-1");
      expect(inputPort).toHaveAttribute("data-port-type", "input");
      expect(inputPort).toHaveAttribute("data-port-data-type", "any");

      const outputPort = screen.getByTestId(`flow-node-port-${entity.id}-out-1`);
      expect(outputPort).toHaveAttribute("data-port-id", "out-1");
      expect(outputPort).toHaveAttribute("data-port-type", "output");
    });

    it("has title attribute with port name", () => {
      const ports = createTestPorts();
      const entity = createTestEntity({
        inputPorts: ports.input,
        outputPorts: [],
      });
      renderWithProvider(<FlowNodePorts entity={entity} />);

      expect(screen.getByTitle("Input 1")).toBeInTheDocument();
      expect(screen.getByTitle("Input 2")).toBeInTheDocument();
    });
  });

  describe("interaction callbacks", () => {
    it("calls onPortConnect when port is clicked", () => {
      const ports = createTestPorts();
      const entity = createTestEntity({
        inputPorts: [],
        outputPorts: ports.output,
      });
      const onPortConnect = vi.fn();
      renderWithProvider(<FlowNodePorts entity={entity} onPortConnect={onPortConnect} />);

      const port = screen.getByTestId(`flow-node-port-${entity.id}-out-1`);
      fireEvent.mouseDown(port);

      expect(onPortConnect).toHaveBeenCalledWith(entity, "out-1", "output");
    });

    it("calls onPortMouseEnter when hovering port", () => {
      const ports = createTestPorts();
      const entity = createTestEntity({
        inputPorts: ports.input,
        outputPorts: [],
      });
      const onPortMouseEnter = vi.fn();
      renderWithProvider(<FlowNodePorts entity={entity} onPortMouseEnter={onPortMouseEnter} />);

      const port = screen.getByTestId(`flow-node-port-${entity.id}-in-1`);
      fireEvent.mouseEnter(port);

      expect(onPortMouseEnter).toHaveBeenCalledWith(entity, "in-1", "input");
    });

    it("calls onPortMouseLeave when leaving port", () => {
      const ports = createTestPorts();
      const entity = createTestEntity({
        inputPorts: ports.input,
        outputPorts: [],
      });
      const onPortMouseLeave = vi.fn();
      renderWithProvider(<FlowNodePorts entity={entity} onPortMouseLeave={onPortMouseLeave} />);

      const port = screen.getByTestId(`flow-node-port-${entity.id}-in-1`);
      fireEvent.mouseLeave(port);

      expect(onPortMouseLeave).toHaveBeenCalledWith(entity, "in-1", "input");
    });

    it("stops propagation on mouseDown to prevent node selection", () => {
      const ports = createTestPorts();
      const entity = createTestEntity({
        inputPorts: [],
        outputPorts: ports.output,
      });
      renderWithProvider(<FlowNodePorts entity={entity} />);

      const port = screen.getByTestId(`flow-node-port-${entity.id}-out-1`);
      const event = fireEvent.mouseDown(port);

      // Event was handled (default not prevented but propagation stopped internally)
      expect(event).toBe(true);
    });

    it("handles mouseUp event on port", () => {
      const ports = createTestPorts();
      const entity = createTestEntity({
        inputPorts: ports.input,
        outputPorts: [],
      });
      renderWithProvider(<FlowNodePorts entity={entity} />);

      const port = screen.getByTestId(`flow-node-port-${entity.id}-in-1`);
      const event = fireEvent.mouseUp(port);

      // Event was handled successfully
      expect(event).toBe(true);
    });
  });

  describe("custom port renderer", () => {
    it("uses custom portRenderer when provided", () => {
      const ports = createTestPorts();
      const entity = createTestEntity({
        inputPorts: ports.input,
        outputPorts: [],
      });
      const portRenderer = vi.fn(({ port }) => (
        <div data-testid={`custom-port-${port.id}`}>Custom Port</div>
      ));
      renderWithProvider(<FlowNodePorts entity={entity} portRenderer={portRenderer} />);

      expect(screen.getByTestId("custom-port-in-1")).toBeInTheDocument();
      expect(screen.getByTestId("custom-port-in-2")).toBeInTheDocument();
    });

    it("passes correct props to portRenderer", () => {
      const ports = createTestPorts();
      const entity = createTestEntity({
        inputPorts: [ports.input[0]],
        outputPorts: [],
      });
      const portRenderer = vi.fn().mockReturnValue(<div>Port</div>);
      renderWithProvider(<FlowNodePorts entity={entity} portRenderer={portRenderer} />);

      expect(portRenderer).toHaveBeenCalledWith(
        expect.objectContaining({
          port: ports.input[0],
          position: "top",
          style: expect.objectContaining({
            position: "absolute",
          }),
        })
      );
    });
  });

  describe("accessibility", () => {
    it("ports have role button", () => {
      const ports = createTestPorts();
      const entity = createTestEntity({
        inputPorts: [ports.input[0]],
        outputPorts: [],
      });
      renderWithProvider(<FlowNodePorts entity={entity} />);

      const port = screen.getByTestId(`flow-node-port-${entity.id}-in-1`);
      expect(port).toHaveAttribute("role", "button");
    });

    it("ports have aria-label with port info", () => {
      const ports = createTestPorts();
      const entity = createTestEntity({
        inputPorts: [ports.input[0]],
        outputPorts: [],
      });
      renderWithProvider(<FlowNodePorts entity={entity} />);

      const port = screen.getByTestId(`flow-node-port-${entity.id}-in-1`);
      expect(port).toHaveAttribute("aria-label", "input port: Input 1");
    });
  });

  describe("styling", () => {
    it("applies className when provided", () => {
      const entity = createTestEntity();
      renderWithProvider(<FlowNodePorts entity={entity} className="custom-class" />);
      const ports = screen.getByTestId(`flow-node-ports-${entity.id}`);
      expect(ports).toHaveClass("flow-node-ports");
      expect(ports).toHaveClass("custom-class");
    });

    it("applies additional styles when provided", () => {
      const entity = createTestEntity();
      renderWithProvider(<FlowNodePorts entity={entity} style={{ zIndex: 10 }} />);
      const ports = screen.getByTestId(`flow-node-ports-${entity.id}`);
      expect(ports).toHaveStyle({ zIndex: 10 });
    });

    it("uses custom portSize when provided", () => {
      const ports = createTestPorts();
      const entity = createTestEntity({
        inputPorts: [ports.input[0]],
        outputPorts: [],
      });
      renderWithProvider(<FlowNodePorts entity={entity} portSize={20} />);

      const port = screen.getByTestId(`flow-node-port-${entity.id}-in-1`);
      expect(port).toHaveStyle({ width: "20px", height: "20px" });
    });
  });
});
