/**
 * @file useSelection Hook and Selection Context
 * @description React hook and context for managing selection state of flow nodes and edges.
 * Supports single-select, multi-select (Shift/Cmd/Ctrl), toggle, and range selection.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 2.4
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// =============================================================================
// Types
// =============================================================================

/**
 * Selection state structure
 */
export interface SelectionState {
  /** Set of selected entity IDs (nodes and edges) */
  selectedIds: Set<string>;
  /** Currently focused entity ID (for keyboard navigation) */
  focusedId: string | null;
  /** Last selected entity ID (for range selection) */
  lastSelectedId: string | null;
}

/**
 * Options for the select operation
 */
export interface SelectOptions {
  /**
   * Whether to enable multi-select mode.
   * When true, the selection is toggled/added rather than replaced.
   * @default false
   */
  multi?: boolean;

  /**
   * Whether to toggle the selection state.
   * When true with multi=true, clicking a selected item deselects it.
   * @default true (when multi is true)
   */
  toggle?: boolean;
}

/**
 * Selection context value provided by SelectionProvider
 */
export interface SelectionContextValue {
  /** Current selection state */
  state: SelectionState;

  /**
   * Select a single entity, replacing current selection
   * @param id - Entity ID to select
   */
  selectOne: (id: string) => void;

  /**
   * Toggle selection of an entity
   * @param id - Entity ID to toggle
   */
  toggle: (id: string) => void;

  /**
   * Select multiple entities (e.g., for box selection)
   * @param ids - Array of entity IDs to select
   * @param additive - If true, add to current selection; if false, replace
   */
  selectRange: (ids: string[], additive?: boolean) => void;

  /**
   * Clear all selections
   */
  clearSelection: () => void;

  /**
   * Check if an entity is selected
   * @param id - Entity ID to check
   * @returns true if the entity is selected
   */
  isSelected: (id: string) => boolean;

  /**
   * Select an entity with options (handles multi-select logic)
   * @param id - Entity ID to select
   * @param options - Selection options
   */
  select: (id: string, options?: SelectOptions) => void;

  /**
   * Set the focused entity (for keyboard navigation)
   * @param id - Entity ID to focus, or null to clear focus
   */
  setFocused: (id: string | null) => void;

  /**
   * Get all selected entity IDs as an array
   * @returns Array of selected entity IDs
   */
  getSelectedIds: () => string[];

  /**
   * Get the count of selected entities
   * @returns Number of selected entities
   */
  getSelectionCount: () => number;
}

/**
 * Props for the SelectionProvider component
 */
export interface SelectionProviderProps {
  /** Child components */
  children: ReactNode;

  /** Initial selected IDs */
  initialSelectedIds?: string[];

  /** Callback when selection changes */
  onSelectionChange?: (selectedIds: string[]) => void;

  /** Whether selection is disabled */
  disabled?: boolean;
}

/**
 * Options for the useSelection hook
 */
export interface UseSelectionOptions {
  /** Entity ID to check/manage selection for */
  entityId?: string;

  /** Callback when this entity's selection state changes */
  onSelect?: (selected: boolean) => void;
}

/**
 * Return value of the useSelection hook
 */
export interface UseSelectionResult {
  /** Whether the entity (if entityId provided) is selected */
  isSelected: boolean;

  /** Whether any entities are selected */
  hasSelection: boolean;

  /** Number of selected entities */
  selectionCount: number;

  /** Array of all selected entity IDs */
  selectedIds: string[];

  /** Currently focused entity ID */
  focusedId: string | null;

  /**
   * Select the current entity or a specific entity
   * @param idOrOptions - Entity ID or selection options
   * @param options - Selection options (if first param is ID)
   */
  select: (idOrOptions?: string | SelectOptions, options?: SelectOptions) => void;

  /**
   * Toggle selection of the current entity or a specific entity
   * @param id - Entity ID to toggle (uses entityId if not provided)
   */
  toggle: (id?: string) => void;

  /**
   * Clear all selections
   */
  clearSelection: () => void;

  /**
   * Check if a specific entity is selected
   * @param id - Entity ID to check
   */
  checkSelected: (id: string) => boolean;

