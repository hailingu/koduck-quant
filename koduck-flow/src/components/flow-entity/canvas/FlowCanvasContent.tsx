import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import type {
  IFlowEdgeEntityData,
  IFlowNodeEntityData,
  PathConfig,
  PortSystemConfig,
  Position,
} from "../types";
import { FlowNodeShellContext } from "../node/FlowNodeShellContext";
import type {
  EdgeRenderProps,
  FlowCanvasInteraction,
  NodeRenderProps,
} from "./FlowCanvas";
import { FlowGrid, type GridPattern } from "./FlowGrid";
import { useViewportOptional } from "./FlowViewport";
import type {
  ConnectionValidationResult,
  FlowCanvasPortConnection,
  FlowCanvasPortEndpoint,
} from "./connection-validation";
import { buildRoundedOrthogonalPath, compactRoutePoints } from "./edge-routing";
import {
  buildFlowCanvasRenderModel,
  getPortKey,
  type FlowCanvasRenderEngine,
  type FlowCanvasRenderModel,
} from "./render-model";
import { useNodeDrag } from "./use-node-drag";
import { usePortConnectionDrag } from "./use-port-connection-drag";

interface FlowCanvasContentProps {
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
  const nodeWidth = node.size?.width ?? 200;
  const nodeHeight = node.size?.height ?? 100;
  const shellContextValue = useMemo(
    () => ({ managedByCanvas: true, selected }),
    [selected]
  );
  const handlePressStart = useNodeDrag({
    node,
    selectNodes: interaction.selectNodes,
    dragNodes: interaction.dragNodes,
    viewportScale: viewport?.viewport.scale ?? 1,
    interactionScale,
    ...(onNodeSelect === undefined ? {} : { onNodeSelect }),
    ...(onNodeMove === undefined ? {} : { onNodeMove }),
  });

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if ((event.key === "Enter" || event.key === " ") && interaction.selectNodes) {
        event.preventDefault();
        onNodeSelect?.([node.id]);
        return;
      }

      if (!interaction.dragNodes || !onNodeMove) {
        return;
      }

      const direction: Record<string, Position> = {
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
      };
      const delta = direction[event.key];
      if (!delta) {
        return;
      }

      event.preventDefault();
      if (interaction.selectNodes) {
        onNodeSelect?.([node.id]);
      }

      const step = event.shiftKey ? 50 : event.altKey ? 1 : 10;
      onNodeMove(node.id, {
        x: (node.position?.x ?? 0) + delta.x * step,
        y: (node.position?.y ?? 0) + delta.y * step,
      });
    },
    [interaction.dragNodes, interaction.selectNodes, node, onNodeMove, onNodeSelect]
  );

  return (
    <div
      role="button"
      tabIndex={0}
      data-node-id={node.id}
      aria-label={node.label || "Node"}
      aria-pressed={selected}
      onKeyDown={handleKeyDown}
      style={{
        position: "absolute",
        left: node.position?.x ?? 0,
        top: node.position?.y ?? 0,
        width: nodeWidth,
        height: nodeHeight,
        cursor: interaction.dragNodes ? "grab" : "default",
        userSelect: interaction.dragNodes ? "none" : undefined,
        background: "transparent",
        border: 0,
        padding: 0,
        textAlign: "inherit",
        font: "inherit",
        color: "inherit",
      }}
      onPointerDown={handlePressStart}
      onMouseDown={handlePressStart}
    >
      <FlowNodeShellContext.Provider value={shellContextValue}>
        {renderNode({
          node,
          selected,
        })}
      </FlowNodeShellContext.Provider>
    </div>
  );
};

CanvasNodeContainer.displayName = "CanvasNodeContainer";

export const CanvasContent: React.FC<FlowCanvasContentProps> = ({
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

  const handleClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) return;

      const rect = contentRef.current?.getBoundingClientRect();
      if (!rect) return;

      const screenX = event.clientX - rect.left;
      const screenY = event.clientY - rect.top;
      const canvasPosition = viewport
        ? viewport.screenToCanvas(screenX, screenY)
        : { x: screenX, y: screenY };

      onCanvasClick?.(canvasPosition, event);
    },
    [viewport, onCanvasClick]
  );

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

  const { translateX = 0, translateY = 0, scale = 1 } = viewport?.viewport ?? {};
  const gridScale = scale || 1;
  const portSize = portConfig?.portSize ?? 12;
  const portHitSize = Math.max(24, portSize + 14);
  const screenEventToCanvasPosition = useCallback(
    (event: PointerEvent | ReactMouseEvent): Position | null => {
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
        ...(pathConfig === undefined ? {} : { pathConfig }),
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
    ...(portConfig === undefined ? {} : { portConfig }),
    ...(validateConnection === undefined ? {} : { validateConnection }),
    ...(onEdgeCreate === undefined ? {} : { onEdgeCreate }),
  });

  return (
    <>
      {showGrid && (
        <FlowGrid
          translateX={translateX}
          translateY={translateY}
          scale={scale}
          {...(gridPattern === undefined ? {} : { pattern: gridPattern })}
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

      <div
        ref={contentRef}
        role="button"
        tabIndex={0}
        data-testid="flow-canvas-content"
        aria-label="Flow canvas"
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
          }
        }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1,
          background: "transparent",
          border: 0,
          padding: 0,
          textAlign: "inherit",
          font: "inherit",
          color: "inherit",
        }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
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
                  renderNode={renderNode}
                  {...(onNodeSelect === undefined ? {} : { onNodeSelect })}
                  {...(onNodeMove === undefined ? {} : { onNodeMove })}
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
                let color: string;
                if (
                  draftTarget &&
                  connectionDraft?.validation.valid === false
                ) {
                  color = "#dc2626";
                } else if (validation && !validation.valid) {
                  color = "#dc2626";
                } else {
                  color = "#2563eb";
                }

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
                    onPointerEnter={() => {
                      hoverPort(portKey, endpoint);
                    }}
                    onPointerLeave={() => {
                      leavePort(portKey, endpoint);
                    }}
                    onPointerDown={(event) => {
                      if (event.button !== 0) {
                        return;
                      }
                      event.preventDefault();
                      event.stopPropagation();
                      event.currentTarget.setPointerCapture?.(event.pointerId);
                      beginConnection(endpoint);
                    }}
                    onPointerUp={(event) => {
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
            <output
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
            </output>
          ) : null}
        </div>

        {children}
      </div>
    </>
  );
};

CanvasContent.displayName = "CanvasContent";
