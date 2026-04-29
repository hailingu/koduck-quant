/**
 * @file ArrayField Component
 * @description Form field component for array values with support for
 * adding, removing, and reordering items. Supports primitive arrays
 * and can nest other field types for complex item rendering.
 *
 * @see docs/design/flow-entity-step-plan-en.md Tasks 4.3-4.7
 */

import React, { useCallback, useId, useMemo } from "react";
import type { FieldProps, ExtendedFormFieldSchema, UIWidgetOptions } from "./types";

// =============================================================================
// Constants
// =============================================================================

/** Base CSS class for array field */
export const ARRAY_FIELD_CLASS = "flow-node-form-array-field";

/** CSS class for array components */
export const ARRAY_FIELD_LIST_CLASS = `${ARRAY_FIELD_CLASS}__list`;
export const ARRAY_FIELD_ITEM_CLASS = `${ARRAY_FIELD_CLASS}__item`;
export const ARRAY_FIELD_ITEM_CONTENT_CLASS = `${ARRAY_FIELD_CLASS}__item-content`;
export const ARRAY_FIELD_ITEM_ACTIONS_CLASS = `${ARRAY_FIELD_CLASS}__item-actions`;
export const ARRAY_FIELD_ADD_BUTTON_CLASS = `${ARRAY_FIELD_CLASS}__add-button`;
export const ARRAY_FIELD_REMOVE_BUTTON_CLASS = `${ARRAY_FIELD_CLASS}__remove-button`;
export const ARRAY_FIELD_MOVE_BUTTON_CLASS = `${ARRAY_FIELD_CLASS}__move-button`;
export const ARRAY_FIELD_EMPTY_CLASS = `${ARRAY_FIELD_CLASS}__empty`;

/** CSS class modifiers */
export const ARRAY_FIELD_READONLY_CLASS = `${ARRAY_FIELD_CLASS}--readonly`;
export const ARRAY_FIELD_DISABLED_CLASS = `${ARRAY_FIELD_CLASS}--disabled`;
export const ARRAY_FIELD_ERROR_CLASS = `${ARRAY_FIELD_CLASS}--error`;
export const ARRAY_FIELD_REQUIRED_CLASS = `${ARRAY_FIELD_CLASS}--required`;
export const ARRAY_FIELD_ORDERABLE_CLASS = `${ARRAY_FIELD_CLASS}--orderable`;

// =============================================================================
// Types
// =============================================================================

/**
 * Props for rendering an individual array item.
 */
export interface ArrayItemRenderProps<T = unknown> {
  /** Item value */
  value: T;
  /** Item index */
  index: number;
  /** Change handler for this item */
  onChange: (value: T) => void;
  /** Remove handler for this item */
  onRemove: () => void;
  /** Move item up handler */
  onMoveUp?: () => void;
  /** Move item down handler */
  onMoveDown?: () => void;
  /** Whether item is read-only */
  readOnly: boolean;
  /** Whether item is disabled */
  disabled: boolean;
  /** Error message for this item */
  error?: string;
  /** Test ID for the item */
  testId: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Gets default value for new array items based on item schema.
 * @param itemSchema - Schema for array items (optional)
 * @returns Default value for new items
 */
function getDefaultItemValue(itemSchema?: ExtendedFormFieldSchema): unknown {
  if (!itemSchema) {
    return "";
  }

  switch (itemSchema.type) {
    case "number":
    case "range":
      return 0;
    case "boolean":
      return false;
    case "select":
      return itemSchema.options?.[0]?.value ?? "";
    case "multiselect":
      return [];
    default:
      return itemSchema.default ?? "";
  }
}

/**
 * Gets UI options with defaults.
 * @param schema - Field schema
 * @returns UI options
 */
function getUIOptions(schema: ExtendedFormFieldSchema): UIWidgetOptions {
  return schema["ui:options"] ?? {};
}

// =============================================================================
// Default Item Renderer
// =============================================================================

/**
 * Default renderer for primitive array items (strings).
 */
const DefaultItemRenderer: React.FC<ArrayItemRenderProps<string>> = ({
  value,
  index,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  readOnly,
  disabled,
  error,
  testId,
}) => (
  <div className={ARRAY_FIELD_ITEM_CLASS} data-testid={testId}>
    <div className={ARRAY_FIELD_ITEM_CONTENT_CLASS}>
      <input
        type="text"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        data-testid={`${testId}-input`}
      />
    </div>
    <div className={ARRAY_FIELD_ITEM_ACTIONS_CLASS}>
      {onMoveUp && (
        <button
          type="button"
          onClick={onMoveUp}
          disabled={disabled || readOnly}
          className={ARRAY_FIELD_MOVE_BUTTON_CLASS}
          aria-label={`Move item ${index + 1} up`}
          data-testid={`${testId}-move-up`}
        >
          ↑
        </button>
      )}
      {onMoveDown && (
        <button
          type="button"
          onClick={onMoveDown}
          disabled={disabled || readOnly}
          className={ARRAY_FIELD_MOVE_BUTTON_CLASS}
          aria-label={`Move item ${index + 1} down`}
          data-testid={`${testId}-move-down`}
        >
          ↓
        </button>
      )}
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled || readOnly}
        className={ARRAY_FIELD_REMOVE_BUTTON_CLASS}
        aria-label={`Remove item ${index + 1}`}
        data-testid={`${testId}-remove`}
      >
        ×
      </button>
    </div>
  </div>
);

