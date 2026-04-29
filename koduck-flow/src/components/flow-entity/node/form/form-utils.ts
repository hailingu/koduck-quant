/**
 * @file Form Utilities
 * @description Utility functions for working with form schemas and data.
 * Provides helpers for creating default values, extracting field values,
 * and validating form data.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 4.1
 */

import type {
  ExtendedFormSchema,
  ExtendedFormFieldSchema,
  FieldValidationResult,
  FormValidationResult,
  BaseFormSchema,
  BaseFormFieldSchema,
  FormFieldType,
} from "./types";

// =============================================================================
// Default Value Creation
// =============================================================================

/**
 * Get the default value for a field type.
 *
 * @param type - The field type
 * @returns The default value for the type
 */
export function getDefaultValueForType(type: FormFieldType): unknown {
  switch (type) {
    case "text":
    case "textarea":
    case "password":
    case "url":
    case "email":
    case "code":
    case "json":
      return "";
    case "number":
    case "range":
      return 0;
    case "boolean":
      return false;
    case "select":
      return null;
    case "multiselect":
      return [];
    case "date":
    case "time":
    case "datetime":
      return null;
    case "color":
      return "#000000";
    case "file":
      return null;
    default:
      return null;
  }
}

/**
 * Get the default value for a form field based on its schema.
 *
 * @param schema - The field schema
 * @returns The default value for the field
 *
 * @example
 * const schema: ExtendedFormFieldSchema = {
 *   type: 'text',
 *   default: 'Hello'
 * };
 * getDefaultValueForField(schema); // 'Hello'
 *
 * @example
 * const schema: ExtendedFormFieldSchema = {
 *   type: 'number',
 *   validation: { min: 10 }
 * };
 * getDefaultValueForField(schema); // 0 (type default)
 */
export function getDefaultValueForField(
  schema: BaseFormFieldSchema | ExtendedFormFieldSchema
): unknown {
  // If explicit default is provided, use it
  if (schema.default !== undefined) {
    return schema.default;
  }

  // For select fields with options, use first option value if required
  if ((schema.type === "select" || schema.type === "multiselect") && schema.options?.length) {
    if (schema.validation?.required && schema.type === "select") {
      return schema.options[0].value;
    }
  }

  // Fall back to type default
  return getDefaultValueForType(schema.type);
}

/**
 * Create default form data from a form schema.
 * This function generates an object with default values for all fields.
 *
 * @param schema - The form schema
 * @returns Object with default values for all fields
 *
 * @example
 * const schema: ExtendedFormSchema = {
 *   type: 'object',
 *   properties: {
 *     name: { type: 'text', default: 'John' },
 *     age: { type: 'number' },
 *     active: { type: 'boolean', default: true }
 *   }
 * };
 * createDefaultValues(schema);
 * // { name: 'John', age: 0, active: true }
 */
export function createDefaultValues(
  schema: BaseFormSchema | ExtendedFormSchema
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (!schema.properties) {
    return result;
  }

  for (const [key, fieldSchema] of Object.entries(schema.properties)) {
    result[key] = getDefaultValueForField(fieldSchema);
  }

  return result;
}

/**
 * Merge provided data with default values from schema.
 * Fills in missing fields with their default values.
 *
 * @param schema - The form schema
 * @param data - Partial data to merge
 * @returns Complete data with defaults filled in
 *
 * @example
 * const schema: ExtendedFormSchema = {
 *   type: 'object',
 *   properties: {
 *     name: { type: 'text', default: 'John' },
 *     age: { type: 'number', default: 18 }
 *   }
 * };
 * mergeWithDefaults(schema, { name: 'Jane' });
 * // { name: 'Jane', age: 18 }
 */
export function mergeWithDefaults(
  schema: BaseFormSchema | ExtendedFormSchema,
  data: Record<string, unknown> = {}
): Record<string, unknown> {
  const defaults = createDefaultValues(schema);
  return { ...defaults, ...data };
}

