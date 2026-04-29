/**
 * @file FlowNodeForm Component
 * @description Renders form fields from a schema and provides data change callbacks.
 * This is the main form component for node configuration UIs.
 *
 * Features:
 * - Schema-driven form rendering
 * - Field type to renderer mapping
 * - Custom component support
 * - Validation integration
 * - Read-only and compact modes
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 4.2
 */

import React, { useCallback, useMemo, useRef } from "react";
import type {
  ExtendedFormSchema,
  ExtendedFormFieldSchema,
  FieldProps,
  FieldRenderer,
  FieldRendererRegistry,
  FormContext,
  FormValidationResult,
} from "./types";
import {
  getOrderedFieldNames,
  getVisibleFieldNames,
  validateForm,
  setNestedValueImmutable,
  isFieldReadOnly,
  isFieldDisabled,
  getWidgetType,
} from "./form-utils";
import { FieldWrapper } from "./FieldWrapper";
import { StringField } from "./StringField";
import { NumberField } from "./NumberField";
import { BooleanField } from "./BooleanField";
import { SelectField, MultiSelectField, CheckboxesField, RadiosField } from "./SelectField";
import { ArrayField } from "./ArrayField";

// =============================================================================
// Types
// =============================================================================

/**
 * Props for the FlowNodeForm component.
 */
export interface FlowNodeFormProps {
  /** The form schema defining fields and their configuration */
  schema: ExtendedFormSchema;

  /** Current form data */
  data: Record<string, unknown>;

  /** Callback when form data changes */
  onChange: (data: Record<string, unknown>) => void;

  /** Whether the form is read-only */
  readOnly?: boolean;

  /** Whether to render in compact mode (less spacing, no descriptions) */
  compact?: boolean;

  /** Custom field components to override or extend default renderers */
  customComponents?: FieldRendererRegistry;

  /** Callback for validation, receives validation result */
  onValidate?: (result: FormValidationResult) => void;

  /** Whether to validate on change (default: true) */
  validateOnChange?: boolean;

  /** Whether to validate on blur (default: true) */
  validateOnBlur?: boolean;

  /** Label position for all fields */
  labelPosition?: "top" | "left" | "inline";

  /** Whether to show labels */
  showLabels?: boolean;

  /** Additional CSS class name */
  className?: string;

  /** Test ID for testing */
  testId?: string;

  /** Form disabled state */
  disabled?: boolean;
}

// =============================================================================
// CSS Class Names
// =============================================================================

/** Base CSS class for the form */
export const FORM_CLASS = "flow-node-form";

/** CSS class for compact mode */
export const FORM_COMPACT_CLASS = "flow-node-form--compact";

/** CSS class for read-only mode */
export const FORM_READONLY_CLASS = "flow-node-form--readonly";

/** CSS class for disabled mode */
export const FORM_DISABLED_CLASS = "flow-node-form--disabled";

/** CSS class for form fields container */
export const FORM_FIELDS_CLASS = "flow-node-form__fields";

// =============================================================================
// Default Field Renderer (Placeholder)
// =============================================================================

/**
 * Placeholder field renderer for unsupported field types.
 * This will be replaced with actual field components in Tasks 4.3-4.7.
 */
