/**
 * @file Form Utilities Unit Tests
 * @description Tests for form schema utility functions.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 4.1
 */

import { describe, it, expect } from "vitest";
import {
  // Default value utilities
  getDefaultValueForType,
  getDefaultValueForField,
  createDefaultValues,
  mergeWithDefaults,
  // Field value extraction
  extractFieldValue,
  extractNestedValue,
  setNestedValue,
  setNestedValueImmutable,
  // Field ordering and filtering
  getOrderedFieldNames,
  getVisibleFieldNames,
  evaluateVisibilityCondition,
  // Validation utilities
  validateField,
  validateForm,
  // Schema utilities
  getWidgetType,
  isFieldRequired,
  getFieldLabel,
  getFieldPlaceholder,
  getFieldDescription,
  isFieldReadOnly,
  isFieldDisabled,
  type ExtendedFormSchema,
  type ExtendedFormFieldSchema,
} from "../../../../../src/components/flow-entity/node/form";

// =============================================================================
// Default Value Utilities Tests
// =============================================================================

describe("Default Value Utilities", () => {
  describe("getDefaultValueForType", () => {
    it("should return empty string for text types", () => {
      expect(getDefaultValueForType("text")).toBe("");
      expect(getDefaultValueForType("textarea")).toBe("");
      expect(getDefaultValueForType("password")).toBe("");
      expect(getDefaultValueForType("url")).toBe("");
      expect(getDefaultValueForType("email")).toBe("");
      expect(getDefaultValueForType("code")).toBe("");
      expect(getDefaultValueForType("json")).toBe("");
    });

    it("should return 0 for number types", () => {
      expect(getDefaultValueForType("number")).toBe(0);
      expect(getDefaultValueForType("range")).toBe(0);
    });

    it("should return false for boolean type", () => {
      expect(getDefaultValueForType("boolean")).toBe(false);
    });

    it("should return null for select type", () => {
      expect(getDefaultValueForType("select")).toBe(null);
    });

    it("should return empty array for multiselect type", () => {
      expect(getDefaultValueForType("multiselect")).toEqual([]);
    });

    it("should return null for date/time types", () => {
      expect(getDefaultValueForType("date")).toBe(null);
      expect(getDefaultValueForType("time")).toBe(null);
      expect(getDefaultValueForType("datetime")).toBe(null);
    });

    it("should return #000000 for color type", () => {
      expect(getDefaultValueForType("color")).toBe("#000000");
    });

    it("should return null for file type", () => {
      expect(getDefaultValueForType("file")).toBe(null);
    });
  });

  describe("getDefaultValueForField", () => {
    it("should use explicit default value when provided", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "text",
        default: "Hello World",
      };
      expect(getDefaultValueForField(schema)).toBe("Hello World");
    });

    it("should use type default when no explicit default", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "number",
      };
      expect(getDefaultValueForField(schema)).toBe(0);
    });

    it("should use first option for required select", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "select",
        options: [
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ],
        validation: { required: true },
      };
      expect(getDefaultValueForField(schema)).toBe("a");
    });

    it("should return null for non-required select without default", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "select",
        options: [
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ],
      };
      expect(getDefaultValueForField(schema)).toBe(null);
    });

    it("should handle empty options array for select", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "select",
        options: [],
        validation: { required: true },
      };
      expect(getDefaultValueForField(schema)).toBe(null);
    });
  });

  describe("createDefaultValues", () => {
    it("should create default values for all fields", () => {
      const schema: ExtendedFormSchema = {
        type: "object",
        properties: {
          name: { type: "text", default: "John" },
          age: { type: "number" },
          active: { type: "boolean", default: true },
        },
      };
      expect(createDefaultValues(schema)).toEqual({
        name: "John",
        age: 0,
        active: true,
      });
    });

    it("should handle empty properties", () => {
      const schema: ExtendedFormSchema = {
        type: "object",
        properties: {},
      };
      expect(createDefaultValues(schema)).toEqual({});
    });

    it("should handle schema without properties", () => {
      const schema = { type: "object" } as ExtendedFormSchema;
      expect(createDefaultValues(schema)).toEqual({});
    });
  });

  describe("mergeWithDefaults", () => {
    it("should merge provided data with defaults", () => {
      const schema: ExtendedFormSchema = {
        type: "object",
        properties: {
          name: { type: "text", default: "John" },
          age: { type: "number", default: 18 },
        },
      };
      const result = mergeWithDefaults(schema, { name: "Jane" });
      expect(result).toEqual({ name: "Jane", age: 18 });
    });

    it("should use defaults when no data provided", () => {
      const schema: ExtendedFormSchema = {
        type: "object",
        properties: {
          name: { type: "text", default: "John" },
        },
      };
      expect(mergeWithDefaults(schema)).toEqual({ name: "John" });
    });

    it("should override defaults with provided data", () => {
      const schema: ExtendedFormSchema = {
        type: "object",
        properties: {
          name: { type: "text", default: "John" },
          age: { type: "number", default: 18 },
        },
      };
      const result = mergeWithDefaults(schema, { name: "Jane", age: 25 });
      expect(result).toEqual({ name: "Jane", age: 25 });
    });
  });
});