DefaultItemRenderer.displayName = "DefaultItemRenderer";

// =============================================================================
// ArrayField Component
// =============================================================================

/**
 * Props for the ArrayField component.
 */
export interface ArrayFieldProps<T = unknown> extends FieldProps<T[]> {
  /** Custom renderer for array items */
  itemRenderer?: React.FC<ArrayItemRenderProps<T>>;
  /** Schema for array items */
  itemSchema?: ExtendedFormFieldSchema;
  /** Whether items can be reordered */
  orderable?: boolean;
  /** Minimum number of items */
  minItems?: number;
  /** Maximum number of items */
  maxItems?: number;
  /** Label for add button */
  addButtonLabel?: string;
  /** Empty state message */
  emptyMessage?: string;
}

/**
 * ArrayField renders a list of items with add/remove controls.
 *
 * Features:
 * - Add new items with default values
 * - Remove individual items
 * - Reorder items (move up/down)
 * - Min/max item constraints
 * - Custom item renderer support
 * - Empty state display
 * - Read-only and disabled states
 *
 * @example
 * // Simple string array
 * <ArrayField
 *   schema={{ type: 'array', label: 'Tags' }}
 *   name="tags"
 *   value={['tag1', 'tag2']}
 *   onChange={(value) => console.log(value)}
 * />
 *
 * @example
 * // With custom renderer and constraints
 * <ArrayField
 *   schema={{ type: 'array', label: 'Items' }}
 *   name="items"
 *   value={[]}
 *   onChange={(value) => console.log(value)}
 *   orderable={true}
 *   minItems={1}
 *   maxItems={5}
 *   itemRenderer={CustomItemRenderer}
 * />
 */
