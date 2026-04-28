/**
 * @file FlowCanvas Component
 * @description Top-level canvas container for rendering flow nodes and edges.
 * Composes FlowViewport and FlowGrid to provide a complete canvas experience.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 2.6
 */

import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
  type ReactNode,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { FlowEntityProvider, useOptionalFlowEntityContext } from "../context";
import { FlowViewport, useViewportOptional, type ViewportState } from "./FlowViewport";
import { FlowGrid, type GridPattern } from "./FlowGrid";
import type {
  FlowTheme,
  IFlowNodeEntityData,
  IFlowEdgeEntityData,
  Position,
  PortSystemConfig,
  PathConfig,
} from "../types";
import {
  type ConnectionValidationResult,
  type FlowCanvasPortConnection,
  type FlowCanvasPortEndpoint,
} from "./connection-validation";
import {
  buildRoundedOrthogonalPath,
  compactRoutePoints,
  type EdgeRoute,
} from "./edge-routing";
import {
  buildFlowCanvasRenderModel,
  getPortKey,
  type FlowCanvasRenderEngine,
  type FlowCanvasRenderModel,
} from "./render-model";
import { useNodeDrag } from "./use-node-drag";
import { usePortConnectionDrag } from "./use-port-connection-drag";

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

// =============================================================================
// Types
// =============================================================================

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
  route?: EdgeRoute;
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

// =============================================================================
// Internal Components
// =============================================================================

/**
 * Internal canvas content component that has access to viewport context
 */
interface CanvasContentProps {
  nodes: IFlowNodeEntityData[];
  edges: IFlowEdgeEntityData[];
  selectedNodeIds: Set<string>;
  selectedEdgeIds: Set<string>;
  showGrid: boolean;
  gridPattern?: Partial<GridPattern>;
  interaction: FlowCanvasInteraction;
  interactionScale?: number;
  portConfig?: Partial<PortSystemConfig>;
  pathConfig?: Partial<PathConfig>;
  renderEngine: FlowCanvasRenderEngine;
  renderNode?: (props: NodeRenderProps) => ReactNode;
  renderEdge?: (props: EdgeRenderProps) => ReactNode;
  onRenderModelChange?: (model: FlowCanvasRenderModel) => void;
  validateConnection?: (connection: FlowCanvasPortConnection) => ConnectionValidationResult;
  onCanvasClick?: (position: Position, event: ReactMouseEvent) => void;
  onCanvasDoubleClick?: (position: Position, event: ReactMouseEvent) => void;
  onNodeSelect?: (nodeIds: string[]) => void;
  onEdgeSelect?: (edgeIds: string[]) => void;
  onNodeMove?: (nodeId: string, position: Position) => void;
  onEdgeCreate?: (
    sourceNodeId: string,
    sourcePortId: string,
    targetNodeId: string,
    targetPortId: string
  ) => void;
  onEdgeDelete?: (edgeId: string) => void;
  children?: ReactNode;
}

