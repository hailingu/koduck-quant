/**
 * @file Field Wrapper Component
 * @description Provides a unified layout wrapper for form fields.
 * Handles label, description, error display, and layout positioning.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 4.2
 */

import React, { useMemo } from "react";
import type { ExtendedFormFieldSchema } from "./types";
import { getFieldLabel, getFieldDescription, isFieldRequired } from "./form-utils";

// =============================================================================
// Types
// =============================================================================

/**
 * Props for the FieldWrapper component.
 */
export interface FieldWrapperProps {
  /** The field schema */
  schema: ExtendedFormFieldSchema;
  /** The field name */
  name: string;
  /** Children to render (the actual field input) */
  children: React.ReactNode;
  /** Validation error message */
  error?: string;
  /** Whether the form is in compact mode */
  compact?: boolean;
  /** Label position override */
  labelPosition?: "top" | "left" | "inline";
  /** Additional CSS class name */
  className?: string;
  /** Test ID for testing */
  testId?: string;
  /** Whether to hide the label */
  hideLabel?: boolean;
}

// =============================================================================
// CSS Class Names
// =============================================================================

/** Base CSS class for field wrapper */
export const FIELD_WRAPPER_CLASS = "flow-node-form-field";

/** CSS class for compact mode */
export const FIELD_WRAPPER_COMPACT_CLASS = "flow-node-form-field--compact";

/** CSS class for field with error */
export const FIELD_WRAPPER_ERROR_CLASS = "flow-node-form-field--error";

/** CSS class for required field */
export const FIELD_WRAPPER_REQUIRED_CLASS = "flow-node-form-field--required";

/** CSS class for field label */
export const FIELD_LABEL_CLASS = "flow-node-form-field__label";

/** CSS class for field input container */
export const FIELD_INPUT_CLASS = "flow-node-form-field__input";

/** CSS class for field description */
export const FIELD_DESCRIPTION_CLASS = "flow-node-form-field__description";

/** CSS class for field error message */
export const FIELD_ERROR_CLASS = "flow-node-form-field__error";

// =============================================================================
// Component
// =============================================================================

/**
 * FieldWrapper provides a unified layout for form fields.
 * It handles:
 * - Label rendering with required indicator
 * - Description text
 * - Error message display
 * - Layout positioning (top, left, inline)
 * - Compact mode
 *
 * @example
 * <FieldWrapper schema={fieldSchema} name="email" error={errors.email}>
 *   <input type="email" value={value} onChange={handleChange} />
 * </FieldWrapper>
 */
export const FieldWrapper: React.FC<FieldWrapperProps> = ({
  schema,
  name,
  children,
  error,
  compact = false,
  labelPosition = "top",
  className,
  testId,
  hideLabel = false,
}) => {
  // Compute label and description
  const label = useMemo(() => getFieldLabel(schema, name), [schema, name]);
  const description = useMemo(() => getFieldDescription(schema), [schema]);
  const required = useMemo(() => isFieldRequired(schema), [schema]);

  // Build class names
  const wrapperClassName = useMemo(() => {
    const classes = [FIELD_WRAPPER_CLASS];
    classes.push(`${FIELD_WRAPPER_CLASS}--${labelPosition}`);

    if (compact) {
      classes.push(FIELD_WRAPPER_COMPACT_CLASS);
    }
    if (error) {
      classes.push(FIELD_WRAPPER_ERROR_CLASS);
    }
    if (required) {
      classes.push(FIELD_WRAPPER_REQUIRED_CLASS);
    }
    if (className) {
      classes.push(className);
    }

    return classes.join(" ");
  }, [labelPosition, compact, error, required, className]);

  // Hidden fields don't need a wrapper
  if (schema.hidden || schema["ui:widget"] === "hidden") {
    return <>{children}</>;
  }

  return (
    <div
      className={wrapperClassName}
      data-testid={testId ?? `field-wrapper-${name}`}
      data-field-name={name}
    >
      {!hideLabel && label && (
        <label
          className={FIELD_LABEL_CLASS}
          htmlFor={`field-${name}`}
          data-testid={`field-label-${name}`}
        >
          {label}
          {required && (
            <span className={`${FIELD_LABEL_CLASS}--required`} aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      <div className={FIELD_INPUT_CLASS}>{children}</div>

      {description && !compact && (
        <div className={FIELD_DESCRIPTION_CLASS} data-testid={`field-description-${name}`}>
          {description}
        </div>
      )}

      {error && (
        <div className={FIELD_ERROR_CLASS} role="alert" data-testid={`field-error-${name}`}>
          {error}
        </div>
      )}
    </div>
  );
};

FieldWrapper.displayName = "FieldWrapper";

export default FieldWrapper;
