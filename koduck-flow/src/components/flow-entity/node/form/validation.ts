/**
 * @file Form Validation
 * @description Schema-driven form validation with comprehensive rule support.
 * Provides validation functions for form fields and entire forms, with
 * detailed error messages and field path tracking.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 4.8
 */

import type {
  ExtendedFormSchema,
  ExtendedFormFieldSchema,
  BaseFormSchema,
  BaseFormFieldSchema,
  FormValidationResult,
  FieldValidationResult,
} from "./types";

// =============================================================================
// Types
// =============================================================================

/**
 * Represents a validation error for a specific field.
 * Contains the field path, error message, and rule that failed.
 */
export interface ValidationError {
  /** Path to the field (e.g., 'user.email' for nested fields) */
  path: string;
  /** Field name (last segment of path) */
  field: string;
  /** Error message describing the validation failure */
  message: string;
  /** The validation rule that failed */
  rule: ValidationRule;
  /** The actual value that failed validation */
  value?: unknown;
  /** Expected value or constraint (for error display) */
  expected?: unknown;
}

/**
 * Types of validation rules supported.
 */
export type ValidationRule =
  | "required"
  | "min"
  | "max"
  | "minLength"
  | "maxLength"
  | "pattern"
  | "enum"
  | "type"
  | "custom";

/**
 * Options for the validate function.
 */
export interface ValidateOptions {
  /** Whether to stop validation at first error (default: false) */
  abortEarly?: boolean;
  /** Custom error messages keyed by rule type */
  messages?: Partial<Record<ValidationRule, string>>;
  /** Path prefix for nested validation */
  pathPrefix?: string;
}

/**
 * Result from the validate function.
 */
export interface ValidationResult {
  /** Whether all validations passed */
  valid: boolean;
  /** Array of validation errors */
  errors: ValidationError[];
  /** Errors grouped by field path for easy access */
  errorsByField: Record<string, ValidationError[]>;
  /** First error message for each field (for form display) */
  firstErrorByField: Record<string, string>;
}

// =============================================================================
// Default Error Messages
// =============================================================================

/**
 * Default error messages for validation rules.
 * Can be overridden via ValidateOptions.messages.
 */
export const DEFAULT_ERROR_MESSAGES: Record<ValidationRule, string> = {
  required: "This field is required",
  min: "Value must be at least {min}",
  max: "Value must be at most {max}",
  minLength: "Must be at least {min} characters",
  maxLength: "Must be at most {max} characters",
  pattern: "Invalid format",
  enum: "Value must be one of the allowed options",
  type: "Invalid value type",
  custom: "Validation failed",
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Checks if a value is empty (null, undefined, empty string, or empty array).
 * @param value - The value to check
 * @returns True if the value is considered empty
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === "string" && value.trim() === "") {
    return true;
  }
  if (Array.isArray(value) && value.length === 0) {
    return true;
  }
  return false;
}

/**
 * Formats an error message by replacing placeholders with values.
 * @param template - The message template with {placeholder} syntax
 * @param values - Object with values to substitute
 * @returns The formatted message
 */
export function formatMessage(template: string, values: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = values[key];
    return value !== undefined ? String(value) : `{${key}}`;
  });
}

/**
 * Gets the error message for a rule, with custom message support.
 * @param rule - The validation rule
 * @param schema - The field schema (may contain custom message)
 * @param options - Validation options (may contain custom messages)
 * @param values - Values for message formatting
 * @returns The formatted error message
 */
export function getErrorMessage(
  rule: ValidationRule,
  schema: BaseFormFieldSchema | ExtendedFormFieldSchema,
  options: ValidateOptions,
  values: Record<string, unknown> = {}
): string {
  // Priority: schema.validation.message > options.messages[rule] > default
  const customMessage = schema.validation?.message;
  const optionMessage = options.messages?.[rule];
  const template = customMessage ?? optionMessage ?? DEFAULT_ERROR_MESSAGES[rule];
  return formatMessage(template, values);
}

/**
 * Gets the field path for a field name.
 * @param fieldName - The field name
 * @param pathPrefix - Optional path prefix
 * @returns The full field path
 */
export function getFieldPath(fieldName: string, pathPrefix?: string): string {
  if (pathPrefix) {
    return `${pathPrefix}.${fieldName}`;
  }
  return fieldName;
}

// =============================================================================
// Field Validation
// =============================================================================

/**
 * Validates a single field value against its schema.
 *
 * Supports the following validation rules:
 * - required: Value must not be empty
 * - min/max: Numeric bounds or string length bounds
 * - pattern: Regular expression match for strings
 * - enum: Value must be in the allowed options list
 *
 * @param schema - The field schema
 * @param value - The field value to validate
 * @param fieldName - The field name (for error messages)
 * @param options - Validation options
 * @returns Array of validation errors (empty if valid)
 *
 * @example
 * const errors = validateFieldValue(
 *   { type: 'text', validation: { required: true } },
 *   '',
 *   'name'
 * );
 * // [{ path: 'name', field: 'name', message: 'This field is required', rule: 'required' }]
 */