const CanvasContent: React.FC<CanvasContentProps> = ({
  nodes,
  edges,
  selectedNodeIds,
  selectedEdgeIds,
  showGrid,
  gridPattern,
  interaction,
  interactionScale = 1,
  portConfig,
  pathConfig,
  renderEngine,
  renderNode,
  renderEdge,
  onRenderModelChange,
  validateConnection,
  onCanvasClick,
  onCanvasDoubleClick,
  onNodeSelect,
  onEdgeSelect,
  onNodeMove,
  onEdgeCreate,
  onEdgeDelete,
  children,
}) => {
  const viewport = useViewportOptional();
  const contentRef = useRef<HTMLDivElement>(null);

  // Handle canvas click (when clicking on empty space)
  const handleClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      // Only trigger if clicking directly on the canvas background
      if (event.target !== event.currentTarget) return;

      const rect = contentRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Convert screen coordinates to canvas coordinates
      const screenX = event.clientX - rect.left;
      const screenY = event.clientY - rect.top;

      const canvasPosition = viewport
        ? viewport.screenToCanvas(screenX, screenY)
        : { x: screenX, y: screenY };

      onCanvasClick?.(canvasPosition, event);
    },
    [viewport, onCanvasClick]
  );

  // Handle canvas double-click
  const handleDoubleClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) return;

      const rect = contentRef.current?.getBoundingClientRect();
      if (!rect) return;

      const screenX = event.clientX - rect.left;
      const screenY = event.clientY - rect.top;

      const canvasPosition = viewport
        ? viewport.screenToCanvas(screenX, screenY)
        : { x: screenX, y: screenY };

      onCanvasDoubleClick?.(canvasPosition, event);
    },
    [viewport, onCanvasDoubleClick]
  );

  // Get viewport state for grid rendering
  const { translateX = 0, translateY = 0, scale = 1 } = viewport?.viewport ?? {};
  const gridScale = scale || 1;
  const portSize = portConfig?.portSize ?? 12;
  const portHitSize = Math.max(24, portSize + 14);
  const screenEventToCanvasPosition = useCallback(
    (event: MouseEvent | ReactMouseEvent): Position | null => {
      const viewportElement = contentRef.current?.closest<HTMLElement>('[data-testid="flow-viewport"]');
      const rect = viewportElement?.getBoundingClientRect();
      if (!rect) {
        return null;
      }

      const screenX = event.clientX - rect.left;
      const screenY = event.clientY - rect.top;
      return viewport ? viewport.screenToCanvas(screenX, screenY) : { x: screenX, y: screenY };
    },
    [viewport]
  );
  const renderModel = useMemo<FlowCanvasRenderModel>(
    () =>
      buildFlowCanvasRenderModel({
        nodes,
        edges,
        selectedNodeIds,
        selectedEdgeIds,
        renderEngine,
        ...(pathConfig !== undefined ? { pathConfig } : {}),
      }),
    [edges, nodes, pathConfig, renderEngine, selectedEdgeIds, selectedNodeIds]
  );
  const edgeRenderItems = renderModel.edges;

  useEffect(() => {
    onRenderModelChange?.(renderModel);
  }, [onRenderModelChange, renderModel]);

  const {
    hoveredPortKey,
    connectionDraft,
    connectionError,
    beginConnection,
    hoverPort,
    leavePort,
    completeConnectionOnPort,
    validatePortConnection,
  } = usePortConnectionDrag({
    edges,
    screenEventToCanvasPosition,
    ...(portConfig !== undefined ? { portConfig } : {}),
    ...(validateConnection !== undefined ? { validateConnection } : {}),
    ...(onEdgeCreate !== undefined ? { onEdgeCreate } : {}),
  });

  return (
    <>
      {/* Background Grid */}
      {showGrid && (
        <FlowGrid
          translateX={translateX}
          translateY={translateY}
          scale={scale}
          pattern={gridPattern}
          style={{
            top: -translateY / gridScale,
            left: -translateX / gridScale,
            right: "auto",
            bottom: "auto",
            width: `${100 / gridScale}%`,
            height: `${100 / gridScale}%`,
          }}
        />
      )}

      {/* Canvas Content Layer */}
      <div
        ref={contentRef}
        data-testid="flow-canvas-content"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1,
        }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        {/* Edges Layer (SVG) */}
        <svg
          data-testid="flow-canvas-edges"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            overflow: "visible",
          }}
        >
          <defs>
            {/* Arrow marker definition */}
            <marker
              id="flow-edge-arrow"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L0,6 L9,3 z" fill="currentColor" />
            </marker>
          </defs>
          <g data-testid="flow-canvas-edges-group">
            {edgeRenderItems.map((item) => {
              const { edge, sourcePosition, targetPosition, route, selected } = item;
              if (renderEdge) {
                return (
                    <g
                      key={edge.id}
                      data-edge-id={edge.id}
                      style={{
                        pointerEvents: "auto",
                        cursor: interaction.selectEdges ? "pointer" : "default",
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (interaction.selectEdges) {
                          onEdgeSelect?.([edge.id]);
                        }
                      }}
                      onDoubleClick={(event) => {
                        event.stopPropagation();
                        if (interaction.deleteEdges) {
                          onEdgeDelete?.(edge.id);
                        }
                      }}
                    >
                      {renderEdge({
                        edge,
                        sourcePosition,
                        targetPosition,
                        route,
                        selected,
                    })}
                  </g>
                );
              }
              return null;
            })}
          </g>
          {connectionDraft ? (
            <g data-testid="flow-canvas-connection-preview" pointerEvents="none">
              <path
                d={buildRoundedOrthogonalPath(
                  compactRoutePoints([
                    connectionDraft.source.position,
                    {
                      x: (connectionDraft.source.position.x + connectionDraft.pointer.x) / 2,
                      y: connectionDraft.source.position.y,
                    },
                    {
                      x: (connectionDraft.source.position.x + connectionDraft.pointer.x) / 2,
                      y: connectionDraft.pointer.y,
                    },
                    connectionDraft.pointer,
                  ]),
                  14
                )}
                fill="none"
                stroke={connectionDraft.validation.valid ? "#2563eb" : "#dc2626"}
                strokeDasharray={connectionDraft.validation.valid ? "0" : "6 6"}
                strokeLinecap="round"
                strokeWidth={3}
              />
            </g>
          ) : null}
        </svg>

        {/* Nodes Layer */}
        <div
          data-testid="flow-canvas-nodes"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 0,
            height: 0,
          }}
        >
          {renderModel.nodes.map(({ node, selected }) => {
            if (renderNode) {
              return (
                <CanvasNodeContainer
                  key={node.id}
                  node={node}
                  selected={selected}
                  interaction={interaction}
                  interactionScale={interactionScale}
                  onNodeSelect={onNodeSelect}
                  onNodeMove={onNodeMove}
                  renderNode={renderNode}
                />
              );
            }
            return null;
          })}
          {onEdgeCreate
            ? renderModel.ports.map(({ key, node, port, position, connected }) => {
                  const endpoint: FlowCanvasPortEndpoint = {
                    nodeId: node.id,
                    portId: port.id,
                    port,
                    position,
                  };
                  const portKey = key;
                  const hovered = hoveredPortKey === portKey;
                  const draftTarget = connectionDraft?.target
                    ? getPortKey(connectionDraft.target.nodeId, connectionDraft.target.portId) ===
                      portKey
                    : false;
                  const visible =
                    port.visibility === "always" ||
                    connected ||
                    hovered ||
                    draftTarget ||
                    Boolean(connectionDraft);
                  const validation =
                    connectionDraft && connectionDraft.source.nodeId !== node.id
                      ? validatePortConnection(connectionDraft.source, endpoint)
                      : null;
                  const color =
                    draftTarget && connectionDraft?.validation.valid === false
                      ? "#dc2626"
                      : validation && !validation.valid
                        ? "#dc2626"
                        : "#2563eb";

                  return (
                    <button
                      key={portKey}
                      type="button"
                      data-port-id={port.id}
                      data-node-id={node.id}
                      data-port-direction={port.type}
                      title={validation?.reason ?? port.description ?? port.name}
                      aria-label={`${node.label} ${port.name} ${port.type} port`}
                      style={{
                        position: "absolute",
                        left: position.x - portHitSize / 2,
                        top: position.y - portHitSize / 2,
                        width: portHitSize,
                        height: portHitSize,
                        border: 0,
                        padding: 0,
                        borderRadius: "999px",
                        background: "transparent",
                        cursor: "crosshair",
                        zIndex: 10,
                        opacity: visible ? 1 : 0,
                        transition: "opacity 120ms ease",
                      }}
                      onMouseEnter={() => {
                        hoverPort(portKey, endpoint);
                      }}
                      onMouseLeave={() => {
                        leavePort(portKey, endpoint);
                      }}
                      onMouseDown={(event) => {
                        if (event.button !== 0) {
                          return;
                        }
                        event.preventDefault();
                        event.stopPropagation();
                        beginConnection(endpoint);
                      }}
                      onMouseUp={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        completeConnectionOnPort(endpoint);
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          position: "absolute",
                          left: "50%",
                          top: "50%",
                          width: portSize,
                          height: portSize,
                          transform: "translate(-50%, -50%)",
                          borderRadius: "999px",
                          border: "2px solid #ffffff",
                          background: color,
                          boxShadow:
                            hovered || draftTarget
                              ? `0 0 0 5px ${color}22, 0 1px 4px rgba(15, 23, 42, 0.22)`
                              : "0 1px 4px rgba(15, 23, 42, 0.22)",
                        }}
                      />
                    </button>
                  );
              })
            : null}
          {connectionError ? (
            <div
              role="status"
              style={{
                position: "absolute",
                left: connectionError.position.x + 12,
                top: connectionError.position.y - 14,
                zIndex: 20,
                maxWidth: 240,
                borderRadius: 8,
                border: "1px solid #fecaca",
                background: "#fff1f2",
                color: "#991b1b",
                padding: "6px 8px",
                fontSize: 12,
                fontWeight: 600,
                boxShadow: "0 8px 18px rgba(15, 23, 42, 0.12)",
                pointerEvents: "none",
              }}
            >
              {connectionError.message}
            </div>
          ) : null}
        </div>

        {/* Custom Children */}
        {children}
      </div>
    </>
  );
};

