import React from "react";
import type { IRenderContext } from "../../../common/render/types";
import type { IEntity } from "../../../common/entity";

export interface EditorProps {
  /** Canvas reference for direct manipulation of the Canvas element */
  canvasRef: HTMLCanvasElement | null;
  /** Callback to set the Canvas reference */
  setCanvasRef: (canvas: HTMLCanvasElement | null) => void;
  /** Mouse down event handler */
  onMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  /** Mouse move event handler */
  onMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  /** Mouse up event handler */
  onMouseUp: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  /** Mouse leave event handler */
  onMouseLeave?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  /** Mouse click event handler */
  onClick?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  /** Draw function responsible for rendering content on the Canvas */
  onDraw: (canvas: HTMLCanvasElement) => void;
  /** Editor width */
  width?: string | number;
  /** Editor height */
  height?: string | number;
  /** Whether dragging is in progress, affects cursor style */
  isDragging?: boolean;
  /** Whether batch dragging is in progress, affects cursor style */
  isDraggingMultiple?: boolean;
  /** Whether box selection is in progress, affects cursor style */
  isSelecting?: boolean;
  /** Canvas style customization */
  canvasStyle?: React.CSSProperties;
  /** Container style customization */
  containerStyle?: React.CSSProperties;
  /** Whether to show border */
  showBorder?: boolean;
  /** Editor class name */
  className?: string;
  /** Whether the editor is disabled */
  disabled?: boolean;
  /** Viewport state change callback */
  onViewportChange?: (viewport: IRenderContext["viewport"]) => void;
  /** Render context builder ready callback */
  onRenderContextReady?: (contextBuilder: RenderContextBuilder) => void;
  /** Externally controlled viewport state */
  viewport?: Partial<IRenderContext["viewport"]>;
}

/**
 * Render context builder interface
 * Provides methods to build and manipulate IRenderContext
 */
export interface RenderContextBuilder {
  /** Get current Canvas element */
  getCanvas(): HTMLCanvasElement | null;

  /** Get current viewport info */
  getViewport(): IRenderContext["viewport"];

  /** Build a complete IRenderContext */
  buildContext(
    nodes: IEntity[],
    metadata?: Record<string, unknown>
  ): IRenderContext;

  /** Update viewport info */
  updateViewport(updates: Partial<IRenderContext["viewport"]>): void;
}

// Use only named exports for types
