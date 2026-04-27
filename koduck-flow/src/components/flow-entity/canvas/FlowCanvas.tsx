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
  PortDefinition,
  PortAlignment,
  PortSide,
  PortDataType,
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
  /** Routed edge geometry */
  route?: EdgeRoute;
  /** Whether the edge is selected */
  selected: boolean;
}

export interface EdgeRoute {
  /** Ordered route points in canvas coordinates */
  points: Position[];
  /** SVG path generated from route points */
  path: string;
  /** Index within a parallel edge group */
  parallelIndex: number;
  /** Number of edges in this parallel edge group */
  parallelCount: number;
  /** Pixel offset applied to separate parallel routes */
  parallelOffset: number;
}

export interface FlowCanvasPortEndpoint {
  nodeId: string;
  portId: string;
  port: PortDefinition;
  position: Position;
}

export interface FlowCanvasPortConnection {
  source: FlowCanvasPortEndpoint;
  target: FlowCanvasPortEndpoint;
}

export interface ConnectionValidationResult {
  valid: boolean;
  reason?: string;
}

export type FlowCanvasRenderEngine = "react-dom";

export interface FlowCanvasNodeRenderItem {
  node: IFlowNodeEntityData;
  selected: boolean;
}

export interface FlowCanvasPortRenderItem {
  key: string;
  node: IFlowNodeEntityData;
  port: PortDefinition;
  direction: "input" | "output";
  position: Position;
  connected: boolean;
}

export interface FlowCanvasEdgeRenderItem {
  edge: IFlowEdgeEntityData;
  sourceNode: IFlowNodeEntityData;
  targetNode: IFlowNodeEntityData;
  sourcePosition: Position;
  targetPosition: Position;
  route: EdgeRoute;
  selected: boolean;
}

export interface FlowCanvasRenderModel {
  engine: FlowCanvasRenderEngine;
  nodes: FlowCanvasNodeRenderItem[];
  ports: FlowCanvasPortRenderItem[];
  edges: FlowCanvasEdgeRenderItem[];
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
  const ports = direction === "input" ? node.inputPorts ?? [] : node.outputPorts ?? [];
  const index = Math.max(
    0,
    ports.findIndex((port) => port.id === portId)
  );
  const total = Math.max(ports.length, 1);
  const port = ports[index] as PortDefinition | undefined;
  const portLayouts = config.portLayouts as Record<string, unknown> | undefined;
  const legacyPortAnchors = config.portAnchors as Record<string, unknown> | undefined;
  const layoutSource =
    (portLayouts?.[portId] as Record<string, unknown> | undefined) ??
    (legacyPortAnchors?.[portId] as Record<string, unknown> | undefined);

  const isPortSide = (value: unknown): value is PortSide =>
    value === "left" || value === "right" || value === "top" || value === "bottom";
  const isPortAlignment = (value: unknown): value is PortAlignment =>
    value === "center" || value === "start" || value === "end" || value === "distributed";

  const side: PortSide = isPortSide(port?.side)
    ? port.side
    : isPortSide(layoutSource?.side)
      ? layoutSource.side
      : direction === "input"
        ? "left"
        : "right";
  const alignment: PortAlignment = isPortAlignment(port?.alignment)
    ? port.alignment
    : isPortAlignment(layoutSource?.alignment)
      ? layoutSource.alignment
      : total === 1
        ? "center"
        : "distributed";
  const explicitX = typeof layoutSource?.x === "number" ? layoutSource.x : undefined;
  const explicitY = typeof layoutSource?.y === "number" ? layoutSource.y : undefined;

  const resolveAxisPosition = (length: number) => {
    if (alignment === "center") {
      return length / 2;
    }
    if (alignment === "start") {
      return Math.min(32, length / 2);
    }
    if (alignment === "end") {
      return Math.max(length - 32, length / 2);
    }
    return (length / (total + 1)) * (index + 1);
  };