CanvasContent.displayName = "CanvasContent";

interface CanvasNodeContainerProps {
  node: IFlowNodeEntityData;
  selected: boolean;
  interaction: FlowCanvasInteraction;
  interactionScale: number;
  onNodeSelect?: (nodeIds: string[]) => void;
  onNodeMove?: (nodeId: string, position: Position) => void;
  renderNode: (props: NodeRenderProps) => ReactNode;
}

const CanvasNodeContainer: React.FC<CanvasNodeContainerProps> = ({
  node,
  selected,
  interaction,
  interactionScale,
  onNodeSelect,
  onNodeMove,
  renderNode,
}) => {
  const viewport = useViewportOptional();
  const handleMouseDown = useNodeDrag({
    node,
    selectNodes: interaction.selectNodes,
    dragNodes: interaction.dragNodes,
    viewportScale: viewport?.viewport.scale ?? 1,
    interactionScale,
    ...(onNodeSelect !== undefined ? { onNodeSelect } : {}),
    ...(onNodeMove !== undefined ? { onNodeMove } : {}),
  });

  return (
    <div
      data-node-id={node.id}
      style={{
        position: "absolute",
        left: node.position?.x ?? 0,
        top: node.position?.y ?? 0,
        width: node.size?.width,
        height: node.size?.height,
        cursor: interaction.dragNodes ? "grab" : "default",
        userSelect: interaction.dragNodes ? "none" : undefined,
      }}
      onMouseDown={handleMouseDown}
    >
      {renderNode({
        node,
        selected,
      })}
    </div>
  );
};