export function validateFieldValue(
  schema: BaseFormFieldSchema | ExtendedFormFieldSchema,
  value: unknown,
  fieldName: string,
  options: ValidateOptions = {}
): ValidationError[] {
  const errors: ValidationError[] = [];
  const validation = schema.validation;
  const path = getFieldPath(fieldName, options.pathPrefix);

  const addError = (rule: ValidationRule, message: string, expected?: unknown) => {
    errors.push({
      path,
      field: fieldName,
      message,
      rule,
      value,
      expected,
    });
  };

  // Required validation
  if (validation?.required && isEmpty(value)) {
    addError("required", getErrorMessage("required", schema, options));
    // If required fails and value is empty, skip other validations
    if (options.abortEarly) return errors;
    return errors;
  }

  // Skip other validations if value is empty (and not required)
  if (isEmpty(value)) {
    return errors;
  }

  // Numeric validations (min/max for numbers)
  if (typeof value === "number") {
    if (validation?.min !== undefined && value < validation.min) {
      addError(
        "min",
        getErrorMessage("min", schema, options, { min: validation.min, value }),
        validation.min
      );
      if (options.abortEarly) return errors;
    }
    if (validation?.max !== undefined && value > validation.max) {
      addError(
        "max",
        getErrorMessage("max", schema, options, { max: validation.max, value }),
        validation.max
      );
      if (options.abortEarly) return errors;
    }
  }

  // String validations (min/max length)
  if (typeof value === "string") {
    if (validation?.min !== undefined && value.length < validation.min) {
      addError(
        "minLength",
        getErrorMessage("minLength", schema, options, {
          min: validation.min,
          length: value.length,
        }),
        validation.min
      );
      if (options.abortEarly) return errors;
    }
    if (validation?.max !== undefined && value.length > validation.max) {
      addError(
        "maxLength",
        getErrorMessage("maxLength", schema, options, {
          max: validation.max,
          length: value.length,
        }),
        validation.max
      );
      if (options.abortEarly) return errors;
    }
  }

  // Pattern validation for strings
  if (typeof value === "string" && validation?.pattern) {
    try {
      const regex = new RegExp(validation.pattern);
      if (!regex.test(value)) {
        addError(
          "pattern",
          getErrorMessage("pattern", schema, options, { pattern: validation.pattern }),
          validation.pattern
        );
        if (options.abortEarly) return errors;
      }
    } catch {
      // Invalid regex pattern - treat as validation error
      addError("pattern", "Invalid validation pattern", validation.pattern);
      if (options.abortEarly) return errors;
    }
  }

  // Enum validation (value must be one of the allowed options)
  if (schema.options && schema.options.length > 0) {
    const allowedValues = schema.options.map((opt: { value: string | number | boolean }) => opt.value);
    const valueToCheck = Array.isArray(value) ? value : [value];

    for (const v of valueToCheck) {
      if (!allowedValues.includes(v as string | number | boolean)) {
        addError(
          "enum",
          getErrorMessage("enum", schema, options, {
            value: v,
            allowed: allowedValues.join(", "),
          }),
          allowedValues
        );
        if (options.abortEarly) return errors;
        break; // Only report first invalid enum value
      }
    }
  }

  // Check enum from schema.enum if present (alternative to options)
  const schemaEnum = (schema as ExtendedFormFieldSchema).enum;
  if (schemaEnum && schemaEnum.length > 0 && !schema.options) {
    const valueToCheck = Array.isArray(value) ? value : [value];

    for (const v of valueToCheck) {
      if (!schemaEnum.includes(v)) {
        addError(
          "enum",
          getErrorMessage("enum", schema, options, {
            value: v,
            allowed: schemaEnum.join(", "),
          }),
          schemaEnum
        );
        if (options.abortEarly) return errors;
        break;
      }
    }
  }

  return errors;
}

// =============================================================================
// Form Validation
// =============================================================================

/**
 * Validates all fields in a form against the schema.
 *
 * @param schema - The form schema
 * @param data - The form data to validate
 * @param options - Validation options
 * @returns Validation result with all errors
 *
 * @example
 * const schema: ExtendedFormSchema = {
 *   type: 'object',
 *   properties: {
 *     name: { type: 'text', validation: { required: true, min: 2 } },
 *     email: { type: 'email', validation: { required: true, pattern: '^[^@]+@[^@]+$' } },
 *     age: { type: 'number', validation: { min: 0, max: 150 } }
 *   }
 * };
 *
 * const result = validate(schema, { name: '', email: 'invalid', age: -5 });
 * // result.valid === false
 * // result.errors contains errors for name (required), email (pattern), age (min)
 */
