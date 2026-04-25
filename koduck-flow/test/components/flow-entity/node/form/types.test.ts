/**
 * @file Form Types Unit Tests
 * @description Tests for form schema type guards and type utilities.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 4.1
 */

import { describe, it, expect } from "vitest";
import {
  isExtendedFormSchema,
  isExtendedFieldSchema,
  type BaseFormSchema,
  type BaseFormFieldSchema,
  type ExtendedFormSchema,
  type ExtendedFormFieldSchema,
  type UIWidgetType,
} from "../../../../../src/components/flow-entity/node/form";

// =============================================================================
// Type Guard Tests
// =============================================================================

describe("Form Type Guards", () => {
  describe("isExtendedFormSchema", () => {
    it("should return true for schema with ui:order", () => {
      const schema: ExtendedFormSchema = {
        type: "object",
        properties: {
          name: { type: "text" },
        },
        "ui:order": ["name"],
      };
      expect(isExtendedFormSchema(schema)).toBe(true);
    });

    it("should return true for schema with ui:options", () => {
      const schema: ExtendedFormSchema = {
        type: "object",
        properties: {
          name: { type: "text" },
        },
        "ui:options": {
          compact: true,
        },
      };
      expect(isExtendedFormSchema(schema)).toBe(true);
    });

    it("should return true for schema with ui:classNames", () => {
      const schema: ExtendedFormSchema = {
        type: "object",
        properties: {
          name: { type: "text" },
        },
        "ui:classNames": "my-form",
      };
      expect(isExtendedFormSchema(schema)).toBe(true);
    });

    it("should return false for base schema without ui properties", () => {
      const schema: BaseFormSchema = {
        type: "object",
        properties: {
          name: { type: "text" },
        },
      };
      expect(isExtendedFormSchema(schema)).toBe(false);
    });

    it("should return true for schema with ui:submitButton", () => {
      const schema: ExtendedFormSchema = {
        type: "object",
        properties: {},
        "ui:submitButton": {
          text: "Save",
        },
      };
      expect(isExtendedFormSchema(schema)).toBe(true);
    });
  });

  describe("isExtendedFieldSchema", () => {
    it("should return true for field with ui:widget", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "text",
        "ui:widget": "textarea",
      };
      expect(isExtendedFieldSchema(schema)).toBe(true);
    });

    it("should return true for field with ui:options", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "number",
        "ui:options": {
          min: 0,
          max: 100,
        },
      };
      expect(isExtendedFieldSchema(schema)).toBe(true);
    });

    it("should return false for base field without ui properties", () => {
      const schema: BaseFormFieldSchema = {
        type: "text",
        label: "Name",
      };
      expect(isExtendedFieldSchema(schema)).toBe(false);
    });

    it("should return true for field with ui:readonly", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "text",
        "ui:readonly": true,
      };
      expect(isExtendedFieldSchema(schema)).toBe(true);
    });

    it("should return true for field with ui:disabled", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "text",
        "ui:disabled": true,
      };
      expect(isExtendedFieldSchema(schema)).toBe(true);
    });
  });
});

// =============================================================================
// Type Inference Tests (compile-time verification)
// =============================================================================

describe("Type Inference", () => {
  it("should correctly type UIWidgetType values", () => {
    const widgets: UIWidgetType[] = [
      "input",
      "textarea",
      "checkbox",
      "switch",
      "select",
      "multiselect",
      "slider",
      "code",
      "json",
      "color",
      "date",
      "custom",
    ];
    expect(widgets).toHaveLength(12);
  });

  it("should allow all valid ExtendedFormFieldSchema properties", () => {
    const schema: ExtendedFormFieldSchema = {
      type: "text",
      label: "Name",
      placeholder: "Enter name",
      description: "Your full name",
      default: "",
      validation: {
        required: true,
        min: 2,
        max: 100,
      },
      "ui:widget": "input",
      "ui:options": {
        autofocus: true,
        maxLength: 100,
      },
      "ui:readonly": false,
      "ui:disabled": false,
      "ui:classNames": "name-field",
      "ui:title": "Full Name",
      "ui:description": "Enter your full name here",
      "ui:help": "Use your legal name",
      "ui:placeholder": "John Doe",
      "ui:order": 1,
      "ui:autofocus": true,
    };
    expect(schema.type).toBe("text");
    expect(schema["ui:widget"]).toBe("input");
    expect(schema["ui:options"]?.autofocus).toBe(true);
  });

  it("should allow all valid ExtendedFormSchema properties", () => {
    const schema: ExtendedFormSchema = {
      type: "object",
      properties: {
        name: { type: "text" },
        age: { type: "number" },
      },
      layout: {
        columns: 2,
        spacing: "normal",
        labelPosition: "top",
      },
      "ui:order": ["name", "age"],
      "ui:classNames": "my-form",
      "ui:submitButton": {
        text: "Save Changes",
        disabled: false,
        hidden: false,
      },
      "ui:options": {
        submitOnChange: false,
        showLabels: true,
        showRequired: true,
        labelPosition: "top",
        compact: false,
      },
    };
    expect(schema.type).toBe("object");
    expect(schema["ui:order"]).toEqual(["name", "age"]);
    expect(schema["ui:options"]?.compact).toBe(false);
  });
});