const PlaceholderField: React.FC<FieldProps> = ({
  schema,
  name,
  value,
  onChange,
  readOnly,
  disabled,
  testId,
}) => {
  const widgetType = getWidgetType(schema);

  // Handle different field types with basic inputs
  switch (schema.type) {
    case "text":
    case "password":
    case "email":
    case "url":
    case "textarea":
      return (
        <input
          id={`field-${name}`}
          type={schema.type === "password" ? "password" : "text"}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={schema.placeholder}
          readOnly={readOnly}
          disabled={disabled}
          data-testid={testId ?? `field-input-${name}`}
          className="flow-node-form-field__text-input"
        />
      );

    case "number":
    case "range":
      return (
        <input
          id={`field-${name}`}
          type={schema.type === "range" ? "range" : "number"}
          value={(value as number) ?? 0}
          onChange={(e) => onChange(Number(e.target.value))}
          min={schema.validation?.min}
          max={schema.validation?.max}
          readOnly={readOnly}
          disabled={disabled}
          data-testid={testId ?? `field-input-${name}`}
          className="flow-node-form-field__number-input"
        />
      );

    case "boolean":
      return (
        <input
          id={`field-${name}`}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          disabled={readOnly || disabled}
          data-testid={testId ?? `field-input-${name}`}
          className="flow-node-form-field__checkbox-input"
        />
      );

    case "select":
      return (
        <select
          id={`field-${name}`}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={readOnly || disabled}
          data-testid={testId ?? `field-input-${name}`}
          className="flow-node-form-field__select-input"
        >
          <option value="">{schema.placeholder ?? "Select..."}</option>
          {schema.options?.map((option) => (
            <option key={String(option.value)} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );

    case "multiselect":
      return (
        <select
          id={`field-${name}`}
          multiple
          value={(value as string[]) ?? []}
          onChange={(e) => {
            const selected = Array.from(e.target.selectedOptions).map((opt) => opt.value);
            onChange(selected);
          }}
          disabled={readOnly || disabled}
          data-testid={testId ?? `field-input-${name}`}
          className="flow-node-form-field__multiselect-input"
        >
          {schema.options?.map((option) => (
            <option key={String(option.value)} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );

    case "date":
      return (
        <input
          id={`field-${name}`}
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          readOnly={readOnly}
          disabled={disabled}
          data-testid={testId ?? `field-input-${name}`}
          className="flow-node-form-field__date-input"
        />
      );

    case "time":
      return (
        <input
          id={`field-${name}`}
          type="time"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          readOnly={readOnly}
          disabled={disabled}
          data-testid={testId ?? `field-input-${name}`}
          className="flow-node-form-field__time-input"
        />
      );

    case "datetime":
      return (
        <input
          id={`field-${name}`}
          type="datetime-local"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          readOnly={readOnly}
          disabled={disabled}
          data-testid={testId ?? `field-input-${name}`}
          className="flow-node-form-field__datetime-input"
        />
      );

    case "color":
      return (
        <input
          id={`field-${name}`}
          type="color"
          value={(value as string) ?? "#000000"}
          onChange={(e) => onChange(e.target.value)}
          disabled={readOnly || disabled}
          data-testid={testId ?? `field-input-${name}`}
          className="flow-node-form-field__color-input"
        />
      );

    case "file":
      return (
        <input
          id={`field-${name}`}
          type="file"
          onChange={(e) => {
            const files = e.target.files;
            if (files && files.length > 0) {
              onChange(files[0]);
            }
          }}
          disabled={readOnly || disabled}
          data-testid={testId ?? `field-input-${name}`}
          className="flow-node-form-field__file-input"
        />
      );

    case "json":
    case "code":
      return (
        <textarea
          id={`field-${name}`}
          value={typeof value === "string" ? value : JSON.stringify(value, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              onChange(parsed);
            } catch {
              // Keep as string if not valid JSON
              onChange(e.target.value);
            }
          }}
          placeholder={schema.placeholder}
          readOnly={readOnly}
          disabled={disabled}
          rows={5}
          data-testid={testId ?? `field-input-${name}`}
          className="flow-node-form-field__code-input"
        />
      );

    default:
      // Fallback to text input for unknown types
      return (
        <input
          id={`field-${name}`}
          type="text"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={schema.placeholder}
          readOnly={readOnly}
          disabled={disabled}
          data-testid={testId ?? `field-input-${name}`}
          className="flow-node-form-field__text-input"
        />
      );
  }
};

PlaceholderField.displayName = "PlaceholderField";

// =============================================================================
// Default Field Renderers Registry
// =============================================================================

/**
 * Default field renderer registry.
 * Maps field types to their renderer components.
 */
export const defaultFieldRenderers: FieldRendererRegistry = {
  // Text types
  text: StringField,
  textarea: StringField,
  password: StringField,
  email: StringField,
  url: StringField,

  // Number types
  number: NumberField,
  range: NumberField,

  // Boolean type
  boolean: BooleanField,

  // Selection types
  select: SelectField,
  multiselect: MultiSelectField,

  // Array type
  array: ArrayField,

  // Date/time types (use PlaceholderField until dedicated components)
  date: PlaceholderField,
  time: PlaceholderField,
  datetime: PlaceholderField,

  // Special types (use PlaceholderField until dedicated components)
  color: PlaceholderField,
  file: PlaceholderField,
  code: PlaceholderField,
  json: PlaceholderField,
};

// =============================================================================
// FlowNodeForm Component
// =============================================================================

/**
 * FlowNodeForm renders a form from a schema with data binding.
 *
 * Features:
 * - Schema-driven field rendering
 * - Automatic field type detection
 * - Custom component override support
 * - Validation integration
 * - Read-only and compact modes
 *
 * @example
 * const schema: ExtendedFormSchema = {
 *   type: 'object',
 *   properties: {
 *     name: { type: 'text', label: 'Name', validation: { required: true } },
 *     age: { type: 'number', label: 'Age' },
 *     active: { type: 'boolean', label: 'Active' }
 *   }
 * };
 *
 * <FlowNodeForm
 *   schema={schema}
 *   data={formData}
 *   onChange={setFormData}
 *   onValidate={handleValidation}
 * />
 */
export const FlowNodeForm: React.FC<FlowNodeFormProps> = ({
  schema,
  data,
  onChange,
  readOnly = false,
  compact = false,
  customComponents,
  onValidate,
  validateOnChange = true,
  validateOnBlur = true,
  labelPosition = "top",
  showLabels = true,
  className,
  testId,
  disabled = false,
}) => {
  // Track validation errors
  const errorsRef = useRef<Record<string, string>>({});

  // Merge custom components with defaults
  const fieldRenderers = useMemo(() => {
    if (!customComponents) {
      return defaultFieldRenderers;
    }
    return { ...defaultFieldRenderers, ...customComponents };
  }, [customComponents]);

  // Get visible field names in order
  const visibleFields = useMemo(() => getVisibleFieldNames(schema, data), [schema, data]);

  // Create form context
  const formContext = useMemo<FormContext>(
    () => ({
      formData: data,
      errors: errorsRef.current,
      readOnly,
      disabled,
      schema,
      getValue: (name: string) => data[name],
      setValue: (name: string, value: unknown) => {
        const newData = setNestedValueImmutable(data, name, value);
        onChange(newData);
      },
    }),
    [data, readOnly, disabled, schema, onChange]
  );

  // Handle field change
  const handleFieldChange = useCallback(
    (name: string, value: unknown) => {
      const newData = { ...data, [name]: value };
      onChange(newData);

      // Validate on change if enabled
      if (validateOnChange && onValidate) {
        const result = validateForm(schema, newData);
        errorsRef.current = result.errors;
        onValidate(result);
      }
    },
    [data, onChange, validateOnChange, onValidate, schema]
  );

  // Handle field blur
  const handleFieldBlur = useCallback(
    (name: string) => {
      // Validate on blur if enabled
      if (validateOnBlur && onValidate) {
        const result = validateForm(schema, data);
        errorsRef.current = result.errors;
        onValidate(result);
      }
    },
    [validateOnBlur, onValidate, schema, data]
  );

  // Render a single field
  const renderField = useCallback(
    (name: string) => {
      const fieldSchema = schema.properties[name] as ExtendedFormFieldSchema;
      if (!fieldSchema) {
        return null;
      }

      // Get the renderer for this field type
      const widgetType = getWidgetType(fieldSchema);
      const FieldComponent =
        fieldRenderers[widgetType] || fieldRenderers[fieldSchema.type] || PlaceholderField;

      // Compute field props
      const fieldReadOnly = isFieldReadOnly(fieldSchema, readOnly);
      const fieldDisabled = isFieldDisabled(fieldSchema, disabled);
      const fieldValue = data[name];
      const fieldError = errorsRef.current[name];

      // Build field props
      const fieldProps: FieldProps = {
        schema: fieldSchema,
        name,
        value: fieldValue,
        onChange: (value: unknown) => handleFieldChange(name, value),
        onBlur: () => handleFieldBlur(name),
        readOnly: fieldReadOnly,
        disabled: fieldDisabled,
        error: fieldError,
        testId: `field-input-${name}`,
        path: name,
        formContext,
      };

      return (
        <FieldWrapper
          key={name}
          schema={fieldSchema}
          name={name}
          error={fieldError}
          compact={compact}
          labelPosition={labelPosition}
          hideLabel={!showLabels}
          testId={`field-wrapper-${name}`}
        >
          <FieldComponent {...fieldProps} />
        </FieldWrapper>
      );
    },
    [
      schema,
      data,
      fieldRenderers,
      readOnly,
      disabled,
      compact,
      labelPosition,
      showLabels,
      formContext,
      handleFieldChange,
      handleFieldBlur,
    ]
  );

  // Build form class names
  const formClassName = useMemo(() => {
    const classes = [FORM_CLASS];

    if (compact) {
      classes.push(FORM_COMPACT_CLASS);
    }
    if (readOnly) {
      classes.push(FORM_READONLY_CLASS);
    }
    if (disabled) {
      classes.push(FORM_DISABLED_CLASS);
    }
    if (className) {
      classes.push(className);
    }

    return classes.join(" ");
  }, [compact, readOnly, disabled, className]);

  return (
    <div
      className={formClassName}
      data-testid={testId ?? "flow-node-form"}
      role="form"
      aria-disabled={disabled}
      aria-readonly={readOnly}
    >
      <div className={FORM_FIELDS_CLASS}>{visibleFields.map(renderField)}</div>
    </div>
  );
};

FlowNodeForm.displayName = "FlowNodeForm";

export default FlowNodeForm;

// =============================================================================
// Exports
// =============================================================================

export { PlaceholderField };
