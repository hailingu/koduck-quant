import type {
  IFlowEdgeEntityData,
  IFlowNodeEntityData,
  PathConfig,
  PortDefinition,
  Position,
} from "../types";
import { buildOrthogonalRoute, type EdgeRoute } from "./edge-routing";
import { resolveNodePortPosition } from "./port-layout";

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

interface BuildFlowCanvasRenderModelOptions {
  nodes: IFlowNodeEntityData[];
  edges: IFlowEdgeEntityData[];
  selectedNodeIds: ReadonlySet<string>;
  selectedEdgeIds: ReadonlySet<string>;
  renderEngine: FlowCanvasRenderEngine;
  pathConfig?: Partial<PathConfig>;
}

function getParallelEdgeKey(edge: IFlowEdgeEntityData): string {
  return [
    edge.sourceNodeId,
    edge.sourcePortId,
    edge.targetNodeId,
    edge.targetPortId,
  ].join("::");
}

/**
 * Build the stable render key used for a node port.
 *
 * @param nodeId - Node identifier.
 * @param portId - Port identifier.
 * @returns Stable port render key.
 */
export function getPortKey(nodeId: string, portId: string): string {
  return `${nodeId}:${portId}`;
}

/**
 * Build the normalized render model consumed by FlowCanvas render backends.
 *
 * @returns Render model for nodes, ports, and edges.
 */
export function buildFlowCanvasRenderModel({
  nodes,
  edges,
  selectedNodeIds,
  selectedEdgeIds,
  renderEngine,
  pathConfig,
}: BuildFlowCanvasRenderModelOptions): FlowCanvasRenderModel {
  const parallelEdgeCounts = new Map<string, number>();
  for (const edge of edges) {
    const key = getParallelEdgeKey(edge);
    parallelEdgeCounts.set(key, (parallelEdgeCounts.get(key) ?? 0) + 1);
  }

  const parallelEdgeIndexes = new Map<string, number>();
  const parallelEdgeCounters = new Map<string, number>();
  for (const edge of edges) {
    const key = getParallelEdgeKey(edge);
    const index = parallelEdgeCounters.get(key) ?? 0;
    parallelEdgeCounters.set(key, index + 1);
    parallelEdgeIndexes.set(edge.id, index);
  }

  const edgeRenderItems = edges.flatMap<FlowCanvasEdgeRenderItem>((edge) => {
    const sourceNode = nodes.find((node) => node.id === edge.sourceNodeId);
    const targetNode = nodes.find((node) => node.id === edge.targetNodeId);

    if (!sourceNode || !targetNode) {
      return [];
    }

    const sourcePosition = resolveNodePortPosition(sourceNode, edge.sourcePortId, "output");
    const targetPosition = resolveNodePortPosition(targetNode, edge.targetPortId, "input");
    const parallelKey = getParallelEdgeKey(edge);
    const routePathConfig = edge.pathConfig ?? pathConfig;
    const route = buildOrthogonalRoute({
      sourceNode,
      targetNode,
      sourcePosition,
      targetPosition,
      nodes,
      parallelIndex: parallelEdgeIndexes.get(edge.id) ?? 0,
      parallelCount: parallelEdgeCounts.get(parallelKey) ?? 1,
      ...(routePathConfig === undefined ? {} : { pathConfig: routePathConfig }),
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

  const portRenderItems = nodes.flatMap<FlowCanvasPortRenderItem>((node) => {
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

  return {
    engine: renderEngine,
    nodes: nodes.map((node) => ({
      node,
      selected: selectedNodeIds.has(node.id),
    })),
    ports: portRenderItems,
    edges: edgeRenderItems,
  };
}
