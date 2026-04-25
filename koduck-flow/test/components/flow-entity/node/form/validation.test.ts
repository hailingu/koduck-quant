/**
 * @file Form Validation Unit Tests
 * @description Tests for schema-driven form validation functions.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 4.8
 */

import { describe, it, expect } from "vitest";
import {
  // Core validation functions
  validate,
  validateFieldValue,
  validateSingleField,
  // Utility functions
  isEmpty,
  formatMessage,
  getFieldPath,
  isValid,
  getFieldError,
  createValidator,
  toFormValidationResult,
  // Constants
  DEFAULT_ERROR_MESSAGES,
  // Types
  type ExtendedFormSchema,
  type ExtendedFormFieldSchema,
} from "../../../../../src/components/flow-entity/node/form";

// =============================================================================
// Helper Functions Tests
// =============================================================================

describe("Validation Helper Functions", () => {
  describe("isEmpty", () => {
    it("should return true for null", () => {
      expect(isEmpty(null)).toBe(true);
    });

    it("should return true for undefined", () => {
      expect(isEmpty(undefined)).toBe(true);
    });

    it("should return true for empty string", () => {
      expect(isEmpty("")).toBe(true);
    });

    it("should return true for whitespace-only string", () => {
      expect(isEmpty("   ")).toBe(true);
    });

    it("should return true for empty array", () => {
      expect(isEmpty([])).toBe(true);
    });

    it("should return false for non-empty string", () => {
      expect(isEmpty("hello")).toBe(false);
    });

    it("should return false for number 0", () => {
      expect(isEmpty(0)).toBe(false);
    });

    it("should return false for false", () => {
      expect(isEmpty(false)).toBe(false);
    });

    it("should return false for non-empty array", () => {
      expect(isEmpty(["item"])).toBe(false);
    });

    it("should return false for object", () => {
      expect(isEmpty({})).toBe(false);
    });
  });

  describe("formatMessage", () => {
    it("should replace single placeholder", () => {
      expect(formatMessage("Value must be at least {min}", { min: 5 })).toBe(
        "Value must be at least 5"
      );
    });

    it("should replace multiple placeholders", () => {
      expect(
        formatMessage("Value {value} must be between {min} and {max}", {
          value: 10,
          min: 0,
          max: 100,
        })
      ).toBe("Value 10 must be between 0 and 100");
    });

    it("should keep placeholder if value not provided", () => {
      expect(formatMessage("Value must be {missing}", {})).toBe("Value must be {missing}");
    });

    it("should handle no placeholders", () => {
      expect(formatMessage("Static message", {})).toBe("Static message");
    });
  });

  describe("getFieldPath", () => {
    it("should return field name when no prefix", () => {
      expect(getFieldPath("name")).toBe("name");
    });

    it("should prepend prefix with dot", () => {
      expect(getFieldPath("email", "user")).toBe("user.email");
    });

    it("should handle nested prefix", () => {
      expect(getFieldPath("city", "user.address")).toBe("user.address.city");
    });
  });
});

// =============================================================================
// Field Validation Tests
// =============================================================================

