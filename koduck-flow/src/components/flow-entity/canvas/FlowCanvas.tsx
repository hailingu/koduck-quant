/**
 * @file FlowCanvas Component
 * @description Top-level canvas container for rendering flow nodes and edges.
 * Composes FlowViewport and FlowCanvasContent to provide a complete canvas experience.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 2.6
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { FlowEntityProvider, useOptionalFlowEntityContext } from "../context";
import type {
  FlowTheme,
  IFlowEdgeEntityData,
  IFlowNodeEntityData,
  PathConfig,
  PortSystemConfig,
  Position,
} from "../types";
import type {
  ConnectionValidationResult,
  FlowCanvasPortConnection,
} from "./connection-validation";
import { CanvasContent } from "./FlowCanvasContent";
import type { GridPattern } from "./FlowGrid";
import { FlowViewport, useViewport, type ViewportState } from "./FlowViewport";
import type {
  FlowCanvasRenderEngine,
  FlowCanvasRenderModel,
} from "./render-model";

export type { EdgeRoute } from "./edge-routing";
export type {
  ConnectionValidationResult,
  FlowCanvasPortConnection,
  FlowCanvasPortEndpoint,
} from "./connection-validation";
export type {
  FlowCanvasEdgeRenderItem,
  FlowCanvasNodeRenderItem,
  FlowCanvasPortRenderItem,
  FlowCanvasRenderEngine,
  FlowCanvasRenderModel,
} from "./render-model";

/**
 * Render props for custom node rendering
 */
export interface NodeRenderProps {
  /** Node data */
  node: IFlowNodeEntityData;
  /** Whether the node is selected */
  selected: boolean;
}

/**
 * Render props for custom edge rendering
 */
export interface EdgeRenderProps {
  /** Edge data */
  edge: IFlowEdgeEntityData;
  /** Source port position */
  sourcePosition: Position;
  /** Target port position */
  targetPosition: Position;
  /** Routed edge geometry */
  route?: import("./edge-routing").EdgeRoute;
  /** Whether the edge is selected */
  selected: boolean;
}

export interface FlowCanvasInteraction {
  selectNodes: boolean;
  dragNodes: boolean;
  selectEdges: boolean;
  deleteEdges: boolean;
  pan: boolean;
  zoom: boolean;
}

export type FlowCanvasMode = "preview" | "editor";

function resolveInteraction(
  readOnly: boolean,
  mode?: FlowCanvasMode,
  interaction?: Partial<FlowCanvasInteraction>
): FlowCanvasInteraction {
  const modeDefaults: FlowCanvasInteraction | undefined =
    mode === "preview"
      ? {
          selectNodes: false,
          dragNodes: false,
          selectEdges: false,
          deleteEdges: false,
          pan: false,
          zoom: false,
        }
      : mode === "editor"
        ? {
            selectNodes: true,
            dragNodes: true,
            selectEdges: true,
            deleteEdges: true,
            pan: true,
            zoom: true,
          }
        : undefined;

  return {
    selectNodes: interaction?.selectNodes ?? modeDefaults?.selectNodes ?? !readOnly,
    dragNodes: interaction?.dragNodes ?? modeDefaults?.dragNodes ?? !readOnly,
    selectEdges: interaction?.selectEdges ?? modeDefaults?.selectEdges ?? !readOnly,
    deleteEdges: interaction?.deleteEdges ?? modeDefaults?.deleteEdges ?? !readOnly,
    pan: interaction?.pan ?? modeDefaults?.pan ?? true,
    zoom: interaction?.zoom ?? modeDefaults?.zoom ?? true,
  };
}

interface FlowCanvasOverlayProps {
  nodes: IFlowNodeEntityData[];
  contentBounds: { minX: number; minY: number; maxX: number; maxY: number };
  containerSize: { width: number; height: number };
  minZoom: number;
  maxZoom: number;
  selectedNodeIds: Set<string>;
}

const controlDockStyle: CSSProperties = {
  position: "absolute",
  left: 16,
  bottom: 16,
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 8,
  zIndex: 30,
  pointerEvents: "none",
};

const controlToolbarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  padding: 4,
  border: "1px solid var(--flow-overlay-border, rgba(15, 23, 42, 0.12))",
  borderRadius: "var(--flow-overlay-radius, 8px)",
  background: "var(--flow-overlay-bg, rgba(255, 255, 255, 0.92))",
  boxShadow: "var(--flow-overlay-shadow, 0 8px 24px rgba(15, 23, 42, 0.12))",
  pointerEvents: "auto",
};

const zoomControlButtonStyle: CSSProperties = {
  width: 30,
  height: 30,
  border: 0,
  borderRadius: 6,
  background: "transparent",
  color: "var(--flow-control-text, #0f172a)",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 700,
  lineHeight: "30px",
  textAlign: "center",
};

const minimapStyle: CSSProperties = {
  position: "relative",
  width: 176,
  height: 118,
  border: "1px solid var(--flow-overlay-border-strong, rgba(15, 23, 42, 0.16))",
  borderRadius: "var(--flow-overlay-radius, 8px)",
  background: "var(--flow-overlay-bg, rgba(255, 255, 255, 0.92))",
  boxShadow: "var(--flow-overlay-shadow, 0 8px 24px rgba(15, 23, 42, 0.12))",
  overflow: "hidden",
  pointerEvents: "auto",
};

function FlowCanvasZoomControls({
  minZoom,
  maxZoom,
}: Pick<FlowCanvasOverlayProps, "minZoom" | "maxZoom">) {
  const { viewport, setZoom } = useViewport();
  const zoomPercent = Math.round(viewport.scale * 100);

  const handleZoomOut = () => {
    setZoom(Math.max(minZoom, viewport.scale / 1.2));
  };

  const handleZoomIn = () => {
    setZoom(Math.min(maxZoom, viewport.scale * 1.2));
  };

  return (
    <>
      <button
        aria-label="Zoom out"
        disabled={viewport.scale <= minZoom}
        style={zoomControlButtonStyle}
        title="Zoom out"
        type="button"
        onClick={handleZoomOut}
      >
        -
      </button>
      <button
        aria-label="Zoom in"
        disabled={viewport.scale >= maxZoom}
        style={zoomControlButtonStyle}
        title="Zoom in"
        type="button"
        onClick={handleZoomIn}
      >
        +
      </button>
      <button
        aria-label="Zoom level"
        style={{ ...zoomControlButtonStyle, width: 54, fontSize: 11, fontWeight: 600 }}
        title="Zoom level"
        type="button"
        onClick={() => setZoom(1)}
      >
        {zoomPercent}%
      </button>
    </>
  );
}

function FlowCanvasMinimap({
  nodes,
  contentBounds,
  containerSize,
  selectedNodeIds,
}: Omit<FlowCanvasOverlayProps, "minZoom" | "maxZoom">) {
  const { viewport, centerOn } = useViewport();
  const isMinimapDraggingRef = useRef(false);
  const minimapWidth = 176;
  const minimapHeight = 118;
  const padding = 10;
  const contentWidth = Math.max(1, contentBounds.maxX - contentBounds.minX);
  const contentHeight = Math.max(1, contentBounds.maxY - contentBounds.minY);
  const scale = Math.min(
    (minimapWidth - padding * 2) / contentWidth,
    (minimapHeight - padding * 2) / contentHeight
  );

  const viewportRect =
    containerSize.width > 0 && containerSize.height > 0
      ? {
          x: padding + (-viewport.translateX / viewport.scale - contentBounds.minX) * scale,
          y: padding + (-viewport.translateY / viewport.scale - contentBounds.minY) * scale,
          width: (containerSize.width / viewport.scale) * scale,
          height: (containerSize.height / viewport.scale) * scale,
        }
      : undefined;

  const centerViewportFromPointer = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const minimapX = Math.min(
        minimapWidth - padding,
        Math.max(padding, event.clientX - rect.left)
      );
      const minimapY = Math.min(
        minimapHeight - padding,
        Math.max(padding, event.clientY - rect.top)
      );
      const x = contentBounds.minX + (minimapX - padding) / scale;
      const y = contentBounds.minY + (minimapY - padding) / scale;
      centerOn(x, y);
    },
    [centerOn, contentBounds.minX, contentBounds.minY, scale]
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    isMinimapDraggingRef.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    centerViewportFromPointer(event);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isMinimapDraggingRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    centerViewportFromPointer(event);
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isMinimapDraggingRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    isMinimapDraggingRef.current = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  return (
    <div
      aria-label="Canvas minimap"
      role="button"
      tabIndex={0}
      style={minimapStyle}
      title="Click to center viewport"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          centerOn(
            contentBounds.minX + contentWidth / 2,
            contentBounds.minY + contentHeight / 2
          );
        }
      }}
    >
      {nodes.map((node) => {
        const x = node.position?.x ?? 0;
        const y = node.position?.y ?? 0;
        const width = node.size?.width ?? 200;
        const height = node.size?.height ?? 100;
        const isSelected = selectedNodeIds.has(node.id);

        return (
          <div
            key={node.id}
            style={{
              position: "absolute",
              left: padding + (x - contentBounds.minX) * scale,
              top: padding + (y - contentBounds.minY) * scale,
              width: Math.max(3, width * scale),
              height: Math.max(3, height * scale),
              borderRadius: 2,
              background: isSelected ? "#2563eb" : "#94a3b8",
              opacity: isSelected ? 0.9 : 0.7,
            }}
          />
        );
      })}
      {viewportRect !== undefined && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: viewportRect.x,
            top: viewportRect.y,
            width: viewportRect.width,
            height: viewportRect.height,
            border: "1px solid #2563eb",
            background: "rgba(37, 99, 235, 0.08)",
          }}
        />
      )}
    </div>
  );
}