// =============================================================================
// Field Value Extraction Tests
// =============================================================================

describe("Field Value Extraction", () => {
  describe("extractFieldValue", () => {
    it("should extract existing field value", () => {
      const data = { name: "John", age: 30 };
      expect(extractFieldValue(data, "name")).toBe("John");
      expect(extractFieldValue(data, "age")).toBe(30);
    });

    it("should return undefined for non-existent field", () => {
      const data = { name: "John" };
      expect(extractFieldValue(data, "email")).toBe(undefined);
    });

    it("should handle null values", () => {
      const data = { name: null };
      expect(extractFieldValue(data, "name")).toBe(null);
    });
  });

  describe("extractNestedValue", () => {
    it("should extract nested value with dot notation", () => {
      const data = { user: { address: { city: "NYC" } } };
      expect(extractNestedValue(data, "user.address.city")).toBe("NYC");
    });

    it("should return undefined for non-existent path", () => {
      const data = { user: { name: "John" } };
      expect(extractNestedValue(data, "user.address.city")).toBe(undefined);
    });

    it("should handle single-level path", () => {
      const data = { name: "John" };
      expect(extractNestedValue(data, "name")).toBe("John");
    });

    it("should handle null in path", () => {
      const data = { user: null };
      expect(extractNestedValue(data, "user.name")).toBe(undefined);
    });

    it("should handle non-object in path", () => {
      const data = { user: "John" };
      expect(extractNestedValue(data, "user.name")).toBe(undefined);
    });
  });

  describe("setNestedValue", () => {
    it("should set nested value with dot notation", () => {
      const data: Record<string, unknown> = { user: { name: "John" } };
      setNestedValue(data, "user.address.city", "NYC");
      expect(data).toEqual({
        user: { name: "John", address: { city: "NYC" } },
      });
    });

    it("should set single-level value", () => {
      const data: Record<string, unknown> = {};
      setNestedValue(data, "name", "John");
      expect(data).toEqual({ name: "John" });
    });

    it("should create intermediate objects", () => {
      const data: Record<string, unknown> = {};
      setNestedValue(data, "a.b.c", "value");
      expect(data).toEqual({ a: { b: { c: "value" } } });
    });

    it("should override non-object values in path", () => {
      const data: Record<string, unknown> = { user: "John" };
      setNestedValue(data, "user.name", "Jane");
      expect(data).toEqual({ user: { name: "Jane" } });
    });
  });

  describe("setNestedValueImmutable", () => {
    it("should return new object with updated value", () => {
      const original = { user: { name: "John" } };
      const result = setNestedValueImmutable(original, "user.name", "Jane");
      expect(result).toEqual({ user: { name: "Jane" } });
      expect(original).toEqual({ user: { name: "John" } }); // Original unchanged
    });

    it("should handle single-level path", () => {
      const original = { name: "John" };
      const result = setNestedValueImmutable(original, "name", "Jane");
      expect(result).toEqual({ name: "Jane" });
      expect(original).toEqual({ name: "John" });
    });

    it("should create new nested objects", () => {
      const original = { user: { name: "John" } };
      const result = setNestedValueImmutable(original, "user.address.city", "NYC");
      expect(result).toEqual({
        user: { name: "John", address: { city: "NYC" } },
      });
    });
  });
});

// =============================================================================
// Field Ordering and Filtering Tests
// =============================================================================