// =============================================================================
// Field Value Extraction
// =============================================================================

/**
 * Extract a field value from form data by key.
 *
 * @param data - The form data object
 * @param key - The field key
 * @returns The field value, or undefined if not found
 *
 * @example
 * const data = { name: 'John', age: 30 };
 * extractFieldValue(data, 'name'); // 'John'
 * extractFieldValue(data, 'email'); // undefined
 */
export function extractFieldValue(data: Record<string, unknown>, key: string): unknown {
  return data[key];
}

/**
 * Extract a nested field value using dot notation path.
 *
 * @param data - The form data object
 * @param path - Dot notation path (e.g., 'user.address.city')
 * @returns The field value, or undefined if not found
 *
 * @example
 * const data = { user: { address: { city: 'NYC' } } };
 * extractNestedValue(data, 'user.address.city'); // 'NYC'
 * extractNestedValue(data, 'user.phone'); // undefined
 */
export function extractNestedValue(data: Record<string, unknown>, path: string): unknown {
  const keys = path.split(".");
  let current: unknown = data;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

/**
 * Set a nested field value using dot notation path.
 *
 * @param data - The form data object (will be mutated)
 * @param path - Dot notation path (e.g., 'user.address.city')
 * @param value - The value to set
 * @returns The modified data object
 *
 * @example
 * const data = { user: { name: 'John' } };
 * setNestedValue(data, 'user.address.city', 'NYC');
 * // { user: { name: 'John', address: { city: 'NYC' } } }
 */
export function setNestedValue(
  data: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> {
  const keys = path.split(".");
  let current = data;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== "object" || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  current[keys[keys.length - 1]] = value;
  return data;
}

/**
 * Immutably set a nested field value using dot notation path.
 * Returns a new object with the updated value.
 *
 * @param data - The form data object
 * @param path - Dot notation path
 * @param value - The value to set
 * @returns A new data object with the updated value
 */
export function setNestedValueImmutable(
  data: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> {
  const keys = path.split(".");

  if (keys.length === 1) {
    return { ...data, [keys[0]]: value };
  }

  const [firstKey, ...restKeys] = keys;
  const nestedData = (data[firstKey] ?? {}) as Record<string, unknown>;

  return {
    ...data,
    [firstKey]: setNestedValueImmutable(nestedData, restKeys.join("."), value),
  };
}

// =============================================================================
// Field Order and Filtering
// =============================================================================

/**
 * Get ordered field names from a form schema.
 * Respects ui:order if specified, otherwise returns fields in original order.
 *
 * @param schema - The form schema
 * @returns Array of field names in display order
 */
export function getOrderedFieldNames(schema: BaseFormSchema | ExtendedFormSchema): string[] {
  const allFields = Object.keys(schema.properties || {});

  // Check for extended schema with ui:order
  if ("ui:order" in schema && Array.isArray(schema["ui:order"])) {
    const order = schema["ui:order"];
    const orderedFields: string[] = [];

    // Add fields in specified order
    for (const field of order) {
      if (allFields.includes(field)) {
        orderedFields.push(field);
      }
    }

    // Add remaining fields not in order
    for (const field of allFields) {
      if (!orderedFields.includes(field)) {
        orderedFields.push(field);
      }
    }

    return orderedFields;
  }

  // Check for ui:order in individual field schemas
  const fieldsWithOrder = allFields.map((name) => ({
    name,
    order: (schema.properties[name] as ExtendedFormFieldSchema)["ui:order"] ?? Infinity,
  }));

  fieldsWithOrder.sort((a, b) => a.order - b.order);
  return fieldsWithOrder.map((f) => f.name);
}

/**
 * Filter visible fields based on visibility conditions.
 *
 * @param schema - The form schema
 * @param data - Current form data
 * @returns Array of visible field names
 */
export function getVisibleFieldNames(
  schema: BaseFormSchema | ExtendedFormSchema,
  data: Record<string, unknown>
): string[] {
  const orderedFields = getOrderedFieldNames(schema);

  return orderedFields.filter((name) => {
    const fieldSchema = schema.properties[name];

    // Check if field is explicitly hidden
    if (fieldSchema.hidden) {
      return false;
    }

    // Check visibility condition
    if (fieldSchema.visibleWhen) {
      return evaluateVisibilityCondition(fieldSchema.visibleWhen, data);
    }

    return true;
  });
}

/**
 * Evaluate a simple visibility condition expression.
 * Supports basic expressions like "fieldName === 'value'" or "fieldName".
 *
 * @param condition - The condition expression
 * @param data - Current form data
 * @returns Whether the condition is satisfied
 */
export function evaluateVisibilityCondition(
  condition: string,
  data: Record<string, unknown>
): boolean {
  // Handle simple field reference (truthy check)
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(condition)) {
    return Boolean(data[condition]);
  }

  // Handle equality comparison: "field === 'value'" or "field === value"
  const equalityMatch = condition.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*===?\s*(['"]?)(.+?)\2$/);
  if (equalityMatch) {
    const [, fieldName, , expectedValue] = equalityMatch;
    const actualValue = data[fieldName];
    // Try to parse expected value as number/boolean
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

  // Default to true if we can't parse the condition
  return true;
}

// =============================================================================
// Validation Utilities
// =============================================================================

/**
 * Validate a single field value against its schema.
 *
 * @param schema - The field schema
 * @param value - The field value
 * @returns Validation result
 */
export function validateField(
  schema: BaseFormFieldSchema | ExtendedFormFieldSchema,
  value: unknown
): FieldValidationResult {
  const validation = schema.validation;

  if (!validation) {
    return { valid: true };
  }

  // Required check
  if (validation.required) {
    if (value === undefined || value === null || value === "") {
      return {
        valid: false,
        error: validation.message || "This field is required",
      };
    }
    // Empty array check for multiselect
    if (Array.isArray(value) && value.length === 0) {
      return {
        valid: false,
        error: validation.message || "At least one selection is required",
      };
    }
  }

  // Skip other validations if value is empty and not required
  if (value === undefined || value === null || value === "") {
    return { valid: true };
  }

  // Min/max for numbers
  if (typeof value === "number") {
    if (validation.min !== undefined && value < validation.min) {
      return {
        valid: false,
        error: validation.message || `Value must be at least ${validation.min}`,
      };
    }
    if (validation.max !== undefined && value > validation.max) {
      return {
        valid: false,
        error: validation.message || `Value must be at most ${validation.max}`,
      };
    }
  }

  // Min/max length for strings
  if (typeof value === "string") {
    if (validation.min !== undefined && value.length < validation.min) {
      return {
        valid: false,
        error: validation.message || `Must be at least ${validation.min} characters`,
      };
    }
    if (validation.max !== undefined && value.length > validation.max) {
      return {
        valid: false,
        error: validation.message || `Must be at most ${validation.max} characters`,
      };
    }
  }

  // Pattern validation for strings
  if (typeof value === "string" && validation.pattern) {
    const regex = new RegExp(validation.pattern);
    if (!regex.test(value)) {
      return {
        valid: false,
        error: validation.message || "Invalid format",
      };
    }
  }

  return { valid: true };
}

/**
 * Validate all fields in a form.
 *
 * @param schema - The form schema
 * @param data - The form data
 * @returns Validation result for the entire form
 */
export function validateForm(
  schema: BaseFormSchema | ExtendedFormSchema,
  data: Record<string, unknown>
): FormValidationResult {
  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};

  for (const [name, fieldSchema] of Object.entries(schema.properties || {})) {
    const value = data[name];
    const result = validateField(fieldSchema, value);

    if (!result.valid && result.error) {
      errors[name] = result.error;
    }
    if (result.warning) {
      warnings[name] = result.warning;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    warnings,
  };
}

// =============================================================================
// Schema Utilities
// =============================================================================

/**
 * Get the appropriate widget type for a field.
 * Uses ui:widget if specified, otherwise infers from field type.
 *
 * @param schema - The field schema
 * @returns The widget type to use
 */
export function getWidgetType(schema: BaseFormFieldSchema | ExtendedFormFieldSchema): string {
  // Check for explicit widget override
  if ("ui:widget" in schema && schema["ui:widget"]) {
    return schema["ui:widget"];
  }

  // Infer from field type
  switch (schema.type) {
    case "text":
    case "password":
    case "email":
    case "url":
      return "input";
    case "textarea":
      return "textarea";
    case "number":
    case "range":
      return "number";
    case "boolean":
      return "checkbox";
    case "select":
      return "select";
    case "multiselect":
      return "multiselect";
    case "date":
      return "date";
    case "time":
      return "time";
    case "datetime":
      return "datetime";
    case "color":
      return "color";
    case "file":
      return "file";
    case "code":
      return "code";
    case "json":
      return "json";
    default:
      return "input";
  }
}

/**
 * Check if a field is required based on its schema.
 *
 * @param schema - The field schema
 * @returns Whether the field is required
 */
export function isFieldRequired(schema: BaseFormFieldSchema | ExtendedFormFieldSchema): boolean {
  return schema.validation?.required === true;
}

/**
 * Get the label for a field.
 *
 * @param schema - The field schema
 * @param name - The field name (used as fallback)
 * @returns The display label
 */
export function getFieldLabel(
  schema: BaseFormFieldSchema | ExtendedFormFieldSchema,
  name: string
): string {
  // Check for ui:title first (extended schema)
  if ("ui:title" in schema && schema["ui:title"]) {
    return schema["ui:title"];
  }

  // Fall back to label
  if (schema.label) {
    return schema.label;
  }

  // Convert camelCase/snake_case name to title case
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^\s+/, "")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Get the placeholder for a field.
 *
 * @param schema - The field schema
 * @returns The placeholder text
 */
export function getFieldPlaceholder(
  schema: BaseFormFieldSchema | ExtendedFormFieldSchema
): string | undefined {
  // Check for ui:placeholder first (extended schema)
  if ("ui:placeholder" in schema && schema["ui:placeholder"]) {
    return schema["ui:placeholder"];
  }

  return schema.placeholder;
}

/**
 * Get the description for a field.
 *
 * @param schema - The field schema
 * @returns The description text
 */
export function getFieldDescription(
  schema: BaseFormFieldSchema | ExtendedFormFieldSchema
): string | undefined {
  // Check for ui:description first (extended schema)
  if ("ui:description" in schema && schema["ui:description"]) {
    return schema["ui:description"];
  }

  return schema.description;
}

/**
 * Check if a field is read-only.
 *
 * @param schema - The field schema
 * @param formReadOnly - Form-level read-only state
 * @returns Whether the field is read-only
 */
export function isFieldReadOnly(
  schema: BaseFormFieldSchema | ExtendedFormFieldSchema,
  formReadOnly?: boolean
): boolean {
  // Check for ui:readonly first (extended schema)
  if ("ui:readonly" in schema && schema["ui:readonly"] !== undefined) {
    return schema["ui:readonly"];
  }

  return formReadOnly ?? false;
}

/**
 * Check if a field is disabled.
 *
 * @param schema - The field schema
 * @param formDisabled - Form-level disabled state
 * @returns Whether the field is disabled
 */
export function isFieldDisabled(
  schema: BaseFormFieldSchema | ExtendedFormFieldSchema,
  formDisabled?: boolean
): boolean {
  // Check for ui:disabled first (extended schema)
  if ("ui:disabled" in schema && schema["ui:disabled"] !== undefined) {
    return schema["ui:disabled"];
  }

  if (schema.disabled !== undefined) {
    return schema.disabled;
  }

  return formDisabled ?? false;
}