  if (side === "left") {
    return { x: nodeX + (explicitX ?? 0), y: nodeY + (explicitY ?? resolveAxisPosition(nodeHeight)) };
  }
  if (side === "right") {
    return { x: nodeX + (explicitX ?? nodeWidth), y: nodeY + (explicitY ?? resolveAxisPosition(nodeHeight)) };
  }
  if (side === "top") {
    return { x: nodeX + (explicitX ?? resolveAxisPosition(nodeWidth)), y: nodeY + (explicitY ?? 0) };
  }
  return { x: nodeX + (explicitX ?? resolveAxisPosition(nodeWidth)), y: nodeY + (explicitY ?? nodeHeight) };
}

interface RoutingRect {
  id: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface EdgeRoutingContext {
  sourceNode: IFlowNodeEntityData;
  targetNode: IFlowNodeEntityData;
  sourcePosition: Position;
  targetPosition: Position;
  nodes: IFlowNodeEntityData[];
  parallelIndex: number;
  parallelCount: number;
  pathConfig?: Partial<PathConfig>;
}

function getNodeRoutingRect(node: IFlowNodeEntityData, padding = 20): RoutingRect {
  const x = node.position?.x ?? 0;
  const y = node.position?.y ?? 0;
  const width = node.size?.width ?? 200;
  const height = node.size?.height ?? 100;

  return {
    id: node.id,
    minX: x - padding,
    minY: y - padding,
    maxX: x + width + padding,
    maxY: y + height + padding,
  };
}

function segmentIntersectsRect(a: Position, b: Position, rect: RoutingRect): boolean {
  if (Math.abs(a.x - b.x) < 0.001) {
    const x = a.x;
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    return x >= rect.minX && x <= rect.maxX && maxY >= rect.minY && minY <= rect.maxY;
  }

  if (Math.abs(a.y - b.y) < 0.001) {
    const y = a.y;
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    return y >= rect.minY && y <= rect.maxY && maxX >= rect.minX && minX <= rect.maxX;
  }

  return false;
}

function routeIntersectsRects(points: Position[], rects: RoutingRect[]): boolean {
  for (let index = 0; index < points.length - 1; index += 1) {
    const a = points[index];
    const b = points[index + 1];
    if (!a || !b) {
      continue;
    }
    if (rects.some((rect) => segmentIntersectsRect(a, b, rect))) {
      return true;
    }
  }

  return false;
}

function compactRoutePoints(points: Position[]): Position[] {
  const compacted: Position[] = [];

  for (const point of points) {
    const previous = compacted[compacted.length - 1];
    if (previous && Math.abs(previous.x - point.x) < 0.001 && Math.abs(previous.y - point.y) < 0.001) {
      continue;
    }

    const beforePrevious = compacted[compacted.length - 2];
    if (
      beforePrevious &&
      previous &&
      ((Math.abs(beforePrevious.x - previous.x) < 0.001 &&
        Math.abs(previous.x - point.x) < 0.001) ||
        (Math.abs(beforePrevious.y - previous.y) < 0.001 &&
          Math.abs(previous.y - point.y) < 0.001))
    ) {
      compacted[compacted.length - 1] = point;
      continue;
    }

    compacted.push(point);
  }

  return compacted;
}

function buildRoundedOrthogonalPath(points: Position[], radius = 12): string {
  const compacted = compactRoutePoints(points);
  if (compacted.length === 0) {
    return "";
  }
  if (compacted.length === 1) {
    return `M ${compacted[0].x} ${compacted[0].y}`;
  }

  let path = `M ${compacted[0].x} ${compacted[0].y}`;

  for (let index = 1; index < compacted.length - 1; index += 1) {
    const previous = compacted[index - 1];
    const current = compacted[index];
    const next = compacted[index + 1];
    const beforeLength = Math.hypot(current.x - previous.x, current.y - previous.y);
    const afterLength = Math.hypot(next.x - current.x, next.y - current.y);
    const cornerRadius = Math.min(radius, beforeLength / 2, afterLength / 2);

    if (cornerRadius <= 0) {
      path += ` L ${current.x} ${current.y}`;
      continue;
    }

    const beforePoint = {
      x: current.x + ((previous.x - current.x) / beforeLength) * cornerRadius,
      y: current.y + ((previous.y - current.y) / beforeLength) * cornerRadius,
    };
    const afterPoint = {
      x: current.x + ((next.x - current.x) / afterLength) * cornerRadius,
      y: current.y + ((next.y - current.y) / afterLength) * cornerRadius,
    };

    path += ` L ${beforePoint.x} ${beforePoint.y} Q ${current.x} ${current.y} ${afterPoint.x} ${afterPoint.y}`;
  }

  const last = compacted[compacted.length - 1];
  return `${path} L ${last.x} ${last.y}`;
}

function buildLaneCandidates(rects: RoutingRect[], sourceY: number, targetY: number, offset: number): number[] {
  if (rects.length === 0) {
    return [sourceY + offset, targetY + offset, (sourceY + targetY) / 2 + offset];
  }

  const sorted = [...rects].sort((a, b) => a.minY - b.minY);
  const minY = Math.min(...rects.map((rect) => rect.minY));
  const maxY = Math.max(...rects.map((rect) => rect.maxY));
  const lanes = [
    sourceY + offset,
    targetY + offset,
    (sourceY + targetY) / 2 + offset,
    minY - 56 + offset,
    maxY + 56 + offset,
  ];

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const upper = sorted[index];
    const lower = sorted[index + 1];
    const gap = lower.minY - upper.maxY;
    if (gap >= 48) {
      lanes.push(upper.maxY + gap / 2 + offset);
    }
  }

