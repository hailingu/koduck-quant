/**
 * @file NumberField Component
 * @description Form field component for numeric input with support for
 * min/max bounds, step increments, slider mode, and up/down controls.
 *
 * @see docs/design/flow-entity-step-plan-en.md Tasks 4.3-4.7
 */

import React, { useCallback, useId, useMemo } from "react";
import type { FieldProps, ExtendedFormFieldSchema, UIWidgetOptions } from "./types";

// =============================================================================
// Constants
// =============================================================================

/** Base CSS class for number field */
export const NUMBER_FIELD_CLASS = "flow-node-form-number-field";

/** CSS class for different input types */
export const NUMBER_FIELD_INPUT_CLASS = `${NUMBER_FIELD_CLASS}__input`;
export const NUMBER_FIELD_SLIDER_CLASS = `${NUMBER_FIELD_CLASS}__slider`;
export const NUMBER_FIELD_UPDOWN_CLASS = `${NUMBER_FIELD_CLASS}__updown`;
export const NUMBER_FIELD_BUTTON_CLASS = `${NUMBER_FIELD_CLASS}__button`;
export const NUMBER_FIELD_VALUE_CLASS = `${NUMBER_FIELD_CLASS}__value`;

/** CSS class modifiers */
export const NUMBER_FIELD_READONLY_CLASS = `${NUMBER_FIELD_CLASS}--readonly`;
export const NUMBER_FIELD_DISABLED_CLASS = `${NUMBER_FIELD_CLASS}--disabled`;
export const NUMBER_FIELD_ERROR_CLASS = `${NUMBER_FIELD_CLASS}--error`;
export const NUMBER_FIELD_REQUIRED_CLASS = `${NUMBER_FIELD_CLASS}--required`;

/** Default step value */
const DEFAULT_STEP = 1;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Determines the widget type from schema.
 * @param schema - Field schema
 * @returns Widget type: 'number', 'slider', 'range', or 'updown'
 */
function getWidgetType(schema: ExtendedFormFieldSchema): "number" | "slider" | "range" | "updown" {
  const widget = schema["ui:widget"];

  if (widget === "slider" || widget === "range" || schema.type === "range") {
    return "slider";
  }
  if (widget === "updown") {
    return "updown";
  }
  return "number";
}

/**
 * Gets numeric constraints from schema.
 * @param schema - Field schema
 * @param options - UI options
 * @returns Numeric constraints
 */
function getConstraints(
  schema: ExtendedFormFieldSchema,
  options: UIWidgetOptions
): { min?: number; max?: number; step: number } {
  const min = options.min ?? schema.validation?.min;
  const max = options.max ?? schema.validation?.max;
  const step = options.step ?? DEFAULT_STEP;
  return {
    ...(min === undefined ? {} : { min }),
    ...(max === undefined ? {} : { max }),
    step,
  };
}

/**
 * Clamps a value within bounds.
 * @param value - Value to clamp
 * @param min - Minimum bound (optional)
 * @param max - Maximum bound (optional)
 * @returns Clamped value
 */
function clampValue(value: number, min?: number, max?: number): number {
  let result = value;
  if (min !== undefined && result < min) result = min;
  if (max !== undefined && result > max) result = max;
  return result;
}

/**
 * Parses a string value to number, returning 0 for invalid input.
 * @param str - String to parse
 * @returns Parsed number
 */
