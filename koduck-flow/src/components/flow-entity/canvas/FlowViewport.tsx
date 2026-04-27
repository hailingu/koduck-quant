/**
 * @file FlowViewport Component
 * @description Manages viewport state (translateX, translateY, scale) for canvas panning and zooming.
 * Provides context and controls for viewport manipulation.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 2.6
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  type ReactNode,
  type CSSProperties,
} from "react";

// =============================================================================
// Types
// =============================================================================

/**
 * Viewport state representing the current view transformation
 */
export interface ViewportState {
  /** Horizontal translation in pixels */
  translateX: number;
  /** Vertical translation in pixels */
  translateY: number;
  /** Zoom scale factor (1 = 100%) */
  scale: number;
}

/**
 * Viewport constraints for limiting pan/zoom range
 */
export interface ViewportConstraints {
  /** Minimum zoom level */
  minScale: number;
  /** Maximum zoom level */
  maxScale: number;
  /** Whether to constrain panning to content bounds */
  constrainPan?: boolean;
  /** Content bounds for pan constraints */
  contentBounds?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

/**
 * Viewport context value with state and control methods
 */
export interface ViewportContextValue {
  /** Current viewport state */
  viewport: ViewportState;
  /** Viewport constraints */
  constraints: ViewportConstraints;
  /** Whether viewport is currently being panned */
  isPanning: boolean;
  /** Set the entire viewport state */
  setViewport: (state: ViewportState) => void;
  /** Pan the viewport by delta amounts */
  pan: (deltaX: number, deltaY: number) => void;
  /** Zoom the viewport by a factor, optionally around a focal point */
  zoom: (factor: number, focalPoint?: { x: number; y: number }) => void;
  /** Set absolute zoom level, optionally around a focal point */
  setZoom: (scale: number, focalPoint?: { x: number; y: number }) => void;
  /** Reset viewport to default state */
  reset: () => void;
  /** Fit content to viewport bounds */
  fitToContent: (contentBounds: { minX: number; minY: number; maxX: number; maxY: number }) => void;
  /** Center on a specific point */
  centerOn: (x: number, y: number) => void;
  /** Convert screen coordinates to canvas coordinates */
  screenToCanvas: (screenX: number, screenY: number) => { x: number; y: number };
  /** Convert canvas coordinates to screen coordinates */
  canvasToScreen: (canvasX: number, canvasY: number) => { x: number; y: number };
}

/**
 * Pan interaction state
 */
interface PanState {
  /** Whether panning is active */
  isPanning: boolean;
  /** Starting pointer position */
  startX: number;
  startY: number;
  /** Starting viewport translation */
  startTranslateX: number;
  startTranslateY: number;
}

/**
 * Props for FlowViewport component
 */
export interface FlowViewportProps {
  /** Child elements to render within the viewport */
  children: ReactNode;
  /** Initial viewport state */
  initialState?: Partial<ViewportState>;
  /** Viewport constraints */
  constraints?: Partial<ViewportConstraints>;
  /** Callback when viewport changes */
  onViewportChange?: (viewport: ViewportState) => void;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
  /** Container width for coordinate conversion */
  containerWidth?: number;
  /** Container height for coordinate conversion */
  containerHeight?: number;
  /** Enable zooming with mouse wheel (default: true) */
  enableZoom?: boolean;
  /** Zoom step multiplier for wheel events (default: 0.1) */
  zoomStep?: number;
  /** Callback when zooming starts */
  onZoomStart?: () => void;
  /** Callback when zooming ends */
  onZoomEnd?: () => void;
  /** Enable panning with Space+drag or middle mouse button (default: true) */
  enablePan?: boolean;
  /** Key to hold for panning (default: " " for Space) */
  panKey?: string;
  /** Callback when panning starts */
  onPanStart?: () => void;
  /** Callback when panning ends */
  onPanEnd?: () => void;
}

// =============================================================================
// Default Configuration
// =============================================================================

/**
 * Default viewport state
 */
export const DEFAULT_VIEWPORT_STATE: ViewportState = {
  translateX: 0,
  translateY: 0,
  scale: 1,
};

/**
 * Default viewport constraints
 */
export const DEFAULT_VIEWPORT_CONSTRAINTS: ViewportConstraints = {
  minScale: 0.1,
  maxScale: 4,
  constrainPan: false,
};

// =============================================================================
// Context
// =============================================================================

/**
 * React Context for viewport state and controls
 */
const ViewportContext = createContext<ViewportContextValue | undefined>(undefined);

ViewportContext.displayName = "ViewportContext";

/**
 * Hook to access viewport context
 * @throws Error if used outside of FlowViewport
 */
export function useViewport(): ViewportContextValue {
  const context = useContext(ViewportContext);
  if (!context) {
    throw new Error("useViewport must be used within a FlowViewport component");
  }
  return context;
}

/**
 * Hook to optionally access viewport context
 * @returns ViewportContextValue or undefined if outside provider
 */
export function useViewportOptional(): ViewportContextValue | undefined {
  return useContext(ViewportContext);
}

// =============================================================================
// Component
// =============================================================================

/**
 * FlowViewport provides viewport state management for the canvas.
 * It maintains translateX, translateY, and scale state, and exposes
 * methods for panning and zooming through context.
 *
 * @param root0
 * @param root0.children
 * @param root0.initialState
 * @param root0.constraints
 * @param root0.onViewportChange
 * @param root0.className
 * @param root0.style
 * @param root0.containerWidth
 * @param root0.containerHeight
 * @param root0.enableZoom
 * @param root0.zoomStep
 * @param root0.onZoomStart
 * @param root0.onZoomEnd
 * @param root0.enablePan
 * @param root0.panKey
 * @param root0.onPanStart
 * @param root0.onPanEnd
 * @example
 * ```tsx
 * <FlowViewport
 *   initialState={{ scale: 1.5 }}
 *   constraints={{ minScale: 0.5, maxScale: 3 }}
 *   onViewportChange={(vp) => console.log('Viewport changed:', vp)}
 * >
 *   <FlowGrid />
 *   <FlowCanvas nodes={nodes} edges={edges} />
 * </FlowViewport>
 * ```
 */
export const FlowViewport: React.FC<FlowViewportProps> = ({
  children,
  initialState,
  constraints: constraintOverrides,
  onViewportChange,
  className,
  style,
  containerWidth = 0,
  containerHeight = 0,
  enableZoom = true,
  zoomStep = 0.1,
  onZoomStart,
  onZoomEnd,
  enablePan = true,
  panKey = " ", // Space key
  onPanStart,
  onPanEnd,
}) => {
  // Merge initial state with defaults
  const initialViewport = useMemo(
    () => ({
      ...DEFAULT_VIEWPORT_STATE,
      ...initialState,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [] // Only compute once on mount
  );

  // Merge constraints with defaults
  const constraints = useMemo<ViewportConstraints>(
    () => ({
      ...DEFAULT_VIEWPORT_CONSTRAINTS,
      ...constraintOverrides,
    }),
    [constraintOverrides]
  );

  // Viewport state
  const [viewport, setViewportState] = useState<ViewportState>(initialViewport);

  // Pan interaction state
  const [panState, setPanState] = useState<PanState>({
    isPanning: false,
    startX: 0,
    startY: 0,
    startTranslateX: 0,
    startTranslateY: 0,
  });

  // Track if pan key is pressed
  const [isPanKeyPressed, setIsPanKeyPressed] = useState(false);

  // Ref for container element
  const viewportRef = useRef<HTMLDivElement>(null);

  // Ref for container dimensions (updated from props)
  const containerRef = useRef({ width: containerWidth, height: containerHeight });
  containerRef.current = { width: containerWidth, height: containerHeight };

  /**
   * Clamp scale to constraints
   */
  const clampScale = useCallback(
    (scale: number): number => {
      return Math.min(Math.max(scale, constraints.minScale), constraints.maxScale);
    },
    [constraints.minScale, constraints.maxScale]
  );

  /**
   * Set viewport state with optional callback notification
   */
  const setViewport = useCallback(
    (newState: ViewportState) => {
      const clampedState = {
        ...newState,
        scale: clampScale(newState.scale),
      };
      setViewportState(clampedState);
      onViewportChange?.(clampedState);
    },
    [clampScale, onViewportChange]
  );

  /**
   * Pan the viewport by delta amounts
   */
  const pan = useCallback(
    (deltaX: number, deltaY: number) => {
      setViewportState((prev) => {
        const newState = {
          ...prev,
          translateX: prev.translateX + deltaX,
          translateY: prev.translateY + deltaY,
        };
        onViewportChange?.(newState);
        return newState;
      });
    },
    [onViewportChange]
  );

  /**
   * Zoom by a factor around an optional focal point
   */
  const zoom = useCallback(
    (factor: number, focalPoint?: { x: number; y: number }) => {
      setViewportState((prev) => {
        const newScale = clampScale(prev.scale * factor);
        const actualFactor = newScale / prev.scale;

        let newTranslateX = prev.translateX;
        let newTranslateY = prev.translateY;

        // If focal point provided, zoom towards it
        if (focalPoint) {
          // Convert focal point to canvas coordinates
          const canvasX = (focalPoint.x - prev.translateX) / prev.scale;
          const canvasY = (focalPoint.y - prev.translateY) / prev.scale;

          // Calculate new translation to keep focal point stationary
          newTranslateX = focalPoint.x - canvasX * newScale;
          newTranslateY = focalPoint.y - canvasY * newScale;
        } else {
          // Zoom towards center
          const centerX = containerRef.current.width / 2;
          const centerY = containerRef.current.height / 2;

          newTranslateX = centerX - (centerX - prev.translateX) * actualFactor;
          newTranslateY = centerY - (centerY - prev.translateY) * actualFactor;
        }

        const newState = {
          translateX: newTranslateX,
          translateY: newTranslateY,
          scale: newScale,
        };
        onViewportChange?.(newState);
        return newState;
      });
    },
    [clampScale, onViewportChange]
  );

  /**
   * Set absolute zoom level
   */
  const setZoom = useCallback(
    (scale: number, focalPoint?: { x: number; y: number }) => {
      setViewportState((prev) => {
        const newScale = clampScale(scale);
        let newTranslateX = prev.translateX;
        let newTranslateY = prev.translateY;

        if (focalPoint) {
          const canvasX = (focalPoint.x - prev.translateX) / prev.scale;
          const canvasY = (focalPoint.y - prev.translateY) / prev.scale;
          newTranslateX = focalPoint.x - canvasX * newScale;
          newTranslateY = focalPoint.y - canvasY * newScale;
        }

        const newState = {
          translateX: newTranslateX,
          translateY: newTranslateY,
          scale: newScale,
        };
        onViewportChange?.(newState);
        return newState;
      });
    },
    [clampScale, onViewportChange]
  );

  /**
   * Reset viewport to initial/default state
   */
  const reset = useCallback(() => {
    setViewportState(initialViewport);
    onViewportChange?.(initialViewport);
  }, [initialViewport, onViewportChange]);

  /**
   * Fit content bounds to viewport
   */
  const fitToContent = useCallback(
    (contentBounds: { minX: number; minY: number; maxX: number; maxY: number }) => {
      const { width, height } = containerRef.current;
      if (width === 0 || height === 0) return;

      const contentWidth = contentBounds.maxX - contentBounds.minX;
      const contentHeight = contentBounds.maxY - contentBounds.minY;

      if (contentWidth === 0 || contentHeight === 0) return;

      // Calculate scale to fit content with padding
      const padding = 40;
      const availableWidth = width - padding * 2;
      const availableHeight = height - padding * 2;

      const scaleX = availableWidth / contentWidth;
      const scaleY = availableHeight / contentHeight;
      const newScale = clampScale(Math.min(scaleX, scaleY));

      // Center content
      const scaledWidth = contentWidth * newScale;
      const scaledHeight = contentHeight * newScale;
      const newTranslateX = (width - scaledWidth) / 2 - contentBounds.minX * newScale;
      const newTranslateY = (height - scaledHeight) / 2 - contentBounds.minY * newScale;

      const newState = {
        translateX: newTranslateX,
        translateY: newTranslateY,
        scale: newScale,
      };
      setViewportState(newState);
      onViewportChange?.(newState);
    },
    [clampScale, onViewportChange]
  );

  /**
   * Center viewport on a specific point
   */
  const centerOn = useCallback(
    (x: number, y: number) => {
      const { width, height } = containerRef.current;
      setViewportState((prev) => {
        const newState = {
          ...prev,
          translateX: width / 2 - x * prev.scale,
          translateY: height / 2 - y * prev.scale,
        };
        onViewportChange?.(newState);
        return newState;
      });
    },
    [onViewportChange]
  );

  /**
   * Convert screen coordinates to canvas coordinates
   */
  const screenToCanvas = useCallback(
    (screenX: number, screenY: number): { x: number; y: number } => {
      return {
        x: (screenX - viewport.translateX) / viewport.scale,
        y: (screenY - viewport.translateY) / viewport.scale,
      };
    },
    [viewport.translateX, viewport.translateY, viewport.scale]
  );

  /**
   * Convert canvas coordinates to screen coordinates
   */
  const canvasToScreen = useCallback(
    (canvasX: number, canvasY: number): { x: number; y: number } => {
      return {
        x: canvasX * viewport.scale + viewport.translateX,
        y: canvasY * viewport.scale + viewport.translateY,
      };
    },
    [viewport.translateX, viewport.translateY, viewport.scale]
  );

  // ===========================================================================
  // Pan Interaction Handlers
  // ===========================================================================

  /**
   * Start panning
   */
  const startPan = useCallback(
    (clientX: number, clientY: number) => {
      if (!enablePan) return;

      setPanState({
        isPanning: true,
        startX: clientX,
        startY: clientY,
        startTranslateX: viewport.translateX,
        startTranslateY: viewport.translateY,
      });
      onPanStart?.();
    },
    [enablePan, viewport.translateX, viewport.translateY, onPanStart]
  );

  /**
   * Update pan during mouse move
   */
  const updatePan = useCallback(
    (clientX: number, clientY: number) => {
      if (!panState.isPanning) return;

      const deltaX = clientX - panState.startX;
      const deltaY = clientY - panState.startY;

      const newTranslateX = panState.startTranslateX + deltaX;
      const newTranslateY = panState.startTranslateY + deltaY;

      setViewportState((prev) => {
        const newState = {
          ...prev,
          translateX: newTranslateX,
          translateY: newTranslateY,
        };
        onViewportChange?.(newState);
        return newState;
      });
    },
    [panState, onViewportChange]
  );

  /**
   * End panning
   */
  const endPan = useCallback(() => {
    if (panState.isPanning) {
      setPanState((prev) => ({
        ...prev,
        isPanning: false,
      }));
      onPanEnd?.();
    }
  }, [panState.isPanning, onPanEnd]);

  /**
   * Handle mouse down on viewport
   */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!enablePan) return;

      // Middle mouse button (button = 1)
      if (e.button === 1) {
        e.preventDefault();
        startPan(e.clientX, e.clientY);
        return;
      }

      // Left mouse button with pan key pressed
      if (e.button === 0 && isPanKeyPressed) {
        e.preventDefault();
        startPan(e.clientX, e.clientY);
        return;
      }
    },
    [enablePan, isPanKeyPressed, startPan]
  );

