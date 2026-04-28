import React, { useMemo, type CSSProperties, type ReactNode } from "react";
import { calculateFlowGraphBounds } from "../layout";
import type { Size } from "../types";
import { FlowCanvasWithProvider, type FlowCanvasProps } from "./FlowCanvas";

export type FlowPreviewFitMode = "actual" | "width" | "contain";

export interface FlowPreviewCanvasProps
  extends Omit<FlowCanvasProps, "className" | "height" | "interactionScale" | "mode" | "style" | "width"> {
  fitMode?: FlowPreviewFitMode;
  previewWidth?: number;
  previewHeight?: number;
  minHeight?: number;
  canvasPadding?: number;
  fallbackNodeSize?: Size;
  className?: string;
  style?: CSSProperties;
  canvasClassName?: string;
  canvasStyle?: CSSProperties;
  overlay?: ReactNode;
}

export const FlowPreviewCanvas: React.FC<FlowPreviewCanvasProps> = ({
  fitMode = "width",
  previewWidth = 760,
  previewHeight = 320,
  minHeight = 120,
  canvasPadding = 48,
  fallbackNodeSize,
  className,
  style,
  canvasClassName,
  canvasStyle,
  overlay,
  nodes = [],
  ...canvasProps
}) => {
  const bounds = useMemo(
    () => calculateFlowGraphBounds(nodes, fallbackNodeSize),
    [fallbackNodeSize, nodes]
  );
  const canvasWidth = Math.max(previewWidth, bounds.maxX + canvasPadding);
  const canvasHeight = Math.max(minHeight, bounds.maxY + canvasPadding);
  const scale = useMemo(() => {
    if (fitMode === "actual") {
      return 1;
    }

    const widthScale = previewWidth / canvasWidth;
    if (fitMode === "contain") {
      return Math.min(1, widthScale, previewHeight / canvasHeight);
    }
    return Math.min(1, widthScale);
  }, [canvasHeight, canvasWidth, fitMode, previewHeight, previewWidth]);
  const frameHeight =
    fitMode === "contain" ? previewHeight : Math.max(minHeight, Math.ceil(canvasHeight * scale));

  const classNameProps =
    canvasClassName === undefined ? {} : { className: canvasClassName };
  const styleProps =
    canvasStyle === undefined ? {} : { style: canvasStyle };

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: "100%",
        maxWidth: previewWidth,
        height: frameHeight,
        overflow: "hidden",
        ...style,
      }}
    >
      <div
        style={{
          width: canvasWidth,
          height: canvasHeight,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <FlowCanvasWithProvider
          {...canvasProps}
          nodes={nodes}
          mode="preview"
          width={canvasWidth}
          height={canvasHeight}
          interactionScale={scale}
          {...classNameProps}
          {...styleProps}
        />
      </div>
      {overlay}
    </div>
  );
};

FlowPreviewCanvas.displayName = "FlowPreviewCanvas";