function parseNumber(str: string): number {
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
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
// NumberField Component
// =============================================================================

/**
 * Props for the NumberField component.
 */
export interface NumberFieldProps extends FieldProps<number> {
  /** Optional widget type override */
  widgetType?: "number" | "slider" | "range" | "updown";
}

/**
 * NumberField renders a numeric input with optional slider or up/down controls.
 *
 * Features:
 * - Standard number input with spin buttons
 * - Slider/range input mode
 * - Up/down button controls
 * - Min/max bounds enforcement
 * - Step increment configuration
 * - Read-only and disabled states
 *
 * @example
 * // Basic number input
 * <NumberField
 *   schema={{
 *     type: 'number',
 *     label: 'Quantity',
 *     validation: { min: 0, max: 100 }
 *   }}
 *   name="quantity"
 *   value={0}
 *   onChange={(value) => console.log(value)}
 * />
 *
 * @example
 * // Slider mode
 * <NumberField
 *   schema={{
 *     type: 'number',
 *     'ui:widget': 'slider',
 *     'ui:options': { min: 0, max: 100, step: 5 }
 *   }}
 *   name="percentage"
 *   value={50}
 *   onChange={(value) => console.log(value)}
 * />
 */
export const NumberField: React.FC<NumberFieldProps> = ({
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
}) => {
  // Generate unique ID for label association
  const uniqueId = useId();
  const inputId = `field-${name}-${uniqueId}`;

  // Get UI options
  const options = useMemo(() => getOptions(schema), [schema]);

  // Determine widget type
  const widgetType = widgetTypeProp ?? getWidgetType(schema);

  // Get constraints
  const { min, max, step } = useMemo(() => getConstraints(schema, options), [schema, options]);

  // Check if required
  const isRequired = Boolean(schema.validation?.required);

  // Build class name
  const fieldClassName = useMemo(() => {
    const classes = [NUMBER_FIELD_CLASS];
    if (readOnly) classes.push(NUMBER_FIELD_READONLY_CLASS);
    if (disabled) classes.push(NUMBER_FIELD_DISABLED_CLASS);
    if (error) classes.push(NUMBER_FIELD_ERROR_CLASS);
    if (isRequired) classes.push(NUMBER_FIELD_REQUIRED_CLASS);
    if (className) classes.push(className);
    return classes.join(" ");
  }, [readOnly, disabled, error, isRequired, className]);

  // Handle value change
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = parseNumber(e.target.value);
      const clampedValue = clampValue(newValue, min, max);
      onChange(clampedValue);
    },
    [onChange, min, max]
  );

  // Handle blur
  const handleBlur = useCallback(() => {
    onBlur?.();
  }, [onBlur]);

  // Handle increment/decrement for updown widget
  const handleIncrement = useCallback(() => {
    const newValue = (value ?? 0) + step;
    const clampedValue = clampValue(newValue, min, max);
    onChange(clampedValue);
  }, [value, step, min, max, onChange]);

  const handleDecrement = useCallback(() => {
    const newValue = (value ?? 0) - step;
    const clampedValue = clampValue(newValue, min, max);
    onChange(clampedValue);
  }, [value, step, min, max, onChange]);

  // Common props for input
  const commonProps = {
    id: inputId,
    name,
    value: value ?? 0,
    onChange: handleChange,
    onBlur: handleBlur,
    step,
    readOnly,
    disabled,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${inputId}-error` : undefined,
    "aria-required": isRequired || undefined,
    "data-testid": testId ?? `number-field-${name}`,
    ...(min === undefined ? {} : { min }),
    ...(max === undefined ? {} : { max }),
  };

  // Render slider
  if (widgetType === "slider") {
    return (
      <div className={fieldClassName} data-field-type="number" data-widget="slider">
        <input {...commonProps} type="range" className={NUMBER_FIELD_SLIDER_CLASS} />
        <span
          className={NUMBER_FIELD_VALUE_CLASS}
          data-testid={`${testId ?? `number-field-${name}`}-value`}
        >
          {value ?? 0}
        </span>
      </div>
    );
  }

  // Render updown
  if (widgetType === "updown") {
    return (
      <div className={fieldClassName} data-field-type="number" data-widget="updown">
        <div className={NUMBER_FIELD_UPDOWN_CLASS}>
          <button
            type="button"
            className={NUMBER_FIELD_BUTTON_CLASS}
            onClick={handleDecrement}
            disabled={disabled || readOnly || (min !== undefined && (value ?? 0) <= min)}
            data-testid={`${testId ?? `number-field-${name}`}-decrement`}
            aria-label="Decrease value"
          >
            −
          </button>
          <input {...commonProps} type="number" className={NUMBER_FIELD_INPUT_CLASS} />
          <button
            type="button"
            className={NUMBER_FIELD_BUTTON_CLASS}
            onClick={handleIncrement}
            disabled={disabled || readOnly || (max !== undefined && (value ?? 0) >= max)}
            data-testid={`${testId ?? `number-field-${name}`}-increment`}
            aria-label="Increase value"
          >
            +
          </button>
        </div>
      </div>
    );
  }

  // Render standard number input
  return (
    <div className={fieldClassName} data-field-type="number" data-widget="number">
      <input {...commonProps} type="number" className={NUMBER_FIELD_INPUT_CLASS} />
    </div>
  );
};

NumberField.displayName = "NumberField";

// =============================================================================
// Convenience Components
// =============================================================================

/**
 * SliderField - NumberField configured as slider.
 * @param props
 */
export const SliderField: React.FC<NumberFieldProps> = (props) => (
  <NumberField {...props} widgetType="slider" />
);

SliderField.displayName = "SliderField";

/**
 * RangeField - Alias for SliderField.
 * @param props
 */
export const RangeField: React.FC<NumberFieldProps> = (props) => (
  <NumberField {...props} widgetType="slider" />
);

RangeField.displayName = "RangeField";

/**
 * UpDownField - NumberField with increment/decrement buttons.
 * @param props
 */
export const UpDownField: React.FC<NumberFieldProps> = (props) => (
  <NumberField {...props} widgetType="updown" />
);

UpDownField.displayName = "UpDownField";

export default NumberField;