// =============================================================================
// UI Widget Options Tests
// =============================================================================

describe("UI Widget Options", () => {
  it("should support number widget options", () => {
    const schema: ExtendedFormFieldSchema = {
      type: "number",
      "ui:widget": "slider",
      "ui:options": {
        min: 0,
        max: 100,
        step: 5,
        showTicks: true,
        tickLabels: {
          0: "Min",
          50: "Mid",
          100: "Max",
        },
      },
    };
    expect(schema["ui:options"]?.min).toBe(0);
    expect(schema["ui:options"]?.max).toBe(100);
    expect(schema["ui:options"]?.step).toBe(5);
    expect(schema["ui:options"]?.showTicks).toBe(true);
  });

  it("should support text widget options", () => {
    const schema: ExtendedFormFieldSchema = {
      type: "textarea",
      "ui:widget": "textarea",
      "ui:options": {
        rows: 10,
        cols: 80,
        maxLength: 1000,
      },
    };
    expect(schema["ui:options"]?.rows).toBe(10);
    expect(schema["ui:options"]?.cols).toBe(80);
    expect(schema["ui:options"]?.maxLength).toBe(1000);
  });

  it("should support select widget options", () => {
    const schema: ExtendedFormFieldSchema = {
      type: "select",
      "ui:widget": "combobox",
      options: [
        { value: "a", label: "Option A" },
        { value: "b", label: "Option B" },
      ],
      "ui:options": {
        searchable: true,
        clearable: true,
        emptyText: "Select an option...",
      },
    };
    expect(schema["ui:options"]?.searchable).toBe(true);
    expect(schema["ui:options"]?.clearable).toBe(true);
    expect(schema["ui:options"]?.emptyText).toBe("Select an option...");
  });

  it("should support code editor options", () => {
    const schema: ExtendedFormFieldSchema = {
      type: "code",
      "ui:widget": "code",
      "ui:options": {
        language: "javascript",
        lineNumbers: true,
        wordWrap: true,
        editorHeight: 300,
      },
    };
    expect(schema["ui:options"]?.language).toBe("javascript");
    expect(schema["ui:options"]?.lineNumbers).toBe(true);
    expect(schema["ui:options"]?.editorHeight).toBe(300);
  });

  it("should support file upload options", () => {
    const schema: ExtendedFormFieldSchema = {
      type: "file",
      "ui:widget": "file",
      "ui:options": {
        accept: "image/*",
        multiple: true,
        maxFileSize: 5 * 1024 * 1024,
        showPreview: true,
      },
    };
    expect(schema["ui:options"]?.accept).toBe("image/*");
    expect(schema["ui:options"]?.multiple).toBe(true);
    expect(schema["ui:options"]?.maxFileSize).toBe(5 * 1024 * 1024);
  });

  it("should support layout options", () => {
    const schema: ExtendedFormFieldSchema = {
      type: "text",
      "ui:options": {
        inline: true,
        colSpan: 2,
        order: 1,
      },
    };
    expect(schema["ui:options"]?.inline).toBe(true);
    expect(schema["ui:options"]?.colSpan).toBe(2);
    expect(schema["ui:options"]?.order).toBe(1);
  });

  it("should support custom widget options", () => {
    const schema: ExtendedFormFieldSchema = {
      type: "text",
      "ui:widget": "custom",
      "ui:options": {
        component: "MyCustomInput",
        componentProps: {
          variant: "outlined",
          size: "large",
        },
      },
    };
    expect(schema["ui:options"]?.component).toBe("MyCustomInput");
    expect(schema["ui:options"]?.componentProps?.variant).toBe("outlined");
  });
});
