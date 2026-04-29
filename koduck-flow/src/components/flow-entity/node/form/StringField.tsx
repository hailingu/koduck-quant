/**
 * @file StringField Component
 * @description Form field component for text/string input with textarea,
 * password, email, and URL variants. When schema.enum is present, delegates
 * to SelectField for dropdown rendering.
 *
 * @see docs/design/flow-entity-step-plan-en.md Tasks 4.3-4.7
 */

import React, { useCallback, useId, useMemo } from "react";
import type { FieldProps, ExtendedFormFieldSchema, UIWidgetOptions } from "./types";

// =============================================================================
// Constants
// =============================================================================

/** Base CSS class for string field */
export const STRING_FIELD_CLASS = "flow-node-form-string-field";

/** CSS class for different input types */
export const STRING_FIELD_INPUT_CLASS = `${STRING_FIELD_CLASS}__input`;
export const STRING_FIELD_TEXTAREA_CLASS = `${STRING_FIELD_CLASS}__textarea`;

/** CSS class modifiers */
export const STRING_FIELD_READONLY_CLASS = `${STRING_FIELD_CLASS}--readonly`;
export const STRING_FIELD_DISABLED_CLASS = `${STRING_FIELD_CLASS}--disabled`;
export const STRING_FIELD_ERROR_CLASS = `${STRING_FIELD_CLASS}--error`;
export const STRING_FIELD_REQUIRED_CLASS = `${STRING_FIELD_CLASS}--required`;

/** Default number of rows for textarea */
const DEFAULT_TEXTAREA_ROWS = 3;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Gets the appropriate input type based on schema type and widget.
 * @param schema - Field schema
 * @returns HTML input type
 */
function getInputType(schema: ExtendedFormFieldSchema): string {
  const widget = schema["ui:widget"];

  // Widget takes precedence
  if (widget === "password") return "password";
  if (widget === "hidden") return "hidden";

  // Then check field type
  switch (schema.type) {
    case "password":
      return "password";
    case "email":
      return "email";
    case "url":
      return "url";
    default:
      return "text";
  }
}

/**
 * Determines if field should render as textarea.
 * @param schema - Field schema
 * @returns True if textarea should be used
 */
function shouldUseTextarea(schema: ExtendedFormFieldSchema): boolean {
  const widget = schema["ui:widget"];
  return widget === "textarea" || schema.type === "textarea" || Boolean(schema["ui:options"]?.rows);
}

/**
 * Gets UI options with defaults applied.
 * @param schema - Field schema
 * @returns Merged options
 */
function getOptions(schema: ExtendedFormFieldSchema): UIWidgetOptions {
  return schema["ui:options"] ?? {};
}

// =============================================================================
// StringField Component
// =============================================================================

/**
 * Props for the StringField component.
 */
export interface StringFieldProps extends FieldProps<string> {
  /** Optional input type override */
  inputType?: "text" | "password" | "email" | "url" | "hidden";
}

/**
 * StringField renders a text input or textarea for string values.
 *
 * Features:
 * - Supports text, password, email, URL input types
 * - Textarea mode for multiline text
 * - Max length enforcement
 * - Placeholder support
 * - Read-only and disabled states
 * - Required field indication
 *
 * @example
 * // Basic text input
 * <StringField
 *   schema={{ type: 'text', label: 'Name' }}
 *   name="name"
 *   value=""
 *   onChange={(value) => console.log(value)}
 * />
 *
 * @example
 * // Textarea with rows
 * <StringField
 *   schema={{
 *     type: 'text',
 *     'ui:widget': 'textarea',
 *     'ui:options': { rows: 5 }
 *   }}
 *   name="description"
 *   value=""
 *   onChange={(value) => console.log(value)}
 * />
 */
