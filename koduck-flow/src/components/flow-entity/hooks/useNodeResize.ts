/**
 * @file useNodeResize Hook
 * @description React hook providing resize interaction for flow nodes.
 * Enables changing node dimensions via a resize handle with minimum size enforcement.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 2.3
 */

import { useCallback, useEffect, useState } from "react";
import type { FlowNodeEntity } from "../../../common/flow/flow-node-entity";
import type { Position, Size } from "../types";

// =============================================================================
// Types
// =============================================================================

/**
 * Internal state for tracking resize operation
 */
export interface ResizeState {
  /** Whether a resize operation is in progress */
  isResizing: boolean;
  /** Node size at the start of the resize */
  startSize: Size;
  /** Pointer position at the start of the resize */
  pointerStart: Position;
  /** Current pointer position during resize */
  currentPointer: Position;
}

/**
 * Options for configuring the useNodeResize hook
 */
export interface UseNodeResizeOptions {
  /**
   * Callback invoked during resize with the new size
   * @param entity - The node entity being resized
   * @param size - The new size of the node
   */
  onResize?: (entity: FlowNodeEntity, size: Size) => void;

  /**
   * Callback invoked when resize starts
   * @param entity - The node entity being resized
   * @param size - The starting size
   */
  onResizeStart?: (entity: FlowNodeEntity, size: Size) => void;

  /**
   * Callback invoked when resize ends
   * @param entity - The node entity being resized
   * @param size - The final size
   */
  onResizeEnd?: (entity: FlowNodeEntity, size: Size) => void;

  /**
   * Whether resizing is disabled
   * @default false
   */
  disabled?: boolean;

  /**
   * Minimum width the node can be resized to
   * @default 100
   */
  minWidth?: number;

  /**
   * Minimum height the node can be resized to
   * @default 60
   */
  minHeight?: number;

  /**
   * Maximum width the node can be resized to
   * @default Infinity
   */
  maxWidth?: number;

  /**
   * Maximum height the node can be resized to
   * @default Infinity
   */
  maxHeight?: number;

  /**
   * Minimum distance (in pixels) the pointer must move before resize starts
   * Helps distinguish between click and resize
   * @default 0
   */
  resizeThreshold?: number;

  /**
   * Direction(s) in which resizing is allowed
   * - 'both': resize width and height (default, for corner handles)
   * - 'horizontal': resize width only (for right edge)
   * - 'vertical': resize height only (for bottom edge)
   * @default 'both'
   */
  direction?: "both" | "horizontal" | "vertical";
}

/**
 * Return value of the useNodeResize hook
 */
export interface UseNodeResizeResult {
  /** Handler to bind to the resize handle's onPointerDown event */
  handlePointerDown: (event: React.PointerEvent) => void;

  /** @deprecated Use handlePointerDown for unified mouse, pen, and touch input. */
  handleMouseDown: (event: React.MouseEvent) => void;

  /** Whether a resize operation is currently in progress */
  isResizing: boolean;

  /** Current resize state (null when not resizing) */
  resizeState: ResizeState | null;

  /** Current size delta from start (useful for preview) */
  sizeDelta: Size;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Default minimum dimensions
 */
const DEFAULT_MIN_WIDTH = 100;
const DEFAULT_MIN_HEIGHT = 60;

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * useNodeResize - Hook for managing node resize interactions
 *
 * Provides resize functionality for flow nodes:
 * - Tracks mouse/pointer position during resize
 * - Calculates new node size based on pointer movement
 * - Enforces minimum and maximum size constraints
 * - Calls onResize callback during resize for size updates
 *
 * @param entity - The FlowNodeEntity to enable resizing for
 * @param options - Configuration options for the resize behavior
 * @returns Object containing resize handlers and state
 *
 * @example Basic usage
 * ```tsx
 * const { handleMouseDown, isResizing } = useNodeResize(entity, {
 *   onResize: (entity, size) => {
 *     entity.setSize(size);
 *   },
 * });
 *
 * return (
 *   <div className="resize-handle" onPointerDown={handlePointerDown}>
 *     ⌟
 *   </div>
 * );
 * ```
 *
 * @example With size constraints
 * ```tsx
 * const { handleMouseDown, isResizing } = useNodeResize(entity, {
 *   onResize: (entity, size) => entity.setSize(size),
 *   minWidth: 150,
 *   minHeight: 80,
 *   maxWidth: 500,
 *   maxHeight: 400,
 * });
 * ```
 */
export function useNodeResize(
  entity: FlowNodeEntity,
  options: UseNodeResizeOptions = {}
): UseNodeResizeResult {
  const {
    onResize,
    onResizeStart,
    onResizeEnd,
    disabled = false,
    minWidth = DEFAULT_MIN_WIDTH,
    minHeight = DEFAULT_MIN_HEIGHT,
    maxWidth = Infinity,
    maxHeight = Infinity,
    resizeThreshold = 0,
    direction = "both",
  } = options;

  // Resize state - null when not resizing
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);

