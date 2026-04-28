import React, { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { calculateFlowGraphBounds } from "../layout";
import type { Size } from "../types";
import { FlowCanvasWithProvider, type FlowCanvasProps } from "./FlowCanvas";
import type { ViewportState } from "./FlowViewport";

export type FlowEditorInitialFit = "actual" | "width" | "contain";

export interface FlowEditorCanvasProps
  extends Omit<
    FlowCanvasProps,
    | "className"
    | "defaultViewport"
    | "defaultZoom"
    | "height"
    | "maxZoom"
    | "minZoom"
    | "mode"
    | "style"
    | "width"
  > {
  width?: number | string;
  height?: number | string;
  minZoom?: number;
  maxZoom?: number;
  defaultZoom?: number;
  defaultViewport?: Partial<ViewportState>;
  initialFit?: FlowEditorInitialFit;
  fitPadding?: number;
  fallbackNodeSize?: Size;
  className?: string;
  style?: CSSProperties;
  overlay?: ReactNode;
}

export const FlowEditorCanvas: React.FC<FlowEditorCanvasProps> = ({
  width = "100%",
  height = "100%",
  minZoom = 0.4,
  maxZoom = 2,
  defaultZoom = 1,
  defaultViewport,
  initialFit = "contain",
  fitPadding = 80,
  fallbackNodeSize,
  className,
  style,
  overlay,
  nodes = [],
  ...canvasProps
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const bounds = useMemo(
    () => calculateFlowGraphBounds(nodes, fallbackNodeSize),
    [fallbackNodeSize, nodes]
  );
  const initialViewport = useMemo<Partial<ViewportState> | undefined>(() => {
    if (
      defaultViewport ||
      initialFit === "actual" ||
      containerSize.width <= 0 ||
      containerSize.height <= 0
    ) {
      return defaultViewport;
    }

    const contentWidth = Math.max(1, bounds.width);
    const contentHeight = Math.max(1, bounds.height);
    const availableWidth = Math.max(1, containerSize.width - fitPadding * 2);
    const availableHeight = Math.max(1, containerSize.height - fitPadding * 2);
    const rawScale =
      initialFit === "width"
        ? availableWidth / contentWidth
        : Math.min(availableWidth / contentWidth, availableHeight / contentHeight);
    const scale = Math.min(Math.max(rawScale, minZoom), maxZoom);

    return {
      scale,
      translateX: (containerSize.width - contentWidth * scale) / 2 - bounds.minX * scale,
      translateY: (containerSize.height - contentHeight * scale) / 2 - bounds.minY * scale,
    };
  }, [
    bounds.height,
    bounds.minX,
    bounds.minY,
    bounds.width,
    containerSize.height,
    containerSize.width,
    defaultViewport,
    fitPadding,
    initialFit,
    maxZoom,
    minZoom,
  ]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const updateSize = () => {
      setContainerSize({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    };
    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  const shouldRenderCanvas =
    Boolean(defaultViewport) ||
    initialFit === "actual" ||
    (containerSize.width > 0 && containerSize.height > 0);

  const viewportProps =
    initialViewport === undefined
      ? {}
      : { defaultViewport: initialViewport };

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: "relative",
        width,
        height,
        overflow: "hidden",
        ...style,
      }}
    >
      {shouldRenderCanvas ? (
        <FlowCanvasWithProvider
          {...canvasProps}
          mode="editor"
          width="100%"
          height="100%"
          minZoom={minZoom}
          maxZoom={maxZoom}
          defaultZoom={defaultZoom}
          nodes={nodes}
          {...viewportProps}
        />
      ) : null}
      {overlay}
    </div>
  );
};

FlowEditorCanvas.displayName = "FlowEditorCanvas";
