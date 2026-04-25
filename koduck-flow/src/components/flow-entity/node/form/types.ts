/**
 * @file Form Schema Types
 * @description Extended type definitions for node configuration forms.
 * Provides JSON Schema-style form description types with UI widget hints.
 *
 * This module extends the base form types from flow-entity/types.ts with
 * additional UI-specific configuration options for rendering form fields.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 4.1
 * @see src/components/flow-entity/types.ts - Base FormSchema, FormFieldSchema, FormLayout
 */

import type {
  FormFieldType,
  FormFieldSchema as BaseFormFieldSchema,
  FormFieldValidation,
  FormLayout,
  FormSchema as BaseFormSchema,
} from "../../types";

// =============================================================================
// UI Widget Types
// =============================================================================

/**
 * Available UI widget types for form field rendering.
 * These map to specific React components for rendering form fields.
 *
 * @example
 * // Use a slider instead of default number input
 * const field: ExtendedFormFieldSchema = {
 *   type: 'number',
 *   'ui:widget': 'slider',
 *   'ui:options': { min: 0, max: 100, step: 1 }
 * };
 */
export type UIWidgetType =
  // Text widgets
  | "input"
  | "textarea"
  | "password"
  | "hidden"
  // Number widgets
  | "number"
  | "slider"
  | "range"
  | "updown"
  // Boolean widgets
  | "checkbox"
  | "switch"
  | "radio"
  // Selection widgets
  | "select"
  | "multiselect"
  | "checkboxes"
  | "radios"
  | "combobox"
  // Rich content widgets
  | "code"
  | "json"
  | "markdown"
  | "richtext"
  // Date/time widgets
  | "date"
  | "time"
  | "datetime"
  | "daterange"
  // Special widgets
  | "color"
  | "file"
  | "image"
  | "url"
  | "email"
  // Custom widgets
  | "custom";

/**
 * UI options for specific widget types.
 * Widget-specific configuration options.
 */
export interface UIWidgetOptions {
  /** Widget title/header text */
  title?: string;
  /** Help text shown below field */
  help?: string;
  /** CSS class name to apply */
  classNames?: string;
  /** Inline styles to apply */
  style?: Record<string, string | number>;
  /** Whether field should be auto-focused */
  autofocus?: boolean;
  /** Input element attributes */
  inputAttributes?: Record<string, string | number | boolean>;

  // Number/range specific
  /** Minimum value for number inputs */
  min?: number;
  /** Maximum value for number inputs */
  max?: number;
  /** Step increment for number inputs */
  step?: number;
  /** Show ticks on slider */
  showTicks?: boolean;
  /** Tick labels for slider */
  tickLabels?: Record<number, string>;

  // Text specific
  /** Number of rows for textarea */
  rows?: number;
  /** Number of columns for textarea */
  cols?: number;
  /** Maximum length for text inputs */
  maxLength?: number;
  /** Input mask pattern */
  mask?: string;

  // Select specific
  /** Placeholder text for empty selection */
  emptyText?: string;
  /** Enable search/filter for select options */
  searchable?: boolean;
  /** Allow clearing selection */
  clearable?: boolean;
  /** Maximum number of selected items (multiselect) */
  maxItems?: number;
  /** Group options by category */
  groupBy?: string;

  // Code editor specific
  /** Programming language for syntax highlighting */
  language?: string;
  /** Line numbers display */
  lineNumbers?: boolean;
  /** Word wrap mode */
  wordWrap?: boolean;
  /** Editor height */
  editorHeight?: number | string;
  /** Read-only code view */
  readOnlyCode?: boolean;

  // File specific
  /** Accepted file types (MIME types or extensions) */
  accept?: string;
  /** Allow multiple file selection */
  multiple?: boolean;
  /** Maximum file size in bytes */
  maxFileSize?: number;
  /** Show file preview */
  showPreview?: boolean;

  // Layout specific
  /** Display field inline with label */
  inline?: boolean;
  /** Column span in grid layout */
  colSpan?: 1 | 2 | 3 | 4;
  /** Order within the form */
  order?: number;