  return [...new Set(lanes.map((lane) => Math.round(lane)))];
}

function buildOrthogonalRoute({
  sourceNode,
  targetNode,
  sourcePosition,
  targetPosition,
  nodes,
  parallelIndex,
  parallelCount,
  pathConfig,
}: EdgeRoutingContext): EdgeRoute {
  const sourceRect = getNodeRoutingRect(sourceNode, 0);
  const targetRect = getNodeRoutingRect(targetNode, 0);
  const obstacleRects = nodes
    .filter((node) => node.id !== sourceNode.id && node.id !== targetNode.id)
    .map((node) => getNodeRoutingRect(node, 24));
  const direction = sourcePosition.x <= targetPosition.x ? 1 : -1;
  const parallelOffset = (parallelIndex - (parallelCount - 1) / 2) * 18;
  const stub =
    typeof pathConfig?.offset === "number" ? Math.max(24, pathConfig.offset) : 56;
  const cornerRadius =
    typeof pathConfig?.borderRadius === "number" ? Math.max(0, pathConfig.borderRadius) : 14;
  const sourceStub = { x: sourcePosition.x + direction * stub, y: sourcePosition.y };
  const targetStub = { x: targetPosition.x - direction * stub, y: targetPosition.y };
  const candidateLanes = buildLaneCandidates(
    obstacleRects,
    sourcePosition.y,
    targetPosition.y,
    parallelOffset,
  );

  const candidateRoutes = candidateLanes.map((laneY) =>
    compactRoutePoints([
      sourcePosition,
      sourceStub,
      { x: sourceStub.x, y: laneY },
      { x: targetStub.x, y: laneY },
      targetStub,
      targetPosition,
    ]),
  );

  const nonIntersectingRoute =
    candidateRoutes.find((points) => !routeIntersectsRects(points, obstacleRects)) ??
    compactRoutePoints([
      sourcePosition,
      sourceStub,
      {
        x: sourceStub.x,
        y:
          sourceRect.maxY <= targetRect.minY
            ? Math.min(sourceRect.maxY, targetRect.minY) + parallelOffset
            : Math.max(sourceRect.maxY, targetRect.maxY) + 72 + parallelOffset,
      },
      {
        x: targetStub.x,
        y:
          sourceRect.maxY <= targetRect.minY
            ? Math.min(sourceRect.maxY, targetRect.minY) + parallelOffset
            : Math.max(sourceRect.maxY, targetRect.maxY) + 72 + parallelOffset,
      },
      targetStub,
      targetPosition,
    ]);

  return {
    points: nonIntersectingRoute,
    path: buildRoundedOrthogonalPath(nonIntersectingRoute, cornerRadius),
    parallelIndex,
    parallelCount,
    parallelOffset,
  };
}