describe("Field Ordering and Filtering", () => {
  describe("getOrderedFieldNames", () => {
    it("should return fields in ui:order when specified", () => {
      const schema: ExtendedFormSchema = {
        type: "object",
        properties: {
          name: { type: "text" },
          email: { type: "email" },
          age: { type: "number" },
        },
        "ui:order": ["age", "name", "email"],
      };
      expect(getOrderedFieldNames(schema)).toEqual(["age", "name", "email"]);
    });

    it("should append unordered fields at the end", () => {
      const schema: ExtendedFormSchema = {
        type: "object",
        properties: {
          name: { type: "text" },
          email: { type: "email" },
          age: { type: "number" },
        },
        "ui:order": ["age"],
      };
      const result = getOrderedFieldNames(schema);
      expect(result[0]).toBe("age");
      expect(result).toContain("name");
      expect(result).toContain("email");
    });

    it("should use ui:order from individual fields", () => {
      const schema: ExtendedFormSchema = {
        type: "object",
        properties: {
          name: { type: "text", "ui:order": 2 },
          email: { type: "email", "ui:order": 1 },
          age: { type: "number", "ui:order": 3 },
        },
      };
      expect(getOrderedFieldNames(schema)).toEqual(["email", "name", "age"]);
    });

    it("should handle empty properties", () => {
      const schema: ExtendedFormSchema = {
        type: "object",
        properties: {},
      };
      expect(getOrderedFieldNames(schema)).toEqual([]);
    });
  });

  describe("getVisibleFieldNames", () => {
    it("should filter out hidden fields", () => {
      const schema: ExtendedFormSchema = {
        type: "object",
        properties: {
          name: { type: "text" },
          email: { type: "email", hidden: true },
          age: { type: "number" },
        },
      };
      const result = getVisibleFieldNames(schema, {});
      expect(result).toContain("name");
      expect(result).toContain("age");
      expect(result).not.toContain("email");
    });

    it("should evaluate visibleWhen conditions", () => {
      const schema: ExtendedFormSchema = {
        type: "object",
        properties: {
          showAge: { type: "boolean" },
          age: { type: "number", visibleWhen: "showAge" },
        },
      };
      expect(getVisibleFieldNames(schema, { showAge: true })).toContain("age");
      expect(getVisibleFieldNames(schema, { showAge: false })).not.toContain("age");
    });
  });

  describe("evaluateVisibilityCondition", () => {
    it("should evaluate simple field reference", () => {
      expect(evaluateVisibilityCondition("active", { active: true })).toBe(true);
      expect(evaluateVisibilityCondition("active", { active: false })).toBe(false);
      expect(evaluateVisibilityCondition("active", {})).toBe(false);
    });

    it("should evaluate equality condition with string", () => {
      expect(evaluateVisibilityCondition("type === 'admin'", { type: "admin" })).toBe(true);
      expect(evaluateVisibilityCondition("type === 'admin'", { type: "user" })).toBe(false);
    });

    it("should evaluate equality condition with number", () => {
      expect(evaluateVisibilityCondition("age === 18", { age: 18 })).toBe(true);
      expect(evaluateVisibilityCondition("age === 18", { age: 20 })).toBe(false);
    });

    it("should evaluate equality condition with boolean", () => {
      expect(evaluateVisibilityCondition("active === true", { active: true })).toBe(true);
      expect(evaluateVisibilityCondition("active === false", { active: false })).toBe(true);
    });

    it("should evaluate inequality condition", () => {
      expect(evaluateVisibilityCondition("type !== 'admin'", { type: "user" })).toBe(true);
      expect(evaluateVisibilityCondition("type !== 'admin'", { type: "admin" })).toBe(false);
    });

    it("should evaluate negation", () => {
      expect(evaluateVisibilityCondition("!disabled", { disabled: false })).toBe(true);
      expect(evaluateVisibilityCondition("!disabled", { disabled: true })).toBe(false);
    });

    it("should return true for unparseable condition", () => {
      expect(evaluateVisibilityCondition("complex && condition", {})).toBe(true);
    });
  });
});

// =============================================================================
// Validation Tests
// =============================================================================