  /**
   * Select multiple entities
   * @param ids - Entity IDs to select
   * @param additive - If true, add to current selection
   */
  selectRange: (ids: string[], additive?: boolean) => void;
}

// =============================================================================
// Context
// =============================================================================

/**
 * React Context for selection state management
 */
const SelectionContext = createContext<SelectionContextValue | undefined>(undefined);

SelectionContext.displayName = "SelectionContext";

// =============================================================================
// Initial State
// =============================================================================

/**
 * Create initial selection state
 */
function createInitialState(initialSelectedIds?: string[]): SelectionState {
  return {
    selectedIds: new Set(initialSelectedIds ?? []),
    focusedId: null,
    lastSelectedId: initialSelectedIds?.[initialSelectedIds.length - 1] ?? null,
  };
}

// =============================================================================
// Selection Provider
// =============================================================================

/**
 * SelectionProvider - Provides selection context to child components
 *
 * Manages selection state for flow nodes and edges:
 * - Single-select: clicking replaces selection
 * - Multi-select: Shift/Cmd/Ctrl + click adds to selection
 * - Toggle: clicking a selected item can deselect it
 * - Range select: for box selection or programmatic multi-select
 *
 * @example
 * ```tsx
 * <SelectionProvider onSelectionChange={(ids) => console.log('Selected:', ids)}>
 *   <FlowCanvas>
 *     <BaseFlowNode entity={node1} />
 *     <BaseFlowNode entity={node2} />
 *   </FlowCanvas>
 * </SelectionProvider>
 * ```
 */
