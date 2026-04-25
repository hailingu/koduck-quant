/**
 * @file NumberField Component Tests
 * @description Unit tests for the NumberField component.
 *
 * @see docs/design/flow-entity-step-plan-en.md Tasks 4.3-4.7
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import {
  NumberField,
  SliderField,
  RangeField,
  UpDownField,
  NUMBER_FIELD_CLASS,
  NUMBER_FIELD_SLIDER_CLASS,
  NUMBER_FIELD_READONLY_CLASS,
  NUMBER_FIELD_DISABLED_CLASS,
  NUMBER_FIELD_ERROR_CLASS,
  NUMBER_FIELD_REQUIRED_CLASS,
} from "../../../../../src/components/flow-entity/node/form/NumberField";
import type { ExtendedFormFieldSchema } from "../../../../../src/components/flow-entity/node/form/types";

// =============================================================================
// Test Helpers
// =============================================================================

const createSchema = (
  overrides: Partial<ExtendedFormFieldSchema> = {}
): ExtendedFormFieldSchema => ({
  type: "number",
  label: "Test Number",
  ...overrides,
});

// =============================================================================
// Tests
// =============================================================================

describe("NumberField", () => {
  describe("Basic Rendering", () => {
    it("should render with base class on wrapper", () => {
      render(<NumberField schema={createSchema()} name="test" value={0} onChange={vi.fn()} />);
      const input = screen.getByTestId("number-field-test");
      expect(input.parentElement).toHaveClass(NUMBER_FIELD_CLASS);
    });

    it("should render number input with value", () => {
      render(<NumberField schema={createSchema()} name="test" value={42} onChange={vi.fn()} />);
      const input = screen.getByTestId("number-field-test");
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue(42);
    });

    it("should use custom testId", () => {
      render(
        <NumberField
          schema={createSchema()}
          name="test"
          value={0}
          onChange={vi.fn()}
          testId="my-number"
        />
      );
      expect(screen.getByTestId("my-number")).toBeInTheDocument();
    });

    it("should render as number type input", () => {
      render(<NumberField schema={createSchema()} name="test" value={0} onChange={vi.fn()} />);
      const input = screen.getByTestId("number-field-test");
      expect(input).toHaveAttribute("type", "number");
    });
  });

  describe("Value Changes", () => {
    it("should call onChange when value changes", () => {
      const onChange = vi.fn();
      render(<NumberField schema={createSchema()} name="test" value={0} onChange={onChange} />);
      const input = screen.getByTestId("number-field-test");
      fireEvent.change(input, { target: { value: "25" } });
      expect(onChange).toHaveBeenCalledWith(25);
    });

    it("should call onBlur when field loses focus", () => {
      const onBlur = vi.fn();
      render(
        <NumberField
          schema={createSchema()}
          name="test"
          value={0}
          onChange={vi.fn()}
          onBlur={onBlur}
        />
      );
      const input = screen.getByTestId("number-field-test");
      fireEvent.blur(input);
      expect(onBlur).toHaveBeenCalled();
    });
  });

  describe("Min/Max Constraints", () => {
    it("should apply min attribute from validation", () => {
      render(
        <NumberField
          schema={createSchema({ validation: { min: 10 } })}
          name="test"
          value={15}
          onChange={vi.fn()}
        />
      );
      const input = screen.getByTestId("number-field-test");
      expect(input).toHaveAttribute("min", "10");
    });

    it("should apply max attribute from validation", () => {
      render(
        <NumberField
          schema={createSchema({ validation: { max: 100 } })}
          name="test"
          value={50}
          onChange={vi.fn()}
        />
      );
      const input = screen.getByTestId("number-field-test");
      expect(input).toHaveAttribute("max", "100");
    });

    it("should apply min from ui:options", () => {
      render(
        <NumberField
          schema={createSchema({ "ui:options": { min: 5 } })}
          name="test"
          value={10}
          onChange={vi.fn()}
        />
      );
      const input = screen.getByTestId("number-field-test");
      expect(input).toHaveAttribute("min", "5");
    });

    it("should clamp value to max when exceeding", () => {
      const onChange = vi.fn();
      render(
        <NumberField
          schema={createSchema({ validation: { max: 100 } })}
          name="test"
          value={50}
          onChange={onChange}
        />
      );
      const input = screen.getByTestId("number-field-test");
      fireEvent.change(input, { target: { value: "150" } });
      expect(onChange).toHaveBeenCalledWith(100);
    });

    it("should clamp value to min when below", () => {
      const onChange = vi.fn();
      render(
        <NumberField
          schema={createSchema({ validation: { min: 0 } })}
          name="test"
          value={50}
          onChange={onChange}
        />
      );
      const input = screen.getByTestId("number-field-test");
      fireEvent.change(input, { target: { value: "-10" } });
      expect(onChange).toHaveBeenCalledWith(0);
    });
  });

  describe("Step", () => {
    it("should apply step from ui:options", () => {
      render(
        <NumberField
          schema={createSchema({ "ui:options": { step: 5 } })}
          name="test"
          value={0}
          onChange={vi.fn()}
        />
      );
      const input = screen.getByTestId("number-field-test");
      expect(input).toHaveAttribute("step", "5");
    });

    it("should use default step of 1", () => {
      render(<NumberField schema={createSchema()} name="test" value={0} onChange={vi.fn()} />);
      const input = screen.getByTestId("number-field-test");
      expect(input).toHaveAttribute("step", "1");
    });
  });

  describe("Slider Mode", () => {
    it("should render as range input when ui:widget is slider", () => {
      render(
        <NumberField
          schema={createSchema({ "ui:widget": "slider" })}
          name="test"
          value={50}
          onChange={vi.fn()}
        />
      );
      const input = screen.getByTestId("number-field-test");
      expect(input).toHaveAttribute("type", "range");
    });

    it("should render as range input when type is range", () => {
      render(
        <NumberField
          schema={createSchema({ type: "range" })}
          name="test"
          value={50}
          onChange={vi.fn()}
        />
      );
      const input = screen.getByTestId("number-field-test");
      expect(input).toHaveAttribute("type", "range");
    });

    it("should show value display for slider", () => {
      render(
        <NumberField
          schema={createSchema({ "ui:widget": "slider" })}
          name="test"
          value={75}
          onChange={vi.fn()}
        />
      );
      expect(screen.getByTestId("number-field-test-value")).toHaveTextContent("75");
    });

    it("should apply slider class", () => {
      render(
        <NumberField
          schema={createSchema({ "ui:widget": "slider" })}
          name="test"
          value={50}
          onChange={vi.fn()}
        />
      );
      const input = screen.getByTestId("number-field-test");
      expect(input).toHaveClass(NUMBER_FIELD_SLIDER_CLASS);
    });
  });

  describe("UpDown Mode", () => {
    it("should render increment button", () => {
      render(
        <NumberField
          schema={createSchema({ "ui:widget": "updown" })}
          name="test"
          value={5}
          onChange={vi.fn()}
        />
      );
      expect(screen.getByTestId("number-field-test-increment")).toBeInTheDocument();
    });

    it("should render decrement button", () => {
      render(
        <NumberField
          schema={createSchema({ "ui:widget": "updown" })}
          name="test"
          value={5}
          onChange={vi.fn()}
        />
      );
      expect(screen.getByTestId("number-field-test-decrement")).toBeInTheDocument();
    });

    it("should increment value when + button clicked", () => {
      const onChange = vi.fn();
      render(
        <NumberField
          schema={createSchema({ "ui:widget": "updown" })}
          name="test"
          value={5}
          onChange={onChange}
        />
      );
      fireEvent.click(screen.getByTestId("number-field-test-increment"));
      expect(onChange).toHaveBeenCalledWith(6);
    });

    it("should decrement value when - button clicked", () => {
      const onChange = vi.fn();
      render(
        <NumberField
          schema={createSchema({ "ui:widget": "updown" })}
          name="test"
          value={5}
          onChange={onChange}
        />
      );
      fireEvent.click(screen.getByTestId("number-field-test-decrement"));
      expect(onChange).toHaveBeenCalledWith(4);
    });

    it("should respect step when incrementing", () => {
      const onChange = vi.fn();
      render(
        <NumberField
          schema={createSchema({ "ui:widget": "updown", "ui:options": { step: 5 } })}
          name="test"
          value={10}
          onChange={onChange}
        />
      );
      fireEvent.click(screen.getByTestId("number-field-test-increment"));
      expect(onChange).toHaveBeenCalledWith(15);
    });

    it("should disable increment when at max", () => {
      render(
        <NumberField
          schema={createSchema({ "ui:widget": "updown", validation: { max: 10 } })}
          name="test"
          value={10}
          onChange={vi.fn()}
        />
      );
      expect(screen.getByTestId("number-field-test-increment")).toBeDisabled();
    });

    it("should disable decrement when at min", () => {
      render(
        <NumberField
          schema={createSchema({ "ui:widget": "updown", validation: { min: 0 } })}
          name="test"
          value={0}
          onChange={vi.fn()}
        />
      );
      expect(screen.getByTestId("number-field-test-decrement")).toBeDisabled();
    });
  });

  describe("Read-Only and Disabled States", () => {
    it("should apply readonly class", () => {
      render(
        <NumberField schema={createSchema()} name="test" value={0} onChange={vi.fn()} readOnly />
      );
      const input = screen.getByTestId("number-field-test");
      expect(input.parentElement).toHaveClass(NUMBER_FIELD_READONLY_CLASS);
      expect(input).toHaveAttribute("readonly");
    });

    it("should apply disabled class", () => {
      render(
        <NumberField schema={createSchema()} name="test" value={0} onChange={vi.fn()} disabled />
      );
      const input = screen.getByTestId("number-field-test");
      expect(input.parentElement).toHaveClass(NUMBER_FIELD_DISABLED_CLASS);
      expect(input).toBeDisabled();
    });
  });

  describe("Error State", () => {
    it("should apply error class when error exists", () => {
      render(
        <NumberField
          schema={createSchema()}
          name="test"
          value={0}
          onChange={vi.fn()}
          error="Must be positive"
        />
      );
      const input = screen.getByTestId("number-field-test");
      expect(input.parentElement).toHaveClass(NUMBER_FIELD_ERROR_CLASS);
    });

    it("should set aria-invalid when error exists", () => {
      render(
        <NumberField
          schema={createSchema()}
          name="test"
          value={0}
          onChange={vi.fn()}
          error="Invalid"
        />
      );
      const input = screen.getByTestId("number-field-test");
      expect(input).toHaveAttribute("aria-invalid", "true");
    });
  });

  describe("Required Field", () => {
    it("should apply required class when validation.required is true", () => {
      render(
        <NumberField
          schema={createSchema({ validation: { required: true } })}
          name="test"
          value={0}
          onChange={vi.fn()}
        />
      );
      const input = screen.getByTestId("number-field-test");
      expect(input.parentElement).toHaveClass(NUMBER_FIELD_REQUIRED_CLASS);
    });

    it("should set aria-required when required", () => {
      render(
        <NumberField
          schema={createSchema({ validation: { required: true } })}
          name="test"
          value={0}
          onChange={vi.fn()}
        />
      );
      const input = screen.getByTestId("number-field-test");
      expect(input).toHaveAttribute("aria-required", "true");
    });
  });
});

describe("SliderField", () => {
  it("should render as range input", () => {
    render(<SliderField schema={createSchema()} name="test" value={50} onChange={vi.fn()} />);
    const input = screen.getByTestId("number-field-test");
    expect(input).toHaveAttribute("type", "range");
  });
});

describe("RangeField", () => {
  it("should render as range input", () => {
    render(<RangeField schema={createSchema()} name="test" value={50} onChange={vi.fn()} />);
    const input = screen.getByTestId("number-field-test");
    expect(input).toHaveAttribute("type", "range");
  });
});

describe("UpDownField", () => {
  it("should render with increment/decrement buttons", () => {
    render(<UpDownField schema={createSchema()} name="test" value={5} onChange={vi.fn()} />);
    expect(screen.getByTestId("number-field-test-increment")).toBeInTheDocument();
    expect(screen.getByTestId("number-field-test-decrement")).toBeInTheDocument();
  });
});