  // Custom widget specific
  /** Custom component name to use */
  component?: string;
  /** Custom component props */
  componentProps?: Record<string, unknown>;
}

// =============================================================================
// Extended Form Field Schema
// =============================================================================

/**
 * Extended form field schema with UI widget configuration.
 * Extends the base FormFieldSchema with ui:* properties for widget customization.
 *
 * @example
 * const nameField: ExtendedFormFieldSchema = {
 *   type: 'text',
 *   label: 'Name',
 *   placeholder: 'Enter your name',
 *   'ui:widget': 'input',
 *   'ui:options': {
 *     autofocus: true,
 *     maxLength: 100
 *   },
 *   validation: {
 *     required: true,
 *     min: 2
 *   }
 * };
 */
export interface ExtendedFormFieldSchema extends BaseFormFieldSchema {
  /**
   * UI widget type to use for rendering this field.
   * If not specified, the widget is inferred from the field type.
   */
  "ui:widget"?: UIWidgetType;

  /**
   * Widget-specific options for customizing field rendering.
   */
  "ui:options"?: UIWidgetOptions;

  /**
   * Whether the field should be rendered in read-only mode.
   * Overrides form-level readOnly setting.
   */
  "ui:readonly"?: boolean;

  /**
   * Whether the field should be disabled.
   * Overrides form-level disabled setting.
   */
  "ui:disabled"?: boolean;

  /**
   * Custom CSS class names for the field wrapper.
   */
  "ui:classNames"?: string;

  /**
   * Title text shown above the field (alternative to label).
   */
  "ui:title"?: string;

  /**
   * Description text shown below the field.
   */
  "ui:description"?: string;

  /**
   * Help text shown in a tooltip or popover.
   */
  "ui:help"?: string;

  /**
   * Placeholder text for the input field.
   */
  "ui:placeholder"?: string;

  /**
   * Field order for automatic layout.
   * Lower numbers appear first.
   */
  "ui:order"?: number;

  /**
   * Auto-focus this field when form renders.
   */
  "ui:autofocus"?: boolean;

  /**
   * Enum labels for select fields (maps values to display labels).
   * Alternative to using options array.
   */
  "ui:enumNames"?: string[];
}

// =============================================================================
// Extended Form Schema
// =============================================================================

/**
 * Extended form schema with UI configuration.
 * Extends the base FormSchema with ui:* properties at the schema level.
 */
export interface ExtendedFormSchema extends Omit<BaseFormSchema, "properties"> {
  /** Extended field definitions keyed by field name */
  properties: Record<string, ExtendedFormFieldSchema>;

  /**
   * Order of fields in the form.
   * Fields not in this array are displayed at the end in their original order.
   */
  "ui:order"?: string[];

  /**
   * Root-level CSS class names.
   */
  "ui:classNames"?: string;

  /**
   * Form submit button configuration.
   */
  "ui:submitButton"?: {
    text?: string;
    disabled?: boolean;
    hidden?: boolean;
  };

  /**
   * Form-level options.
   */
  "ui:options"?: {
    /** Submit form on field change */
    submitOnChange?: boolean;
    /** Show field labels */
    showLabels?: boolean;
    /** Show required field indicators */
    showRequired?: boolean;
    /** Label position */
    labelPosition?: "top" | "left" | "inline";
    /** Compact mode with reduced spacing */
    compact?: boolean;
  };
}

// =============================================================================
// Field Props Interface
// =============================================================================

/**
 * Props interface for form field components.
 * This is the standard interface that all field renderer components should implement.
 *
 * @template T - The type of the field value
 *
 * @example
 * const StringField: React.FC<FieldProps<string>> = ({
 *   schema,
 *   value,
 *   onChange,
 *   readOnly,
 *   disabled,
 *   error
 * }) => {
 *   return (
 *     <input
 *       type="text"
 *       value={value ?? ''}
 *       onChange={(e) => onChange(e.target.value)}
 *       readOnly={readOnly}
 *       disabled={disabled}
 *       placeholder={schema.placeholder}
 *     />
 *   );
 * };
 */
export interface FieldProps<T = unknown> {
  /** The field schema definition */
  schema: ExtendedFormFieldSchema;

