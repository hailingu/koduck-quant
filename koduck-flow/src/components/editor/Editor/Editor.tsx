import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EditorProps, RenderContextBuilder } from "./types";
import { CanvasElement } from "./CanvasElement";
import "./styles.css";

export const Editor: React.FC<EditorProps> = ({
  canvasRef,
  setCanvasRef,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
  onClick,
  onDraw,
  width = "100%",
  height = "400px",
  isDragging = false,
  isDraggingMultiple = false,
  isSelecting = false,
  canvasStyle,
  containerStyle,
  showBorder = true,
  className,
  disabled = false,
  onViewportChange,
  onRenderContextReady,
  viewport: externalViewport,
}) => {
  const internalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const handleCanvasRef = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      internalCanvasRef.current = canvas;
      if (canvas !== canvasRef) {
        setCanvasRef(canvas);
      }
    },
    [canvasRef, setCanvasRef]
  );

  // 内部视口状态管理
  const [internalViewport, setInternalViewport] = useState({
    x: 0,
    y: 0,
    zoom: 1,
    width: 800,
    height: 600,
  });

  // 合并外部和内部视口状态
  const currentViewport = useMemo(() => {
    return externalViewport ? { ...internalViewport, ...externalViewport } : internalViewport;
  }, [internalViewport, externalViewport]);

  // RenderContextBuilder 实现
  const contextBuilder = useMemo(
    (): RenderContextBuilder => ({
      getCanvas: () => internalCanvasRef.current,

      getViewport: () => currentViewport,

      buildContext: (nodes, metadata) => {
        const context = {
          nodes,
          viewport: currentViewport,
          timestamp: Date.now(),
        };
        const canvasElement = internalCanvasRef.current;
        if (canvasElement) {
          (context as typeof context & { canvas: HTMLCanvasElement }).canvas = canvasElement;
        }
        if (metadata !== undefined) {
          (
            context as typeof context & {
              metadata: Record<string, unknown>;
            }
          ).metadata = metadata;
        }
        return context;
      },

      updateViewport: (updates) => {
        setInternalViewport((prev) => ({ ...prev, ...updates }));
      },
    }),
    [currentViewport]
  );

  // 暴露构建器给外部
  useEffect(() => {
    onRenderContextReady?.(contextBuilder);
  }, [contextBuilder, onRenderContextReady]);

  // 视口变化时通知外部
  useEffect(() => {
    onViewportChange?.(currentViewport);
  }, [currentViewport, onViewportChange]);

  // 同步 canvas 大小到视口
  useEffect(() => {
    if (internalCanvasRef.current) {
      const canvas = internalCanvasRef.current;
      const rect = canvas.getBoundingClientRect();
      setInternalViewport((prev) => ({
        ...prev,
        width: rect.width,
        height: rect.height,
      }));
    }
  }, [width, height]);

  const prevCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevOnDrawRef = useRef<((canvas: HTMLCanvasElement) => void) | null>(null);
  useEffect(() => {
    if (!canvasRef) {
      prevCanvasRef.current = null;
      return;
    }

    const canvasChanged = canvasRef !== prevCanvasRef.current;
    const drawChanged = onDraw !== prevOnDrawRef.current;

    if (canvasChanged || drawChanged) {
      prevCanvasRef.current = canvasRef;
      prevOnDrawRef.current = onDraw;
      onDraw(canvasRef);
    }
  }, [canvasRef, onDraw]);

  const cursor = useMemo(() => {
    if (disabled) {
      return "not-allowed";
    }
    if (isDragging || isDraggingMultiple) {
      return "grabbing";
    }
    if (isSelecting) {
      return "crosshair";
    }
    return "grab";
  }, [disabled, isDragging, isDraggingMultiple, isSelecting]);

  const finalContainer = useMemo(
    () => ({
      width,
      height,
      ...containerStyle,
    }),
    [containerStyle, height, width]
  );

  const finalCanvas = useMemo(
    () => ({
      cursor,
      ...canvasStyle,
    }),
    [canvasStyle, cursor]
  );

  return (
    <div
      className={`${className ?? ""} editor-container ${showBorder ? "show-border" : ""}`}
      style={finalContainer}
    >
      <CanvasElement
        ref={handleCanvasRef}
        onMouseDown={disabled ? undefined : onMouseDown}
        onMouseMove={disabled ? undefined : onMouseMove}
        onMouseUp={disabled ? undefined : onMouseUp}
        onMouseLeave={disabled ? undefined : onMouseLeave}
        onClick={disabled ? undefined : onClick}
        style={{ ...finalCanvas, width: "100%", height: "100%" }}
        className={`editor-canvas ${showBorder ? "show-border" : ""}`}
      />
    </div>
  );
};

export default Editor;