function getParallelEdgeKey(edge: IFlowEdgeEntityData): string {
  return [
    edge.sourceNodeId,
    edge.sourcePortId,
    edge.targetNodeId,
    edge.targetPortId,
  ].join("::");
}

function arePortTypesCompatible(sourceType?: PortDataType, targetType?: PortDataType): boolean {
  if (!sourceType || !targetType || sourceType === "any" || targetType === "any") {
    return true;
  }
  if (sourceType === targetType) {
    return true;
  }
  return (
    (sourceType === "number" && targetType === "string") ||
    (sourceType === "boolean" && targetType === "string")
  );
}

function getConnectionKey(
  sourceNodeId: string,
  sourcePortId: string,
  targetNodeId: string,
  targetPortId: string
): string {
  return `${sourceNodeId}:${sourcePortId}->${targetNodeId}:${targetPortId}`;
}

function normalizePortConnection(
  source: FlowCanvasPortEndpoint,
  target: FlowCanvasPortEndpoint
): FlowCanvasPortConnection | null {
  if (source.port.type === "output" && target.port.type === "input") {
    return { source, target };
  }
  if (source.port.type === "input" && target.port.type === "output") {
    return { source: target, target: source };
  }
  return null;
}

function getDefaultConnectionValidation(
  connection: FlowCanvasPortConnection,
  edges: IFlowEdgeEntityData[],
  portConfig?: Partial<PortSystemConfig>
): ConnectionValidationResult {
  const { source, target } = connection;
  if (source.nodeId === target.nodeId) {
    return { valid: false, reason: "Cannot connect a node to itself" };
  }

  const connectionKey = getConnectionKey(source.nodeId, source.portId, target.nodeId, target.portId);
  if (
    edges.some(
      (edge) =>
        getConnectionKey(edge.sourceNodeId, edge.sourcePortId, edge.targetNodeId, edge.targetPortId) ===
        connectionKey
    )
  ) {
    return { valid: false, reason: "Connection already exists" };
  }

  if (
    target.port.allowMultiple !== true &&
    edges.some((edge) => edge.targetNodeId === target.nodeId && edge.targetPortId === target.portId)
  ) {
    return { valid: false, reason: "Target input already has a connection" };
  }

  if (
    portConfig?.enableTypeChecking !== false &&
    portConfig?.allowIncompatibleConnections !== true &&
    !arePortTypesCompatible(source.port.dataType, target.port.dataType)
  ) {
    return {
      valid: false,
      reason: `Incompatible port types: ${source.port.dataType ?? "any"} -> ${target.port.dataType ?? "any"}`,
    };
  }

  return { valid: true };
}