describe("Validation Utilities", () => {
  describe("validateField", () => {
    it("should pass validation for field without rules", () => {
      const schema: ExtendedFormFieldSchema = { type: "text" };
      expect(validateField(schema, "anything")).toEqual({ valid: true });
    });

    it("should fail required validation for empty value", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "text",
        validation: { required: true },
      };
      expect(validateField(schema, "").valid).toBe(false);
      expect(validateField(schema, null).valid).toBe(false);
      expect(validateField(schema, undefined).valid).toBe(false);
    });

    it("should pass required validation for non-empty value", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "text",
        validation: { required: true },
      };
      expect(validateField(schema, "hello")).toEqual({ valid: true });
    });

    it("should fail required validation for empty array", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "multiselect",
        validation: { required: true },
      };
      expect(validateField(schema, []).valid).toBe(false);
    });

    it("should validate number min", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "number",
        validation: { min: 10 },
      };
      expect(validateField(schema, 5).valid).toBe(false);
      expect(validateField(schema, 10).valid).toBe(true);
      expect(validateField(schema, 15).valid).toBe(true);
    });

    it("should validate number max", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "number",
        validation: { max: 100 },
      };
      expect(validateField(schema, 50).valid).toBe(true);
      expect(validateField(schema, 100).valid).toBe(true);
      expect(validateField(schema, 150).valid).toBe(false);
    });

    it("should validate string min length", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "text",
        validation: { min: 3 },
      };
      expect(validateField(schema, "ab").valid).toBe(false);
      expect(validateField(schema, "abc").valid).toBe(true);
    });

    it("should validate string max length", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "text",
        validation: { max: 5 },
      };
      expect(validateField(schema, "hello").valid).toBe(true);
      expect(validateField(schema, "hello!").valid).toBe(false);
    });

    it("should validate pattern", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "text",
        validation: { pattern: "^[A-Z]+$" },
      };
      expect(validateField(schema, "ABC").valid).toBe(true);
      expect(validateField(schema, "abc").valid).toBe(false);
    });

    it("should use custom error message", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "text",
        validation: { required: true, message: "Name is required" },
      };
      const result = validateField(schema, "");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Name is required");
    });

    it("should skip non-required validations for empty value", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "text",
        validation: { min: 5 },
      };
      expect(validateField(schema, "").valid).toBe(true);
    });
  });

  describe("validateForm", () => {
    it("should validate all fields", () => {
      const schema: ExtendedFormSchema = {
        type: "object",
        properties: {
          name: { type: "text", validation: { required: true } },
          age: { type: "number", validation: { min: 18 } },
        },
      };
      const result = validateForm(schema, { name: "", age: 15 });
      expect(result.valid).toBe(false);
      expect(result.errors.name).toBeDefined();
      expect(result.errors.age).toBeDefined();
    });

    it("should return valid for correct data", () => {
      const schema: ExtendedFormSchema = {
        type: "object",
        properties: {
          name: { type: "text", validation: { required: true } },
          age: { type: "number", validation: { min: 18 } },
        },
      };
      const result = validateForm(schema, { name: "John", age: 25 });
      expect(result.valid).toBe(true);
      expect(Object.keys(result.errors)).toHaveLength(0);
    });

    it("should handle empty schema", () => {
      const schema: ExtendedFormSchema = {
        type: "object",
        properties: {},
      };
      const result = validateForm(schema, {});
      expect(result.valid).toBe(true);
    });
  });
});

// =============================================================================
// Schema Utilities Tests
// =============================================================================