function FlowCanvasLocationControls({
  nodes,
  contentBounds,
  selectedNodeIds,
}: Pick<FlowCanvasOverlayProps, "nodes" | "contentBounds" | "selectedNodeIds">) {
  const { fitToContent, centerOn, reset } = useViewport();
  const selectedNode = nodes.find((node) => selectedNodeIds.has(node.id));

  const handleCenterSelected = () => {
    if (!selectedNode) {
      fitToContent(contentBounds);
      return;
    }

    const width = selectedNode.size?.width ?? 200;
    const height = selectedNode.size?.height ?? 100;
    centerOn(
      (selectedNode.position?.x ?? 0) + width / 2,
      (selectedNode.position?.y ?? 0) + height / 2
    );
  };

  return (
    <>
      <button
        aria-label="Fit graph"
        style={zoomControlButtonStyle}
        title="Fit graph"
        type="button"
        onClick={() => fitToContent(contentBounds)}
      >
        ⛶
      </button>
      <button
        aria-label="Center selected node"
        style={zoomControlButtonStyle}
        title={selectedNode ? "Center selected node" : "Center graph"}
        type="button"
        onClick={handleCenterSelected}
      >
        ◎
      </button>
      <button
        aria-label="Reset viewport"
        style={zoomControlButtonStyle}
        title="Reset viewport"
        type="button"
        onClick={reset}
      >
        ↺
      </button>
    </>
  );
}

function FlowCanvasControlDock({
  nodes,
  contentBounds,
  containerSize,
  minZoom,
  maxZoom,
  selectedNodeIds,
  showMinimap,
  showZoomControls,
  showLocationControls,
}: FlowCanvasOverlayProps & {
  showMinimap: boolean;
  showZoomControls: boolean;
  showLocationControls: boolean;
}) {
  if (!showMinimap && !showZoomControls && !showLocationControls) {
    return null;
  }

  return (
    <div
      aria-label="Canvas navigation controls"
      style={controlDockStyle}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      {showMinimap ? (
        <FlowCanvasMinimap
          nodes={nodes}
          contentBounds={contentBounds}
          containerSize={containerSize}
          selectedNodeIds={selectedNodeIds}
        />
      ) : null}
      <div aria-label="Canvas toolbar" style={controlToolbarStyle}>
        {showZoomControls ? <FlowCanvasZoomControls minZoom={minZoom} maxZoom={maxZoom} /> : null}
        {showLocationControls ? (
          <FlowCanvasLocationControls
            nodes={nodes}
            contentBounds={contentBounds}
            selectedNodeIds={selectedNodeIds}
          />
        ) : null}
      </div>
    </div>
  );
}

/**
 * Props for FlowCanvas component
 */
