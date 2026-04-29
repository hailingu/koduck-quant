/**
 * @file SelectField Component
 * @description Form field component for single and multi-select dropdowns
 * with support for searchable options, option groups, and custom rendering.
 *
 * @see docs/design/flow-entity-step-plan-en.md Tasks 4.3-4.7
 */

import React, { useCallback, useId, useMemo, useState } from "react";
import type { FieldProps, ExtendedFormFieldSchema, UIWidgetOptions } from "./types";
import type { FormFieldOption } from "../../types";

// =============================================================================
// Constants
// =============================================================================

/** Base CSS class for select field */
export const SELECT_FIELD_CLASS = "flow-node-form-select-field";

/** CSS class for different variants */
export const SELECT_FIELD_SELECT_CLASS = `${SELECT_FIELD_CLASS}__select`;
export const SELECT_FIELD_OPTION_CLASS = `${SELECT_FIELD_CLASS}__option`;
export const SELECT_FIELD_OPTGROUP_CLASS = `${SELECT_FIELD_CLASS}__optgroup`;
export const SELECT_FIELD_SEARCH_CLASS = `${SELECT_FIELD_CLASS}__search`;
export const SELECT_FIELD_CLEAR_CLASS = `${SELECT_FIELD_CLASS}__clear`;
export const SELECT_FIELD_TAGS_CLASS = `${SELECT_FIELD_CLASS}__tags`;
export const SELECT_FIELD_TAG_CLASS = `${SELECT_FIELD_CLASS}__tag`;

/** CSS class modifiers */
export const SELECT_FIELD_MULTI_CLASS = `${SELECT_FIELD_CLASS}--multi`;
export const SELECT_FIELD_SEARCHABLE_CLASS = `${SELECT_FIELD_CLASS}--searchable`;
export const SELECT_FIELD_READONLY_CLASS = `${SELECT_FIELD_CLASS}--readonly`;
export const SELECT_FIELD_DISABLED_CLASS = `${SELECT_FIELD_CLASS}--disabled`;
export const SELECT_FIELD_ERROR_CLASS = `${SELECT_FIELD_CLASS}--error`;
export const SELECT_FIELD_REQUIRED_CLASS = `${SELECT_FIELD_CLASS}--required`;
export const SELECT_FIELD_OPEN_CLASS = `${SELECT_FIELD_CLASS}--open`;

// =============================================================================
// Types
// =============================================================================

/**
 * Option with optional group for organizing options.
 */
