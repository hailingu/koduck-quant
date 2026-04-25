/**
 * @file BooleanField Component Tests
 * @description Unit tests for the BooleanField component.
 *
 * @see docs/design/flow-entity-step-plan-en.md Tasks 4.3-4.7
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import {
  BooleanField,
  CheckboxField,
  SwitchField,
  RadioBooleanField,
  BOOLEAN_FIELD_CLASS,
  BOOLEAN_FIELD_CHECKED_CLASS,
  BOOLEAN_FIELD_READONLY_CLASS,
  BOOLEAN_FIELD_DISABLED_CLASS,
  BOOLEAN_FIELD_ERROR_CLASS,
  BOOLEAN_FIELD_REQUIRED_CLASS,
} from "../../../../../src/components/flow-entity/node/form/BooleanField";
import type { ExtendedFormFieldSchema } from "../../../../../src/components/flow-entity/node/form/types";

// =============================================================================
// Test Helpers
// =============================================================================

const createSchema = (
  overrides: Partial<ExtendedFormFieldSchema> = {}
): ExtendedFormFieldSchema => ({
  type: "boolean",
  label: "Test Boolean",
  ...overrides,
});

// =============================================================================
// Tests
// =============================================================================

describe("BooleanField", () => {
  describe("Basic Rendering", () => {
    it("should render with base class on wrapper", () => {
      render(<BooleanField schema={createSchema()} name="test" value={false} onChange={vi.fn()} />);
      const checkbox = screen.getByTestId("boolean-field-test");
      expect(checkbox.parentElement?.parentElement).toHaveClass(BOOLEAN_FIELD_CLASS);
    });

    it("should render checkbox input", () => {
      render(<BooleanField schema={createSchema()} name="test" value={false} onChange={vi.fn()} />);
      const checkbox = screen.getByTestId("boolean-field-test");
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).toHaveAttribute("type", "checkbox");
    });

    it("should use custom testId", () => {
      render(
        <BooleanField
          schema={createSchema()}
          name="test"
          value={false}
          onChange={vi.fn()}
          testId="my-checkbox"
        />
      );
      expect(screen.getByTestId("my-checkbox")).toBeInTheDocument();
    });

    it("should reflect checked state", () => {
      render(<BooleanField schema={createSchema()} name="test" value={true} onChange={vi.fn()} />);
      const checkbox = screen.getByTestId("boolean-field-test");
      expect(checkbox).toBeChecked();
    });

    it("should reflect unchecked state", () => {
      render(<BooleanField schema={createSchema()} name="test" value={false} onChange={vi.fn()} />);
      const checkbox = screen.getByTestId("boolean-field-test");
      expect(checkbox).not.toBeChecked();
    });
  });

  describe("Value Changes", () => {
    it("should call onChange when checkbox is clicked", () => {
      const onChange = vi.fn();
      render(
        <BooleanField schema={createSchema()} name="test" value={false} onChange={onChange} />
      );
      const checkbox = screen.getByTestId("boolean-field-test");
      fireEvent.click(checkbox);
      expect(onChange).toHaveBeenCalledWith(true);
    });

    it("should toggle from true to false", () => {
      const onChange = vi.fn();
      render(<BooleanField schema={createSchema()} name="test" value={true} onChange={onChange} />);
      const checkbox = screen.getByTestId("boolean-field-test");
      fireEvent.click(checkbox);
      expect(onChange).toHaveBeenCalledWith(false);
    });

    it("should call onBlur when checkbox loses focus", () => {
      const onBlur = vi.fn();
      render(
        <BooleanField
          schema={createSchema()}
          name="test"
          value={false}
          onChange={vi.fn()}
          onBlur={onBlur}
        />
      );
      const checkbox = screen.getByTestId("boolean-field-test");
      fireEvent.blur(checkbox);
      expect(onBlur).toHaveBeenCalled();
    });
  });

  describe("Checked Class", () => {
    it("should apply checked class when true", () => {
      render(<BooleanField schema={createSchema()} name="test" value={true} onChange={vi.fn()} />);
      const checkbox = screen.getByTestId("boolean-field-test");
      expect(checkbox.closest(`.${BOOLEAN_FIELD_CLASS}`)).toHaveClass(BOOLEAN_FIELD_CHECKED_CLASS);
    });

    it("should not apply checked class when false", () => {
      render(<BooleanField schema={createSchema()} name="test" value={false} onChange={vi.fn()} />);
      const checkbox = screen.getByTestId("boolean-field-test");
      expect(checkbox.closest(`.${BOOLEAN_FIELD_CLASS}`)).not.toHaveClass(
        BOOLEAN_FIELD_CHECKED_CLASS
      );
    });
  });

  describe("Switch Mode", () => {
    it("should render as switch when ui:widget is switch", () => {
      render(
        <BooleanField
          schema={createSchema({ "ui:widget": "switch" })}
          name="test"
          value={false}
          onChange={vi.fn()}
        />
      );
      const checkbox = screen.getByTestId("boolean-field-test");
      expect(checkbox).toBeInTheDocument();
      expect(screen.getByTestId("boolean-field-test-track")).toBeInTheDocument();
    });

    it("should toggle when switch is clicked", () => {
      const onChange = vi.fn();
      render(
        <BooleanField
          schema={createSchema({ "ui:widget": "switch" })}
          name="test"
          value={false}
          onChange={onChange}
        />
      );
      const checkbox = screen.getByTestId("boolean-field-test");
      fireEvent.click(checkbox);
      expect(onChange).toHaveBeenCalledWith(true);
    });

    it("should toggle on Enter keypress", () => {
      const onChange = vi.fn();
      render(
        <BooleanField
          schema={createSchema({ "ui:widget": "switch" })}
          name="test"
          value={false}
          onChange={onChange}
        />
      );
      const track = screen.getByTestId("boolean-field-test-track");
      fireEvent.keyDown(track, { key: "Enter" });
      expect(onChange).toHaveBeenCalledWith(true);
    });

    it("should toggle on Space keypress", () => {
      const onChange = vi.fn();
      render(
        <BooleanField
          schema={createSchema({ "ui:widget": "switch" })}
          name="test"
          value={true}
          onChange={onChange}
        />
      );
      const track = screen.getByTestId("boolean-field-test-track");
      fireEvent.keyDown(track, { key: " " });
      expect(onChange).toHaveBeenCalledWith(false);
    });
  });

  describe("Radio Mode", () => {
    it("should render as radio buttons when ui:widget is radio", () => {
      render(
        <BooleanField
          schema={createSchema({ "ui:widget": "radio" })}
          name="test"
          value={false}
          onChange={vi.fn()}
        />
      );
      expect(screen.getByTestId("boolean-field-test")).toBeInTheDocument();
      expect(screen.getByTestId("boolean-field-test-true")).toBeInTheDocument();
      expect(screen.getByTestId("boolean-field-test-false")).toBeInTheDocument();
    });

    it("should check true radio when value is true", () => {
      render(
        <BooleanField
          schema={createSchema({ "ui:widget": "radio" })}
          name="test"
          value={true}
          onChange={vi.fn()}
        />
      );
      expect(screen.getByTestId("boolean-field-test-true")).toBeChecked();
      expect(screen.getByTestId("boolean-field-test-false")).not.toBeChecked();
    });

    it("should check false radio when value is false", () => {
      render(
        <BooleanField
          schema={createSchema({ "ui:widget": "radio" })}
          name="test"
          value={false}
          onChange={vi.fn()}
        />
      );
      expect(screen.getByTestId("boolean-field-test-true")).not.toBeChecked();
      expect(screen.getByTestId("boolean-field-test-false")).toBeChecked();
    });

    it("should call onChange with true when true radio clicked", () => {
      const onChange = vi.fn();
      render(
        <BooleanField
          schema={createSchema({ "ui:widget": "radio" })}
          name="test"
          value={false}
          onChange={onChange}
        />
      );
      fireEvent.click(screen.getByTestId("boolean-field-test-true"));
      expect(onChange).toHaveBeenCalledWith(true);
    });

    it("should call onChange with false when false radio clicked", () => {
      const onChange = vi.fn();
      render(
        <BooleanField
          schema={createSchema({ "ui:widget": "radio" })}
          name="test"
          value={true}
          onChange={onChange}
        />
      );
      fireEvent.click(screen.getByTestId("boolean-field-test-false"));
      expect(onChange).toHaveBeenCalledWith(false);
    });

    it("should use custom labels for radio buttons", () => {
      render(
        <BooleanField
          schema={createSchema({ "ui:widget": "radio" })}
          name="test"
          value={false}
          onChange={vi.fn()}
          trueLabel="Enabled"
          falseLabel="Disabled"
        />
      );
      expect(screen.getByText("Enabled")).toBeInTheDocument();
      expect(screen.getByText("Disabled")).toBeInTheDocument();
    });
  });

  describe("Read-Only and Disabled States", () => {
    it("should apply readonly class", () => {
      render(
        <BooleanField
          schema={createSchema()}
          name="test"
          value={false}
          onChange={vi.fn()}
          readOnly
        />
      );
      const checkbox = screen.getByTestId("boolean-field-test");
      expect(checkbox.closest(`.${BOOLEAN_FIELD_CLASS}`)).toHaveClass(BOOLEAN_FIELD_READONLY_CLASS);
    });

    it("should not call onChange when readOnly and clicked", () => {
      const onChange = vi.fn();
      render(
        <BooleanField
          schema={createSchema()}
          name="test"
          value={false}
          onChange={onChange}
          readOnly
        />
      );
      const checkbox = screen.getByTestId("boolean-field-test");
      fireEvent.click(checkbox);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("should apply disabled class", () => {
      render(
        <BooleanField
          schema={createSchema()}
          name="test"
          value={false}
          onChange={vi.fn()}
          disabled
        />
      );
      const checkbox = screen.getByTestId("boolean-field-test");
      expect(checkbox.closest(`.${BOOLEAN_FIELD_CLASS}`)).toHaveClass(BOOLEAN_FIELD_DISABLED_CLASS);
      expect(checkbox).toBeDisabled();
    });
  });

  describe("Error State", () => {
    it("should apply error class when error exists", () => {
      render(
        <BooleanField
          schema={createSchema()}
          name="test"
          value={false}
          onChange={vi.fn()}
          error="Required"
        />
      );
      const checkbox = screen.getByTestId("boolean-field-test");
      expect(checkbox.closest(`.${BOOLEAN_FIELD_CLASS}`)).toHaveClass(BOOLEAN_FIELD_ERROR_CLASS);
    });

    it("should set aria-invalid when error exists", () => {
      render(
        <BooleanField
          schema={createSchema()}
          name="test"
          value={false}
          onChange={vi.fn()}
          error="Required"
        />
      );
      const checkbox = screen.getByTestId("boolean-field-test");
      expect(checkbox).toHaveAttribute("aria-invalid", "true");
    });
  });

  describe("Required Field", () => {
    it("should apply required class when validation.required is true", () => {
      render(
        <BooleanField
          schema={createSchema({ validation: { required: true } })}
          name="test"
          value={false}
          onChange={vi.fn()}
        />
      );
      const checkbox = screen.getByTestId("boolean-field-test");
      expect(checkbox.closest(`.${BOOLEAN_FIELD_CLASS}`)).toHaveClass(BOOLEAN_FIELD_REQUIRED_CLASS);
    });

    it("should set aria-required when required", () => {
      render(
        <BooleanField
          schema={createSchema({ validation: { required: true } })}
          name="test"
          value={false}
          onChange={vi.fn()}
        />
      );
      const checkbox = screen.getByTestId("boolean-field-test");
      expect(checkbox).toHaveAttribute("aria-required", "true");
    });
  });
});

describe("CheckboxField", () => {
  it("should render as checkbox", () => {
    render(<CheckboxField schema={createSchema()} name="test" value={false} onChange={vi.fn()} />);
    const checkbox = screen.getByTestId("boolean-field-test");
    expect(checkbox).toHaveAttribute("type", "checkbox");
  });
});

describe("SwitchField", () => {
  it("should render as switch", () => {
    render(<SwitchField schema={createSchema()} name="test" value={false} onChange={vi.fn()} />);
    expect(screen.getByTestId("boolean-field-test-track")).toBeInTheDocument();
  });
});

describe("RadioBooleanField", () => {
  it("should render as radio buttons", () => {
    render(
      <RadioBooleanField schema={createSchema()} name="test" value={false} onChange={vi.fn()} />
    );
    expect(screen.getByTestId("boolean-field-test-true")).toBeInTheDocument();
    expect(screen.getByTestId("boolean-field-test-false")).toBeInTheDocument();
  });
});