export const SelectionProvider: React.FC<SelectionProviderProps> = ({
  children,
  initialSelectedIds,
  onSelectionChange,
  disabled = false,
}) => {
  const [state, setState] = useState<SelectionState>(() => createInitialState(initialSelectedIds));

  /**
   * Notify selection change
   */
  const notifyChange = useCallback(
    (newSelectedIds: Set<string>) => {
      onSelectionChange?.(Array.from(newSelectedIds));
    },
    [onSelectionChange]
  );

  /**
   * Select a single entity, replacing current selection
   */
  const selectOne = useCallback(
    (id: string) => {
      if (disabled) return;

      setState(() => {
        const newSelectedIds = new Set([id]);
        notifyChange(newSelectedIds);
        return {
          selectedIds: newSelectedIds,
          focusedId: id,
          lastSelectedId: id,
        };
      });
    },
    [disabled, notifyChange]
  );

  /**
   * Toggle selection of an entity
   */
  const toggle = useCallback(
    (id: string) => {
      if (disabled) return;

      setState((prev) => {
        const newSelectedIds = new Set(prev.selectedIds);
        if (newSelectedIds.has(id)) {
          newSelectedIds.delete(id);
        } else {
          newSelectedIds.add(id);
        }
        notifyChange(newSelectedIds);
        return {
          selectedIds: newSelectedIds,
          focusedId: id,
          lastSelectedId: id,
        };
      });
    },
    [disabled, notifyChange]
  );

  /**
   * Select multiple entities (for box selection)
   */
  const selectRange = useCallback(
    (ids: string[], additive: boolean = false) => {
      if (disabled) return;

      setState((prev) => {
        const newSelectedIds = additive ? new Set([...prev.selectedIds, ...ids]) : new Set(ids);
        notifyChange(newSelectedIds);
        return {
          selectedIds: newSelectedIds,
          focusedId: ids[ids.length - 1] ?? prev.focusedId,
          lastSelectedId: ids[ids.length - 1] ?? prev.lastSelectedId,
        };
      });
    },
    [disabled, notifyChange]
  );

  /**
   * Clear all selections
   */
  const clearSelection = useCallback(() => {
    if (disabled) return;

    setState((prev) => {
      if (prev.selectedIds.size === 0) return prev;
      notifyChange(new Set());
      return {
        selectedIds: new Set(),
        focusedId: null,
        lastSelectedId: null,
      };
    });
  }, [disabled, notifyChange]);

  /**
   * Check if an entity is selected
   */
  const isSelected = useCallback(
    (id: string): boolean => {
      return state.selectedIds.has(id);
    },
    [state.selectedIds]
  );

  /**
   * Select with options (handles multi-select logic)
   */
  const select = useCallback(
    (id: string, options: SelectOptions = {}) => {
      if (disabled) return;

      const { multi = false, toggle: shouldToggle = true } = options;

      if (multi) {
        if (shouldToggle) {
          toggle(id);
        } else {
          // Add to selection without toggle
          setState((prev) => {
            const newSelectedIds = new Set(prev.selectedIds);
            newSelectedIds.add(id);
            notifyChange(newSelectedIds);
            return {
              selectedIds: newSelectedIds,
              focusedId: id,
              lastSelectedId: id,
            };
          });
        }
      } else {
        selectOne(id);
      }
    },
    [disabled, toggle, selectOne, notifyChange]
  );

  /**
   * Set the focused entity
   */
  const setFocused = useCallback((id: string | null) => {
    setState((prev) => ({
      ...prev,
      focusedId: id,
    }));
  }, []);

  /**
   * Get all selected IDs as array
   */
  const getSelectedIds = useCallback((): string[] => {
    return Array.from(state.selectedIds);
  }, [state.selectedIds]);

  /**
   * Get selection count
   */
  const getSelectionCount = useCallback((): number => {
    return state.selectedIds.size;
  }, [state.selectedIds]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo<SelectionContextValue>(
    () => ({
      state,
      selectOne,
      toggle,
      selectRange,
      clearSelection,
      isSelected,
      select,
      setFocused,
      getSelectedIds,
      getSelectionCount,
    }),
    [
      state,
      selectOne,
      toggle,
      selectRange,
      clearSelection,
      isSelected,
      select,
      setFocused,
      getSelectedIds,
      getSelectionCount,
    ]
  );

  return <SelectionContext.Provider value={contextValue}>{children}</SelectionContext.Provider>;
};

// =============================================================================
// Context Hook
// =============================================================================

/**
 * useSelectionContext - Access the selection context directly
 *
 * @throws Error if used outside of SelectionProvider
 * @returns SelectionContextValue
 *
 * @example
 * ```tsx
 * const { selectOne, isSelected, clearSelection } = useSelectionContext();
 * ```
 */
export function useSelectionContext(): SelectionContextValue {
  const context = useContext(SelectionContext);
  if (context === undefined) {
    throw new Error("useSelectionContext must be used within a SelectionProvider");
  }
  return context;
}

/**
 * useSelectionContextOptional - Access the selection context optionally
 *
 * Returns undefined if used outside of SelectionProvider instead of throwing.
 * Useful for components that can work with or without selection management.
 *
 * @returns SelectionContextValue | undefined
 */
export function useSelectionContextOptional(): SelectionContextValue | undefined {
  return useContext(SelectionContext);
}

// =============================================================================
// Main Hook
// =============================================================================

/**
 * useSelection - Hook for managing entity selection
 *
 * Provides selection functionality for a specific entity or general selection operations:
 * - Check if current entity is selected
 * - Select/deselect entities with single or multi-select
 * - Access selection state and counts
 *
 * @param options - Configuration options
 * @returns Selection state and handlers
 *
 * @example Basic usage with entity
 * ```tsx
 * const { isSelected, select, toggle } = useSelection({ entityId: node.id });
 *
 * return (
 *   <div
 *     onClick={(e) => select({ multi: e.shiftKey || e.metaKey })}
 *     className={isSelected ? 'selected' : ''}
 *   >
 *     Node content
 *   </div>
 * );
 * ```
 *
 * @example General selection management
 * ```tsx
 * const { selectedIds, clearSelection, selectRange } = useSelection();
 *
 * // Clear all selections
 * clearSelection();
 *
 * // Select multiple items (e.g., from box selection)
 * selectRange(['node1', 'node2', 'node3']);
 * ```
 */
export function useSelection(options: UseSelectionOptions = {}): UseSelectionResult {
  const { entityId, onSelect } = options;
  const context = useSelectionContextOptional();

  // Local state for when context is not available
  const [localSelectedIds, setLocalSelectedIds] = useState<Set<string>>(new Set());
  const [localFocusedId, setLocalFocusedId] = useState<string | null>(null);

  // Use context if available, otherwise use local state
  const selectedIds = context
    ? Array.from(context.state.selectedIds)
    : Array.from(localSelectedIds);

  const focusedId = context ? context.state.focusedId : localFocusedId;

  const isSelected = useMemo(() => {
    if (!entityId) return false;
    return context ? context.isSelected(entityId) : localSelectedIds.has(entityId);
  }, [context, entityId, localSelectedIds]);

  const hasSelection = useMemo(() => {
    return context ? context.state.selectedIds.size > 0 : localSelectedIds.size > 0;
  }, [context, localSelectedIds]);

  const selectionCount = useMemo(() => {
    return context ? context.state.selectedIds.size : localSelectedIds.size;
  }, [context, localSelectedIds]);

  /**
   * Select handler - supports both context and local mode
   */
  const select = useCallback(
    (idOrOptions?: string | SelectOptions, opts?: SelectOptions) => {
      let id: string;
      let options: SelectOptions;

      if (typeof idOrOptions === "string") {
        id = idOrOptions;
        options = opts ?? {};
      } else {
        id = entityId ?? "";
        options = idOrOptions ?? {};
      }

      if (!id) return;

      if (context) {
        context.select(id, options);
      } else {
        // Local mode
        const { multi = false, toggle: shouldToggle = true } = options;

        setLocalSelectedIds((prev) => {
          const newSet = new Set(prev);
          if (multi) {
            if (shouldToggle && newSet.has(id)) {
              newSet.delete(id);
            } else {
              newSet.add(id);
            }
          } else {
            newSet.clear();
            newSet.add(id);
          }
          return newSet;
        });
        setLocalFocusedId(id);
      }

      // Notify callback if entity selection changed
      if (entityId && id === entityId) {
        const wasSelected = context ? context.isSelected(entityId) : localSelectedIds.has(entityId);
        const willBeSelected = !wasSelected || options.multi === false;
        if (wasSelected !== willBeSelected) {
          onSelect?.(willBeSelected);
        }
      }
    },
    [context, entityId, localSelectedIds, onSelect]
  );

  /**
   * Toggle handler
   */
  const toggle = useCallback(
    (id?: string) => {
      const targetId = id ?? entityId;
      if (!targetId) return;

      if (context) {
        context.toggle(targetId);
      } else {
        setLocalSelectedIds((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(targetId)) {
            newSet.delete(targetId);
          } else {
            newSet.add(targetId);
          }
          return newSet;
        });
        setLocalFocusedId(targetId);
      }

      // Notify callback
      if (entityId && targetId === entityId) {
        const wasSelected = context ? context.isSelected(entityId) : localSelectedIds.has(entityId);
        onSelect?.(!wasSelected);
      }
    },
    [context, entityId, localSelectedIds, onSelect]
  );

  /**
   * Clear selection
   */
  const clearSelection = useCallback(() => {
    if (context) {
      context.clearSelection();
    } else {
      setLocalSelectedIds(new Set());
      setLocalFocusedId(null);
    }

    // Notify if this entity was selected
    if (entityId) {
      const wasSelected = context ? context.isSelected(entityId) : localSelectedIds.has(entityId);
      if (wasSelected) {
        onSelect?.(false);
      }
    }
  }, [context, entityId, localSelectedIds, onSelect]);

  /**
   * Check if a specific entity is selected
   */
  const checkSelected = useCallback(
    (id: string): boolean => {
      return context ? context.isSelected(id) : localSelectedIds.has(id);
    },
    [context, localSelectedIds]
  );

  /**
   * Select range of entities
   */
  const selectRange = useCallback(
    (ids: string[], additive: boolean = false) => {
      if (context) {
        context.selectRange(ids, additive);
      } else {
        setLocalSelectedIds((prev) => {
          if (additive) {
            return new Set([...prev, ...ids]);
          }
          return new Set(ids);
        });
        if (ids.length > 0) {
          setLocalFocusedId(ids[ids.length - 1]);
        }
      }

      // Notify if this entity is affected
      if (entityId && ids.includes(entityId)) {
        onSelect?.(true);
      }
    },
    [context, entityId, onSelect]
  );

  return {
    isSelected,
    hasSelection,
    selectionCount,
    selectedIds,
    focusedId,
    select,
    toggle,
    clearSelection,
    checkSelected,
    selectRange,
  };
}

// Default export for convenience
export default useSelection;