export function ArrayField<T = string>({
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
  itemRenderer,
  itemSchema,
  orderable = false,
  minItems = 0,
  maxItems,
  addButtonLabel = "Add Item",
  emptyMessage = "No items",
}: ArrayFieldProps<T>): React.ReactElement {
  // Generate unique ID for accessibility
  const uniqueId = useId();
  const fieldId = `field-${name}-${uniqueId}`;

  // Get UI options
  const uiOptions = useMemo(() => getUIOptions(schema), [schema]);

  // Normalize value to array
  const items = useMemo(() => {
    if (Array.isArray(value)) return value;
    return [];
  }, [value]);

  // Check constraints
  const canAdd = maxItems === undefined || items.length < maxItems;
  const canRemove = items.length > minItems;

  // Check if required
  const isRequired = Boolean(schema.validation?.required) || minItems > 0;

  // Build class name
  const fieldClassName = useMemo(() => {
    const classes = [ARRAY_FIELD_CLASS];
    if (orderable) classes.push(ARRAY_FIELD_ORDERABLE_CLASS);
    if (readOnly) classes.push(ARRAY_FIELD_READONLY_CLASS);
    if (disabled) classes.push(ARRAY_FIELD_DISABLED_CLASS);
    if (error) classes.push(ARRAY_FIELD_ERROR_CLASS);
    if (isRequired) classes.push(ARRAY_FIELD_REQUIRED_CLASS);
    if (className) classes.push(className);
    return classes.join(" ");
  }, [orderable, readOnly, disabled, error, isRequired, className]);

  // Handle add item
  const handleAdd = useCallback(() => {
    if (!canAdd || readOnly || disabled) return;
    const defaultValue = getDefaultItemValue(itemSchema) as T;
    onChange([...items, defaultValue]);
  }, [canAdd, readOnly, disabled, itemSchema, items, onChange]);

  // Handle remove item
  const handleRemove = useCallback(
    (index: number) => {
      if (!canRemove || readOnly || disabled) return;
      const newItems = [...items];
      newItems.splice(index, 1);
      onChange(newItems);
    },
    [canRemove, readOnly, disabled, items, onChange]
  );

  // Handle change item
  const handleItemChange = useCallback(
    (index: number, itemValue: T) => {
      const newItems = [...items];
      newItems[index] = itemValue;
      onChange(newItems);
    },
    [items, onChange]
  );

  // Handle move item up
  const handleMoveUp = useCallback(
    (index: number) => {
      if (index <= 0 || readOnly || disabled) return;
      const newItems = [...items];
      [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
      onChange(newItems);
    },
    [items, readOnly, disabled, onChange]
  );

  // Handle move item down
  const handleMoveDown = useCallback(
    (index: number) => {
      if (index >= items.length - 1 || readOnly || disabled) return;
      const newItems = [...items];
      [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
      onChange(newItems);
    },
    [items, readOnly, disabled, onChange]
  );

  // Handle blur
  const handleBlur = useCallback(() => {
    onBlur?.();
  }, [onBlur]);

  // Test ID
  const testIdValue = testId ?? `array-field-${name}`;

  // Use custom or default item renderer
  const ItemRenderer = (itemRenderer ?? DefaultItemRenderer) as React.FC<ArrayItemRenderProps<T>>;

  return (
    <div
      className={fieldClassName}
      data-field-type="array"
      id={fieldId}
      aria-required={isRequired || undefined}
      data-testid={testIdValue}
      onBlur={handleBlur}
    >
      {/* Item list */}
      <div className={ARRAY_FIELD_LIST_CLASS} data-testid={`${testIdValue}-list`}>
        {items.length === 0 ? (
          <div className={ARRAY_FIELD_EMPTY_CLASS} data-testid={`${testIdValue}-empty`}>
            {emptyMessage}
          </div>
        ) : (
          items.map((item, index) => (
            <ItemRenderer
              key={index}
              value={item}
              index={index}
              onChange={(newValue) => handleItemChange(index, newValue)}
              onRemove={() => handleRemove(index)}
              onMoveUp={orderable && index > 0 ? () => handleMoveUp(index) : undefined}
              onMoveDown={
                orderable && index < items.length - 1 ? () => handleMoveDown(index) : undefined
              }
              readOnly={readOnly}
              disabled={disabled}
              error={error}
              testId={`${testIdValue}-item-${index}`}
            />
          ))
        )}
      </div>

      {/* Add button */}
      {!readOnly && !disabled && canAdd && (
        <button
          type="button"
          onClick={handleAdd}
          disabled={disabled || readOnly || !canAdd}
          className={ARRAY_FIELD_ADD_BUTTON_CLASS}
          data-testid={`${testIdValue}-add`}
        >
          {addButtonLabel}
        </button>
      )}
    </div>
  );
}

ArrayField.displayName = "ArrayField";

export default ArrayField;
