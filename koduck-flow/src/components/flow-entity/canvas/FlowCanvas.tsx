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
  /** Whether the edge is selected */
  selected: boolean;
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

  /** Port system configuration */
  portConfig?: Partial<PortSystemConfig>;

  /** Path configuration for edges */
  pathConfig?: Partial<PathConfig>;

  /** Whether the canvas is read-only */
  readOnly?: boolean;

  /** Custom node renderer */
  renderNode?: (props: NodeRenderProps) => ReactNode;

  /** Custom edge renderer */
  renderEdge?: (props: EdgeRenderProps) => ReactNode;

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
  readOnly?: boolean;
  renderNode?: (props: NodeRenderProps) => ReactNode;
  renderEdge?: (props: EdgeRenderProps) => ReactNode;
  onCanvasClick?: (position: Position, event: ReactMouseEvent) => void;
  onCanvasDoubleClick?: (position: Position, event: ReactMouseEvent) => void;
  onNodeSelect?: (nodeIds: string[]) => void;
  onEdgeSelect?: (edgeIds: string[]) => void;
  onNodeMove?: (nodeId: string, position: Position) => void;
  onEdgeDelete?: (edgeId: string) => void;
  children?: ReactNode;
}

function resolveNodePortPosition(
  node: IFlowNodeEntityData,
  portId: string,
  direction: "input" | "output"
): Position {
  const nodeX = node.position?.x ?? 0;
  const nodeY = node.position?.y ?? 0;
  const nodeWidth = node.size?.width ?? 200;
  const nodeHeight = node.size?.height ?? 100;
  const config = (node.config ?? {}) as Record<string, unknown>;
  const portAnchors = config.portAnchors as Record<string, unknown> | undefined;
  const anchor = portAnchors?.[portId];

  if (typeof anchor === "object" && anchor !== null) {
    const record = anchor as Record<string, unknown>;
    const side = record.side === "left" ||
      record.side === "right" ||
      record.side === "top" ||
      record.side === "bottom"
      ? record.side
      : direction === "input"
        ? "left"
        : "right";
    const x = typeof record.x === "number" ? record.x : undefined;
    const y = typeof record.y === "number" ? record.y : undefined;

    if (side === "left") {
      return { x: nodeX + (x ?? 0), y: nodeY + (y ?? nodeHeight / 2) };
    }
    if (side === "right") {
      return { x: nodeX + (x ?? nodeWidth), y: nodeY + (y ?? nodeHeight / 2) };
    }
    if (side === "top") {
      return { x: nodeX + (x ?? nodeWidth / 2), y: nodeY + (y ?? 0) };
    }
    return { x: nodeX + (x ?? nodeWidth / 2), y: nodeY + (y ?? nodeHeight) };
  }

  const ports = direction === "input" ? node.inputPorts ?? [] : node.outputPorts ?? [];
  const index = Math.max(
    0,
    ports.findIndex((port) => port.id === portId)
  );
  const total = Math.max(ports.length, 1);
  const portY = (nodeHeight / (total + 1)) * (index + 1);

  return {
    x: nodeX + (direction === "input" ? 0 : nodeWidth),
    y: nodeY + portY,
  };
}

