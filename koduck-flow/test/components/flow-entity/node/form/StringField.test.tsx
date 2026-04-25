/**
 * @file StringField Component Tests
 * @description Unit tests for the StringField component.
 *
 * @see docs/design/flow-entity-step-plan-en.md Tasks 4.3-4.7
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import {
  StringField,
  TextField,
  PasswordField,
  EmailField,
  UrlField,
  TextareaField,
  STRING_FIELD_CLASS,
  STRING_FIELD_TEXTAREA_CLASS,
  STRING_FIELD_READONLY_CLASS,
  STRING_FIELD_DISABLED_CLASS,
  STRING_FIELD_ERROR_CLASS,
  STRING_FIELD_REQUIRED_CLASS,
} from "../../../../../src/components/flow-entity/node/form/StringField";
import type { ExtendedFormFieldSchema } from "../../../../../src/components/flow-entity/node/form/types";

// =============================================================================
// Test Helpers
// =============================================================================

const createSchema = (
  overrides: Partial<ExtendedFormFieldSchema> = {}
): ExtendedFormFieldSchema => ({
  type: "text",
  label: "Test Field",
  ...overrides,
});

// =============================================================================
// Tests
// =============================================================================

describe("StringField", () => {
  describe("Basic Rendering", () => {
    it("should render with base class on wrapper", () => {
      render(<StringField schema={createSchema()} name="test" value="" onChange={vi.fn()} />);
      const input = screen.getByTestId("string-field-test");
      expect(input.parentElement).toHaveClass(STRING_FIELD_CLASS);
    });

    it("should render input element with value", () => {
      render(<StringField schema={createSchema()} name="test" value="hello" onChange={vi.fn()} />);
      const input = screen.getByTestId("string-field-test");
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue("hello");
    });

    it("should use custom testId", () => {
      render(
        <StringField
          schema={createSchema()}
          name="test"
          value=""
          onChange={vi.fn()}
          testId="my-field"
        />
      );
      expect(screen.getByTestId("my-field")).toBeInTheDocument();
    });
  });

  describe("Input Types", () => {
    it("should render text input by default", () => {
      render(
        <StringField
          schema={createSchema({ type: "text" })}
          name="test"
          value=""
          onChange={vi.fn()}
        />
      );
      const input = screen.getByTestId("string-field-test");
      expect(input).toHaveAttribute("type", "text");
    });

    it("should render password input for password type", () => {
      render(
        <StringField
          schema={createSchema({ type: "password" })}
          name="test"
          value=""
          onChange={vi.fn()}
        />
      );
      const input = screen.getByTestId("string-field-test");
      expect(input).toHaveAttribute("type", "password");
    });

    it("should render email input for email type", () => {
      render(
        <StringField
          schema={createSchema({ type: "email" })}
          name="test"
          value=""
          onChange={vi.fn()}
        />
      );
      const input = screen.getByTestId("string-field-test");
      expect(input).toHaveAttribute("type", "email");
    });

    it("should render url input for url type", () => {
      render(
        <StringField
          schema={createSchema({ type: "url" })}
          name="test"
          value=""
          onChange={vi.fn()}
        />
      );
      const input = screen.getByTestId("string-field-test");
      expect(input).toHaveAttribute("type", "url");
    });
  });

  describe("Textarea Mode", () => {
    it("should render textarea when ui:widget is textarea", () => {
      render(
        <StringField
          schema={createSchema({ "ui:widget": "textarea" })}
          name="test"
          value=""
          onChange={vi.fn()}
        />
      );
      const textarea = screen.getByTestId("string-field-test");
      expect(textarea.tagName.toLowerCase()).toBe("textarea");
    });

    it("should render textarea when type is textarea", () => {
      render(
        <StringField
          schema={createSchema({ type: "textarea" })}
          name="test"
          value=""
          onChange={vi.fn()}
        />
      );
      const textarea = screen.getByTestId("string-field-test");
      expect(textarea.tagName.toLowerCase()).toBe("textarea");
    });

    it("should use rows option for textarea", () => {
      render(
        <StringField
          schema={createSchema({
            "ui:widget": "textarea",
            "ui:options": { rows: 10 },
          })}
          name="test"
          value=""
          onChange={vi.fn()}
        />
      );
      const textarea = screen.getByTestId("string-field-test");
      expect(textarea).toHaveAttribute("rows", "10");
    });

    it("should apply textarea class", () => {
      render(
        <StringField
          schema={createSchema({ "ui:widget": "textarea" })}
          name="test"
          value=""
          onChange={vi.fn()}
        />
      );
      const textarea = screen.getByTestId("string-field-test");
      expect(textarea).toHaveClass(STRING_FIELD_TEXTAREA_CLASS);
    });
  });

  describe("Value Changes", () => {
    it("should call onChange when value changes", () => {
      const onChange = vi.fn();
      render(<StringField schema={createSchema()} name="test" value="" onChange={onChange} />);
      const input = screen.getByTestId("string-field-test");
      fireEvent.change(input, { target: { value: "new value" } });
      expect(onChange).toHaveBeenCalledWith("new value");
    });

    it("should call onBlur when field loses focus", () => {
      const onBlur = vi.fn();
      render(
        <StringField
          schema={createSchema()}
          name="test"
          value=""
          onChange={vi.fn()}
          onBlur={onBlur}
        />
      );
      const input = screen.getByTestId("string-field-test");
      fireEvent.blur(input);
      expect(onBlur).toHaveBeenCalled();
    });
  });

  describe("Read-Only and Disabled States", () => {
    it("should apply readonly class and attribute", () => {
      render(
        <StringField schema={createSchema()} name="test" value="" onChange={vi.fn()} readOnly />
      );
      const input = screen.getByTestId("string-field-test");
      expect(input.parentElement).toHaveClass(STRING_FIELD_READONLY_CLASS);
      expect(input).toHaveAttribute("readonly");
    });

    it("should apply disabled class and attribute", () => {
      render(
        <StringField schema={createSchema()} name="test" value="" onChange={vi.fn()} disabled />
      );
      const input = screen.getByTestId("string-field-test");
      expect(input.parentElement).toHaveClass(STRING_FIELD_DISABLED_CLASS);
      expect(input).toBeDisabled();
    });
  });

  describe("Error State", () => {
    it("should apply error class when error exists", () => {
      render(
        <StringField
          schema={createSchema()}
          name="test"
          value=""
          onChange={vi.fn()}
          error="Required field"
        />
      );
      const input = screen.getByTestId("string-field-test");
      expect(input.parentElement).toHaveClass(STRING_FIELD_ERROR_CLASS);
    });

    it("should set aria-invalid when error exists", () => {
      render(
        <StringField
          schema={createSchema()}
          name="test"
          value=""
          onChange={vi.fn()}
          error="Required field"
        />
      );
      const input = screen.getByTestId("string-field-test");
      expect(input).toHaveAttribute("aria-invalid", "true");
    });
  });

  describe("Required Field", () => {
    it("should apply required class when validation.required is true", () => {
      render(
        <StringField
          schema={createSchema({ validation: { required: true } })}
          name="test"
          value=""
          onChange={vi.fn()}
        />
      );
      const input = screen.getByTestId("string-field-test");
      expect(input.parentElement).toHaveClass(STRING_FIELD_REQUIRED_CLASS);
    });

    it("should set aria-required when required", () => {
      render(
        <StringField
          schema={createSchema({ validation: { required: true } })}
          name="test"
          value=""
          onChange={vi.fn()}
        />
      );
      const input = screen.getByTestId("string-field-test");
      expect(input).toHaveAttribute("aria-required", "true");
    });
  });

  describe("Placeholder", () => {
    it("should use placeholder from schema", () => {
      render(
        <StringField
          schema={createSchema({ placeholder: "Enter text" })}
          name="test"
          value=""
          onChange={vi.fn()}
        />
      );
      const input = screen.getByTestId("string-field-test");
      expect(input).toHaveAttribute("placeholder", "Enter text");
    });

    it("should prefer ui:placeholder over placeholder", () => {
      render(
        <StringField
          schema={createSchema({
            placeholder: "Default",
            "ui:placeholder": "UI Placeholder",
          })}
          name="test"
          value=""
          onChange={vi.fn()}
        />
      );
      const input = screen.getByTestId("string-field-test");
      expect(input).toHaveAttribute("placeholder", "UI Placeholder");
    });
  });

  describe("Max Length", () => {
    it("should apply maxLength from ui:options", () => {
      render(
        <StringField
          schema={createSchema({ "ui:options": { maxLength: 100 } })}
          name="test"
          value=""
          onChange={vi.fn()}
        />
      );
      const input = screen.getByTestId("string-field-test");
      expect(input).toHaveAttribute("maxLength", "100");
    });

    it("should apply maxLength from validation", () => {
      render(
        <StringField
          schema={createSchema({ validation: { maxLength: 50 } })}
          name="test"
          value=""
          onChange={vi.fn()}
        />
      );
      const input = screen.getByTestId("string-field-test");
      expect(input).toHaveAttribute("maxLength", "50");
    });
  });
});

describe("TextField", () => {
  it("should render as text input", () => {
    render(<TextField schema={createSchema()} name="test" value="" onChange={vi.fn()} />);
    const input = screen.getByTestId("string-field-test");
    expect(input).toHaveAttribute("type", "text");
  });
});

describe("PasswordField", () => {
  it("should render as password input", () => {
    render(<PasswordField schema={createSchema()} name="test" value="" onChange={vi.fn()} />);
    const input = screen.getByTestId("string-field-test");
    expect(input).toHaveAttribute("type", "password");
  });
});

describe("EmailField", () => {
  it("should render as email input", () => {
    render(<EmailField schema={createSchema()} name="test" value="" onChange={vi.fn()} />);
    const input = screen.getByTestId("string-field-test");
    expect(input).toHaveAttribute("type", "email");
  });
});

describe("UrlField", () => {
  it("should render as url input", () => {
    render(<UrlField schema={createSchema()} name="test" value="" onChange={vi.fn()} />);
    const input = screen.getByTestId("string-field-test");
    expect(input).toHaveAttribute("type", "url");
  });
});

describe("TextareaField", () => {
  it("should render as textarea", () => {
    render(<TextareaField schema={createSchema()} name="test" value="" onChange={vi.fn()} />);
    const textarea = screen.getByTestId("string-field-test");
    expect(textarea.tagName.toLowerCase()).toBe("textarea");
  });
});
