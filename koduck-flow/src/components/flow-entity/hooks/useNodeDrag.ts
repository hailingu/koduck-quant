/**
 * @file useNodeDrag Hook
 * @description React hook providing drag interaction for flow nodes.
 * Enables smooth movement of nodes on the canvas with position updates.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 2.2
 */

import { useCallback, useEffect, useState } from "react";
import type { FlowNodeEntity } from "../../../common/flow/flow-node-entity";
import type { Position } from "../types";

// =============================================================================
// Types
// =============================================================================

/**
 * Internal state for tracking drag operation
 */
export interface DragState {
  /** Whether a drag operation is in progress */
  isDragging: boolean;
  /** Node position at the start of the drag */
  startPosition: Position;
  /** Pointer position at the start of the drag */
  pointerStart: Position;
  /** Current pointer position during drag */
  currentPointer: Position;
}

/**
 * Options for configuring the useNodeDrag hook
 */
export interface UseNodeDragOptions {
  /**
   * Callback invoked during drag with the new position
   * @param entity - The node entity being dragged
   * @param position - The new position of the node
   */
  onMove?: (entity: FlowNodeEntity, position: Position) => void;

  /**
   * Callback invoked when drag starts
   * @param entity - The node entity being dragged
   * @param position - The starting position
   */
  onDragStart?: (entity: FlowNodeEntity, position: Position) => void;

  /**
   * Callback invoked when drag ends
   * @param entity - The node entity being dragged
   * @param position - The final position
   */
  onDragEnd?: (entity: FlowNodeEntity, position: Position) => void;

  /**
   * Whether dragging is disabled
   * @default false
   */
  disabled?: boolean;

  /**
   * Minimum distance (in pixels) the pointer must move before drag starts
   * Helps distinguish between click and drag
   * @default 0
   */
  dragThreshold?: number;
}

/**
 * Return value of the useNodeDrag hook
 */
export interface UseNodeDragResult {
  /** Handler to bind to the node's onMouseDown event */
  handleMouseDown: (event: React.MouseEvent) => void;

  /** Whether a drag operation is currently in progress */
  isDragging: boolean;

  /** Current drag state (null when not dragging) */
  dragState: DragState | null;

  /** Current position offset from start (useful for preview) */
  offset: Position;
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * useNodeDrag - Hook for managing node drag interactions
 *
 * Provides drag-and-drop functionality for flow nodes:
 * - Tracks mouse/pointer position during drag
 * - Calculates new node position based on pointer movement
 * - Calls onMove callback during drag for position updates
 * - Supports drag threshold to distinguish from clicks
 *
 * @param entity - The FlowNodeEntity to enable dragging for
 * @param options - Configuration options for the drag behavior
 * @returns Object containing drag handlers and state
 *
 * @example Basic usage
 * ```tsx
 * const { handleMouseDown, isDragging } = useNodeDrag(entity, {
 *   onMove: (entity, position) => {
 *     entity.setPosition(position);
 *   },
 * });
 *
 * return (
 *   <div
 *     onMouseDown={handleMouseDown}
 *     className={isDragging ? 'dragging' : ''}
 *   >
 *     Node content
 *   </div>
 * );
 * ```
 *
 * @example With drag start/end callbacks
 * ```tsx
 * const { handleMouseDown, isDragging } = useNodeDrag(entity, {
 *   onDragStart: (entity) => console.log('Drag started:', entity.id),
 *   onMove: (entity, pos) => entity.setPosition(pos),
 *   onDragEnd: (entity, pos) => savePosition(entity.id, pos),
 * });
 * ```
 */
export function useNodeDrag(
  entity: FlowNodeEntity,
  options: UseNodeDragOptions = {}
): UseNodeDragResult {
  const { onMove, onDragStart, onDragEnd, disabled = false, dragThreshold = 0 } = options;

  // Drag state - null when not dragging
  const [dragState, setDragState] = useState<DragState | null>(null);

  // Track if we've exceeded the drag threshold
  const [hasExceededThreshold, setHasExceededThreshold] = useState(false);

  /**
   * Handle mousedown on the node - initiates potential drag
   */
  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      // Only handle left mouse button
      if (event.button !== 0) return;

      // Don't start drag if disabled
      if (disabled) return;

      // Prevent default to avoid text selection during drag
      event.preventDefault();

      // Stop propagation to prevent canvas pan
      event.stopPropagation();

      // Get the entity's current position
      const entityPosition = entity.data?.position ?? { x: 0, y: 0 };

      // Record starting positions
      const pointerStart: Position = {
        x: event.clientX,
        y: event.clientY,
      };

      // Initialize drag state
      setDragState({
        isDragging: true,
        startPosition: { ...entityPosition },
        pointerStart,
        currentPointer: pointerStart,
      });

      // Reset threshold flag
      setHasExceededThreshold(dragThreshold === 0);
    },
    [entity, disabled, dragThreshold]
  );

  /**
   * Effect to attach window-level mouse listeners during drag
   */
  useEffect(() => {
    // Only attach listeners when dragging
    if (!dragState?.isDragging) return;

    /**
     * Handle mouse move during drag
     * @param event
     */
    const handleMouseMove = (event: MouseEvent) => {
      // Calculate pointer movement delta
      const deltaX = event.clientX - dragState.pointerStart.x;
      const deltaY = event.clientY - dragState.pointerStart.y;

      // Check if we've exceeded the drag threshold
      if (!hasExceededThreshold) {
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        if (distance < dragThreshold) {
          return; // Haven't moved enough yet
        }
        setHasExceededThreshold(true);

        // Fire drag start callback
        onDragStart?.(entity, dragState.startPosition);
      }

      // Calculate new node position
      const newPosition: Position = {
        x: dragState.startPosition.x + deltaX,
        y: dragState.startPosition.y + deltaY,
      };

      // Update current pointer in state
      setDragState((prev) =>
        prev
          ? {
              ...prev,
              currentPointer: { x: event.clientX, y: event.clientY },
            }
          : null
      );

      // Call move callback with new position
      onMove?.(entity, newPosition);
    };

    /**
     * Handle mouse up - end drag operation
     * @param event
     */
    const handleMouseUp = (event: MouseEvent) => {
      // Calculate final position
      const deltaX = event.clientX - dragState.pointerStart.x;
      const deltaY = event.clientY - dragState.pointerStart.y;

      const finalPosition: Position = {
        x: dragState.startPosition.x + deltaX,
        y: dragState.startPosition.y + deltaY,
      };

      // Fire drag end callback if we actually dragged
      if (hasExceededThreshold) {
        onDragEnd?.(entity, finalPosition);
      }

      // Reset drag state
      setDragState(null);
      setHasExceededThreshold(false);
    };

    // Attach listeners to window for reliable tracking outside the element
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    // Cleanup listeners on unmount or when drag ends
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragState, hasExceededThreshold, dragThreshold, entity, onMove, onDragStart, onDragEnd]);

  // Calculate current offset from start position
  const offset: Position = dragState
    ? {
        x: dragState.currentPointer.x - dragState.pointerStart.x,
        y: dragState.currentPointer.y - dragState.pointerStart.y,
      }
    : { x: 0, y: 0 };

  return {
    handleMouseDown,
    isDragging: dragState?.isDragging ?? false,
    dragState,
    offset,
  };
}

// Default export for convenience
export default useNodeDrag;