const CanvasContent: React.FC<CanvasContentProps> = ({
  nodes,
  edges,
  selectedNodeIds,
  selectedEdgeIds,
  showGrid,
  gridPattern,
  readOnly = false,
  renderNode,
  renderEdge,
  onCanvasClick,
  onCanvasDoubleClick,
  onNodeSelect,
  onEdgeSelect,
  onNodeMove,
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

  return (
    <>
      {/* Background Grid */}
      {showGrid && (
        <FlowGrid
          translateX={translateX}
          translateY={translateY}
          scale={scale}
          pattern={gridPattern}
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
            {edges.map((edge) => {
              if (renderEdge) {
                // Find source and target node positions for edge rendering
                const sourceNode = nodes.find((n) => n.id === edge.sourceNodeId);
                const targetNode = nodes.find((n) => n.id === edge.targetNodeId);

                if (!sourceNode || !targetNode) return null;

                const sourcePosition = resolveNodePortPosition(
                  sourceNode,
                  edge.sourcePortId,
                  "output"
                );
                const targetPosition = resolveNodePortPosition(
                  targetNode,
                  edge.targetPortId,
                  "input"
                );

                return (
                    <g
                      key={edge.id}
                      data-edge-id={edge.id}
                      style={{ pointerEvents: "auto", cursor: readOnly ? "default" : "pointer" }}
                      onClick={(event) => {
                        event.stopPropagation();
                        onEdgeSelect?.([edge.id]);
                      }}
                      onDoubleClick={(event) => {
                        event.stopPropagation();
                        if (!readOnly) {
                          onEdgeDelete?.(edge.id);
                        }
                      }}
                    >
                      {renderEdge({
                        edge,
                        sourcePosition,
                        targetPosition,
                        selected: selectedEdgeIds.has(edge.id),
                    })}
                  </g>
                );
              }
              return null;
            })}
          </g>
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
          {nodes.map((node) => {
            if (renderNode) {
              return (
                <CanvasNodeContainer
                  key={node.id}
                  node={node}
                  selected={selectedNodeIds.has(node.id)}
                  readOnly={readOnly}
                  onNodeSelect={onNodeSelect}
                  onNodeMove={onNodeMove}
                  renderNode={renderNode}
                />
              );
            }
            return null;
          })}
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
  readOnly: boolean;
  onNodeSelect?: (nodeIds: string[]) => void;
  onNodeMove?: (nodeId: string, position: Position) => void;
  renderNode: (props: NodeRenderProps) => ReactNode;
}

const CanvasNodeContainer: React.FC<CanvasNodeContainerProps> = ({
  node,
  selected,
  readOnly,
  onNodeSelect,
  onNodeMove,
  renderNode,
}) => {
  const dragRef = useRef<{
    pointerStart: Position;
    nodeStart: Position;
    dragging: boolean;
  } | null>(null);

  const handleMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }

      event.stopPropagation();
      onNodeSelect?.([node.id]);

      if (readOnly || !onNodeMove) {
        return;
      }

      event.preventDefault();
      dragRef.current = {
        pointerStart: { x: event.clientX, y: event.clientY },
        nodeStart: {
          x: node.position?.x ?? 0,
          y: node.position?.y ?? 0,
        },
        dragging: true,
      };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const drag = dragRef.current;
        if (!drag?.dragging) {
          return;
        }

        onNodeMove(node.id, {
          x: drag.nodeStart.x + moveEvent.clientX - drag.pointerStart.x,
          y: drag.nodeStart.y + moveEvent.clientY - drag.pointerStart.y,
        });
      };

      const handleMouseUp = () => {
        dragRef.current = null;
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [node, onNodeMove, onNodeSelect, readOnly]
  );

  return (
    <div
      data-node-id={node.id}
      style={{
        position: "absolute",
        left: node.position?.x ?? 0,
        top: node.position?.y ?? 0,
        width: node.size?.width,
        height: node.size?.height,
        cursor: readOnly ? "default" : "grab",
        userSelect: readOnly ? undefined : "none",
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
  showMinimap = false,
  showZoomControls = false,
  minZoom = 0.1,
  maxZoom = 4,
  defaultZoom = 1,
  defaultViewport,
  portConfig,
  pathConfig,
  readOnly = false,
  renderNode,
  renderEdge,
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
        constraints={viewportConstraints}
        onViewportChange={onViewportChange}
        containerWidth={containerSize.width}
        containerHeight={containerSize.height}
      >
        <CanvasContent
          nodes={nodes}
          edges={edges}
          selectedNodeIds={selectedNodeSet}
          selectedEdgeIds={selectedEdgeSet}
          showGrid={showGrid}
          gridPattern={gridPattern}
          readOnly={readOnly}
          renderNode={renderNode}
          renderEdge={renderEdge}
          onCanvasClick={onCanvasClick}
          onCanvasDoubleClick={onCanvasDoubleClick}
          onNodeSelect={onNodeSelect}
          onEdgeSelect={onEdgeSelect}
          onNodeMove={onNodeMove}
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
    <FlowEntityProvider theme={props.theme} portConfig={props.portConfig} readOnly={props.readOnly}>
      <FlowCanvas {...props} />
    </FlowEntityProvider>
  );
};

FlowCanvasWithProvider.displayName = "FlowCanvasWithProvider";

export default FlowCanvas;
