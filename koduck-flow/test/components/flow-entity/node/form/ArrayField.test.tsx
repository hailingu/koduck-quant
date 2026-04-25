/**
 * @file ArrayField Component Tests
 * @description Unit tests for the ArrayField component.
 *
 * @see docs/design/flow-entity-step-plan-en.md Tasks 4.3-4.7
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import {
  ArrayField,
  ARRAY_FIELD_CLASS,
  ARRAY_FIELD_READONLY_CLASS,
  ARRAY_FIELD_DISABLED_CLASS,
  ARRAY_FIELD_ERROR_CLASS,
  ARRAY_FIELD_REQUIRED_CLASS,
  ARRAY_FIELD_ORDERABLE_CLASS,
  ARRAY_FIELD_ITEM_CLASS,
} from "../../../../../src/components/flow-entity/node/form/ArrayField";
import type { ExtendedFormFieldSchema } from "../../../../../src/components/flow-entity/node/form/types";

// =============================================================================
// Test Helpers
// =============================================================================

const createSchema = (
  overrides: Partial<ExtendedFormFieldSchema> = {}
): ExtendedFormFieldSchema => ({
  type: "array",
  label: "Test Array",
  items: {
    type: "string",
  },
  ...overrides,
});

// =============================================================================
// Tests
// =============================================================================

describe("ArrayField", () => {
  describe("Basic Rendering", () => {
    it("should render with base class", () => {
      render(<ArrayField schema={createSchema()} name="test" value={[]} onChange={vi.fn()} />);
      const field = screen.getByTestId("array-field-test");
      expect(field).toHaveClass(ARRAY_FIELD_CLASS);
    });

    it("should render empty message when no items", () => {
      render(<ArrayField schema={createSchema()} name="test" value={[]} onChange={vi.fn()} />);
      expect(screen.getByTestId("array-field-test-empty")).toBeInTheDocument();
    });

    it("should render items", () => {
      render(
        <ArrayField
          schema={createSchema()}
          name="test"
          value={["item1", "item2"]}
          onChange={vi.fn()}
        />
      );
      expect(screen.getByTestId("array-field-test-item-0")).toBeInTheDocument();
      expect(screen.getByTestId("array-field-test-item-1")).toBeInTheDocument();
    });

    it("should render add button", () => {
      render(<ArrayField schema={createSchema()} name="test" value={[]} onChange={vi.fn()} />);
      expect(screen.getByTestId("array-field-test-add")).toBeInTheDocument();
    });

    it("should use custom testId", () => {
      render(
        <ArrayField
          schema={createSchema()}
          name="test"
          value={[]}
          onChange={vi.fn()}
          testId="my-array"
        />
      );
      expect(screen.getByTestId("my-array")).toBeInTheDocument();
    });
  });

  describe("Add Item", () => {
    it("should add empty string item for string type", () => {
      const onChange = vi.fn();
      render(
        <ArrayField
          schema={createSchema({ items: { type: "string" } })}
          name="test"
          value={["existing"]}
          onChange={onChange}
        />
      );
      fireEvent.click(screen.getByTestId("array-field-test-add"));
      expect(onChange).toHaveBeenCalledWith(["existing", ""]);
    });

    it("should add 0 for number type", () => {
      const onChange = vi.fn();
      render(
        <ArrayField
          schema={createSchema({ items: { type: "number" } })}
          name="test"
          value={[1, 2]}
          onChange={onChange}
          itemSchema={{ type: "number" }}
        />
      );
      fireEvent.click(screen.getByTestId("array-field-test-add"));
      expect(onChange).toHaveBeenCalledWith([1, 2, 0]);
    });

    it("should add false for boolean type", () => {
      const onChange = vi.fn();
      render(
        <ArrayField
          schema={createSchema({ items: { type: "boolean" } })}
          name="test"
          value={[true]}
          onChange={onChange}
          itemSchema={{ type: "boolean" }}
        />
      );
      fireEvent.click(screen.getByTestId("array-field-test-add"));
      expect(onChange).toHaveBeenCalledWith([true, false]);
    });
  });

  describe("Remove Item", () => {
    it("should render remove button for each item", () => {
      render(
        <ArrayField
          schema={createSchema()}
          name="test"
          value={["a", "b", "c"]}
          onChange={vi.fn()}
        />
      );
      expect(screen.getByTestId("array-field-test-item-0-remove")).toBeInTheDocument();
      expect(screen.getByTestId("array-field-test-item-1-remove")).toBeInTheDocument();
      expect(screen.getByTestId("array-field-test-item-2-remove")).toBeInTheDocument();
    });

    it("should remove item at index", () => {
      const onChange = vi.fn();
      render(
        <ArrayField
          schema={createSchema()}
          name="test"
          value={["a", "b", "c"]}
          onChange={onChange}
        />
      );
      fireEvent.click(screen.getByTestId("array-field-test-item-1-remove"));
      expect(onChange).toHaveBeenCalledWith(["a", "c"]);
    });
  });

  describe("Max Items", () => {
    it("should hide add button when maxItems is reached", () => {
      render(
        <ArrayField
          schema={createSchema()}
          name="test"
          value={["a", "b"]}
          onChange={vi.fn()}
          maxItems={2}
        />
      );
      expect(screen.queryByTestId("array-field-test-add")).not.toBeInTheDocument();
    });

    it("should enable add button when under maxItems", () => {
      render(
        <ArrayField
          schema={createSchema()}
          name="test"
          value={["a", "b"]}
          onChange={vi.fn()}
          maxItems={3}
        />
      );
      const addButton = screen.getByTestId("array-field-test-add");
      expect(addButton).not.toBeDisabled();
    });
  });

  describe("Min Items", () => {
    it("should not remove items when at minItems", () => {
      const onChange = vi.fn();
      render(
        <ArrayField
          schema={createSchema()}
          name="test"
          value={["a", "b"]}
          onChange={onChange}
          minItems={2}
        />
      );
      // Remove buttons still render, but clicking doesn't work
      fireEvent.click(screen.getByTestId("array-field-test-item-0-remove"));
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("Reordering", () => {
    it("should apply orderable class when orderable is true", () => {
      render(
        <ArrayField
          schema={createSchema()}
          name="test"
          value={["a", "b"]}
          onChange={vi.fn()}
          orderable
        />
      );
      const field = screen.getByTestId("array-field-test");
      expect(field).toHaveClass(ARRAY_FIELD_ORDERABLE_CLASS);
    });

    it("should render move buttons for each item", () => {
      render(
        <ArrayField
          schema={createSchema()}
          name="test"
          value={["a", "b"]}
          onChange={vi.fn()}
          orderable
        />
      );
      // First item: only down button (no up)
      expect(screen.queryByTestId("array-field-test-item-0-move-up")).not.toBeInTheDocument();
      expect(screen.getByTestId("array-field-test-item-0-move-down")).toBeInTheDocument();
      // Last item: only up button (no down)
      expect(screen.getByTestId("array-field-test-item-1-move-up")).toBeInTheDocument();
      expect(screen.queryByTestId("array-field-test-item-1-move-down")).not.toBeInTheDocument();
    });

    it("should move item up", () => {
      const onChange = vi.fn();
      render(
        <ArrayField
          schema={createSchema()}
          name="test"
          value={["a", "b", "c"]}
          onChange={onChange}
          orderable
        />
      );
      fireEvent.click(screen.getByTestId("array-field-test-item-1-move-up"));
      expect(onChange).toHaveBeenCalledWith(["b", "a", "c"]);
    });

    it("should move item down", () => {
      const onChange = vi.fn();
      render(
        <ArrayField
          schema={createSchema()}
          name="test"
          value={["a", "b", "c"]}
          onChange={onChange}
          orderable
        />
      );
      fireEvent.click(screen.getByTestId("array-field-test-item-0-move-down"));
      expect(onChange).toHaveBeenCalledWith(["b", "a", "c"]);
    });

    it("should not render up button for first item", () => {
      render(
        <ArrayField
          schema={createSchema()}
          name="test"
          value={["a", "b"]}
          onChange={vi.fn()}
          orderable
        />
      );
      expect(screen.queryByTestId("array-field-test-item-0-move-up")).not.toBeInTheDocument();
    });

    it("should not render down button for last item", () => {
      render(
        <ArrayField
          schema={createSchema()}
          name="test"
          value={["a", "b"]}
          onChange={vi.fn()}
          orderable
        />
      );
      expect(screen.queryByTestId("array-field-test-item-1-move-down")).not.toBeInTheDocument();
    });
  });

  describe("Primitive Item Editing", () => {
    it("should render input for string item", () => {
      render(
        <ArrayField
          schema={createSchema({ items: { type: "string" } })}
          name="test"
          value={["hello"]}
          onChange={vi.fn()}
        />
      );
      const input = screen.getByTestId("array-field-test-item-0-input");
      expect(input).toHaveValue("hello");
    });

    it("should update string item value", () => {
      const onChange = vi.fn();
      render(
        <ArrayField
          schema={createSchema({ items: { type: "string" } })}
          name="test"
          value={["old"]}
          onChange={onChange}
        />
      );
      const input = screen.getByTestId("array-field-test-item-0-input");
      fireEvent.change(input, { target: { value: "new" } });
      expect(onChange).toHaveBeenCalledWith(["new"]);
    });
  });

  describe("Read-Only and Disabled States", () => {
    it("should apply readonly class", () => {
      render(
        <ArrayField schema={createSchema()} name="test" value={["a"]} onChange={vi.fn()} readOnly />
      );
      const field = screen.getByTestId("array-field-test");
      expect(field).toHaveClass(ARRAY_FIELD_READONLY_CLASS);
    });

    it("should hide add button in readonly mode", () => {
      render(
        <ArrayField schema={createSchema()} name="test" value={["a"]} onChange={vi.fn()} readOnly />
      );
      expect(screen.queryByTestId("array-field-test-add")).not.toBeInTheDocument();
    });

    it("should disable remove buttons in readonly mode", () => {
      render(
        <ArrayField schema={createSchema()} name="test" value={["a"]} onChange={vi.fn()} readOnly />
      );
      expect(screen.getByTestId("array-field-test-item-0-remove")).toBeDisabled();
    });

    it("should apply disabled class", () => {
      render(
        <ArrayField schema={createSchema()} name="test" value={["a"]} onChange={vi.fn()} disabled />
      );
      const field = screen.getByTestId("array-field-test");
      expect(field).toHaveClass(ARRAY_FIELD_DISABLED_CLASS);
    });

    it("should disable all controls in disabled mode", () => {
      render(
        <ArrayField schema={createSchema()} name="test" value={["a"]} onChange={vi.fn()} disabled />
      );
      // Add button is hidden in disabled mode
      expect(screen.queryByTestId("array-field-test-add")).not.toBeInTheDocument();
      expect(screen.getByTestId("array-field-test-item-0-remove")).toBeDisabled();
      expect(screen.getByTestId("array-field-test-item-0-input")).toBeDisabled();
    });
  });

  describe("Error State", () => {
    it("should apply error class", () => {
      render(
        <ArrayField
          schema={createSchema()}
          name="test"
          value={[]}
          onChange={vi.fn()}
          error="At least one item required"
        />
      );
      const field = screen.getByTestId("array-field-test");
      expect(field).toHaveClass(ARRAY_FIELD_ERROR_CLASS);
    });
  });

  describe("Required Field", () => {
    it("should apply required class", () => {
      render(
        <ArrayField
          schema={createSchema({ validation: { required: true } })}
          name="test"
          value={[]}
          onChange={vi.fn()}
        />
      );
      const field = screen.getByTestId("array-field-test");
      expect(field).toHaveClass(ARRAY_FIELD_REQUIRED_CLASS);
    });
  });

  describe("Item Class", () => {
    it("should apply item class to each item", () => {
      render(
        <ArrayField schema={createSchema()} name="test" value={["a", "b"]} onChange={vi.fn()} />
      );
      expect(screen.getByTestId("array-field-test-item-0")).toHaveClass(ARRAY_FIELD_ITEM_CLASS);
      expect(screen.getByTestId("array-field-test-item-1")).toHaveClass(ARRAY_FIELD_ITEM_CLASS);
    });
  });

  describe("Accessibility", () => {
    it("should have accessible name for add button", () => {
      render(
        <ArrayField
          schema={createSchema({ label: "Tags" })}
          name="test"
          value={[]}
          onChange={vi.fn()}
        />
      );
      const addButton = screen.getByTestId("array-field-test-add");
      expect(addButton).toHaveAccessibleName();
    });

    it("should have accessible name for remove buttons", () => {
      render(
        <ArrayField schema={createSchema()} name="test" value={["item"]} onChange={vi.fn()} />
      );
      const removeButton = screen.getByTestId("array-field-test-item-0-remove");
      expect(removeButton).toHaveAccessibleName();
    });
  });
});
