/**
 * @file BooleanField Component
 * @description Form field component for boolean values with support for
 * checkbox, switch toggle, and radio button variants.
 *
 * @see docs/design/flow-entity-step-plan-en.md Tasks 4.3-4.7
 */

import React, { useCallback, useId, useMemo } from "react";
import type { FieldProps, ExtendedFormFieldSchema } from "./types";

// =============================================================================
// Constants
// =============================================================================

/** Base CSS class for boolean field */
export const BOOLEAN_FIELD_CLASS = "flow-node-form-boolean-field";

/** CSS class for different input types */
export const BOOLEAN_FIELD_CHECKBOX_CLASS = `${BOOLEAN_FIELD_CLASS}__checkbox`;
export const BOOLEAN_FIELD_SWITCH_CLASS = `${BOOLEAN_FIELD_CLASS}__switch`;
export const BOOLEAN_FIELD_RADIO_CLASS = `${BOOLEAN_FIELD_CLASS}__radio`;
export const BOOLEAN_FIELD_LABEL_CLASS = `${BOOLEAN_FIELD_CLASS}__label`;
export const BOOLEAN_FIELD_TRACK_CLASS = `${BOOLEAN_FIELD_CLASS}__track`;
export const BOOLEAN_FIELD_THUMB_CLASS = `${BOOLEAN_FIELD_CLASS}__thumb`;

/** CSS class modifiers */
export const BOOLEAN_FIELD_CHECKED_CLASS = `${BOOLEAN_FIELD_CLASS}--checked`;
export const BOOLEAN_FIELD_READONLY_CLASS = `${BOOLEAN_FIELD_CLASS}--readonly`;
export const BOOLEAN_FIELD_DISABLED_CLASS = `${BOOLEAN_FIELD_CLASS}--disabled`;
export const BOOLEAN_FIELD_ERROR_CLASS = `${BOOLEAN_FIELD_CLASS}--error`;
export const BOOLEAN_FIELD_REQUIRED_CLASS = `${BOOLEAN_FIELD_CLASS}--required`;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Determines the widget type from schema.
 * @param schema - Field schema
 * @returns Widget type: 'checkbox', 'switch', or 'radio'
 */
function getWidgetType(schema: ExtendedFormFieldSchema): "checkbox" | "switch" | "radio" {
  const widget = schema["ui:widget"];

  if (widget === "switch") {
    return "switch";
  }
  if (widget === "radio") {
    return "radio";
  }
  return "checkbox";
}

// =============================================================================
// BooleanField Component
// =============================================================================

/**
 * Props for the BooleanField component.
 */
export interface BooleanFieldProps extends FieldProps<boolean> {
  /** Optional widget type override */
  widgetType?: "checkbox" | "switch" | "radio";
  /** Label for true/checked state (radio mode) */
  trueLabel?: string;
  /** Label for false/unchecked state (radio mode) */
  falseLabel?: string;
}

/**
 * BooleanField renders a boolean toggle input.
 *
 * Features:
 * - Standard checkbox input
 * - Toggle switch with track and thumb
 * - Radio button pair for true/false
 * - Custom true/false labels
 * - Read-only and disabled states
 *
 * @example
 * // Basic checkbox
 * <BooleanField
 *   schema={{ type: 'boolean', label: 'Active' }}
 *   name="active"
 *   value={false}
 *   onChange={(value) => console.log(value)}
 * />
 *
 * @example
 * // Toggle switch
 * <BooleanField
 *   schema={{
 *     type: 'boolean',
 *     label: 'Enable Feature',
 *     'ui:widget': 'switch'
 *   }}
 *   name="enabled"
 *   value={true}
 *   onChange={(value) => console.log(value)}
 * />
 */