export interface GroupedOption extends FormFieldOption {
  /** Group name for organizing options */
  group?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Gets options from schema, including enum-based options.
 * @param schema - Field schema
 * @returns Array of options
 */
function getOptions(schema: ExtendedFormFieldSchema): FormFieldOption[] {
  // Use options array if provided
  if (schema.options && schema.options.length > 0) {
    return schema.options;
  }

  // Convert enum to options
  if (schema.enum) {
    const enumNames = schema["ui:enumNames"];
    return schema.enum.map((value, index) => ({
      value,
      label: enumNames?.[index] ?? String(value),
    }));
  }

  return [];
}

/**
 * Gets UI options with defaults.
 * @param schema - Field schema
 * @returns UI options
 */
function getUIOptions(schema: ExtendedFormFieldSchema): UIWidgetOptions {
  return schema["ui:options"] ?? {};
}

/**
 * Checks if widget is multiselect.
 * @param schema - Field schema
 * @returns True if multiselect
 */
function isMultiSelect(schema: ExtendedFormFieldSchema): boolean {
  const widget = schema["ui:widget"];
  return widget === "multiselect" || widget === "checkboxes" || schema.type === "multiselect";
}

/**
 * Groups options by their group property.
 * @param options - Options to group
 * @param groupBy - Group by property name
 * @returns Map of group name to options
 */
function groupOptions(options: GroupedOption[], groupBy?: string): Map<string, FormFieldOption[]> {
  const groups = new Map<string, FormFieldOption[]>();

  if (!groupBy) {
    groups.set("", options as FormFieldOption[]);
    return groups;
  }

  for (const option of options) {
    const groupName = option.group ?? "";
    if (!groups.has(groupName)) {
      groups.set(groupName, []);
    }
    groups.get(groupName)!.push(option);
  }

  return groups;
}

// =============================================================================
// SelectField Component
// =============================================================================

/**
 * Props for the SelectField component.
 */
export interface SelectFieldProps extends FieldProps<string | string[]> {
  /** Whether this is a multi-select */
  multiple?: boolean;
}

/**
 * SelectField renders a dropdown select or multi-select.
 *
 * Features:
 * - Single and multi-select modes
 * - Option groups
 * - Searchable options (filter while typing)
 * - Clearable selection
 * - Placeholder support
 * - Enum-based options
 * - Read-only and disabled states
 *
 * @example
 * // Single select with options
 * <SelectField
 *   schema={{
 *     type: 'select',
 *     label: 'Status',
 *     options: [
 *       { value: 'active', label: 'Active' },
 *       { value: 'inactive', label: 'Inactive' }
 *     ]
 *   }}
 *   name="status"
 *   value=""
 *   onChange={(value) => console.log(value)}
 * />
 *
 * @example
 * // Multi-select with enum
 * <SelectField
 *   schema={{
 *     type: 'select',
 *     'ui:widget': 'multiselect',
 *     enum: ['red', 'green', 'blue'],
 *     'ui:enumNames': ['Red', 'Green', 'Blue']
 *   }}
 *   name="colors"
 *   value={[]}
 *   onChange={(value) => console.log(value)}
 * />
 */
export const SelectField: React.FC<SelectFieldProps> = ({
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
  multiple: multipleProp,
}) => {
  // Generate unique ID for label association
  const uniqueId = useId();
  const inputId = `field-${name}-${uniqueId}`;

  // State for search filtering
  const [searchText, setSearchText] = useState("");

  // Get options
  const options = useMemo(() => getOptions(schema), [schema]);
  const uiOptions = useMemo(() => getUIOptions(schema), [schema]);

  // Determine if multi-select
  const isMulti = multipleProp ?? isMultiSelect(schema);

  // Get configuration
  const searchable = Boolean(uiOptions.searchable);
  const clearable = Boolean(uiOptions.clearable);
  const placeholder = schema["ui:placeholder"] ?? schema.placeholder ?? "Select...";

  // Check if required
  const isRequired = Boolean(schema.validation?.required);

  // Filter options based on search text
  const filteredOptions = useMemo(() => {
    if (!searchText || !searchable) {
      return options;
    }
    const lowerSearch = searchText.toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(lowerSearch));
  }, [options, searchText, searchable]);

  // Group options if configured
  const groupedOptions = useMemo(
    () => groupOptions(filteredOptions as GroupedOption[], uiOptions.groupBy),
    [filteredOptions, uiOptions.groupBy]
  );

  // Build class name
  const fieldClassName = useMemo(() => {
    const classes = [SELECT_FIELD_CLASS];
    if (isMulti) classes.push(SELECT_FIELD_MULTI_CLASS);
    if (searchable) classes.push(SELECT_FIELD_SEARCHABLE_CLASS);
    if (readOnly) classes.push(SELECT_FIELD_READONLY_CLASS);
    if (disabled) classes.push(SELECT_FIELD_DISABLED_CLASS);
    if (error) classes.push(SELECT_FIELD_ERROR_CLASS);
    if (isRequired) classes.push(SELECT_FIELD_REQUIRED_CLASS);
    if (className) classes.push(className);
    return classes.join(" ");
  }, [isMulti, searchable, readOnly, disabled, error, isRequired, className]);

