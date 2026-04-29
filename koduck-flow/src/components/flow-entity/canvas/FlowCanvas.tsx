/**
 * @file FlowCanvas Component
 * @description Top-level canvas container for rendering flow nodes and edges.
 * Composes FlowViewport and FlowCanvasContent to provide a complete canvas experience.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 2.6
 */

import React, {
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
import { FlowViewport, type ViewportState } from "./FlowViewport";
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
  gridPattern,
  minZoom = 0.1,
  maxZoom = 4,
  defaultZoom = 1,
  defaultViewport,
  fitView = false,
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
  }, [containerSize.height, containerSize.width, contentBounds, fitPadding, fitView, maxZoom, minZoom]);

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
        initialState={initialViewport}
        constraints={viewportConstraints}
        containerWidth={containerSize.width}
        containerHeight={containerSize.height}
        enablePan={resolvedInteraction.pan}
        enableZoom={resolvedInteraction.zoom}
        {...(fitViewport !== undefined ? { viewport: fitViewport } : {})}
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

      {/* TODO: Add minimap component when showMinimap is true */}
      {/* TODO: Add zoom controls when showZoomControls is true */}
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