export const BooleanField: React.FC<BooleanFieldProps> = ({
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
  widgetType: widgetTypeProp,
  trueLabel = "Yes",
  falseLabel = "No",
}) => {
  // Generate unique ID for label association
  const uniqueId = useId();
  const inputId = `field-${name}-${uniqueId}`;

  // Determine widget type
  const widgetType = widgetTypeProp ?? getWidgetType(schema);

  // Check if required
  const isRequired = Boolean(schema.validation?.required);

  // Current checked state
  const isChecked = Boolean(value);

  // Build class name
  const fieldClassName = useMemo(() => {
    const classes = [BOOLEAN_FIELD_CLASS];
    if (isChecked) classes.push(BOOLEAN_FIELD_CHECKED_CLASS);
    if (readOnly) classes.push(BOOLEAN_FIELD_READONLY_CLASS);
    if (disabled) classes.push(BOOLEAN_FIELD_DISABLED_CLASS);
    if (error) classes.push(BOOLEAN_FIELD_ERROR_CLASS);
    if (isRequired) classes.push(BOOLEAN_FIELD_REQUIRED_CLASS);
    if (className) classes.push(className);
    return classes.join(" ");
  }, [isChecked, readOnly, disabled, error, isRequired, className]);

  // Handle checkbox/switch change
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (readOnly) return;
      onChange(e.target.checked);
    },
    [onChange, readOnly]
  );

  // Handle blur
  const handleBlur = useCallback(() => {
    onBlur?.();
  }, [onBlur]);

  // Handle radio change
  const handleRadioChange = useCallback(
    (newValue: boolean) => {
      if (readOnly) return;
      onChange(newValue);
    },
    [onChange, readOnly]
  );

  // Handle keyboard toggle for switch
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (!readOnly && !disabled) {
          onChange(!isChecked);
        }
      }
    },
    [readOnly, disabled, isChecked, onChange]
  );

  // Common props
  const testIdValue = testId ?? `boolean-field-${name}`;

  // Render radio buttons
  if (widgetType === "radio") {
    return (
      <div
        className={fieldClassName}
        data-field-type="boolean"
        data-widget="radio"
        role="radiogroup"
        aria-required={isRequired || undefined}
        data-testid={testIdValue}
      >
        <label className={BOOLEAN_FIELD_RADIO_CLASS}>
          <input
            type="radio"
            name={name}
            checked={isChecked}
            onChange={() => handleRadioChange(true)}
            onBlur={handleBlur}
            disabled={readOnly || disabled}
            aria-invalid={error ? true : undefined}
            data-testid={`${testIdValue}-true`}
          />
          <span className={BOOLEAN_FIELD_LABEL_CLASS}>{trueLabel}</span>
        </label>
        <label className={BOOLEAN_FIELD_RADIO_CLASS}>
          <input
            type="radio"
            name={name}
            checked={!isChecked}
            onChange={() => handleRadioChange(false)}
            onBlur={handleBlur}
            disabled={readOnly || disabled}
            aria-invalid={error ? true : undefined}
            data-testid={`${testIdValue}-false`}
          />
          <span className={BOOLEAN_FIELD_LABEL_CLASS}>{falseLabel}</span>
        </label>
      </div>
    );
  }

  // Render switch toggle
  if (widgetType === "switch") {
    return (
      <div className={fieldClassName} data-field-type="boolean" data-widget="switch">
        <label className={BOOLEAN_FIELD_SWITCH_CLASS}>
          <input
            type="checkbox"
            id={inputId}
            name={name}
            checked={isChecked}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={readOnly || disabled}
            aria-invalid={error ? true : undefined}
            aria-required={isRequired || undefined}
            data-testid={testIdValue}
            className="visually-hidden"
          />
          <span
            className={BOOLEAN_FIELD_TRACK_CLASS}
            role="switch"
            aria-checked={isChecked}
            tabIndex={disabled || readOnly ? -1 : 0}
            onKeyDown={handleKeyDown}
            data-testid={`${testIdValue}-track`}
          >
            <span className={BOOLEAN_FIELD_THUMB_CLASS} />
          </span>
        </label>
      </div>
    );
  }

  // Render standard checkbox
  return (
    <div className={fieldClassName} data-field-type="boolean" data-widget="checkbox">
      <label className={BOOLEAN_FIELD_CHECKBOX_CLASS}>
        <input
          type="checkbox"
          id={inputId}
          name={name}
          checked={isChecked}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={readOnly || disabled}
          aria-invalid={error ? true : undefined}
          aria-required={isRequired || undefined}
          data-testid={testIdValue}
        />
      </label>
    </div>
  );
};

BooleanField.displayName = "BooleanField";

// =============================================================================
// Convenience Components
// =============================================================================

/**
 * CheckboxField - BooleanField configured as checkbox.
 * @param props
 */
export const CheckboxField: React.FC<BooleanFieldProps> = (props) => (
  <BooleanField {...props} widgetType="checkbox" />
);

CheckboxField.displayName = "CheckboxField";

/**
 * SwitchField - BooleanField configured as toggle switch.
 * @param props
 */
export const SwitchField: React.FC<BooleanFieldProps> = (props) => (
  <BooleanField {...props} widgetType="switch" />
);

SwitchField.displayName = "SwitchField";

/**
 * RadioBooleanField - BooleanField configured as radio buttons.
 * @param props
 */
export const RadioBooleanField: React.FC<BooleanFieldProps> = (props) => (
  <BooleanField {...props} widgetType="radio" />
);

RadioBooleanField.displayName = "RadioBooleanField";

export default BooleanField;
