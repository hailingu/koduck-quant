/**
 * @file Form Module Index
 * @description Exports for the form schema types and utilities module.
 *
 * This module provides:
 * - Extended form schema types with UI widget configuration
 * - FieldProps interface for field renderer components
 * - Utility functions for working with form schemas and data
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 4.1
 */

// =============================================================================
// Type Exports
// =============================================================================

export type {
  // Base types (re-exported)
  FormFieldType,
  FormFieldValidation,
  FormLayout,
  BaseFormSchema,
  BaseFormFieldSchema,
  // UI widget types
  UIWidgetType,
  UIWidgetOptions,
  // Extended schema types
  ExtendedFormFieldSchema,
  ExtendedFormSchema,
  ExtendedFormFieldValidation,
  // Field component types
  FieldProps,
  FormContext,
  FieldRenderer,
  FieldRendererRegistry,
  FieldRendererConfig,
  // Validation types
  FieldValidationResult,
  FormValidationResult,
} from "./types";

// =============================================================================
// Type Guard Exports
// =============================================================================

export { isExtendedFormSchema, isExtendedFieldSchema } from "./types";

// =============================================================================
// Utility Function Exports
// =============================================================================

export {
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
} from "./form-utils";

// =============================================================================
// Component Exports
// =============================================================================

export {
  FlowNodeForm,
  default as FlowNodeFormDefault,
  PlaceholderField,
  defaultFieldRenderers,
  type FlowNodeFormProps,
  FORM_CLASS,
  FORM_COMPACT_CLASS,
  FORM_READONLY_CLASS,
  FORM_DISABLED_CLASS,
  FORM_FIELDS_CLASS,
} from "./FlowNodeForm";

export {
  FieldWrapper,
  default as FieldWrapperDefault,
  type FieldWrapperProps,
  FIELD_WRAPPER_CLASS,
  FIELD_WRAPPER_COMPACT_CLASS,
  FIELD_WRAPPER_ERROR_CLASS,
  FIELD_WRAPPER_REQUIRED_CLASS,
  FIELD_LABEL_CLASS,
  FIELD_INPUT_CLASS,
  FIELD_DESCRIPTION_CLASS,
  FIELD_ERROR_CLASS,
} from "./FieldWrapper";

// Field Components
export {
  StringField,
  STRING_FIELD_CLASS,
  STRING_FIELD_INPUT_CLASS,
  STRING_FIELD_TEXTAREA_CLASS,
  STRING_FIELD_READONLY_CLASS,
  STRING_FIELD_DISABLED_CLASS,
  STRING_FIELD_ERROR_CLASS,
  STRING_FIELD_REQUIRED_CLASS,
} from "./StringField";

export {
  NumberField,
  NUMBER_FIELD_CLASS,
  NUMBER_FIELD_SLIDER_CLASS,
  NUMBER_FIELD_UPDOWN_CLASS,
  NUMBER_FIELD_READONLY_CLASS,
  NUMBER_FIELD_DISABLED_CLASS,
  NUMBER_FIELD_ERROR_CLASS,
  NUMBER_FIELD_REQUIRED_CLASS,
} from "./NumberField";

export {
  BooleanField,
  BOOLEAN_FIELD_CLASS,
  BOOLEAN_FIELD_SWITCH_CLASS,
  BOOLEAN_FIELD_RADIO_CLASS,
  BOOLEAN_FIELD_READONLY_CLASS,
  BOOLEAN_FIELD_DISABLED_CLASS,
  BOOLEAN_FIELD_ERROR_CLASS,
  BOOLEAN_FIELD_REQUIRED_CLASS,
} from "./BooleanField";

export {
  SelectField,
  MultiSelectField,
  CheckboxesField,
  RadiosField,
  SELECT_FIELD_CLASS,
  SELECT_FIELD_MULTI_CLASS,
  SELECT_FIELD_SEARCHABLE_CLASS,
  SELECT_FIELD_READONLY_CLASS,
  SELECT_FIELD_DISABLED_CLASS,
  SELECT_FIELD_ERROR_CLASS,
  SELECT_FIELD_REQUIRED_CLASS,
} from "./SelectField";

export {
  ArrayField,
  ARRAY_FIELD_CLASS,
  ARRAY_FIELD_LIST_CLASS,
  ARRAY_FIELD_ITEM_CLASS,
  ARRAY_FIELD_ITEM_CONTENT_CLASS,
  ARRAY_FIELD_ITEM_ACTIONS_CLASS,
  ARRAY_FIELD_ADD_BUTTON_CLASS,
  ARRAY_FIELD_REMOVE_BUTTON_CLASS,
  ARRAY_FIELD_MOVE_BUTTON_CLASS,
  ARRAY_FIELD_EMPTY_CLASS,
  ARRAY_FIELD_READONLY_CLASS,
  ARRAY_FIELD_DISABLED_CLASS,
  ARRAY_FIELD_ERROR_CLASS,
  ARRAY_FIELD_REQUIRED_CLASS,
  ARRAY_FIELD_ORDERABLE_CLASS,
} from "./ArrayField";

// =============================================================================
// Validation Exports
// =============================================================================

export {
  // Core validation functions
  validate,
  validateFieldValue,
  validateSingleField,
  // Utility functions
  isEmpty,
  formatMessage,
  getErrorMessage,
  getFieldPath,
  isValid,
  getFieldError,
  createValidator,
  toFormValidationResult,
  // Types
  type ValidationError,
  type ValidationRule,
  type ValidateOptions,
  type ValidationResult,
  // Constants
  DEFAULT_ERROR_MESSAGES,
} from "./validation";
