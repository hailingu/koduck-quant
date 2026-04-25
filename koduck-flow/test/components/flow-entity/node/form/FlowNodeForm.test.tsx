/**
 * @file FlowNodeForm Component Tests
 * @description Unit tests for the FlowNodeForm component.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 4.2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";
import {
  FlowNodeForm,
  defaultFieldRenderers,
  FORM_CLASS,
  FORM_COMPACT_CLASS,
  FORM_READONLY_CLASS,
  FORM_DISABLED_CLASS,
  FORM_FIELDS_CLASS,
  type FlowNodeFormProps,
} from "../../../../../src/components/flow-entity/node/form/FlowNodeForm";
import type {
  ExtendedFormSchema,
  FieldProps,
  FormValidationResult,
} from "../../../../../src/components/flow-entity/node/form/types";

// =============================================================================
// Test Helpers
// =============================================================================

const createSchema = (properties: Record<string, object> = {}): ExtendedFormSchema => ({
  type: "object",
  properties: {
    name: { type: "text", label: "Name" },
    ...properties,
  },
});

const renderForm = (props: Partial<FlowNodeFormProps> = {}) => {
  const defaultProps: FlowNodeFormProps = {
    schema: createSchema(),
    data: {},
    onChange: vi.fn(),
    ...props,
  };
  return render(<FlowNodeForm {...defaultProps} />);
};

// =============================================================================
// Tests
// =============================================================================

describe("FlowNodeForm", () => {
  describe("Basic Rendering", () => {
    it("should render with base class", () => {
      renderForm();
      const form = screen.getByTestId("flow-node-form");
      expect(form).toHaveClass(FORM_CLASS);
    });

    it("should render fields container", () => {
      const { container } = renderForm();
      expect(container.querySelector(`.${FORM_FIELDS_CLASS}`)).toBeInTheDocument();
    });

    it("should use custom testId", () => {
      renderForm({ testId: "my-form" });
      expect(screen.getByTestId("my-form")).toBeInTheDocument();
    });

    it("should have role=form", () => {
      renderForm();
      const form = screen.getByTestId("flow-node-form");
      expect(form).toHaveAttribute("role", "form");
    });
  });

  describe("Field Rendering", () => {
    it("should render all visible fields from schema", () => {
      renderForm({
        schema: createSchema({
          name: { type: "text", label: "Name" },
          email: { type: "email", label: "Email" },
          age: { type: "number", label: "Age" },
        }),
      });
      expect(screen.getByTestId("field-wrapper-name")).toBeInTheDocument();
      expect(screen.getByTestId("field-wrapper-email")).toBeInTheDocument();
      expect(screen.getByTestId("field-wrapper-age")).toBeInTheDocument();
    });

    it("should not render hidden fields", () => {
      renderForm({
        schema: createSchema({
          name: { type: "text", label: "Name" },
          secret: { type: "text", label: "Secret", hidden: true },
        }),
      });
      expect(screen.getByTestId("field-wrapper-name")).toBeInTheDocument();
      expect(screen.queryByTestId("field-wrapper-secret")).not.toBeInTheDocument();
    });

    it("should render fields in ui:order", () => {
      const schema: ExtendedFormSchema = {
        type: "object",
        properties: {
          name: { type: "text", label: "Name" },
          email: { type: "email", label: "Email" },
          age: { type: "number", label: "Age" },
        },
        "ui:order": ["age", "name", "email"],
      };
      const { container } = renderForm({ schema });

      const wrappers = container.querySelectorAll('[data-testid^="field-wrapper-"]');
      expect(wrappers[0]).toHaveAttribute("data-field-name", "age");
      expect(wrappers[1]).toHaveAttribute("data-field-name", "name");
      expect(wrappers[2]).toHaveAttribute("data-field-name", "email");
    });

    it("should respect visibleWhen conditions", () => {
      const schema: ExtendedFormSchema = {
        type: "object",
        properties: {
          showEmail: { type: "boolean", label: "Show Email" },
          email: { type: "email", label: "Email", visibleWhen: "showEmail" },
        },
      };
      renderForm({
        schema,
        data: { showEmail: false },
      });
      expect(screen.queryByTestId("field-wrapper-email")).not.toBeInTheDocument();
    });

    it("should show conditional fields when condition is met", () => {
      const schema: ExtendedFormSchema = {
        type: "object",
        properties: {
          showEmail: { type: "boolean", label: "Show Email" },
          email: { type: "email", label: "Email", visibleWhen: "showEmail" },
        },
      };
      renderForm({
        schema,
        data: { showEmail: true },
      });
      expect(screen.getByTestId("field-wrapper-email")).toBeInTheDocument();
    });
  });

  describe("Field Types", () => {
    it("should render text input for text type", () => {
      renderForm({
        schema: createSchema({
          name: { type: "text", label: "Name" },
        }),
      });
      const input = screen.getByTestId("field-input-name") as HTMLInputElement;
      expect(input.type).toBe("text");
    });

    it("should render number input for number type", () => {
      renderForm({
        schema: createSchema({
          age: { type: "number", label: "Age" },
        }),
      });
      const input = screen.getByTestId("field-input-age") as HTMLInputElement;
      expect(input.type).toBe("number");
    });

    it("should render checkbox for boolean type", () => {
      renderForm({
        schema: createSchema({
          active: { type: "boolean", label: "Active" },
        }),
      });
      const input = screen.getByTestId("field-input-active") as HTMLInputElement;
      expect(input.type).toBe("checkbox");
    });

    it("should render select for select type", () => {
      renderForm({
        schema: createSchema({
          status: {
            type: "select",
            label: "Status",
            options: [
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ],
          },
        }),
      });
      const select = screen.getByTestId("field-input-status");
      expect(select.tagName.toLowerCase()).toBe("select");
    });

    it("should render date input for date type", () => {
      renderForm({
        schema: createSchema({
          birthday: { type: "date", label: "Birthday" },
        }),
      });
      const input = screen.getByTestId("field-input-birthday") as HTMLInputElement;
      expect(input.type).toBe("date");
    });

    it("should render color input for color type", () => {
      renderForm({
        schema: createSchema({
          color: { type: "color", label: "Color" },
        }),
      });
      const input = screen.getByTestId("field-input-color") as HTMLInputElement;
      expect(input.type).toBe("color");
    });

    it("should render textarea input for textarea type", () => {
      renderForm({
        schema: createSchema({
          description: { type: "textarea", label: "Description" },
        }),
      });
      const input = screen.getByTestId("field-input-description") as HTMLInputElement;
      // textarea type uses a text input in the placeholder renderer
      expect(input).toBeInTheDocument();
    });

    it("should render url input for url type", () => {
      renderForm({
        schema: createSchema({
          website: { type: "url", label: "Website" },
        }),
      });
      const input = screen.getByTestId("field-input-website") as HTMLInputElement;
      // url type uses a text input in the placeholder renderer
      expect(input).toBeInTheDocument();
    });

    it("should render range input for range type", () => {
      renderForm({
        schema: createSchema({
          volume: { type: "range", label: "Volume" },
        }),
      });
      const input = screen.getByTestId("field-input-volume") as HTMLInputElement;
      expect(input.type).toBe("range");
    });

    it("should render multiselect for multiselect type", () => {
      renderForm({
        schema: createSchema({
          tags: {
            type: "multiselect",
            label: "Tags",
            options: [
              { value: "a", label: "Option A" },
              { value: "b", label: "Option B" },
            ],
          },
        }),
      });
      const select = screen.getByTestId("field-input-tags") as HTMLSelectElement;
      expect(select.tagName.toLowerCase()).toBe("select");
      expect(select.multiple).toBe(true);
    });

    it("should render time input for time type", () => {
      renderForm({
        schema: createSchema({
          startTime: { type: "time", label: "Start Time" },
        }),
      });
      const input = screen.getByTestId("field-input-startTime") as HTMLInputElement;
      expect(input.type).toBe("time");
    });

    it("should render datetime input for datetime type", () => {
      renderForm({
        schema: createSchema({
          meeting: { type: "datetime", label: "Meeting" },
        }),
      });
      const input = screen.getByTestId("field-input-meeting") as HTMLInputElement;
      expect(input.type).toBe("datetime-local");
    });

    it("should render file input for file type", () => {
      renderForm({
        schema: createSchema({
          attachment: { type: "file", label: "Attachment" },
        }),
      });
      const input = screen.getByTestId("field-input-attachment") as HTMLInputElement;
      expect(input.type).toBe("file");
    });

    it("should render textarea for code type", () => {
      renderForm({
        schema: createSchema({
          script: { type: "code", label: "Script" },
        }),
      });
      const textarea = screen.getByTestId("field-input-script") as HTMLTextAreaElement;
      expect(textarea.tagName.toLowerCase()).toBe("textarea");
    });

    it("should render textarea for json type", () => {
      renderForm({
        schema: createSchema({
          config: { type: "json", label: "Config" },
        }),
      });
      const textarea = screen.getByTestId("field-input-config") as HTMLTextAreaElement;
      expect(textarea.tagName.toLowerCase()).toBe("textarea");
    });
  });

  describe("Data Binding", () => {
    it("should display initial data values", () => {
      renderForm({
        schema: createSchema({
          name: { type: "text", label: "Name" },
        }),
        data: { name: "John" },
      });
      const input = screen.getByTestId("field-input-name") as HTMLInputElement;
      expect(input.value).toBe("John");
    });

    it("should call onChange when field value changes", async () => {
      const onChange = vi.fn();
      renderForm({
        schema: createSchema({
          name: { type: "text", label: "Name" },
        }),
        data: { name: "" },
        onChange,
      });

      const input = screen.getByTestId("field-input-name");
      fireEvent.change(input, { target: { value: "John" } });

      expect(onChange).toHaveBeenCalled();
      expect(onChange).toHaveBeenCalledWith({ name: "John" });
    });

    it("should update number value correctly", async () => {
      const onChange = vi.fn();
      renderForm({
        schema: createSchema({
          age: { type: "number", label: "Age" },
        }),
        data: { age: 0 },
        onChange,
      });

      const input = screen.getByTestId("field-input-age");
      fireEvent.change(input, { target: { value: "25" } });

      expect(onChange).toHaveBeenCalledWith({ age: 25 });
    });

    it("should update boolean value correctly", async () => {
      const onChange = vi.fn();
      renderForm({
        schema: createSchema({
          active: { type: "boolean", label: "Active" },
        }),
        data: { active: false },
        onChange,
      });

      const input = screen.getByTestId("field-input-active");
      fireEvent.click(input);

      expect(onChange).toHaveBeenCalledWith({ active: true });
    });

    it("should update select value correctly", async () => {
      const onChange = vi.fn();
      renderForm({
        schema: createSchema({
          status: {
            type: "select",
            label: "Status",
            options: [
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ],
          },
        }),
        data: { status: "" },
        onChange,
      });

      const select = screen.getByTestId("field-input-status");
      fireEvent.change(select, { target: { value: "active" } });

      expect(onChange).toHaveBeenCalledWith({ status: "active" });
    });

    it("should update multiselect value correctly", async () => {
      const onChange = vi.fn();
      renderForm({
        schema: createSchema({
          tags: {
            type: "multiselect",
            label: "Tags",
            options: [
              { value: "a", label: "Option A" },
              { value: "b", label: "Option B" },
              { value: "c", label: "Option C" },
            ],
          },
        }),
        data: { tags: [] },
        onChange,
      });

      const select = screen.getByTestId("field-input-tags") as HTMLSelectElement;
      // Simulate selecting option A
      fireEvent.change(select, { target: { value: "a" } });

      expect(onChange).toHaveBeenCalled();
    });

    it("should update range value correctly", async () => {
      const onChange = vi.fn();
      renderForm({
        schema: createSchema({
          volume: { type: "range", label: "Volume" },
        }),
        data: { volume: 50 },
        onChange,
      });

      const input = screen.getByTestId("field-input-volume");
      fireEvent.change(input, { target: { value: "75" } });

      expect(onChange).toHaveBeenCalledWith({ volume: 75 });
    });

    it("should update time value correctly", async () => {
      const onChange = vi.fn();
      renderForm({
        schema: createSchema({
          startTime: { type: "time", label: "Start Time" },
        }),
        data: { startTime: "" },
        onChange,
      });

      const input = screen.getByTestId("field-input-startTime");
      fireEvent.change(input, { target: { value: "14:30" } });

      expect(onChange).toHaveBeenCalledWith({ startTime: "14:30" });
    });

    it("should update datetime value correctly", async () => {
      const onChange = vi.fn();
      renderForm({
        schema: createSchema({
          meeting: { type: "datetime", label: "Meeting" },
        }),
        data: { meeting: "" },
        onChange,
      });

      const input = screen.getByTestId("field-input-meeting");
      fireEvent.change(input, { target: { value: "2024-01-15T14:30" } });

      expect(onChange).toHaveBeenCalledWith({ meeting: "2024-01-15T14:30" });
    });

    it("should update json value with valid JSON", async () => {
      const onChange = vi.fn();
      renderForm({
        schema: createSchema({
          config: { type: "json", label: "Config" },
        }),
        data: { config: {} },
        onChange,
      });

      const textarea = screen.getByTestId("field-input-config");
      fireEvent.change(textarea, { target: { value: '{"key": "value"}' } });

      expect(onChange).toHaveBeenCalledWith({ config: { key: "value" } });
    });

    it("should keep json value as string when invalid JSON", async () => {
      const onChange = vi.fn();
      renderForm({
        schema: createSchema({
          config: { type: "json", label: "Config" },
        }),
        data: { config: {} },
        onChange,
      });

      const textarea = screen.getByTestId("field-input-config");
      fireEvent.change(textarea, { target: { value: "not valid json" } });

      expect(onChange).toHaveBeenCalledWith({ config: "not valid json" });
    });

    it("should update code value correctly", async () => {
      const onChange = vi.fn();
      renderForm({
        schema: createSchema({
          script: { type: "code", label: "Script" },
        }),
        data: { script: "" },
        onChange,
      });

      const textarea = screen.getByTestId("field-input-script");
      fireEvent.change(textarea, { target: { value: '{"test": true}' } });

      expect(onChange).toHaveBeenCalled();
    });

    it("should update url value correctly", async () => {
      const onChange = vi.fn();
      renderForm({
        schema: createSchema({
          website: { type: "url", label: "Website" },
        }),
        data: { website: "" },
        onChange,
      });

      const input = screen.getByTestId("field-input-website");
      fireEvent.change(input, { target: { value: "https://example.com" } });

      expect(onChange).toHaveBeenCalledWith({ website: "https://example.com" });
    });

    it("should update textarea value correctly", async () => {
      const onChange = vi.fn();
      renderForm({
        schema: createSchema({
          description: { type: "textarea", label: "Description" },
        }),
        data: { description: "" },
        onChange,
      });

      const input = screen.getByTestId("field-input-description");
      fireEvent.change(input, { target: { value: "A long description" } });

      expect(onChange).toHaveBeenCalledWith({ description: "A long description" });
    });
  });

  describe("Validation", () => {
    it("should call onValidate on change when validateOnChange is true", async () => {
      const onValidate = vi.fn();
      renderForm({
        schema: createSchema({
          name: { type: "text", label: "Name", validation: { required: true } },
        }),
        data: { name: "" },
        onValidate,
        validateOnChange: true,
      });

      const input = screen.getByTestId("field-input-name");
      fireEvent.change(input, { target: { value: "J" } });

      expect(onValidate).toHaveBeenCalled();
    });

    it("should not call onValidate on change when validateOnChange is false", async () => {
      const onValidate = vi.fn();
      renderForm({
        schema: createSchema({
          name: { type: "text", label: "Name" },
        }),
        data: { name: "" },
        onValidate,
        validateOnChange: false,
      });

      const input = screen.getByTestId("field-input-name");
      fireEvent.change(input, { target: { value: "John" } });

      expect(onValidate).not.toHaveBeenCalled();
    });

    it("should call onValidate on blur when validateOnBlur is true", async () => {
      // Note: This test is skipped because the placeholder field renderers
      // don't call onBlur. This will be fully tested with actual field components
      // in Tasks 4.3-4.7.
      const onValidate = vi.fn();
      const handleBlur = vi.fn();

      // Create a custom component that calls onBlur
      const CustomTextField: React.FC<FieldProps<string>> = ({ name, value, onChange, onBlur }) => (
        <input
          data-testid={`field-input-${name}`}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => onBlur?.()}
        />
      );

      renderForm({
        schema: createSchema({
          name: { type: "text", label: "Name" },
        }),
        data: { name: "" },
        onValidate,
        validateOnBlur: true,
        validateOnChange: false,
        customComponents: {
          text: CustomTextField as React.FC<FieldProps>,
        },
      });

      const input = screen.getByTestId("field-input-name");
      fireEvent.blur(input);

      expect(onValidate).toHaveBeenCalled();
    });

    it("should report validation errors", async () => {
      const onValidate = vi.fn();
      renderForm({
        schema: createSchema({
          name: { type: "text", label: "Name", validation: { required: true } },
        }),
        data: { name: "initial" },
        onValidate,
        validateOnChange: true,
      });

      const input = screen.getByTestId("field-input-name");
      // Clear to empty value to trigger required validation
      fireEvent.change(input, { target: { value: "" } });

      expect(onValidate).toHaveBeenCalled();
      const lastCall = onValidate.mock.calls[onValidate.mock.calls.length - 1][0];
      expect(lastCall.valid).toBe(false);
      expect(lastCall.errors.name).toBeDefined();
    });
  });

  describe("Read-Only Mode", () => {
    it("should apply readOnly class", () => {
      renderForm({ readOnly: true });
      const form = screen.getByTestId("flow-node-form");
      expect(form).toHaveClass(FORM_READONLY_CLASS);
    });

    it("should have aria-readonly attribute", () => {
      renderForm({ readOnly: true });
      const form = screen.getByTestId("flow-node-form");
      expect(form).toHaveAttribute("aria-readonly", "true");
    });

    it("should make text inputs read-only", () => {
      renderForm({
        schema: createSchema({
          name: { type: "text", label: "Name" },
        }),
        readOnly: true,
      });
      const input = screen.getByTestId("field-input-name");
      expect(input).toHaveAttribute("readonly");
    });

    it("should disable checkboxes in read-only mode", () => {
      renderForm({
        schema: createSchema({
          active: { type: "boolean", label: "Active" },
        }),
        readOnly: true,
      });
      const input = screen.getByTestId("field-input-active");
      expect(input).toBeDisabled();
    });
  });

  describe("Disabled Mode", () => {
    it("should apply disabled class", () => {
      renderForm({ disabled: true });
      const form = screen.getByTestId("flow-node-form");
      expect(form).toHaveClass(FORM_DISABLED_CLASS);
    });

    it("should have aria-disabled attribute", () => {
      renderForm({ disabled: true });
      const form = screen.getByTestId("flow-node-form");
      expect(form).toHaveAttribute("aria-disabled", "true");
    });

    it("should disable all inputs", () => {
      renderForm({
        schema: createSchema({
          name: { type: "text", label: "Name" },
          age: { type: "number", label: "Age" },
        }),
        disabled: true,
      });
      expect(screen.getByTestId("field-input-name")).toBeDisabled();
      expect(screen.getByTestId("field-input-age")).toBeDisabled();
    });
  });

  describe("Compact Mode", () => {
    it("should apply compact class", () => {
      renderForm({ compact: true });
      const form = screen.getByTestId("flow-node-form");
      expect(form).toHaveClass(FORM_COMPACT_CLASS);
    });

    it("should hide field descriptions in compact mode", () => {
      renderForm({
        schema: createSchema({
          name: { type: "text", label: "Name", description: "Your name" },
        }),
        compact: true,
      });
      expect(screen.queryByTestId("field-description-name")).not.toBeInTheDocument();
    });
  });

  describe("Custom Components", () => {
    it("should use custom component when provided", () => {
      const CustomTextField: React.FC<FieldProps<string>> = ({ name, value, onChange }) => (
        <input
          data-testid={`custom-field-${name}`}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

      renderForm({
        schema: createSchema({
          name: { type: "text", label: "Name" },
        }),
        customComponents: {
          text: CustomTextField as React.FC<FieldProps>,
        },
      });

      expect(screen.getByTestId("custom-field-name")).toBeInTheDocument();
    });

    it("should fall back to default renderer for non-custom types", () => {
      const CustomTextField: React.FC<FieldProps<string>> = ({ name, value, onChange }) => (
        <input
          data-testid={`custom-field-${name}`}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

      renderForm({
        schema: createSchema({
          name: { type: "text", label: "Name" },
          age: { type: "number", label: "Age" },
        }),
        customComponents: {
          text: CustomTextField as React.FC<FieldProps>,
        },
      });

      expect(screen.getByTestId("custom-field-name")).toBeInTheDocument();
      expect(screen.getByTestId("field-input-age")).toBeInTheDocument();
    });
  });

  describe("Label Position", () => {
    it("should use top label position by default", () => {
      renderForm();
      const wrapper = screen.getByTestId("field-wrapper-name");
      expect(wrapper).toHaveClass("flow-node-form-field--top");
    });

    it("should use left label position when specified", () => {
      renderForm({ labelPosition: "left" });
      const wrapper = screen.getByTestId("field-wrapper-name");
      expect(wrapper).toHaveClass("flow-node-form-field--left");
    });
  });

  describe("Show Labels", () => {
    it("should show labels by default", () => {
      renderForm();
      expect(screen.getByTestId("field-label-name")).toBeInTheDocument();
    });

    it("should hide labels when showLabels is false", () => {
      renderForm({ showLabels: false });
      expect(screen.queryByTestId("field-label-name")).not.toBeInTheDocument();
    });
  });

  describe("Custom Class Name", () => {
    it("should apply custom className", () => {
      renderForm({ className: "my-custom-form" });
      const form = screen.getByTestId("flow-node-form");
      expect(form).toHaveClass("my-custom-form");
    });
  });

  describe("Default Field Renderers", () => {
    it("should have all expected field types in registry", () => {
      expect(defaultFieldRenderers.text).toBeDefined();
      expect(defaultFieldRenderers.number).toBeDefined();
      expect(defaultFieldRenderers.boolean).toBeDefined();
      expect(defaultFieldRenderers.select).toBeDefined();
      expect(defaultFieldRenderers.date).toBeDefined();
      expect(defaultFieldRenderers.color).toBeDefined();
      expect(defaultFieldRenderers.email).toBeDefined();
      expect(defaultFieldRenderers.password).toBeDefined();
      expect(defaultFieldRenderers.textarea).toBeDefined();
      expect(defaultFieldRenderers.url).toBeDefined();
      expect(defaultFieldRenderers.range).toBeDefined();
      expect(defaultFieldRenderers.multiselect).toBeDefined();
      expect(defaultFieldRenderers.time).toBeDefined();
      expect(defaultFieldRenderers.datetime).toBeDefined();
      expect(defaultFieldRenderers.file).toBeDefined();
      expect(defaultFieldRenderers.code).toBeDefined();
      expect(defaultFieldRenderers.json).toBeDefined();
    });
  });

  describe("Real-time Form Updates", () => {
    it("should update multiple fields in real time", async () => {
      const onChange = vi.fn();
      renderForm({
        schema: createSchema({
          name: { type: "text", label: "Name" },
          age: { type: "number", label: "Age" },
          active: { type: "boolean", label: "Active" },
        }),
        data: { name: "", age: 0, active: false },
        onChange,
      });

      // Update name
      const nameInput = screen.getByTestId("field-input-name");
      fireEvent.change(nameInput, { target: { value: "John" } });

      // Update age
      const ageInput = screen.getByTestId("field-input-age");
      fireEvent.change(ageInput, { target: { value: "25" } });

      // Toggle active
      const activeInput = screen.getByTestId("field-input-active");
      fireEvent.click(activeInput);

      // Verify all changes were captured
      expect(onChange).toHaveBeenCalledTimes(3);
    });
  });
});