  // Handle single select change
  const handleSingleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  // Handle multi-select change
  const handleMultiChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const selectedOptions = Array.from(e.target.selectedOptions).map((opt) => opt.value);
      onChange(selectedOptions);
    },
    [onChange]
  );

  // Handle clear
  const handleClear = useCallback(() => {
    if (isMulti) {
      onChange([]);
    } else {
      onChange("");
    }
  }, [isMulti, onChange]);

  // Handle blur
  const handleBlur = useCallback(() => {
    onBlur?.();
  }, [onBlur]);

  // Handle search input
  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  }, []);

  // Get current value for display
  const currentValue = isMulti ? (Array.isArray(value) ? value : []) : ((value as string) ?? "");

  // Check if has value for clearable
  const hasValue = isMulti ? (currentValue as string[]).length > 0 : Boolean(currentValue);

  // Test ID
  const testIdValue = testId ?? `select-field-${name}`;

  // Render options with grouping
  const renderOptions = () => {
    const elements: React.ReactNode[] = [];

    // Add placeholder option for single select
    if (!isMulti && !isRequired) {
      elements.push(
        <option key="__placeholder__" value="" className={SELECT_FIELD_OPTION_CLASS}>
          {placeholder}
        </option>
      );
    }

    // Render grouped or flat options
    for (const [groupName, groupOpts] of groupedOptions) {
      if (groupName) {
        elements.push(
          <optgroup key={groupName} label={groupName} className={SELECT_FIELD_OPTGROUP_CLASS}>
            {groupOpts.map((opt) => (
              <option
                key={String(opt.value)}
                value={opt.value}
                disabled={opt.disabled}
                className={SELECT_FIELD_OPTION_CLASS}
              >
                {opt.label}
              </option>
            ))}
          </optgroup>
        );
      } else {
        elements.push(
          ...groupOpts.map((opt) => (
            <option
              key={String(opt.value)}
              value={opt.value}
              disabled={opt.disabled}
              className={SELECT_FIELD_OPTION_CLASS}
            >
              {opt.label}
            </option>
          ))
        );
      }
    }

    return elements;
  };

  // Render selected tags for multi-select
  const renderTags = () => {
    if (!isMulti || !(currentValue as string[]).length) {
      return null;
    }

    return (
      <div className={SELECT_FIELD_TAGS_CLASS} data-testid={`${testIdValue}-tags`}>
        {(currentValue as string[]).map((val) => {
          const option = options.find((opt) => opt.value === val);
          return (
            <span
              key={val}
              className={SELECT_FIELD_TAG_CLASS}
              data-testid={`${testIdValue}-tag-${val}`}
            >
              {option?.label ?? val}
              {!readOnly && !disabled && (
                <button
                  type="button"
                  onClick={() => {
                    const newValue = (currentValue as string[]).filter((v) => v !== val);
                    onChange(newValue);
                  }}
                  aria-label={`Remove ${option?.label ?? val}`}
                  data-testid={`${testIdValue}-remove-${val}`}
                >
                  ×
                </button>
              )}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className={fieldClassName} data-field-type="select">
      {/* Search input for searchable select */}
      {searchable && (
        <input
          type="text"
          value={searchText}
          onChange={handleSearch}
          placeholder="Search..."
          className={SELECT_FIELD_SEARCH_CLASS}
          disabled={disabled || readOnly}
          data-testid={`${testIdValue}-search`}
        />
      )}

      {/* Tags for multi-select */}
      {renderTags()}

      {/* Select element */}
      <select
        id={inputId}
        name={name}
        value={currentValue}
        onChange={isMulti ? handleMultiChange : handleSingleChange}
        onBlur={handleBlur}
        multiple={isMulti}
        disabled={readOnly || disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        aria-required={isRequired || undefined}
        data-testid={testIdValue}
        className={SELECT_FIELD_SELECT_CLASS}
      >
        {renderOptions()}
      </select>

      {/* Clear button */}
      {clearable && hasValue && !readOnly && !disabled && (
        <button
          type="button"
          onClick={handleClear}
          className={SELECT_FIELD_CLEAR_CLASS}
          aria-label="Clear selection"
          data-testid={`${testIdValue}-clear`}
        >
          ×
        </button>
      )}
    </div>
  );
};

SelectField.displayName = "SelectField";

// =============================================================================
// Convenience Components
// =============================================================================

/**
 * MultiSelectField - SelectField configured for multi-select.
 * @param props
 */
export const MultiSelectField: React.FC<SelectFieldProps> = (props) => (
  <SelectField {...props} multiple />
);

MultiSelectField.displayName = "MultiSelectField";

/**
 * CheckboxesField - Multi-select rendered as checkboxes.
 */
export const CheckboxesField: React.FC<SelectFieldProps> = ({
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
}) => {
  const options = useMemo(() => getOptions(schema), [schema]);
  const currentValue = Array.isArray(value) ? value : [];
  const isRequired = Boolean(schema.validation?.required);
  const testIdValue = testId ?? `checkboxes-field-${name}`;

  const fieldClassName = useMemo(() => {
    const classes = [SELECT_FIELD_CLASS, `${SELECT_FIELD_CLASS}--checkboxes`];
    if (readOnly) classes.push(SELECT_FIELD_READONLY_CLASS);
    if (disabled) classes.push(SELECT_FIELD_DISABLED_CLASS);
    if (error) classes.push(SELECT_FIELD_ERROR_CLASS);
    if (isRequired) classes.push(SELECT_FIELD_REQUIRED_CLASS);
    if (className) classes.push(className);
    return classes.join(" ");
  }, [readOnly, disabled, error, isRequired, className]);

  const handleChange = useCallback(
    (optionValue: string | number | boolean, checked: boolean) => {
      const stringValue = String(optionValue);
      let newValue: string[];
      if (checked) {
        newValue = [...currentValue, stringValue];
      } else {
        newValue = currentValue.filter((v) => v !== stringValue);
      }
      onChange(newValue);
    },
    [currentValue, onChange]
  );

  return (
    <div
      className={fieldClassName}
      data-field-type="select"
      data-widget="checkboxes"
      role="group"
      aria-required={isRequired || undefined}
      data-testid={testIdValue}
    >
      {options.map((opt) => {
        const isChecked = currentValue.includes(String(opt.value));
        return (
          <label key={String(opt.value)} className={`${SELECT_FIELD_CLASS}__checkbox-option`}>
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => handleChange(opt.value, e.target.checked)}
              onBlur={onBlur}
              disabled={readOnly || disabled || opt.disabled}
              data-testid={`${testIdValue}-${opt.value}`}
            />
            <span>{opt.label}</span>
          </label>
        );
      })}
    </div>
  );
};

CheckboxesField.displayName = "CheckboxesField";

/**
 * RadiosField - Single select rendered as radio buttons.
 */
export const RadiosField: React.FC<SelectFieldProps> = ({
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
}) => {
  const options = useMemo(() => getOptions(schema), [schema]);
  const currentValue = (value as string) ?? "";
  const isRequired = Boolean(schema.validation?.required);
  const testIdValue = testId ?? `radios-field-${name}`;

  const fieldClassName = useMemo(() => {
    const classes = [SELECT_FIELD_CLASS, `${SELECT_FIELD_CLASS}--radios`];
    if (readOnly) classes.push(SELECT_FIELD_READONLY_CLASS);
    if (disabled) classes.push(SELECT_FIELD_DISABLED_CLASS);
    if (error) classes.push(SELECT_FIELD_ERROR_CLASS);
    if (isRequired) classes.push(SELECT_FIELD_REQUIRED_CLASS);
    if (className) classes.push(className);
    return classes.join(" ");
  }, [readOnly, disabled, error, isRequired, className]);

  const handleChange = useCallback(
    (optionValue: string | number | boolean) => {
      onChange(String(optionValue));
    },
    [onChange]
  );

  return (
    <div
      className={fieldClassName}
      data-field-type="select"
      data-widget="radios"
      role="radiogroup"
      aria-required={isRequired || undefined}
      data-testid={testIdValue}
    >
      {options.map((opt) => {
        const isChecked = currentValue === String(opt.value);
        return (
          <label key={String(opt.value)} className={`${SELECT_FIELD_CLASS}__radio-option`}>
            <input
              type="radio"
              name={name}
              checked={isChecked}
              onChange={() => handleChange(opt.value)}
              onBlur={onBlur}
              disabled={readOnly || disabled || opt.disabled}
              data-testid={`${testIdValue}-${opt.value}`}
            />
            <span>{opt.label}</span>
          </label>
        );
      })}
    </div>
  );
};

RadiosField.displayName = "RadiosField";

export default SelectField;