CanvasNodeContainer.displayName = "CanvasNodeContainer";

// =============================================================================
// Main Component
// =============================================================================

/**
 * FlowCanvas is the top-level container for rendering a flow diagram.
 * It composes FlowViewport, FlowGrid, and provides structure for rendering
 * nodes and edges.
 *
 * @param root0
 * @param root0.nodes
 * @param root0.edges
 * @param root0.selectedNodeIds
 * @param root0.selectedEdgeIds
 * @param root0.theme
 * @param root0.width
 * @param root0.height
 * @param root0.showGrid
 * @param root0.gridPattern
 * @param root0.showMinimap
 * @param root0.showZoomControls
 * @param root0.minZoom
 * @param root0.maxZoom
 * @param root0.defaultZoom
 * @param root0.defaultViewport
 * @param root0.portConfig
 * @param root0.pathConfig
 * @param root0.readOnly
 * @param root0.renderNode
 * @param root0.renderEdge
 * @param root0.children
 * @param root0.onCanvasClick
 * @param root0.onCanvasDoubleClick
 * @param root0.onNodeSelect
 * @param root0.onEdgeSelect
 * @param root0.onNodeMove
 * @param root0.onEdgeCreate
 * @param root0.onEdgeDelete
 * @param root0.onViewportChange
 * @param root0.className
 * @param root0.style
 * @example
 * ```tsx
 * <FlowCanvas
 *   nodes={nodes}
 *   edges={edges}
 *   showGrid={true}
 *   minZoom={0.5}
 *   maxZoom={2}
 *   onNodeSelect={(ids) => console.log('Selected:', ids)}
 *   onViewportChange={(vp) => console.log('Viewport:', vp)}
 * >
 *   <CustomOverlay />
 * </FlowCanvas>
 * ```
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

  // Convert selected IDs to Sets for efficient lookup
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
        const width = node.size?.width ?? 200;
        const height = node.size?.height ?? 100;

        return {
          minX: Math.min(bounds.minX, x),
          minY: Math.min(bounds.minY, y),
          maxX: Math.max(bounds.maxX, x + width),
          maxY: Math.max(bounds.maxY, y + height),
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

  // Build initial viewport state
  const initialViewport = useMemo(
    () => ({
      translateX: 0,
      translateY: 0,
      scale: defaultZoom,
      ...defaultViewport,
    }),
    [defaultZoom, defaultViewport]
  );

  // Build viewport constraints
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

  // Observe container size for viewport calculations
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

  // Get context to access theme
  const contextValue = useOptionalFlowEntityContext();
  const canvasBackground =
    theme?.canvasBackground ?? contextValue?.theme?.canvasBackground ?? "#f9fafb";

  // Container styles
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
        viewport={fitViewport}
        constraints={viewportConstraints}
        onViewportChange={onViewportChange}
        containerWidth={containerSize.width}
        containerHeight={containerSize.height}
        enablePan={resolvedInteraction.pan}
        enableZoom={resolvedInteraction.zoom}
      >
        <CanvasContent
          nodes={nodes}
          edges={edges}
          selectedNodeIds={selectedNodeSet}
          selectedEdgeIds={selectedEdgeSet}
          showGrid={showGrid}
          gridPattern={gridPattern}
          interaction={resolvedInteraction}
          interactionScale={interactionScale}
          portConfig={portConfig}
          pathConfig={pathConfig}
          renderEngine={renderEngine}
          renderNode={renderNode}
          renderEdge={renderEdge}
          onRenderModelChange={onRenderModelChange}
          validateConnection={validateConnection}
          onCanvasClick={onCanvasClick}
          onCanvasDoubleClick={onCanvasDoubleClick}
          onNodeSelect={onNodeSelect}
          onEdgeSelect={onEdgeSelect}
          onNodeMove={onNodeMove}
          onEdgeCreate={onEdgeCreate}
          onEdgeDelete={onEdgeDelete}
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
      theme={props.theme}
      portConfig={props.portConfig}
      readOnly={props.readOnly ?? props.mode === "preview"}
    >
      <FlowCanvas {...props} />
    </FlowEntityProvider>
  );
};

FlowCanvasWithProvider.displayName = "FlowCanvasWithProvider";

export default FlowCanvas;