export function validate(
  schema: BaseFormSchema | ExtendedFormSchema,
  data: Record<string, unknown>,
  options: ValidateOptions = {}
): ValidationResult {
  const allErrors: ValidationError[] = [];
  const errorsByField: Record<string, ValidationError[]> = {};
  const firstErrorByField: Record<string, string> = {};

  const properties: Record<string, BaseFormFieldSchema | ExtendedFormFieldSchema> =
    schema.properties ?? {};

  for (const [fieldName, fieldSchema] of Object.entries(properties)) {
    // Skip hidden fields
    if (fieldSchema.hidden) {
      continue;
    }

    // Skip fields with unmet visibility conditions
    if (fieldSchema.visibleWhen) {
      if (!evaluateVisibility(fieldSchema.visibleWhen, data)) {
        continue;
      }
    }

    const value = data[fieldName];
    const fieldErrors = validateFieldValue(fieldSchema, value, fieldName, options);

    if (fieldErrors.length > 0) {
      allErrors.push(...fieldErrors);
      errorsByField[fieldName] = fieldErrors;
      firstErrorByField[fieldName] = fieldErrors[0].message;

      if (options.abortEarly) {
        break;
      }
    }
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    errorsByField,
    firstErrorByField,
  };
}

/**
 * Evaluates a visibility condition expression.
 * Simplified version - only handles basic equality checks.
 * @param condition - The visibility condition expression
 * @param data - The form data
 * @returns Whether the field should be visible
 */
function evaluateVisibility(condition: string, data: Record<string, unknown>): boolean {
  // Handle simple field reference: "fieldName"
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(condition)) {
    return Boolean(data[condition]);
  }

  // Handle equality: "field === 'value'" or "field == 'value'"
  const equalityMatch = condition.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*===?\s*(['"]?)(.+?)\2$/);
  if (equalityMatch) {
    const [, fieldName, , expectedValue] = equalityMatch;
    const actualValue = data[fieldName];
    let parsedExpected: unknown = expectedValue;
    if (expectedValue === "true") parsedExpected = true;
    else if (expectedValue === "false") parsedExpected = false;
    else if (!isNaN(Number(expectedValue))) parsedExpected = Number(expectedValue);
    return actualValue === parsedExpected;
  }

  // Handle inequality: "field !== 'value'"
  const inequalityMatch = condition.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*!==?\s*(['"]?)(.+?)\2$/);
  if (inequalityMatch) {
    const [, fieldName, , expectedValue] = inequalityMatch;
    const actualValue = data[fieldName];
    let parsedExpected: unknown = expectedValue;
    if (expectedValue === "true") parsedExpected = true;
    else if (expectedValue === "false") parsedExpected = false;
    else if (!isNaN(Number(expectedValue))) parsedExpected = Number(expectedValue);
    return actualValue !== parsedExpected;
  }

  // Handle negation: "!fieldName"
  if (condition.startsWith("!")) {
    const fieldName = condition.slice(1).trim();
    return !data[fieldName];
  }

  // Default to visible if we can't parse the condition
  return true;
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Converts ValidationResult to FormValidationResult for FlowNodeForm compatibility.
 * @param result - The validation result from validate()
 * @returns FormValidationResult for use with FlowNodeForm
 */
export function toFormValidationResult(result: ValidationResult): FormValidationResult {
  return {
    valid: result.valid,
    errors: result.firstErrorByField,
    warnings: {}, // No warnings in basic validation
  };
}

/**
 * Validates a single field and returns a FieldValidationResult.
 * Convenience wrapper for validateFieldValue that returns the expected format.
 * @param schema - The field schema
 * @param value - The field value
 * @returns FieldValidationResult
 */
export function validateSingleField(
  schema: BaseFormFieldSchema | ExtendedFormFieldSchema,
  value: unknown
): FieldValidationResult {
  const errors = validateFieldValue(schema, value, "field");
  if (errors.length === 0) {
    return { valid: true };
  }
  return {
    valid: false,
    error: errors[0].message,
  };
}

/**
 * Creates a validator function for a specific schema.
 * Useful for memoizing validation logic.
 * @param schema - The form schema
 * @param options - Validation options
 * @returns A validation function that takes data and returns ValidationResult
 */
export function createValidator(
  schema: BaseFormSchema | ExtendedFormSchema,
  options: ValidateOptions = {}
): (data: Record<string, unknown>) => ValidationResult {
  return (data: Record<string, unknown>) => validate(schema, data, options);
}

/**
 * Checks if form data has any validation errors.
 * Quick check without full error details.
 * @param schema - The form schema
 * @param data - The form data
 * @returns True if the form data is valid
 */
export function isValid(
  schema: BaseFormSchema | ExtendedFormSchema,
  data: Record<string, unknown>
): boolean {
  return validate(schema, data, { abortEarly: true }).valid;
}

/**
 * Gets the first error message for a field.
 * @param schema - The field schema
 * @param value - The field value
 * @returns Error message or undefined if valid
 */
export function getFieldError(
  schema: BaseFormFieldSchema | ExtendedFormFieldSchema,
  value: unknown
): string | undefined {
  const result = validateSingleField(schema, value);
  return result.valid ? undefined : result.error;
}
