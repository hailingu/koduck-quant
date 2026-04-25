/**
 * @file useFlowNode Hook
 * @description React hook to encapsulate common flow node view state and behavior.
 * Provides position, size, selection state, and wrapped handlers for node interactions.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 2.1
 */

import { useCallback, useMemo, useState } from "react";
import type { FlowNodeEntity } from "../../../common/flow/flow-node-entity";
import type { Position, Size } from "../types";

// =============================================================================
// Types
// =============================================================================

/**
 * Options for configuring the useFlowNode hook
 */
export interface UseFlowNodeOptions {
  /**
   * Initial selection state
   * @default false
   */
  selected?: boolean;

  /**
   * Callback when the node is selected
   */
  onSelect?: (entity: FlowNodeEntity) => void;

  /**
   * Callback when the node is moved to a new position
   */
  onMove?: (entity: FlowNodeEntity, position: Position) => void;

  /**
   * Callback when the node is resized
   */
  onResize?: (entity: FlowNodeEntity, size: Size) => void;

  /**
   * Callback when a port connection is initiated
   */
  onPortConnect?: (entity: FlowNodeEntity, portId: string) => void;

  /**
   * Callback when form values change
   */
  onFormChange?: (entity: FlowNodeEntity, values: Record<string, unknown>) => void;

  /**
   * Whether to use local selection state
   * If false, only uses the `selected` prop without local state
   * @default false
   */
  useLocalSelection?: boolean;
}

/**
 * Return value of the useFlowNode hook
 */
export interface UseFlowNodeResult {
  /** Current node position (from entity data) */
  position: Position;

  /** Current node size (with defaults applied) */
  size: Size;

  /** Whether the node is currently selected */
  isSelected: boolean;

  /** Whether the node is disabled */
  isDisabled: boolean;

  /** Current execution state */
  executionState: string;

  /** Node label */
  label: string;

  /**
   * Handler to select the node
   * Updates local state (if enabled) and calls the onSelect callback
   */
  handleSelect: () => void;

  /**
   * Handler to move the node to a new position
   * Updates entity data and calls the onMove callback
   */
  handleMove: (newPosition: Position) => void;

  /**
   * Handler to resize the node
   * Updates entity data and calls the onResize callback
   */
  handleResize: (newSize: Size) => void;

  /**
   * Handler to initiate a port connection
   * Calls the onPortConnect callback
   */
  handlePortConnect: (portId: string) => void;

  /**
   * Handler for form value changes
   * Updates entity form data and calls the onFormChange callback
   */
  handleFormChange: (values: Record<string, unknown>) => void;

  /**
   * Toggle selection state (for local selection mode)
   */
  toggleSelect: () => void;

  /**
   * Set selection state explicitly (for local selection mode)
   */
  setSelected: (selected: boolean) => void;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Default node dimensions when not specified in entity data
 */
const DEFAULT_WIDTH = 200;
const DEFAULT_HEIGHT = 100;

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * useFlowNode - Hook for managing flow node view state and interactions
 *
 * Encapsulates common node state and behavior:
 * - Position and size from entity data
 * - Selection state (local or controlled)
 * - Wrapped handlers that update entity and call callbacks
 *
 * @param entity - The FlowNodeEntity to manage
 * @param options - Configuration options for the hook
 * @returns Object containing node state and handlers
 *
 * @example Basic usage
 * ```tsx
 * const { position, size, isSelected, handleSelect, handleMove } = useFlowNode(entity, {
 *   selected: isNodeSelected,
 *   onSelect: (entity) => dispatch({ type: 'SELECT_NODE', id: entity.id }),
 *   onMove: (entity, pos) => dispatch({ type: 'MOVE_NODE', id: entity.id, position: pos }),
 * });
 * ```
 *
 * @example With local selection state
 * ```tsx
 * const { isSelected, handleSelect, toggleSelect } = useFlowNode(entity, {
 *   useLocalSelection: true,
 *   onSelect: (entity) => console.log('Selected:', entity.id),
 * });
 * ```
 */
export function useFlowNode(
  entity: FlowNodeEntity,
  options: UseFlowNodeOptions = {}
): UseFlowNodeResult {
  const {
    selected = false,
    onSelect,
    onMove,
    onResize,
    onPortConnect,
    onFormChange,
    useLocalSelection = false,
  } = options;

  // Local selection state (used when useLocalSelection is true)
  const [localSelected, setLocalSelected] = useState(selected);

  // Local size state for triggering re-renders during resize
  const initialSize = entity.data?.size ?? { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
  const [localSize, setLocalSize] = useState<Size>(initialSize);

  // Determine effective selection state
  const isSelected = useLocalSelection ? localSelected : selected;

  // Extract entity data with safe access
  const data = entity.data;

  // Memoized position from entity data
  const position = useMemo<Position>(() => data?.position ?? { x: 0, y: 0 }, [data?.position]);

  // Use local size state (updated during resize) for rendering
  const size = localSize;

  // Other entity properties
  const isDisabled = data?.disabled ?? false;
  const executionState = data?.executionState ?? "idle";
  const label = data?.label ?? "";

  // Handler: Select the node
  const handleSelect = useCallback(() => {
    if (isDisabled) return;

    if (useLocalSelection) {
      setLocalSelected(true);
    }
    onSelect?.(entity);
  }, [entity, isDisabled, useLocalSelection, onSelect]);

  // Handler: Toggle selection state
  const toggleSelect = useCallback(() => {
    if (isDisabled) return;

    if (useLocalSelection) {
      setLocalSelected((prev) => !prev);
    }
    onSelect?.(entity);
  }, [entity, isDisabled, useLocalSelection, onSelect]);

  // Handler: Set selection state explicitly
  const setSelected = useCallback(
    (newSelected: boolean) => {
      if (useLocalSelection) {
        setLocalSelected(newSelected);
      }
    },
    [useLocalSelection]
  );

  // Handler: Move the node to a new position
  const handleMove = useCallback(
    (newPosition: Position) => {
      if (isDisabled) return;

      // Update entity data
      entity.setPosition(newPosition);

      // Call external callback
      onMove?.(entity, newPosition);
    },
    [entity, isDisabled, onMove]
  );

  // Handler: Resize the node
  const handleResize = useCallback(
    (newSize: Size) => {
      if (isDisabled) return;

      // Update local state to trigger re-render
      setLocalSize(newSize);

      // Update entity data
      entity.setSize(newSize);

      // Call external callback
      onResize?.(entity, newSize);
    },
    [entity, isDisabled, onResize]
  );

  // Handler: Initiate port connection
  const handlePortConnect = useCallback(
    (portId: string) => {
      if (isDisabled) return;

      onPortConnect?.(entity, portId);
    },
    [entity, isDisabled, onPortConnect]
  );

  // Handler: Form value changes
  const handleFormChange = useCallback(
    (values: Record<string, unknown>) => {
      if (isDisabled) return;

      // Update entity form data
      entity.updateFormData(values);

      // Call external callback
      onFormChange?.(entity, values);
    },
    [entity, isDisabled, onFormChange]
  );

  return {
    position,
    size,
    isSelected,
    isDisabled,
    executionState,
    label,
    handleSelect,
    handleMove,
    handleResize,
    handlePortConnect,
    handleFormChange,
    toggleSelect,
    setSelected,
  };
}

// Default export for convenience
export default useFlowNode;