  /** The field name/key in the form data */
  name: string;

  /** Current field value */
  value: T;

  /** Callback when field value changes */
  onChange: (value: T) => void;

  /** Callback when field loses focus (for validation) */
  onBlur?: () => void;

  /** Whether the field is read-only */
  readOnly?: boolean;

  /** Whether the field is disabled */
  disabled?: boolean;

  /** Validation error message */
  error?: string;

  /** Additional CSS class name */
  className?: string;

  /** Test ID for testing */
  testId?: string;

  /** Path to this field in nested form data */
  path?: string;

  /** Form context for accessing other field values */
  formContext?: FormContext;
}

/**
 * Form context provided to field components for accessing form-level state.
 */
export interface FormContext {
  /** All form data */
  formData: Record<string, unknown>;

  /** All form errors */
  errors: Record<string, string>;

  /** Form-level read-only state */
  readOnly?: boolean;

  /** Form-level disabled state */
  disabled?: boolean;

  /** Root form schema */
  schema: ExtendedFormSchema;

  /** Get value of another field */
  getValue: (name: string) => unknown;

  /** Set value of another field */
  setValue: (name: string, value: unknown) => void;
}

// =============================================================================
// Field Renderer Types
// =============================================================================

/**
 * Type for a field renderer component.
 */
export type FieldRenderer<T = unknown> = React.ComponentType<FieldProps<T>>;

/**
 * Registry of field renderers keyed by field type or widget type.
 */
export type FieldRendererRegistry = Record<string, FieldRenderer>;

/**
 * Configuration for a field renderer.
 */
export interface FieldRendererConfig {
  /** The renderer component */
  component: FieldRenderer;
  /** Default widget type for this renderer */
  defaultWidget?: UIWidgetType;
  /** Supported field types */
  supportedTypes?: FormFieldType[];
}

// =============================================================================
// Validation Types
// =============================================================================

/**
 * Extended validation configuration.
 */
export interface ExtendedFormFieldValidation extends FormFieldValidation {
  /** Custom async validator function */
  asyncValidator?: string;
  /** Validate on change (default: true) */
  validateOnChange?: boolean;
  /** Validate on blur (default: true) */
  validateOnBlur?: boolean;
  /** Debounce validation in milliseconds */
  debounce?: number;
}

/**
 * Validation result for a single field.
 */
export interface FieldValidationResult {
  /** Whether the field is valid */
  valid: boolean;
  /** Error message if invalid */
  error?: string;
  /** Warning message (field is valid but has issues) */
  warning?: string;
}

/**
 * Validation result for the entire form.
 */
export interface FormValidationResult {
  /** Whether the form is valid */
  valid: boolean;
  /** Errors keyed by field name */
  errors: Record<string, string>;
  /** Warnings keyed by field name */
  warnings: Record<string, string>;
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if a schema is an extended form schema.
 * @param schema
 */
export function isExtendedFormSchema(
  schema: BaseFormSchema | ExtendedFormSchema
): schema is ExtendedFormSchema {
  return (
    "ui:order" in schema ||
    "ui:options" in schema ||
    "ui:classNames" in schema ||
    "ui:submitButton" in schema
  );
}

/**
 * Type guard to check if a field schema is an extended field schema.
 * @param schema
 */
export function isExtendedFieldSchema(
  schema: BaseFormFieldSchema | ExtendedFormFieldSchema
): schema is ExtendedFormFieldSchema {
  return (
    "ui:widget" in schema ||
    "ui:options" in schema ||
    "ui:readonly" in schema ||
    "ui:disabled" in schema ||
    "ui:classNames" in schema ||
    "ui:title" in schema ||
    "ui:description" in schema ||
    "ui:help" in schema ||
    "ui:placeholder" in schema ||
    "ui:order" in schema ||
    "ui:autofocus" in schema ||
    "ui:enumNames" in schema
  );
}

// =============================================================================
// Re-exports from base types
// =============================================================================

export type {
  FormFieldType,
  FormFieldValidation,
  FormLayout,
  FormSchema as BaseFormSchema,
  FormFieldSchema as BaseFormFieldSchema,
};
