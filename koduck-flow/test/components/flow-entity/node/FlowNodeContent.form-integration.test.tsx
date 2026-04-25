/**
 * @file FlowNodeContent Form Integration Tests
 * @description Tests for FlowNodeForm integration within FlowNodeContent.
 * Verifies that forms render automatically when entity has formSchema
 * and that form changes update entity data.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 4.9
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FlowNodeContent } from "../../../../src/components/flow-entity/node/FlowNodeContent";
import { FlowNodeEntity } from "../../../../src/common/flow/flow-node-entity";
import { FlowEntityProvider } from "../../../../src/components/flow-entity/context";
import type { FlowEntityTheme } from "../../../../src/components/flow-entity/types";

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Default theme for testing
 */
const defaultTheme: FlowEntityTheme = {
  node: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 8,
    borderWidth: 1,
    textColor: "#1e293b",
    shadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
    headerBackgroundColor: "#f8fafc",
    headerTextColor: "#475569",
    headerHeight: 40,
    executionStateColors: {
      idle: "#94a3b8",
      pending: "#fbbf24",
      running: "#3b82f6",
      success: "#22c55e",
      error: "#ef4444",
      warning: "#f97316",
      skipped: "#a855f7",
      cancelled: "#6b7280",
    },
    portColors: {
      input: "#60a5fa",
      output: "#34d399",
      default: "#94a3b8",
    },
  },
  edge: {
    strokeColor: "#94a3b8",
    strokeWidth: 2,
    selectedColor: "#3b82f6",
    hoverColor: "#64748b",
    arrowSize: 8,
  },
  canvas: {
    backgroundColor: "#f1f5f9",
    gridColor: "#e2e8f0",
    gridSize: 20,
    selectionColor: "rgba(59, 130, 246, 0.2)",
  },
};

/**
 * Wrapper component with FlowEntityProvider
 */
const TestWrapper: React.FC<{ children: React.ReactNode; readOnly?: boolean }> = ({
  children,
  readOnly = false,
}) => (
  <FlowEntityProvider theme={defaultTheme} readOnly={readOnly}>
    {children}
  </FlowEntityProvider>
);

/**
 * Creates a test entity with form schema
 */
function createTestEntityWithForm(): FlowNodeEntity {
  return new FlowNodeEntity({
    nodeType: "test-node",
    label: "Test Node",
    position: { x: 0, y: 0 },
    size: { width: 200, height: 150 },
    formSchema: {
      type: "object",
      properties: {
        name: {
          type: "text",
          label: "Name",
          placeholder: "Enter name",
          validation: { required: true },
        },
        count: {
          type: "number",
          label: "Count",
          defaultValue: 0,
          validation: { min: 0, max: 100 },
        },
        enabled: {
          type: "boolean",
          label: "Enabled",
          defaultValue: false,
        },
      },
      required: ["name"],
    },
    config: {
      name: "Initial Name",
      count: 10,
      enabled: true,
    },
  });
}

/**
 * Creates a test entity without form schema
 */
function createTestEntityWithoutForm(): FlowNodeEntity {
  return new FlowNodeEntity({
    nodeType: "test-node",
    label: "Test Node",
    position: { x: 0, y: 0 },
    size: { width: 200, height: 150 },
  });
}

// =============================================================================
// Tests
// =============================================================================