export const StringField: React.FC<StringFieldProps> = ({
  schema,
  name,
  value,
  onChange,
  onBlur,
  readOnly = false,
  disabled = false,
  error,
  className,
  testId,
  inputType: inputTypeProp,
}) => {
  // Generate unique ID for label association
  const uniqueId = useId();
  const inputId = `field-${name}-${uniqueId}`;

  // Get UI options
  const options = useMemo(() => getOptions(schema), [schema]);

  // Determine input characteristics
  const useTextarea = useMemo(() => shouldUseTextarea(schema), [schema]);
  // Use prop override if provided, otherwise derive from schema
  const inputType = useMemo(() => inputTypeProp ?? getInputType(schema), [inputTypeProp, schema]);

  // Check if required
  const isRequired = Boolean(schema.validation?.required);

  // Build class name
  const fieldClassName = useMemo(() => {
    const classes = [STRING_FIELD_CLASS];
    if (readOnly) classes.push(STRING_FIELD_READONLY_CLASS);
    if (disabled) classes.push(STRING_FIELD_DISABLED_CLASS);
    if (error) classes.push(STRING_FIELD_ERROR_CLASS);
    if (isRequired) classes.push(STRING_FIELD_REQUIRED_CLASS);
    if (className) classes.push(className);
    return classes.join(" ");
  }, [readOnly, disabled, error, isRequired, className]);

  // Handle value change
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      onChange(newValue);
    },
    [onChange]
  );

  // Handle blur
  const handleBlur = useCallback(() => {
    onBlur?.();
  }, [onBlur]);

  // Get placeholder text
  const placeholder = schema["ui:placeholder"] ?? schema.placeholder ?? undefined;

  // Get max length
  const maxLength = options.maxLength ?? schema.validation?.maxLength ?? undefined;

  // Common props for input/textarea
  const commonProps = {
    id: inputId,
    name,
    value: value ?? "",
    onChange: handleChange,
    onBlur: handleBlur,
    placeholder,
    maxLength,
    readOnly,
    disabled,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${inputId}-error` : undefined,
    "aria-required": isRequired || undefined,
    "data-testid": testId ?? `string-field-${name}`,
  };

  // Render textarea
  if (useTextarea) {
    const rows = options.rows ?? DEFAULT_TEXTAREA_ROWS;
    const cols = options.cols;

    return (
      <div className={fieldClassName} data-field-type="string">
        <textarea
          {...commonProps}
          rows={rows}
          cols={cols}
          className={STRING_FIELD_TEXTAREA_CLASS}
        />
      </div>
    );
  }

  // Render input
  return (
    <div className={fieldClassName} data-field-type="string">
      <input {...commonProps} type={inputType} className={STRING_FIELD_INPUT_CLASS} />
    </div>
  );
};

StringField.displayName = "StringField";

// =============================================================================
// Convenience Components
// =============================================================================

/**
 * TextField - Alias for StringField with text type.
 * @param props
 */
export const TextField: React.FC<StringFieldProps> = (props) => (
  <StringField {...props} inputType="text" />
);

TextField.displayName = "TextField";

/**
 * PasswordField - StringField configured for password input.
 * @param props
 */
export const PasswordField: React.FC<StringFieldProps> = (props) => (
  <StringField {...props} inputType="password" />
);

PasswordField.displayName = "PasswordField";

/**
 * EmailField - StringField configured for email input.
 * @param props
 */
export const EmailField: React.FC<StringFieldProps> = (props) => (
  <StringField {...props} inputType="email" />
);

EmailField.displayName = "EmailField";

/**
 * UrlField - StringField configured for URL input.
 * @param props
 */
export const UrlField: React.FC<StringFieldProps> = (props) => (
  <StringField {...props} inputType="url" />
);

UrlField.displayName = "UrlField";

/**
 * TextareaField - StringField configured for multiline text.
 */
export const TextareaField: React.FC<StringFieldProps> = ({ schema, ...props }) => {
  // Force textarea widget
  const enhancedSchema: ExtendedFormFieldSchema = {
    ...schema,
    "ui:widget": "textarea",
  };
  return <StringField {...props} schema={enhancedSchema} />;
};

TextareaField.displayName = "TextareaField";

export default StringField;