describe("Schema Utilities", () => {
  describe("getWidgetType", () => {
    it("should return ui:widget when specified", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "text",
        "ui:widget": "textarea",
      };
      expect(getWidgetType(schema)).toBe("textarea");
    });

    it("should infer widget from field type", () => {
      expect(getWidgetType({ type: "text" })).toBe("input");
      expect(getWidgetType({ type: "password" })).toBe("input");
      expect(getWidgetType({ type: "email" })).toBe("input");
      expect(getWidgetType({ type: "url" })).toBe("input");
      expect(getWidgetType({ type: "textarea" })).toBe("textarea");
      expect(getWidgetType({ type: "number" })).toBe("number");
      expect(getWidgetType({ type: "range" })).toBe("number");
      expect(getWidgetType({ type: "boolean" })).toBe("checkbox");
      expect(getWidgetType({ type: "select" })).toBe("select");
      expect(getWidgetType({ type: "multiselect" })).toBe("multiselect");
      expect(getWidgetType({ type: "date" })).toBe("date");
      expect(getWidgetType({ type: "time" })).toBe("time");
      expect(getWidgetType({ type: "datetime" })).toBe("datetime");
      expect(getWidgetType({ type: "color" })).toBe("color");
      expect(getWidgetType({ type: "file" })).toBe("file");
      expect(getWidgetType({ type: "code" })).toBe("code");
      expect(getWidgetType({ type: "json" })).toBe("json");
    });
  });

  describe("isFieldRequired", () => {
    it("should return true for required field", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "text",
        validation: { required: true },
      };
      expect(isFieldRequired(schema)).toBe(true);
    });

    it("should return false for non-required field", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "text",
        validation: { required: false },
      };
      expect(isFieldRequired(schema)).toBe(false);
    });

    it("should return false when no validation", () => {
      const schema: ExtendedFormFieldSchema = { type: "text" };
      expect(isFieldRequired(schema)).toBe(false);
    });
  });

  describe("getFieldLabel", () => {
    it("should return ui:title when specified", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "text",
        label: "Name",
        "ui:title": "Full Name",
      };
      expect(getFieldLabel(schema, "name")).toBe("Full Name");
    });

    it("should return label when ui:title not specified", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "text",
        label: "Name",
      };
      expect(getFieldLabel(schema, "fieldName")).toBe("Name");
    });

    it("should convert camelCase name to title case", () => {
      const schema: ExtendedFormFieldSchema = { type: "text" };
      expect(getFieldLabel(schema, "firstName")).toBe("First Name");
    });

    it("should convert snake_case name to title case", () => {
      const schema: ExtendedFormFieldSchema = { type: "text" };
      expect(getFieldLabel(schema, "first_name")).toBe("First Name");
    });
  });

  describe("getFieldPlaceholder", () => {
    it("should return ui:placeholder when specified", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "text",
        placeholder: "Enter name",
        "ui:placeholder": "Enter your full name",
      };
      expect(getFieldPlaceholder(schema)).toBe("Enter your full name");
    });

    it("should return placeholder when ui:placeholder not specified", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "text",
        placeholder: "Enter name",
      };
      expect(getFieldPlaceholder(schema)).toBe("Enter name");
    });
  });

  describe("getFieldDescription", () => {
    it("should return ui:description when specified", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "text",
        description: "Your name",
        "ui:description": "Enter your full legal name",
      };
      expect(getFieldDescription(schema)).toBe("Enter your full legal name");
    });

    it("should return description when ui:description not specified", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "text",
        description: "Your name",
      };
      expect(getFieldDescription(schema)).toBe("Your name");
    });
  });

  describe("isFieldReadOnly", () => {
    it("should return ui:readonly when specified", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "text",
        "ui:readonly": true,
      };
      expect(isFieldReadOnly(schema)).toBe(true);
      expect(isFieldReadOnly(schema, false)).toBe(true); // Field-level overrides form
    });

    it("should return form-level readOnly when not specified on field", () => {
      const schema: ExtendedFormFieldSchema = { type: "text" };
      expect(isFieldReadOnly(schema, true)).toBe(true);
      expect(isFieldReadOnly(schema, false)).toBe(false);
    });

    it("should return false when neither specified", () => {
      const schema: ExtendedFormFieldSchema = { type: "text" };
      expect(isFieldReadOnly(schema)).toBe(false);
    });
  });

  describe("isFieldDisabled", () => {
    it("should return ui:disabled when specified", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "text",
        "ui:disabled": true,
      };
      expect(isFieldDisabled(schema)).toBe(true);
    });

    it("should return schema.disabled when ui:disabled not specified", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "text",
        disabled: true,
      };
      expect(isFieldDisabled(schema)).toBe(true);
    });

    it("should return form-level disabled when not specified on field", () => {
      const schema: ExtendedFormFieldSchema = { type: "text" };
      expect(isFieldDisabled(schema, true)).toBe(true);
      expect(isFieldDisabled(schema, false)).toBe(false);
    });

    it("should return false when neither specified", () => {
      const schema: ExtendedFormFieldSchema = { type: "text" };
      expect(isFieldDisabled(schema)).toBe(false);
    });
  });
});