export interface FlowCanvasProps {
  /** Node entities to render */
  nodes?: IFlowNodeEntityData[];

  /** Edge entities to render */
  edges?: IFlowEdgeEntityData[];

  /** Selected node IDs */
  selectedNodeIds?: string[];

  /** Selected edge IDs */
  selectedEdgeIds?: string[];

  /** Theme configuration */
  theme?: Partial<FlowTheme>;

  /** Canvas width (defaults to 100%) */
  width?: number | string;

  /** Canvas height (defaults to 100%) */
  height?: number | string;

  /** Whether to show the background grid */
  showGrid?: boolean;

  /** Grid pattern configuration */
  gridPattern?: Partial<GridPattern>;

  /** Whether to show minimap */
  showMinimap?: boolean;

  /** Whether to show zoom controls */
  showZoomControls?: boolean;

  /** Whether to show viewport location controls */
  showLocationControls?: boolean;

  /** Minimum zoom level */
  minZoom?: number;

  /** Maximum zoom level */
  maxZoom?: number;

  /** Default/initial zoom level */
  defaultZoom?: number;

  /** Default viewport position */
  defaultViewport?: Partial<ViewportState>;

  /** Automatically fit graph content into the canvas viewport */
  fitView?: boolean;

  /**
   * Controls how often `fitView` recalculates.
   *
   * - `auto`: recompute when nodes, container size, or fit padding change.
   * - `initial`: compute only once after the first measurable layout.
   *
   * @default "auto"
   */
  fitViewStrategy?: "auto" | "initial";

  /** Padding used when fitting graph content */
  fitPadding?: number;

  /** Port system configuration */
  portConfig?: Partial<PortSystemConfig>;

  /** Path configuration for edges */
  pathConfig?: Partial<PathConfig>;

  /** Whether the canvas is read-only */
  readOnly?: boolean;

  /** First-class canvas mode for common preview/editor behavior */
  mode?: FlowCanvasMode;

  /** Fine-grained interaction permissions */
  interaction?: Partial<FlowCanvasInteraction>;

  /** Extra scale applied outside the canvas, used to normalize pointer movement */
  interactionScale?: number;

  /** Custom node renderer */
  renderNode?: (props: NodeRenderProps) => ReactNode;

  /** Custom edge renderer */
  renderEdge?: (props: EdgeRenderProps) => ReactNode;

  /** Render backend used by FlowCanvas. React DOM is currently implemented. */
  renderEngine?: FlowCanvasRenderEngine;

  /** Emits the normalized render model used by the active render backend. */
  onRenderModelChange?: (model: FlowCanvasRenderModel) => void;

  /** Validate interactive port connections before creating an edge */
  validateConnection?: (connection: FlowCanvasPortConnection) => ConnectionValidationResult;

  /** Additional children to render in the canvas */
  children?: ReactNode;

  /** Callback when canvas background is clicked */
  onCanvasClick?: (position: Position, event: ReactMouseEvent) => void;

  /** Callback when canvas background is double-clicked */
  onCanvasDoubleClick?: (position: Position, event: ReactMouseEvent) => void;

  /** Callback when node is selected */
  onNodeSelect?: (nodeIds: string[]) => void;

  /** Callback when edge is selected */
  onEdgeSelect?: (edgeIds: string[]) => void;

  /** Callback when node is moved */
  onNodeMove?: (nodeId: string, position: Position) => void;

  /** Callback when edge is created */
  onEdgeCreate?: (
    sourceNodeId: string,
    sourcePortId: string,
    targetNodeId: string,
    targetPortId: string
  ) => void;

  /** Callback when edge is deleted */
  onEdgeDelete?: (edgeId: string) => void;

  /** Callback when viewport changes */
  onViewportChange?: (viewport: ViewportState) => void;

  /** Additional CSS class name */
  className?: string;

  /** Additional inline styles */
  style?: CSSProperties;
}

/**
 * FlowCanvas is the top-level container for rendering a flow diagram.
 * It owns public canvas props, viewport setup, and content composition.
 *
 */