  /**
   * Handle mouse move on viewport
   */
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (panState.isPanning) {
        updatePan(e.clientX, e.clientY);
      }
    },
    [panState.isPanning, updatePan]
  );

  /**
   * Handle mouse up on viewport
   */
  const handleMouseUp = useCallback(() => {
    endPan();
  }, [endPan]);

  /**
   * Handle mouse leave on viewport
   */
  const handleMouseLeave = useCallback(() => {
    endPan();
  }, [endPan]);

  // ===========================================================================
  // Wheel Zoom Handler
  // ===========================================================================

  /**
   * Ref to track zoom debounce for onZoomStart/onZoomEnd callbacks
   */
  const zoomTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isZoomingRef = useRef(false);

  /**
   * Handle wheel events for zooming
   * Zooms towards cursor position to keep focus point stationary
   */
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!enableZoom) return;

      // Prevent default scroll behavior
      e.preventDefault();

      // Get the viewport element's bounding rect for accurate cursor position
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Calculate cursor position relative to viewport
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      // Determine zoom direction: negative deltaY = scroll up = zoom in
      // Normalize across different browsers and devices
      const delta = -e.deltaY;
      const direction = delta > 0 ? 1 : -1;

      // Calculate zoom factor based on direction and zoomStep
      const factor = 1 + direction * zoomStep;

      // Trigger onZoomStart callback if not already zooming
      if (!isZoomingRef.current) {
        isZoomingRef.current = true;
        onZoomStart?.();
      }

      // Clear any existing zoom end timeout
      if (zoomTimeoutRef.current) {
        clearTimeout(zoomTimeoutRef.current);
      }

      // Set timeout to trigger onZoomEnd after zoom interaction stops
      zoomTimeoutRef.current = setTimeout(() => {
        isZoomingRef.current = false;
        onZoomEnd?.();
      }, 150);

      // Zoom around cursor position
      zoom(factor, { x: cursorX, y: cursorY });
    },
    [enableZoom, zoomStep, zoom, onZoomStart, onZoomEnd]
  );

  // ===========================================================================
  // Keyboard Listeners for Pan Key
  // ===========================================================================

  useEffect(() => {
    if (!enablePan) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === panKey && !e.repeat) {
        setIsPanKeyPressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === panKey) {
        setIsPanKeyPressed(false);
        // End panning if key is released while panning
        if (panState.isPanning) {
          endPan();
        }
      }
    };

    // Handle global mouse up to catch releases outside viewport
    const handleGlobalMouseUp = () => {
      if (panState.isPanning) {
        endPan();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mouseup", handleGlobalMouseUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [enablePan, panKey, panState.isPanning, endPan]);

  // Cleanup zoom timeout on unmount
  useEffect(() => {
    return () => {
      if (zoomTimeoutRef.current) {
        clearTimeout(zoomTimeoutRef.current);
      }
    };
  }, []);

  // Build context value
  const contextValue = useMemo<ViewportContextValue>(
    () => ({
      viewport,
      constraints,
      isPanning: panState.isPanning,
      setViewport,
      pan,
      zoom,
      setZoom,
      reset,
      fitToContent,
      centerOn,
      screenToCanvas,
      canvasToScreen,
    }),
    [
      viewport,
      constraints,
      panState.isPanning,
      setViewport,
      pan,
      zoom,
      setZoom,
      reset,
      fitToContent,
      centerOn,
      screenToCanvas,
      canvasToScreen,
    ]
  );

  // Calculate transform style for content
  const transformStyle = useMemo<CSSProperties>(
    () => ({
      position: "relative",
      width: "100%",
      height: "100%",
      transform: `translate(${viewport.translateX}px, ${viewport.translateY}px) scale(${viewport.scale})`,
      transformOrigin: "0 0",
    }),
    [viewport.translateX, viewport.translateY, viewport.scale]
  );

  // Calculate cursor style based on pan state
  const cursorStyle = useMemo<string>(() => {
    if (panState.isPanning) {
      return "grabbing";
    }
    if (isPanKeyPressed && enablePan) {
      return "grab";
    }
    return "default";
  }, [panState.isPanning, isPanKeyPressed, enablePan]);

  return (
    <ViewportContext.Provider value={contextValue}>
      <div
        ref={viewportRef}
        className={className}
        data-testid="flow-viewport"
        data-panning={panState.isPanning}
        data-pan-ready={isPanKeyPressed}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          cursor: cursorStyle,
          userSelect: panState.isPanning ? "none" : undefined,
          ...style,
        }}
      >
        <div data-testid="flow-viewport-content" style={transformStyle}>
          {children}
        </div>
      </div>
    </ViewportContext.Provider>
  );
};

FlowViewport.displayName = "FlowViewport";

export default FlowViewport;