describe("validateFieldValue", () => {
  describe("Required Validation", () => {
    const requiredSchema: ExtendedFormFieldSchema = {
      type: "text",
      validation: { required: true },
    };

    it("should fail for null value", () => {
      const errors = validateFieldValue(requiredSchema, null, "name");
      expect(errors).toHaveLength(1);
      expect(errors[0].rule).toBe("required");
      expect(errors[0].field).toBe("name");
    });

    it("should fail for undefined value", () => {
      const errors = validateFieldValue(requiredSchema, undefined, "name");
      expect(errors).toHaveLength(1);
      expect(errors[0].rule).toBe("required");
    });

    it("should fail for empty string", () => {
      const errors = validateFieldValue(requiredSchema, "", "name");
      expect(errors).toHaveLength(1);
      expect(errors[0].rule).toBe("required");
    });

    it("should fail for empty array", () => {
      const errors = validateFieldValue(requiredSchema, [], "tags");
      expect(errors).toHaveLength(1);
      expect(errors[0].rule).toBe("required");
    });

    it("should pass for non-empty string", () => {
      const errors = validateFieldValue(requiredSchema, "John", "name");
      expect(errors).toHaveLength(0);
    });

    it("should pass for number 0", () => {
      const errors = validateFieldValue(requiredSchema, 0, "count");
      expect(errors).toHaveLength(0);
    });

    it("should pass for false", () => {
      const errors = validateFieldValue(requiredSchema, false, "active");
      expect(errors).toHaveLength(0);
    });

    it("should use custom error message", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "text",
        validation: { required: true, message: "Name is required" },
      };
      const errors = validateFieldValue(schema, "", "name");
      expect(errors[0].message).toBe("Name is required");
    });
  });

  describe("Minimum Validation (Numbers)", () => {
    const minSchema: ExtendedFormFieldSchema = {
      type: "number",
      validation: { min: 10 },
    };

    it("should fail when value is below minimum", () => {
      const errors = validateFieldValue(minSchema, 5, "age");
      expect(errors).toHaveLength(1);
      expect(errors[0].rule).toBe("min");
      expect(errors[0].expected).toBe(10);
    });

    it("should pass when value equals minimum", () => {
      const errors = validateFieldValue(minSchema, 10, "age");
      expect(errors).toHaveLength(0);
    });

    it("should pass when value is above minimum", () => {
      const errors = validateFieldValue(minSchema, 15, "age");
      expect(errors).toHaveLength(0);
    });

    it("should skip validation for empty value (not required)", () => {
      const errors = validateFieldValue(minSchema, null, "age");
      expect(errors).toHaveLength(0);
    });
  });

  describe("Maximum Validation (Numbers)", () => {
    const maxSchema: ExtendedFormFieldSchema = {
      type: "number",
      validation: { max: 100 },
    };

    it("should fail when value is above maximum", () => {
      const errors = validateFieldValue(maxSchema, 150, "score");
      expect(errors).toHaveLength(1);
      expect(errors[0].rule).toBe("max");
      expect(errors[0].expected).toBe(100);
    });

    it("should pass when value equals maximum", () => {
      const errors = validateFieldValue(maxSchema, 100, "score");
      expect(errors).toHaveLength(0);
    });

    it("should pass when value is below maximum", () => {
      const errors = validateFieldValue(maxSchema, 50, "score");
      expect(errors).toHaveLength(0);
    });
  });

  describe("Min/Max Range Validation (Numbers)", () => {
    const rangeSchema: ExtendedFormFieldSchema = {
      type: "number",
      validation: { min: 0, max: 100 },
    };

    it("should fail when value is below range", () => {
      const errors = validateFieldValue(rangeSchema, -5, "percentage");
      expect(errors).toHaveLength(1);
      expect(errors[0].rule).toBe("min");
    });

    it("should fail when value is above range", () => {
      const errors = validateFieldValue(rangeSchema, 105, "percentage");
      expect(errors).toHaveLength(1);
      expect(errors[0].rule).toBe("max");
    });

    it("should pass when value is within range", () => {
      const errors = validateFieldValue(rangeSchema, 50, "percentage");
      expect(errors).toHaveLength(0);
    });
  });

  describe("Minimum Length Validation (Strings)", () => {
    const minLengthSchema: ExtendedFormFieldSchema = {
      type: "text",
      validation: { min: 3 },
    };

    it("should fail when string is too short", () => {
      const errors = validateFieldValue(minLengthSchema, "ab", "username");
      expect(errors).toHaveLength(1);
      expect(errors[0].rule).toBe("minLength");
    });

    it("should pass when string meets minimum length", () => {
      const errors = validateFieldValue(minLengthSchema, "abc", "username");
      expect(errors).toHaveLength(0);
    });

    it("should pass when string exceeds minimum length", () => {
      const errors = validateFieldValue(minLengthSchema, "abcdef", "username");
      expect(errors).toHaveLength(0);
    });
  });

  describe("Maximum Length Validation (Strings)", () => {
    const maxLengthSchema: ExtendedFormFieldSchema = {
      type: "text",
      validation: { max: 10 },
    };

    it("should fail when string is too long", () => {
      const errors = validateFieldValue(maxLengthSchema, "this is too long", "title");
      expect(errors).toHaveLength(1);
      expect(errors[0].rule).toBe("maxLength");
    });

    it("should pass when string meets maximum length", () => {
      const errors = validateFieldValue(maxLengthSchema, "1234567890", "title");
      expect(errors).toHaveLength(0);
    });

    it("should pass when string is under maximum length", () => {
      const errors = validateFieldValue(maxLengthSchema, "short", "title");
      expect(errors).toHaveLength(0);
    });
  });

  describe("Pattern Validation", () => {
    const emailSchema: ExtendedFormFieldSchema = {
      type: "email",
      validation: { pattern: "^[^@]+@[^@]+\\.[^@]+$" },
    };

    it("should fail when pattern does not match", () => {
      const errors = validateFieldValue(emailSchema, "invalid-email", "email");
      expect(errors).toHaveLength(1);
      expect(errors[0].rule).toBe("pattern");
    });

    it("should pass when pattern matches", () => {
      const errors = validateFieldValue(emailSchema, "user@example.com", "email");
      expect(errors).toHaveLength(0);
    });

    it("should skip validation for empty value", () => {
      const errors = validateFieldValue(emailSchema, "", "email");
      expect(errors).toHaveLength(0);
    });

    it("should use custom error message", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "email",
        validation: {
          pattern: "^[^@]+@[^@]+$",
          message: "Please enter a valid email",
        },
      };
      const errors = validateFieldValue(schema, "invalid", "email");
      expect(errors[0].message).toBe("Please enter a valid email");
    });
  });

  describe("Enum Validation (via options)", () => {
    const selectSchema: ExtendedFormFieldSchema = {
      type: "select",
      options: [
        { value: "red", label: "Red" },
        { value: "green", label: "Green" },
        { value: "blue", label: "Blue" },
      ],
    };

    it("should fail when value is not in options", () => {
      const errors = validateFieldValue(selectSchema, "yellow", "color");
      expect(errors).toHaveLength(1);
      expect(errors[0].rule).toBe("enum");
    });

    it("should pass when value is in options", () => {
      const errors = validateFieldValue(selectSchema, "red", "color");
      expect(errors).toHaveLength(0);
    });

    it("should validate array values for multiselect", () => {
      const multiSchema: ExtendedFormFieldSchema = {
        type: "multiselect",
        options: [
          { value: "a", label: "A" },
          { value: "b", label: "B" },
          { value: "c", label: "C" },
        ],
      };
      const errors = validateFieldValue(multiSchema, ["a", "d"], "items");
      expect(errors).toHaveLength(1);
      expect(errors[0].rule).toBe("enum");
    });

    it("should pass for valid multiselect values", () => {
      const multiSchema: ExtendedFormFieldSchema = {
        type: "multiselect",
        options: [
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ],
      };
      const errors = validateFieldValue(multiSchema, ["a", "b"], "items");
      expect(errors).toHaveLength(0);
    });
  });

  describe("Combined Validations", () => {
    it("should collect multiple errors", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "text",
        validation: { required: true, min: 5 },
      };
      // Empty string fails both required and minLength
      const errors = validateFieldValue(schema, "", "name");
      // Should only have required error since empty values skip other validations
      expect(errors).toHaveLength(1);
      expect(errors[0].rule).toBe("required");
    });

    it("should validate all rules when value is present", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "text",
        validation: { min: 5, max: 10, pattern: "^[a-z]+$" },
      };
      // "AB" is too short and doesn't match pattern
      const errors = validateFieldValue(schema, "AB", "name");
      expect(errors.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("AbortEarly Option", () => {
    it("should stop at first error when abortEarly is true", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "number",
        validation: { min: 0, max: 100 },
      };
      const errors = validateFieldValue(schema, -5, "value", {
        abortEarly: true,
      });
      expect(errors).toHaveLength(1);
    });
  });

  describe("Path Prefix Option", () => {
    it("should include path prefix in error path", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "text",
        validation: { required: true },
      };
      const errors = validateFieldValue(schema, "", "email", {
        pathPrefix: "user",
      });
      expect(errors[0].path).toBe("user.email");
      expect(errors[0].field).toBe("email");
    });
  });
});