export const FlowCanvas: React.FC<FlowCanvasProps> = ({
  nodes = [],
  edges = [],
  selectedNodeIds = [],
  selectedEdgeIds = [],
  theme,
  width = "100%",
  height = "100%",
  showGrid = true,
  showMinimap = false,
  showZoomControls = false,
  showLocationControls = false,
  gridPattern,
  minZoom = 0.1,
  maxZoom = 4,
  defaultZoom = 1,
  defaultViewport,
  fitView = false,
  fitViewStrategy = "auto",
  fitPadding = 32,
  portConfig,
  pathConfig,
  readOnly,
  mode,
  interaction,
  interactionScale = 1,
  renderEngine = "react-dom",
  renderNode,
  renderEdge,
  onRenderModelChange,
  validateConnection,
  children,
  onCanvasClick,
  onCanvasDoubleClick,
  onNodeSelect,
  onEdgeSelect,
  onNodeMove,
  onEdgeCreate,
  onEdgeDelete,
  onViewportChange,
  className,
  style,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [fitViewportSeed, setFitViewportSeed] = useState<ViewportState | null>(null);
  const [viewportSeedKey, setViewportSeedKey] = useState(0);
  const lastFitViewportKeyRef = useRef<string | null>(null);

  const selectedNodeSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds]);
  const selectedEdgeSet = useMemo(() => new Set(selectedEdgeIds), [selectedEdgeIds]);
  const effectiveReadOnly = readOnly ?? mode === "preview";
  const resolvedInteraction = useMemo(
    () => resolveInteraction(effectiveReadOnly, mode, interaction),
    [effectiveReadOnly, mode, interaction]
  );
  const contentBounds = useMemo(() => {
    if (nodes.length === 0) {
      return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
    }

    return nodes.reduce(
      (bounds, node) => {
        const x = node.position?.x ?? 0;
        const y = node.position?.y ?? 0;
        const nodeWidth = node.size?.width ?? 200;
        const nodeHeight = node.size?.height ?? 100;

        return {
          minX: Math.min(bounds.minX, x),
          minY: Math.min(bounds.minY, y),
          maxX: Math.max(bounds.maxX, x + nodeWidth),
          maxY: Math.max(bounds.maxY, y + nodeHeight),
        };
      },
      {
        minX: Number.POSITIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY,
      }
    );
  }, [nodes]);

  const initialViewport = useMemo(
    () => ({
      translateX: 0,
      translateY: 0,
      scale: defaultZoom,
      ...defaultViewport,
    }),
    [defaultZoom, defaultViewport]
  );

  const viewportConstraints = useMemo(
    () => ({
      minScale: minZoom,
      maxScale: maxZoom,
    }),
    [minZoom, maxZoom]
  );
  const fitViewport = useMemo<ViewportState | undefined>(() => {
    if (!fitView || containerSize.width <= 0 || containerSize.height <= 0) {
      return undefined;
    }

    const contentWidth = Math.max(1, contentBounds.maxX - contentBounds.minX);
    const contentHeight = Math.max(1, contentBounds.maxY - contentBounds.minY);
    const availableWidth = Math.max(1, containerSize.width - fitPadding * 2);
    const availableHeight = Math.max(1, containerSize.height - fitPadding * 2);
    const rawScale = Math.min(availableWidth / contentWidth, availableHeight / contentHeight);
    const scale = Math.min(Math.max(rawScale, minZoom), maxZoom);
    const translateX =
      (containerSize.width - contentWidth * scale) / 2 - contentBounds.minX * scale;
    const translateY =
      (containerSize.height - contentHeight * scale) / 2 - contentBounds.minY * scale;

    return { translateX, translateY, scale };
  }, [
    containerSize.height,
    containerSize.width,
    contentBounds,
    fitPadding,
    fitView,
    maxZoom,
    minZoom,
  ]);
  const fitViewportKey = fitViewport
    ? [
        fitViewStrategy,
        fitViewport.translateX.toFixed(3),
        fitViewport.translateY.toFixed(3),
        fitViewport.scale.toFixed(5),
      ].join(":")
    : null;

  useEffect(() => {
    if (!fitView) {
      setFitViewportSeed(null);
      lastFitViewportKeyRef.current = null;
      return;
    }

    if (fitViewport === undefined || fitViewportKey === null) {
      return;
    }

    if (fitViewStrategy === "initial" && fitViewportSeed !== null) {
      return;
    }

    if (lastFitViewportKeyRef.current === fitViewportKey) {
      return;
    }

    lastFitViewportKeyRef.current = fitViewportKey;
    setFitViewportSeed(fitViewport);
    setViewportSeedKey((current) => current + 1);
  }, [fitView, fitViewStrategy, fitViewport, fitViewportKey, fitViewportSeed]);

  const viewportInitialState = fitViewportSeed ?? initialViewport;
  const viewportOverlay = (
    <FlowCanvasControlDock
      nodes={nodes}
      contentBounds={contentBounds}
      containerSize={containerSize}
      minZoom={minZoom}
      maxZoom={maxZoom}
      selectedNodeIds={selectedNodeSet}
      showMinimap={showMinimap}
      showZoomControls={showZoomControls}
      showLocationControls={showLocationControls}
    />
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      setContainerSize({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const contextValue = useOptionalFlowEntityContext();
  const canvasBackground =
    theme?.canvasBackground ?? contextValue?.theme?.canvasBackground ?? "#f9fafb";

  const containerStyle = useMemo<CSSProperties>(
    () => ({
      position: "relative",
      width,
      height,
      overflow: "hidden",
      backgroundColor: canvasBackground,
      ...style,
    }),
    [width, height, canvasBackground, style]
  );

  return (
    <div ref={containerRef} className={className} data-testid="flow-canvas" style={containerStyle}>
      <FlowViewport
        key={viewportSeedKey}
        initialState={viewportInitialState}
        constraints={viewportConstraints}
        containerWidth={containerSize.width}
        containerHeight={containerSize.height}
        enablePan={resolvedInteraction.pan}
        enableZoom={resolvedInteraction.zoom}
        wheelZoomActivation="modifier"
        overlay={viewportOverlay}
        {...(onViewportChange !== undefined ? { onViewportChange } : {})}
      >
        <CanvasContent
          nodes={nodes}
          edges={edges}
          selectedNodeIds={selectedNodeSet}
          selectedEdgeIds={selectedEdgeSet}
          showGrid={showGrid}
          interaction={resolvedInteraction}
          interactionScale={interactionScale}
          renderEngine={renderEngine}
          {...(gridPattern === undefined ? {} : { gridPattern })}
          {...(portConfig === undefined ? {} : { portConfig })}
          {...(pathConfig === undefined ? {} : { pathConfig })}
          {...(renderNode === undefined ? {} : { renderNode })}
          {...(renderEdge === undefined ? {} : { renderEdge })}
          {...(onRenderModelChange === undefined ? {} : { onRenderModelChange })}
          {...(validateConnection === undefined ? {} : { validateConnection })}
          {...(onCanvasClick === undefined ? {} : { onCanvasClick })}
          {...(onCanvasDoubleClick === undefined ? {} : { onCanvasDoubleClick })}
          {...(onNodeSelect === undefined ? {} : { onNodeSelect })}
          {...(onEdgeSelect === undefined ? {} : { onEdgeSelect })}
          {...(onNodeMove === undefined ? {} : { onNodeMove })}
          {...(onEdgeCreate === undefined ? {} : { onEdgeCreate })}
          {...(onEdgeDelete === undefined ? {} : { onEdgeDelete })}
        >
          {children}
        </CanvasContent>
      </FlowViewport>
    </div>
  );
};

FlowCanvas.displayName = "FlowCanvas";

/**
 * FlowCanvas wrapped with FlowEntityProvider for standalone usage.
 * Use this when FlowCanvas is not already wrapped in a FlowEntityProvider.
 * @param props
 */
export const FlowCanvasWithProvider: React.FC<FlowCanvasProps> = (props) => {
  return (
    <FlowEntityProvider
      readOnly={props.readOnly ?? props.mode === "preview"}
      {...(props.theme !== undefined ? { theme: props.theme } : {})}
      {...(props.portConfig !== undefined ? { portConfig: props.portConfig } : {})}
    >
      <FlowCanvas {...props} />
    </FlowEntityProvider>
  );
};

FlowCanvasWithProvider.displayName = "FlowCanvasWithProvider";

export default FlowCanvas;