describe("FlowNodeContent Form Integration", () => {
  describe("Form Rendering", () => {
    it("should render FlowNodeForm when entity has formSchema", () => {
      const entity = createTestEntityWithForm();

      render(
        <TestWrapper>
          <FlowNodeContent entity={entity} />
        </TestWrapper>
      );

      // Should find form elements
      expect(screen.getByTestId(`flow-node-form-${entity.id}`)).toBeInTheDocument();
      expect(screen.getByTestId("field-input-name")).toBeInTheDocument();
      expect(screen.getByTestId("field-input-count")).toBeInTheDocument();
      expect(screen.getByTestId("field-input-enabled")).toBeInTheDocument();
    });

    it("should not render FlowNodeForm when entity has no formSchema", () => {
      const entity = createTestEntityWithoutForm();

      render(
        <TestWrapper>
          <FlowNodeContent entity={entity}>
            <div data-testid="children-content">Children Content</div>
          </FlowNodeContent>
        </TestWrapper>
      );

      // Should not find form
      expect(screen.queryByTestId(`flow-node-form-${entity.id}`)).not.toBeInTheDocument();
      // Should render children instead
      expect(screen.getByTestId("children-content")).toBeInTheDocument();
    });

    it("should render children when entity has empty formSchema properties", () => {
      const entity = new FlowNodeEntity({
        nodeType: "test-node",
        label: "Test Node",
        position: { x: 0, y: 0 },
        formSchema: {
          type: "object",
          properties: {},
        },
      });

      render(
        <TestWrapper>
          <FlowNodeContent entity={entity}>
            <div data-testid="children-content">Children Content</div>
          </FlowNodeContent>
        </TestWrapper>
      );

      // Should not find form
      expect(screen.queryByTestId(`flow-node-form-${entity.id}`)).not.toBeInTheDocument();
      // Should render children instead
      expect(screen.getByTestId("children-content")).toBeInTheDocument();
    });

    it("should use custom renderer when provided even with formSchema", () => {
      const entity = createTestEntityWithForm();
      const customRenderer = vi.fn().mockReturnValue(<div data-testid="custom-content" />);

      render(
        <TestWrapper>
          <FlowNodeContent entity={entity} renderer={customRenderer} />
        </TestWrapper>
      );

      // Should use custom renderer
      expect(customRenderer).toHaveBeenCalled();
      expect(screen.getByTestId("custom-content")).toBeInTheDocument();
      // Should not render form
      expect(screen.queryByTestId(`flow-node-form-${entity.id}`)).not.toBeInTheDocument();
    });
  });

  describe("Form Data Population", () => {
    it("should populate form with entity config data", () => {
      const entity = createTestEntityWithForm();

      render(
        <TestWrapper>
          <FlowNodeContent entity={entity} />
        </TestWrapper>
      );

      // Check that form fields have initial values
      const nameInput = screen.getByTestId("field-input-name") as HTMLInputElement;
      expect(nameInput.value).toBe("Initial Name");

      const countInput = screen.getByTestId("field-input-count") as HTMLInputElement;
      expect(countInput.value).toBe("10");

      const enabledInput = screen.getByTestId("field-input-enabled") as HTMLInputElement;
      expect(enabledInput.checked).toBe(true);
    });

    it("should handle empty config data gracefully", () => {
      const entity = new FlowNodeEntity({
        nodeType: "test-node",
        label: "Test Node",
        position: { x: 0, y: 0 },
        formSchema: {
          type: "object",
          properties: {
            name: {
              type: "text",
              label: "Name",
            },
          },
        },
        // No config provided
      });

      render(
        <TestWrapper>
          <FlowNodeContent entity={entity} />
        </TestWrapper>
      );

      // Should render form without errors
      expect(screen.getByTestId(`flow-node-form-${entity.id}`)).toBeInTheDocument();
      const nameInput = screen.getByTestId("field-input-name") as HTMLInputElement;
      expect(nameInput.value).toBe("");
    });
  });

  describe("Form Change Handling", () => {
    it("should update entity form data when form field changes", () => {
      const entity = createTestEntityWithForm();

      render(
        <TestWrapper>
          <FlowNodeContent entity={entity} />
        </TestWrapper>
      );

      const nameInput = screen.getByTestId("field-input-name") as HTMLInputElement;

      // Change the value
      fireEvent.change(nameInput, { target: { value: "New Name" } });

      // Entity's form data should be updated
      expect(entity.getFormData().name).toBe("New Name");
    });

    it("should call onFormChange callback when form data changes", () => {
      const entity = createTestEntityWithForm();
      const onFormChange = vi.fn();

      render(
        <TestWrapper>
          <FlowNodeContent entity={entity} onFormChange={onFormChange} />
        </TestWrapper>
      );

      const nameInput = screen.getByTestId("field-input-name") as HTMLInputElement;
      fireEvent.change(nameInput, { target: { value: "Changed" } });

      // onFormChange should have been called
      expect(onFormChange).toHaveBeenCalled();
    });

    it("should update number field and persist to entity", () => {
      const entity = createTestEntityWithForm();

      render(
        <TestWrapper>
          <FlowNodeContent entity={entity} />
        </TestWrapper>
      );

      const countInput = screen.getByTestId("field-input-count") as HTMLInputElement;
      fireEvent.change(countInput, { target: { value: "50" } });

      expect(entity.getFormData().count).toBe(50);
    });

    it("should update boolean field and persist to entity", () => {
      const entity = createTestEntityWithForm();

      render(
        <TestWrapper>
          <FlowNodeContent entity={entity} />
        </TestWrapper>
      );

      const enabledInput = screen.getByTestId("field-input-enabled") as HTMLInputElement;
      expect(enabledInput.checked).toBe(true);

      fireEvent.click(enabledInput);

      expect(entity.getFormData().enabled).toBe(false);
    });
  });

  describe("Read-Only Mode", () => {
    it("should pass readOnly to form when content is readOnly", () => {
      const entity = createTestEntityWithForm();

      render(
        <TestWrapper>
          <FlowNodeContent entity={entity} readOnly={true} />
        </TestWrapper>
      );

      const nameInput = screen.getByTestId("field-input-name") as HTMLInputElement;
      expect(nameInput).toHaveAttribute("readonly");
    });

    it("should pass readOnly from context when context is readOnly", () => {
      const entity = createTestEntityWithForm();

      render(
        <TestWrapper readOnly={true}>
          <FlowNodeContent entity={entity} />
        </TestWrapper>
      );

      const nameInput = screen.getByTestId("field-input-name") as HTMLInputElement;
      expect(nameInput).toHaveAttribute("readonly");
    });
  });

  describe("Compact Mode", () => {
    it("should pass compact=true to form in compact render mode", () => {
      const entity = createTestEntityWithForm();

      render(
        <TestWrapper>
          <FlowNodeContent entity={entity} renderMode="compact" />
        </TestWrapper>
      );

      // Form should be rendered with compact class
      const form = screen.getByTestId(`flow-node-form-${entity.id}`);
      expect(form).toHaveClass("flow-node-form--compact");
    });

    it("should pass compact=true to form in minimal render mode", () => {
      const entity = createTestEntityWithForm();

      render(
        <TestWrapper>
          <FlowNodeContent entity={entity} renderMode="minimal" />
        </TestWrapper>
      );

      // Form should be rendered with compact class
      const form = screen.getByTestId(`flow-node-form-${entity.id}`);
      expect(form).toHaveClass("flow-node-form--compact");
    });
  });

  describe("Test IDs", () => {
    it("should generate correct test ID for form", () => {
      const entity = createTestEntityWithForm();

      render(
        <TestWrapper>
          <FlowNodeContent entity={entity} />
        </TestWrapper>
      );

      expect(screen.getByTestId(`flow-node-form-${entity.id}`)).toBeInTheDocument();
    });

    it("should generate correct test ID for content wrapper", () => {
      const entity = createTestEntityWithForm();

      render(
        <TestWrapper>
          <FlowNodeContent entity={entity} data-testid="custom-content-id" />
        </TestWrapper>
      );

      expect(screen.getByTestId("custom-content-id")).toBeInTheDocument();
    });
  });
});

describe("FlowNodeContent with Select Fields", () => {
  it("should render select field and handle changes", () => {
    const entity = new FlowNodeEntity({
      nodeType: "test-node",
      label: "Test Node",
      position: { x: 0, y: 0 },
      formSchema: {
        type: "object",
        properties: {
          status: {
            type: "select",
            label: "Status",
            options: [
              { label: "Active", value: "active" },
              { label: "Inactive", value: "inactive" },
              { label: "Pending", value: "pending" },
            ],
          },
        },
      },
      config: {
        status: "active",
      },
    });

    render(
      <TestWrapper>
        <FlowNodeContent entity={entity} />
      </TestWrapper>
    );

    const selectInput = screen.getByTestId("field-input-status") as HTMLSelectElement;
    expect(selectInput.value).toBe("active");

    fireEvent.change(selectInput, { target: { value: "pending" } });

    expect(entity.getFormData().status).toBe("pending");
  });
});