  // Track if we've exceeded the resize threshold
  const [hasExceededThreshold, setHasExceededThreshold] = useState(false);

  /**
   * Handle pointerdown on the resize handle - initiates potential resize
   */
  const handlePointerDown = useCallback(
    (event: React.PointerEvent | React.MouseEvent) => {
      // Only handle left mouse button
      if (event.button !== 0) return;

      // Don't start resize if disabled
      if (disabled) return;

      // Prevent default to avoid text selection during resize
      event.preventDefault();

      // Stop propagation to prevent drag or other handlers
      event.stopPropagation();
      if ("pointerId" in event) {
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }

      // Get the entity's current size
      const entitySize = entity.data?.size ?? { width: 200, height: 100 };

      // Record starting positions
      const pointerStart: Position = {
        x: event.clientX,
        y: event.clientY,
      };

      // Initialize resize state
      setResizeState({
        isResizing: true,
        startSize: { ...entitySize },
        pointerStart,
        currentPointer: pointerStart,
      });

      // Reset threshold flag
      setHasExceededThreshold(resizeThreshold === 0);
    },
    [entity, disabled, resizeThreshold]
  );

  /**
   * Effect to attach window-level pointer listeners during resize
   */
  useEffect(() => {
    // Only attach listeners when resizing
    if (!resizeState?.isResizing) return;

    /**
     * Clamp a value between min and max
     * @param value
     * @param min
     * @param max
     */
    const clamp = (value: number, min: number, max: number): number => {
      return Math.max(min, Math.min(max, value));
    };

    /**
     * Handle pointer move during resize
     * @param event
     */
    const handlePointerMove = (event: PointerEvent) => {
      // Calculate pointer movement delta
      const deltaX = event.clientX - resizeState.pointerStart.x;
      const deltaY = event.clientY - resizeState.pointerStart.y;

      // Check if we've exceeded the resize threshold
      if (!hasExceededThreshold) {
        const distance = Math.hypot(deltaX, deltaY);
        if (distance < resizeThreshold) {
          return; // Haven't moved enough yet
        }
        setHasExceededThreshold(true);

        // Fire resize start callback
        onResizeStart?.(entity, resizeState.startSize);
      }

      // Calculate new node size with constraints based on direction
      const newSize: Size = {
        width:
          direction === "vertical"
            ? resizeState.startSize.width
            : clamp(resizeState.startSize.width + deltaX, minWidth, maxWidth),
        height:
          direction === "horizontal"
            ? resizeState.startSize.height
            : clamp(resizeState.startSize.height + deltaY, minHeight, maxHeight),
      };

      // Update current pointer in state
      setResizeState((prev) =>
        prev
          ? {
              ...prev,
              currentPointer: { x: event.clientX, y: event.clientY },
            }
          : null
      );

      // Call resize callback with new size
      onResize?.(entity, newSize);
    };

    /**
     * Handle pointer up - end resize operation
     * @param event
     */
    const handlePointerUp = (event: PointerEvent) => {
      // Calculate final size
      const deltaX = event.clientX - resizeState.pointerStart.x;
      const deltaY = event.clientY - resizeState.pointerStart.y;

      // Calculate final size based on direction
      const finalSize: Size = {
        width:
          direction === "vertical"
            ? resizeState.startSize.width
            : clamp(resizeState.startSize.width + deltaX, minWidth, maxWidth),
        height:
          direction === "horizontal"
            ? resizeState.startSize.height
            : clamp(resizeState.startSize.height + deltaY, minHeight, maxHeight),
      };

      // Fire resize end callback if we actually resized
      if (hasExceededThreshold) {
        onResizeEnd?.(entity, finalSize);
      }

      // Reset resize state
      setResizeState(null);
      setHasExceededThreshold(false);
    };

    // Attach listeners to globalThis for reliable tracking outside the element
    globalThis.addEventListener("pointermove", handlePointerMove);
    globalThis.addEventListener("pointerup", handlePointerUp);
    globalThis.addEventListener("pointercancel", handlePointerUp);

    // Cleanup listeners on unmount or when resize ends
    return () => {
      globalThis.removeEventListener("pointermove", handlePointerMove);
      globalThis.removeEventListener("pointerup", handlePointerUp);
      globalThis.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [
    resizeState,
    hasExceededThreshold,
    resizeThreshold,
    direction,
    entity,
    onResize,
    onResizeStart,
    onResizeEnd,
    minWidth,
    minHeight,
    maxWidth,
    maxHeight,
  ]);

  // Calculate current size delta from start
  const sizeDelta: Size = resizeState
    ? {
        width: resizeState.currentPointer.x - resizeState.pointerStart.x,
        height: resizeState.currentPointer.y - resizeState.pointerStart.y,
      }
    : { width: 0, height: 0 };

  return {
    handlePointerDown,
    handleMouseDown: handlePointerDown,
    isResizing: resizeState?.isResizing ?? false,
    resizeState,
    sizeDelta,
  };
}

// Default export for convenience
export default useNodeResize;