// =============================================================================
// Form Validation Tests
// =============================================================================

describe("validate", () => {
  const schema: ExtendedFormSchema = {
    type: "object",
    properties: {
      name: {
        type: "text",
        label: "Name",
        validation: { required: true, min: 2 },
      },
      email: {
        type: "email",
        label: "Email",
        validation: { required: true, pattern: "^[^@]+@[^@]+\\.[^@]+$" },
      },
      age: {
        type: "number",
        label: "Age",
        validation: { min: 0, max: 150 },
      },
      role: {
        type: "select",
        label: "Role",
        options: [
          { value: "user", label: "User" },
          { value: "admin", label: "Admin" },
        ],
      },
    },
  };

  describe("Valid Form Data", () => {
    it("should return valid for correct data", () => {
      const data = {
        name: "John Doe",
        email: "john@example.com",
        age: 30,
        role: "user",
      };
      const result = validate(schema, data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should return valid when optional fields are empty", () => {
      const data = {
        name: "John Doe",
        email: "john@example.com",
        age: null,
        role: null,
      };
      const result = validate(schema, data);
      expect(result.valid).toBe(true);
    });
  });

  describe("Invalid Form Data", () => {
    it("should return errors for missing required fields", () => {
      const data = {
        name: "",
        email: "",
        age: 30,
      };
      const result = validate(schema, data);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
      expect(result.firstErrorByField.name).toBeDefined();
      expect(result.firstErrorByField.email).toBeDefined();
    });

    it("should return error for invalid pattern", () => {
      const data = {
        name: "John",
        email: "invalid-email",
        age: 30,
      };
      const result = validate(schema, data);
      expect(result.valid).toBe(false);
      expect(result.firstErrorByField.email).toBeDefined();
    });

    it("should return error for out-of-range number", () => {
      const data = {
        name: "John",
        email: "john@example.com",
        age: -5,
      };
      const result = validate(schema, data);
      expect(result.valid).toBe(false);
      expect(result.firstErrorByField.age).toBeDefined();
    });

    it("should return error for invalid enum value", () => {
      const data = {
        name: "John",
        email: "john@example.com",
        age: 30,
        role: "superuser",
      };
      const result = validate(schema, data);
      expect(result.valid).toBe(false);
      expect(result.firstErrorByField.role).toBeDefined();
    });
  });

  describe("Errors Structure", () => {
    it("should group errors by field", () => {
      const data = {
        name: "",
        email: "invalid",
      };
      const result = validate(schema, data);
      expect(result.errorsByField.name).toBeDefined();
      expect(result.errorsByField.email).toBeDefined();
      expect(Array.isArray(result.errorsByField.name)).toBe(true);
    });

    it("should provide first error for each field", () => {
      const data = {
        name: "",
        email: "invalid",
      };
      const result = validate(schema, data);
      expect(typeof result.firstErrorByField.name).toBe("string");
      expect(typeof result.firstErrorByField.email).toBe("string");
    });
  });

  describe("Hidden Fields", () => {
    it("should skip validation for hidden fields", () => {
      const schemaWithHidden: ExtendedFormSchema = {
        type: "object",
        properties: {
          visible: {
            type: "text",
            validation: { required: true },
          },
          hidden: {
            type: "text",
            hidden: true,
            validation: { required: true },
          },
        },
      };
      const data = { visible: "value", hidden: "" };
      const result = validate(schemaWithHidden, data);
      expect(result.valid).toBe(true);
    });
  });

  describe("Conditional Fields (visibleWhen)", () => {
    it("should skip validation when condition is not met", () => {
      const schemaWithCondition: ExtendedFormSchema = {
        type: "object",
        properties: {
          hasEmail: { type: "boolean" },
          email: {
            type: "email",
            visibleWhen: "hasEmail === true",
            validation: { required: true },
          },
        },
      };
      const data = { hasEmail: false, email: "" };
      const result = validate(schemaWithCondition, data);
      expect(result.valid).toBe(true);
    });

    it("should validate when condition is met", () => {
      const schemaWithCondition: ExtendedFormSchema = {
        type: "object",
        properties: {
          hasEmail: { type: "boolean" },
          email: {
            type: "email",
            visibleWhen: "hasEmail === true",
            validation: { required: true },
          },
        },
      };
      const data = { hasEmail: true, email: "" };
      const result = validate(schemaWithCondition, data);
      expect(result.valid).toBe(false);
      expect(result.firstErrorByField.email).toBeDefined();
    });
  });

  describe("AbortEarly Option", () => {
    it("should stop at first field with error", () => {
      const data = {
        name: "",
        email: "",
        age: -5,
      };
      const result = validate(schema, data, { abortEarly: true });
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });
});

// =============================================================================
// Convenience Functions Tests
// =============================================================================

describe("Convenience Functions", () => {
  describe("validateSingleField", () => {
    it("should return valid result for valid value", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "text",
        validation: { required: true },
      };
      const result = validateSingleField(schema, "hello");
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should return error for invalid value", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "text",
        validation: { required: true },
      };
      const result = validateSingleField(schema, "");
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("isValid", () => {
    const schema: ExtendedFormSchema = {
      type: "object",
      properties: {
        name: { type: "text", validation: { required: true } },
      },
    };

    it("should return true for valid data", () => {
      expect(isValid(schema, { name: "John" })).toBe(true);
    });

    it("should return false for invalid data", () => {
      expect(isValid(schema, { name: "" })).toBe(false);
    });
  });

  describe("getFieldError", () => {
    const schema: ExtendedFormFieldSchema = {
      type: "text",
      validation: { required: true },
    };

    it("should return undefined for valid value", () => {
      expect(getFieldError(schema, "hello")).toBeUndefined();
    });

    it("should return error message for invalid value", () => {
      const error = getFieldError(schema, "");
      expect(typeof error).toBe("string");
      expect(error).toBe(DEFAULT_ERROR_MESSAGES.required);
    });
  });

  describe("createValidator", () => {
    it("should create a reusable validator function", () => {
      const schema: ExtendedFormSchema = {
        type: "object",
        properties: {
          name: { type: "text", validation: { required: true } },
        },
      };
      const validator = createValidator(schema);

      expect(validator({ name: "John" }).valid).toBe(true);
      expect(validator({ name: "" }).valid).toBe(false);
    });

    it("should accept options", () => {
      const schema: ExtendedFormSchema = {
        type: "object",
        properties: {
          a: { type: "text", validation: { required: true } },
          b: { type: "text", validation: { required: true } },
        },
      };
      const validator = createValidator(schema, { abortEarly: true });
      const result = validator({ a: "", b: "" });
      expect(result.errors).toHaveLength(1);
    });
  });

  describe("toFormValidationResult", () => {
    it("should convert ValidationResult to FormValidationResult", () => {
      const validationResult = validate(
        {
          type: "object",
          properties: {
            name: { type: "text", validation: { required: true } },
          },
        },
        { name: "" }
      );
      const formResult = toFormValidationResult(validationResult);
      expect(formResult.valid).toBe(false);
      expect(formResult.errors.name).toBeDefined();
      expect(formResult.warnings).toEqual({});
    });
  });
});

// =============================================================================
// Edge Cases Tests
// =============================================================================

describe("Edge Cases", () => {
  describe("Empty Schema", () => {
    it("should handle schema with no properties", () => {
      const schema = { type: "object" } as ExtendedFormSchema;
      const result = validate(schema, {});
      expect(result.valid).toBe(true);
    });

    it("should handle schema with empty properties", () => {
      const schema: ExtendedFormSchema = {
        type: "object",
        properties: {},
      };
      const result = validate(schema, {});
      expect(result.valid).toBe(true);
    });
  });

  describe("No Validation Rules", () => {
    it("should pass when field has no validation", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "text",
      };
      const errors = validateFieldValue(schema, "", "name");
      expect(errors).toHaveLength(0);
    });
  });

  describe("Null/Undefined Schema Properties", () => {
    it("should handle null validation object", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "text",
        validation: undefined,
      };
      const errors = validateFieldValue(schema, "test", "name");
      expect(errors).toHaveLength(0);
    });
  });

  describe("Invalid Regex Pattern", () => {
    it("should handle invalid regex pattern gracefully", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "text",
        validation: { pattern: "[invalid" },
      };
      const errors = validateFieldValue(schema, "test", "name");
      expect(errors).toHaveLength(1);
      expect(errors[0].rule).toBe("pattern");
    });
  });

  describe("Special Characters in Values", () => {
    it("should handle special characters in string values", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "text",
        validation: { min: 1 },
      };
      const errors = validateFieldValue(schema, "Test <script>alert('xss')</script>", "name");
      expect(errors).toHaveLength(0);
    });
  });

  describe("Numeric Options", () => {
    it("should handle numeric enum values", () => {
      const schema: ExtendedFormFieldSchema = {
        type: "select",
        options: [
          { value: 1, label: "One" },
          { value: 2, label: "Two" },
          { value: 3, label: "Three" },
        ],
      };
      const errors = validateFieldValue(schema, 2, "number");
      expect(errors).toHaveLength(0);

      const invalidErrors = validateFieldValue(schema, 5, "number");
      expect(invalidErrors).toHaveLength(1);
    });
  });
});

// =============================================================================
// Default Error Messages Tests
// =============================================================================

describe("DEFAULT_ERROR_MESSAGES", () => {
  it("should have messages for all rule types", () => {
    expect(DEFAULT_ERROR_MESSAGES.required).toBeDefined();
    expect(DEFAULT_ERROR_MESSAGES.min).toBeDefined();
    expect(DEFAULT_ERROR_MESSAGES.max).toBeDefined();
    expect(DEFAULT_ERROR_MESSAGES.minLength).toBeDefined();
    expect(DEFAULT_ERROR_MESSAGES.maxLength).toBeDefined();
    expect(DEFAULT_ERROR_MESSAGES.pattern).toBeDefined();
    expect(DEFAULT_ERROR_MESSAGES.enum).toBeDefined();
    expect(DEFAULT_ERROR_MESSAGES.type).toBeDefined();
    expect(DEFAULT_ERROR_MESSAGES.custom).toBeDefined();
  });
});
