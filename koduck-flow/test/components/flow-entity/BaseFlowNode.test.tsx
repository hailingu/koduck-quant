/**
 * @file BaseFlowNode Component Tests
 * @description Unit tests for BaseFlowNode skeleton component.
 * Tests rendering, theme integration, header/content customization, and click handling.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 1.8
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import {
  BaseFlowNode,
  type BaseFlowNodeProps,
} from "../../../src/components/flow-entity/node/BaseFlowNode";
import { FlowEntityProvider } from "../../../src/components/flow-entity/context";
import { FlowNodeEntity } from "../../../src/common/flow/flow-node-entity";
import type { IFlowNodeEntityData } from "../../../src/components/flow-entity/types";

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
 * Renders BaseFlowNode wrapped in FlowEntityProvider
 */
function renderWithProvider(props: Partial<BaseFlowNodeProps> & { entity?: FlowNodeEntity } = {}) {
  const entity = props.entity ?? createTestEntity();
  return render(
    <FlowEntityProvider>
      <BaseFlowNode entity={entity} {...props} />
    </FlowEntityProvider>
  );
}

// =============================================================================
// Test Suites
// =============================================================================

describe("BaseFlowNode", () => {
  describe("basic rendering", () => {
    it("renders without crashing", () => {
      const entity = createTestEntity();
      const { container } = renderWithProvider({ entity });
      expect(container.firstChild).toBeTruthy();
    });

    it("renders with correct test id", () => {
      const entity = createTestEntity();
      renderWithProvider({ entity });
      expect(screen.getByTestId(`flow-node-${entity.id}`)).toBeInTheDocument();
    });

    it("renders with custom test id when provided", () => {
      const entity = createTestEntity();
      renderWithProvider({ entity, "data-testid": "custom-node" });
      expect(screen.getByTestId("custom-node")).toBeInTheDocument();
    });

    it("renders node with correct data attributes", () => {
      const entity = createTestEntity({ nodeType: "condition", executionState: "running" });
      renderWithProvider({ entity, selected: true });

      const node = screen.getByTestId(`flow-node-${entity.id}`);
      expect(node).toHaveAttribute("data-node-id", entity.id);
      expect(node).toHaveAttribute("data-node-type", "condition");
      expect(node).toHaveAttribute("data-execution-state", "running");
      expect(node).toHaveAttribute("data-selected", "true");
    });

    it("applies correct className when provided", () => {
      const entity = createTestEntity();
      renderWithProvider({ entity, className: "custom-class" });

      const node = screen.getByTestId(`flow-node-${entity.id}`);
      expect(node).toHaveClass("custom-class");
    });

    it("applies additional styles when provided", () => {
      const entity = createTestEntity();
      renderWithProvider({ entity, style: { zIndex: 999 } });

      const node = screen.getByTestId(`flow-node-${entity.id}`);
      expect(node).toHaveStyle({ zIndex: 999 });
    });
  });

  describe("header rendering", () => {
    it("renders default header with node label", () => {
      const entity = createTestEntity({ label: "My Node Label" });
      renderWithProvider({ entity });

      expect(screen.getByText("My Node Label")).toBeInTheDocument();
    });

    it("renders header test id", () => {
      const entity = createTestEntity();
      renderWithProvider({ entity });

      expect(screen.getByTestId(`flow-node-header-${entity.id}`)).toBeInTheDocument();
    });

    it("renders custom header when headerRenderer is provided", () => {
      const entity = createTestEntity({ label: "Original Label" });
      const customHeader = vi.fn().mockReturnValue(<span>Custom Header Content</span>);

      renderWithProvider({ entity, headerRenderer: customHeader });

      expect(screen.getByText("Custom Header Content")).toBeInTheDocument();
      expect(screen.queryByText("Original Label")).not.toBeInTheDocument();
    });

    it("passes correct props to headerRenderer", () => {
      const entity = createTestEntity();
      const headerRenderer = vi.fn().mockReturnValue(<span>Header</span>);

      renderWithProvider({ entity, selected: true, headerRenderer });

      expect(headerRenderer).toHaveBeenCalledWith(
        expect.objectContaining({
          entity,
          selected: true,
          theme: expect.objectContaining({
            backgroundColor: expect.any(String),
            borderColor: expect.any(String),
          }),
        })
      );
    });
  });

  describe("content rendering", () => {
    it("renders content test id", () => {
      const entity = createTestEntity();
      renderWithProvider({ entity });

      expect(screen.getByTestId(`flow-node-content-${entity.id}`)).toBeInTheDocument();
    });

    it("renders children in content area", () => {
      const entity = createTestEntity();
      render(
        <FlowEntityProvider>
          <BaseFlowNode entity={entity}>
            <div data-testid="child-content">Child Content</div>
          </BaseFlowNode>
        </FlowEntityProvider>
      );

      expect(screen.getByTestId("child-content")).toBeInTheDocument();
      expect(screen.getByText("Child Content")).toBeInTheDocument();
    });

    it("renders custom content when contentRenderer is provided", () => {
      const entity = createTestEntity();
      const customContent = vi.fn().mockReturnValue(<div>Custom Content</div>);

      renderWithProvider({
        entity,
        contentRenderer: customContent,
        children: <span>Original Children</span>,
      });

      expect(screen.getByText("Custom Content")).toBeInTheDocument();
      expect(screen.queryByText("Original Children")).not.toBeInTheDocument();
    });

    it("passes correct props to contentRenderer", () => {
      const entity = createTestEntity();
      const contentRenderer = vi.fn().mockReturnValue(<span>Content</span>);
      const onFormChange = vi.fn();

      renderWithProvider({ entity, selected: true, contentRenderer, onFormChange });

      expect(contentRenderer).toHaveBeenCalledWith(
        expect.objectContaining({
          entity,
          selected: true,
          readOnly: false,
          theme: expect.any(Object),
          onFormChange: expect.any(Function),
        })
      );
    });
  });

  describe("footer rendering", () => {
    it("does not render footer when footerRenderer is not provided", () => {
      const entity = createTestEntity();
      renderWithProvider({ entity });

      expect(screen.queryByTestId(`flow-node-footer-${entity.id}`)).not.toBeInTheDocument();
    });

    it("renders footer when footerRenderer is provided", () => {
      const entity = createTestEntity();
      const footerRenderer = vi.fn().mockReturnValue(<span>Footer Content</span>);

      renderWithProvider({ entity, footerRenderer });

      expect(screen.getByTestId(`flow-node-footer-${entity.id}`)).toBeInTheDocument();
      expect(screen.getByText("Footer Content")).toBeInTheDocument();
    });

    it("passes correct props to footerRenderer", () => {
      const entity = createTestEntity();
      const footerRenderer = vi.fn().mockReturnValue(<span>Footer</span>);

      renderWithProvider({ entity, selected: true, footerRenderer });

      expect(footerRenderer).toHaveBeenCalledWith(
        expect.objectContaining({
          entity,
          selected: true,
          theme: expect.any(Object),
        })
      );
    });
  });

  describe("ports placeholder", () => {
    it("renders ports placeholder container", () => {
      const entity = createTestEntity();
      renderWithProvider({ entity });

      expect(screen.getByTestId(`flow-node-ports-${entity.id}`)).toBeInTheDocument();
    });

    it("ports container has pointer-events none", () => {
      const entity = createTestEntity();
      renderWithProvider({ entity });

      const portsContainer = screen.getByTestId(`flow-node-ports-${entity.id}`);
      expect(portsContainer).toHaveStyle({ pointerEvents: "none" });
    });
  });

  describe("click handling", () => {
    it("calls onSelect when node is clicked", () => {
      const entity = createTestEntity();
      const onSelect = vi.fn();

      renderWithProvider({ entity, onSelect });
      fireEvent.click(screen.getByTestId(`flow-node-${entity.id}`));

      expect(onSelect).toHaveBeenCalledWith(entity);
    });

    it("does not call onSelect when node is disabled", () => {
      const entity = createTestEntity({ disabled: true });
      const onSelect = vi.fn();

      renderWithProvider({ entity, onSelect });
      fireEvent.click(screen.getByTestId(`flow-node-${entity.id}`));

      expect(onSelect).not.toHaveBeenCalled();
    });

    it("stops event propagation on click", () => {
      const entity = createTestEntity();
      const parentClick = vi.fn();

      render(
        <div onClick={parentClick}>
          <FlowEntityProvider>
            <BaseFlowNode entity={entity} onSelect={() => {}} />
          </FlowEntityProvider>
        </div>
      );

      fireEvent.click(screen.getByTestId(`flow-node-${entity.id}`));
      expect(parentClick).not.toHaveBeenCalled();
    });
  });

  describe("styling and positioning", () => {
    it("positions node at entity position", () => {
      const entity = createTestEntity({ position: { x: 150, y: 200 } });
      renderWithProvider({ entity });

      const node = screen.getByTestId(`flow-node-${entity.id}`);
      expect(node).toHaveStyle({ left: "150px", top: "200px" });
    });

    it("uses entity size when provided", () => {
      const entity = createTestEntity({ size: { width: 300, height: 150 } });
      renderWithProvider({ entity });

      const node = screen.getByTestId(`flow-node-${entity.id}`);
      expect(node).toHaveStyle({ width: "300px", height: "150px" });
    });

    it("uses default size when not provided", () => {
      const entity = createTestEntity();
      renderWithProvider({ entity });

      const node = screen.getByTestId(`flow-node-${entity.id}`);
      // Default is 200x100
      expect(node).toHaveStyle({ width: "200px", height: "100px" });
    });

    it("reduces opacity when node is disabled", () => {
      const entity = createTestEntity({ disabled: true });
      renderWithProvider({ entity });

      const node = screen.getByTestId(`flow-node-${entity.id}`);
      expect(node).toHaveStyle({ opacity: "0.5" });
    });

    it("applies not-allowed cursor when disabled", () => {
      const entity = createTestEntity({ disabled: true });
      renderWithProvider({ entity });

      const node = screen.getByTestId(`flow-node-${entity.id}`);
      expect(node).toHaveStyle({ cursor: "not-allowed" });
    });
  });

  describe("accessibility", () => {
    it("has role button", () => {
      const entity = createTestEntity();
      renderWithProvider({ entity });

      const node = screen.getByTestId(`flow-node-${entity.id}`);
      expect(node).toHaveAttribute("role", "button");
    });

    it("has correct aria-label", () => {
      const entity = createTestEntity({ label: "My Node" });
      renderWithProvider({ entity });

      const node = screen.getByTestId(`flow-node-${entity.id}`);
      expect(node).toHaveAttribute("aria-label", "Flow node: My Node");
    });

    it("has aria-selected when selected", () => {
      const entity = createTestEntity();
      renderWithProvider({ entity, selected: true });

      const node = screen.getByTestId(`flow-node-${entity.id}`);
      expect(node).toHaveAttribute("aria-selected", "true");
    });

    it("has aria-disabled when disabled", () => {
      const entity = createTestEntity({ disabled: true });
      renderWithProvider({ entity });

      const node = screen.getByTestId(`flow-node-${entity.id}`);
      expect(node).toHaveAttribute("aria-disabled", "true");
    });

    it("has tabIndex 0 when not disabled", () => {
      const entity = createTestEntity();
      renderWithProvider({ entity });

      const node = screen.getByTestId(`flow-node-${entity.id}`);
      expect(node).toHaveAttribute("tabIndex", "0");
    });

    it("has tabIndex -1 when disabled", () => {
      const entity = createTestEntity({ disabled: true });
      renderWithProvider({ entity });

      const node = screen.getByTestId(`flow-node-${entity.id}`);
      expect(node).toHaveAttribute("tabIndex", "-1");
    });
  });

  describe("theme integration", () => {
    it("applies theme background color", () => {
      const entity = createTestEntity();
      renderWithProvider({ entity });

      const node = screen.getByTestId(`flow-node-${entity.id}`);
      // Default theme background is #ffffff
      expect(node).toHaveStyle({ backgroundColor: "rgb(255, 255, 255)" });
    });

    it("applies custom theme when provided via context", () => {
      const entity = createTestEntity();
      render(
        <FlowEntityProvider
          theme={{
            node: {
              backgroundColor: "#ff0000",
              borderColor: "#00ff00",
            },
          }}
        >
          <BaseFlowNode entity={entity} />
        </FlowEntityProvider>
      );

      const node = screen.getByTestId(`flow-node-${entity.id}`);
      expect(node).toHaveStyle({ backgroundColor: "rgb(255, 0, 0)" });
    });
  });

  describe("render modes", () => {
    it("uses default render mode by default", () => {
      const entity = createTestEntity();
      renderWithProvider({ entity });

      const content = screen.getByTestId(`flow-node-content-${entity.id}`);
      expect(content).toHaveStyle({ padding: "8px 12px" });
    });

    it("uses compact padding in compact mode", () => {
      const entity = createTestEntity();
      renderWithProvider({ entity, renderMode: "compact" });

      const content = screen.getByTestId(`flow-node-content-${entity.id}`);
      expect(content).toHaveStyle({ padding: "4px 8px" });
    });
  });

  describe("form change handling", () => {
    it("calls onFormChange when contentRenderer triggers it", () => {
      const entity = createTestEntity();
      const onFormChange = vi.fn();
      const contentRenderer = vi.fn(({ onFormChange }) => (
        <button onClick={() => onFormChange?.({ key: "value" })}>Submit</button>
      ));

      renderWithProvider({ entity, onFormChange, contentRenderer });
      fireEvent.click(screen.getByText("Submit"));

      expect(onFormChange).toHaveBeenCalledWith(entity, { key: "value" });
    });
  });

  describe("memoization", () => {
    it("is wrapped in React.memo", () => {
      // BaseFlowNode should be memoized
      expect(
        (BaseFlowNode as React.MemoExoticComponent<React.FC<BaseFlowNodeProps>>).$$typeof
      ).toBe(Symbol.for("react.memo"));
    });
  });
});
