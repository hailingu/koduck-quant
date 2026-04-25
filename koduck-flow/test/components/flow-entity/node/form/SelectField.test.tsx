/**
 * @file SelectField Component Tests
 * @description Unit tests for the SelectField component.
 *
 * @see docs/design/flow-entity-step-plan-en.md Tasks 4.3-4.7
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import {
  SelectField,
  SELECT_FIELD_CLASS,
  SELECT_FIELD_MULTI_CLASS,
  SELECT_FIELD_SEARCHABLE_CLASS,
  SELECT_FIELD_READONLY_CLASS,
  SELECT_FIELD_DISABLED_CLASS,
  SELECT_FIELD_ERROR_CLASS,
  SELECT_FIELD_REQUIRED_CLASS,
} from "../../../../../src/components/flow-entity/node/form/SelectField";
import type { ExtendedFormFieldSchema } from "../../../../../src/components/flow-entity/node/form/types";

// =============================================================================
// Test Helpers
// =============================================================================

const createSchema = (
  overrides: Partial<ExtendedFormFieldSchema> = {}
): ExtendedFormFieldSchema => ({
  type: "select",
  label: "Test Select",
  options: [
    { value: "a", label: "Option A" },
    { value: "b", label: "Option B" },
    { value: "c", label: "Option C" },
  ],
  ...overrides,
});

// =============================================================================
// Tests
// =============================================================================

describe("SelectField", () => {
  describe("Basic Rendering", () => {
    it("should render with base class on wrapper", () => {
      render(<SelectField schema={createSchema()} name="test" value="" onChange={vi.fn()} />);
      const select = screen.getByTestId("select-field-test");
      expect(select.parentElement).toHaveClass(SELECT_FIELD_CLASS);
    });

    it("should render select element", () => {
      render(<SelectField schema={createSchema()} name="test" value="" onChange={vi.fn()} />);
      const select = screen.getByTestId("select-field-test");
      expect(select).toBeInTheDocument();
      expect(select.tagName.toLowerCase()).toBe("select");
    });

    it("should render all options", () => {
      render(<SelectField schema={createSchema()} name="test" value="" onChange={vi.fn()} />);
      expect(screen.getByText("Option A")).toBeInTheDocument();
      expect(screen.getByText("Option B")).toBeInTheDocument();
      expect(screen.getByText("Option C")).toBeInTheDocument();
    });

    it("should use custom testId", () => {
      render(
        <SelectField
          schema={createSchema()}
          name="test"
          value=""
          onChange={vi.fn()}
          testId="my-select"
        />
      );
      expect(screen.getByTestId("my-select")).toBeInTheDocument();
    });
  });

  describe("Enum Options", () => {
    it("should create options from enum", () => {
      render(
        <SelectField
          schema={createSchema({
            options: undefined,
            enum: ["red", "green", "blue"],
          })}
          name="test"
          value=""
          onChange={vi.fn()}
        />
      );
      expect(screen.getByText("red")).toBeInTheDocument();
      expect(screen.getByText("green")).toBeInTheDocument();
      expect(screen.getByText("blue")).toBeInTheDocument();
    });

    it("should use ui:enumNames for labels", () => {
      render(
        <SelectField
          schema={createSchema({
            options: undefined,
            enum: ["r", "g", "b"],
            "ui:enumNames": ["Red", "Green", "Blue"],
          })}
          name="test"
          value=""
          onChange={vi.fn()}
        />
      );
      expect(screen.getByText("Red")).toBeInTheDocument();
      expect(screen.getByText("Green")).toBeInTheDocument();
      expect(screen.getByText("Blue")).toBeInTheDocument();
    });
  });

  describe("Value Changes", () => {
    it("should call onChange with selected value", () => {
      const onChange = vi.fn();
      render(<SelectField schema={createSchema()} name="test" value="" onChange={onChange} />);
      const select = screen.getByTestId("select-field-test");
      fireEvent.change(select, { target: { value: "b" } });
      expect(onChange).toHaveBeenCalledWith("b");
    });

    it("should call onBlur when field loses focus", () => {
      const onBlur = vi.fn();
      render(
        <SelectField
          schema={createSchema()}
          name="test"
          value=""
          onChange={vi.fn()}
          onBlur={onBlur}
        />
      );
      const select = screen.getByTestId("select-field-test");
      fireEvent.blur(select);
      expect(onBlur).toHaveBeenCalled();
    });

    it("should reflect current value", () => {
      render(<SelectField schema={createSchema()} name="test" value="b" onChange={vi.fn()} />);
      const select = screen.getByTestId("select-field-test") as HTMLSelectElement;
      expect(select.value).toBe("b");
    });
  });

  describe("Multi-Select", () => {
    it("should apply multi class when multiple prop is true", () => {
      render(
        <SelectField schema={createSchema()} name="test" value={[]} onChange={vi.fn()} multiple />
      );
      const select = screen.getByTestId("select-field-test");
      expect(select.parentElement).toHaveClass(SELECT_FIELD_MULTI_CLASS);
    });

    it("should apply multi class when ui:widget is multiselect", () => {
      render(
        <SelectField
          schema={createSchema({ "ui:widget": "multiselect" })}
          name="test"
          value={[]}
          onChange={vi.fn()}
        />
      );
      const select = screen.getByTestId("select-field-test");
      expect(select.parentElement).toHaveClass(SELECT_FIELD_MULTI_CLASS);
    });

    it("should set multiple attribute on select", () => {
      render(
        <SelectField schema={createSchema()} name="test" value={[]} onChange={vi.fn()} multiple />
      );
      const select = screen.getByTestId("select-field-test") as HTMLSelectElement;
      expect(select.multiple).toBe(true);
    });
  });

  describe("Searchable", () => {
    it("should show search input when searchable", () => {
      render(
        <SelectField
          schema={createSchema({ "ui:options": { searchable: true } })}
          name="test"
          value=""
          onChange={vi.fn()}
        />
      );
      expect(screen.getByTestId("select-field-test-search")).toBeInTheDocument();
    });

    it("should apply searchable class", () => {
      render(
        <SelectField
          schema={createSchema({ "ui:options": { searchable: true } })}
          name="test"
          value=""
          onChange={vi.fn()}
        />
      );
      const select = screen.getByTestId("select-field-test");
      expect(select.parentElement).toHaveClass(SELECT_FIELD_SEARCHABLE_CLASS);
    });
  });

  describe("Clearable", () => {
    it("should show clear button when clearable and has value", () => {
      render(
        <SelectField
          schema={createSchema({ "ui:options": { clearable: true } })}
          name="test"
          value="a"
          onChange={vi.fn()}
        />
      );
      expect(screen.getByTestId("select-field-test-clear")).toBeInTheDocument();
    });

    it("should not show clear button when value is empty", () => {
      render(
        <SelectField
          schema={createSchema({ "ui:options": { clearable: true } })}
          name="test"
          value=""
          onChange={vi.fn()}
        />
      );
      expect(screen.queryByTestId("select-field-test-clear")).not.toBeInTheDocument();
    });

    it("should call onChange with empty value when cleared", () => {
      const onChange = vi.fn();
      render(
        <SelectField
          schema={createSchema({ "ui:options": { clearable: true } })}
          name="test"
          value="a"
          onChange={onChange}
        />
      );
      fireEvent.click(screen.getByTestId("select-field-test-clear"));
      expect(onChange).toHaveBeenCalledWith("");
    });
  });

  describe("Multi-Select Tags", () => {
    it("should render tags for selected values", () => {
      render(
        <SelectField
          schema={createSchema()}
          name="test"
          value={["a", "b"]}
          onChange={vi.fn()}
          multiple
        />
      );
      expect(screen.getByTestId("select-field-test-tags")).toBeInTheDocument();
      expect(screen.getByTestId("select-field-test-tag-a")).toBeInTheDocument();
      expect(screen.getByTestId("select-field-test-tag-b")).toBeInTheDocument();
    });

    it("should remove tag when remove button is clicked", () => {
      const onChange = vi.fn();
      render(
        <SelectField
          schema={createSchema()}
          name="test"
          value={["a", "b"]}
          onChange={onChange}
          multiple
        />
      );
      fireEvent.click(screen.getByTestId("select-field-test-remove-a"));
      expect(onChange).toHaveBeenCalledWith(["b"]);
    });
  });

  describe("Read-Only and Disabled States", () => {
    it("should apply readonly class", () => {
      render(
        <SelectField schema={createSchema()} name="test" value="" onChange={vi.fn()} readOnly />
      );
      const select = screen.getByTestId("select-field-test");
      expect(select.parentElement).toHaveClass(SELECT_FIELD_READONLY_CLASS);
      expect(select).toBeDisabled();
    });

    it("should apply disabled class", () => {
      render(
        <SelectField schema={createSchema()} name="test" value="" onChange={vi.fn()} disabled />
      );
      const select = screen.getByTestId("select-field-test");
      expect(select.parentElement).toHaveClass(SELECT_FIELD_DISABLED_CLASS);
      expect(select).toBeDisabled();
    });
  });

  describe("Error State", () => {
    it("should apply error class", () => {
      render(
        <SelectField
          schema={createSchema()}
          name="test"
          value=""
          onChange={vi.fn()}
          error="Required"
        />
      );
      const select = screen.getByTestId("select-field-test");
      expect(select.parentElement).toHaveClass(SELECT_FIELD_ERROR_CLASS);
    });

    it("should set aria-invalid when error exists", () => {
      render(
        <SelectField
          schema={createSchema()}
          name="test"
          value=""
          onChange={vi.fn()}
          error="Required"
        />
      );
      const select = screen.getByTestId("select-field-test");
      expect(select).toHaveAttribute("aria-invalid", "true");
    });
  });

  describe("Required Field", () => {
    it("should apply required class", () => {
      render(
        <SelectField
          schema={createSchema({ validation: { required: true } })}
          name="test"
          value=""
          onChange={vi.fn()}
        />
      );
      const select = screen.getByTestId("select-field-test");
      expect(select.parentElement).toHaveClass(SELECT_FIELD_REQUIRED_CLASS);
    });

    it("should set aria-required when required", () => {
      render(
        <SelectField
          schema={createSchema({ validation: { required: true } })}
          name="test"
          value=""
          onChange={vi.fn()}
        />
      );
      const select = screen.getByTestId("select-field-test");
      expect(select).toHaveAttribute("aria-required", "true");
    });
  });
});