function getPortKey(nodeId: string, portId: string): string {
  return `${nodeId}:${portId}`;
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
  const [hoveredPortKey, setHoveredPortKey] = useState<string | null>(null);
  const [connectionDraft, setConnectionDraft] = useState<{
    source: FlowCanvasPortEndpoint;
    pointer: Position;
    target: FlowCanvasPortEndpoint | null;
    validation: ConnectionValidationResult;
  } | null>(null);
  const [connectionError, setConnectionError] = useState<{
    message: string;
    position: Position;
  } | null>(null);

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
  const parallelEdgeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const edge of edges) {
      const key = getParallelEdgeKey(edge);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [edges]);
  const parallelEdgeIndexes = useMemo(() => {
    const counters = new Map<string, number>();
    const indexes = new Map<string, number>();
    for (const edge of edges) {
      const key = getParallelEdgeKey(edge);
      const index = counters.get(key) ?? 0;
      counters.set(key, index + 1);
      indexes.set(edge.id, index);
    }
    return indexes;
  }, [edges]);
  const edgeRenderItems = useMemo<FlowCanvasEdgeRenderItem[]>(() => {
    return edges.flatMap((edge) => {
      const sourceNode = nodes.find((node) => node.id === edge.sourceNodeId);
      const targetNode = nodes.find((node) => node.id === edge.targetNodeId);

      if (!sourceNode || !targetNode) {
        return [];
      }

      const sourcePosition = resolveNodePortPosition(sourceNode, edge.sourcePortId, "output");
      const targetPosition = resolveNodePortPosition(targetNode, edge.targetPortId, "input");
      const parallelKey = getParallelEdgeKey(edge);
      const route = buildOrthogonalRoute({
        sourceNode,
        targetNode,
        sourcePosition,
        targetPosition,
        nodes,
        parallelIndex: parallelEdgeIndexes.get(edge.id) ?? 0,
        parallelCount: parallelEdgeCounts.get(parallelKey) ?? 1,
        pathConfig: edge.pathConfig ?? pathConfig,
      });

      return [
        {
          edge,
          sourceNode,
          targetNode,
          sourcePosition,
          targetPosition,
          route,
          selected: selectedEdgeIds.has(edge.id),
        },
      ];
    });
  }, [edges, nodes, parallelEdgeCounts, parallelEdgeIndexes, pathConfig, selectedEdgeIds]);
  const portRenderItems = useMemo<FlowCanvasPortRenderItem[]>(() => {
    return nodes.flatMap((node) => {
      const ports = [
        ...(node.inputPorts ?? []).map((port) => ({ port, direction: "input" as const })),
        ...(node.outputPorts ?? []).map((port) => ({ port, direction: "output" as const })),
      ];

      return ports.map(({ port, direction }) => {
        const position = resolveNodePortPosition(node, port.id, direction);
        return {
          key: getPortKey(node.id, port.id),
          node,
          port,
          direction,
          position,
          connected: edges.some(
            (edge) =>
              (edge.sourceNodeId === node.id && edge.sourcePortId === port.id) ||
              (edge.targetNodeId === node.id && edge.targetPortId === port.id)
          ),
        };
      });
    });
  }, [edges, nodes]);
  const renderModel = useMemo<FlowCanvasRenderModel>(
    () => ({
      engine: renderEngine,
      nodes: nodes.map((node) => ({
        node,
        selected: selectedNodeIds.has(node.id),
      })),
      ports: portRenderItems,
      edges: edgeRenderItems,
    }),
    [edgeRenderItems, nodes, portRenderItems, renderEngine, selectedNodeIds]
  );

  useEffect(() => {
    onRenderModelChange?.(renderModel);
  }, [onRenderModelChange, renderModel]);

  const validatePortConnection = useCallback(
    (source: FlowCanvasPortEndpoint, target: FlowCanvasPortEndpoint): ConnectionValidationResult => {
      const normalized = normalizePortConnection(source, target);
      if (!normalized) {
        return { valid: false, reason: "Connect an output port to an input port" };
      }

      const defaultValidation = getDefaultConnectionValidation(normalized, edges, portConfig);
      if (!defaultValidation.valid) {
        return defaultValidation;
      }

      return validateConnection?.(normalized) ?? defaultValidation;
    },
    [edges, portConfig, validateConnection]
  );

  const completePortConnection = useCallback(
    (source: FlowCanvasPortEndpoint, target: FlowCanvasPortEndpoint): boolean => {
      const normalized = normalizePortConnection(source, target);
      if (!normalized) {
        return false;
      }

      const validation = validatePortConnection(source, target);
      if (!validation.valid) {
        setConnectionError({
          message: validation.reason ?? "Invalid connection",
          position: target.position,
        });
        return false;
      }

      onEdgeCreate?.(
        normalized.source.nodeId,
        normalized.source.portId,
        normalized.target.nodeId,
        normalized.target.portId
      );
      return true;
    },
    [onEdgeCreate, validatePortConnection]
  );

  useEffect(() => {
    if (!connectionError) {
      return undefined;
    }

    const timer = window.setTimeout(() => setConnectionError(null), 1800);
    return () => window.clearTimeout(timer);
  }, [connectionError]);

  useEffect(() => {
    if (!connectionDraft) {
      return undefined;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const pointer = screenEventToCanvasPosition(event);
      if (!pointer) {
        return;
      }
      setConnectionDraft((prev) => (prev ? { ...prev, pointer } : prev));
    };

    const handleMouseUp = () => {
      setConnectionDraft((prev) => {
        if (prev?.target) {
          completePortConnection(prev.source, prev.target);
        }
        return null;
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [completePortConnection, connectionDraft, screenEventToCanvasPosition]);

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
            ? renderModel.ports.map(({ key, node, port, direction, position, connected }) => {
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
                        setHoveredPortKey(portKey);
                        setConnectionDraft((prev) => {
                          if (!prev) {
                            return prev;
                          }
                          const nextValidation = validatePortConnection(prev.source, endpoint);
                          return {
                            ...prev,
                            target: endpoint,
                            validation: nextValidation,
                          };
                        });
                      }}
                      onMouseLeave={() => {
                        setHoveredPortKey((prev) => (prev === portKey ? null : prev));
                        setConnectionDraft((prev) => {
                          if (!prev || prev.target?.nodeId !== node.id || prev.target.portId !== port.id) {
                            return prev;
                          }
                          return {
                            ...prev,
                            target: null,
                            validation: { valid: true },
                          };
                        });
                      }}
                      onMouseDown={(event) => {
                        if (event.button !== 0) {
                          return;
                        }
                        event.preventDefault();
                        event.stopPropagation();
                        setConnectionError(null);
                        setConnectionDraft({
                          source: endpoint,
                          pointer: position,
                          target: null,
                          validation: { valid: true },
                        });
                      }}
                      onMouseUp={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (!connectionDraft) {
                          return;
                        }
                        completePortConnection(connectionDraft.source, endpoint);
                        setConnectionDraft(null);
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
  const dragRef = useRef<{
    pointerStart: Position;
    nodeStart: Position;
    scale: number;
    dragging: boolean;
  } | null>(null);

  const handleMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }

      event.stopPropagation();
      if (interaction.selectNodes) {
        onNodeSelect?.([node.id]);
      }

      if (!interaction.dragNodes || !onNodeMove) {
        return;
      }

      event.preventDefault();
      dragRef.current = {
        pointerStart: { x: event.clientX, y: event.clientY },
        nodeStart: {
          x: node.position?.x ?? 0,
          y: node.position?.y ?? 0,
        },
        scale: (viewport?.viewport.scale || 1) * (interactionScale || 1),
        dragging: true,
      };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const drag = dragRef.current;
        if (!drag?.dragging) {
          return;
        }

        onNodeMove(node.id, {
          x: drag.nodeStart.x + (moveEvent.clientX - drag.pointerStart.x) / drag.scale,
          y: drag.nodeStart.y + (moveEvent.clientY - drag.pointerStart.y) / drag.scale,
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
    [node, onNodeMove, onNodeSelect, interaction, viewport?.viewport.scale, interactionScale]
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
  showMinimap = false,
  showZoomControls = false,
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
