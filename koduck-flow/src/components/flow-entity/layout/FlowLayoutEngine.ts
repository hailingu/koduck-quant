import type { IFlowEdgeEntityData, IFlowNodeEntityData, Position, Size } from "../types";

export type FlowLayoutStrategy = "horizontal-dag" | "vertical-dag" | "freeform";

export interface FlowLayoutOptions {
  strategy?: FlowLayoutStrategy;
  origin?: Position;
  nodeSize?: Size;
  horizontalGap?: number;
  verticalGap?: number;
}

export interface FlowLayoutResult {
  nodes: IFlowNodeEntityData[];
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
}

const DEFAULT_NODE_SIZE: Size = { width: 300, height: 220 };
const DEFAULT_ORIGIN: Position = { x: 48, y: 60 };
const DEFAULT_HORIZONTAL_GAP = 180;
const DEFAULT_VERTICAL_GAP = 80;

function getNodeSize(node: IFlowNodeEntityData, fallback: Size): Size {
  return {
    width: node.size?.width ?? fallback.width,
    height: node.size?.height ?? fallback.height,
  };
}

export function calculateFlowGraphBounds(
  nodes: IFlowNodeEntityData[],
  fallbackSize: Size = DEFAULT_NODE_SIZE
): FlowLayoutResult["bounds"] {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  const raw = nodes.reduce(
    (bounds, node) => {
      const size = getNodeSize(node, fallbackSize);
      const x = node.position?.x ?? 0;
      const y = node.position?.y ?? 0;
      return {
        minX: Math.min(bounds.minX, x),
        minY: Math.min(bounds.minY, y),
        maxX: Math.max(bounds.maxX, x + size.width),
        maxY: Math.max(bounds.maxY, y + size.height),
      };
    },
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    }
  );

  return {
    ...raw,
    width: raw.maxX - raw.minX,
    height: raw.maxY - raw.minY,
  };
}

function buildRanks(nodes: IFlowNodeEntityData[], edges: IFlowEdgeEntityData[]): Map<string, number> {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const incomingCount = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  nodes.forEach((node) => {
    incomingCount.set(node.id, 0);
    outgoing.set(node.id, []);
  });

  edges.forEach((edge) => {
    if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)) {
      return;
    }
    outgoing.get(edge.sourceNodeId)?.push(edge.targetNodeId);
    incomingCount.set(edge.targetNodeId, (incomingCount.get(edge.targetNodeId) ?? 0) + 1);
  });

  const queue = nodes.filter((node) => (incomingCount.get(node.id) ?? 0) === 0);
  const ranks = new Map<string, number>();
  queue.forEach((node) => ranks.set(node.id, 0));

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    const currentRank = ranks.get(current.id) ?? 0;

    for (const targetId of outgoing.get(current.id) ?? []) {
      ranks.set(targetId, Math.max(ranks.get(targetId) ?? 0, currentRank + 1));
      incomingCount.set(targetId, (incomingCount.get(targetId) ?? 0) - 1);
      if ((incomingCount.get(targetId) ?? 0) === 0) {
        const target = nodes.find((node) => node.id === targetId);
        if (target) {
          queue.push(target);
        }
      }
    }
  }

  nodes.forEach((node, index) => {
    if (!ranks.has(node.id)) {
      ranks.set(node.id, index);
    }
  });

  return ranks;
}

function layoutDag(
  nodes: IFlowNodeEntityData[],
  edges: IFlowEdgeEntityData[],
  options: Required<Omit<FlowLayoutOptions, "strategy">>,
  direction: "horizontal" | "vertical"
): IFlowNodeEntityData[] {
  const ranks = buildRanks(nodes, edges);
  const rankGroups = new Map<number, IFlowNodeEntityData[]>();

  nodes.forEach((node) => {
    const rank = ranks.get(node.id) ?? 0;
    const group = rankGroups.get(rank) ?? [];
    group.push(node);
    rankGroups.set(rank, group);
  });

  const orderedRanks = Array.from(rankGroups.keys()).sort((a, b) => a - b);
  const maxRankWidth = new Map<number, number>();
  const maxRankHeight = new Map<number, number>();

  orderedRanks.forEach((rank) => {
    const group = rankGroups.get(rank) ?? [];
    maxRankWidth.set(
      rank,
      Math.max(...group.map((node) => getNodeSize(node, options.nodeSize).width), options.nodeSize.width)
    );
    maxRankHeight.set(
      rank,
      Math.max(...group.map((node) => getNodeSize(node, options.nodeSize).height), options.nodeSize.height)
    );
  });

  const rankOffsets = new Map<number, number>();
  let offset = direction === "horizontal" ? options.origin.x : options.origin.y;
  orderedRanks.forEach((rank) => {
    rankOffsets.set(rank, offset);
    offset +=
      (direction === "horizontal" ? maxRankWidth.get(rank)! : maxRankHeight.get(rank)!) +
      (direction === "horizontal" ? options.horizontalGap : options.verticalGap);
  });

  return nodes.map((node) => {
    const rank = ranks.get(node.id) ?? 0;
    const group = rankGroups.get(rank) ?? [node];
    const indexInRank = group.findIndex((item) => item.id === node.id);
    const size = getNodeSize(node, options.nodeSize);
    const crossOffset = group
      .slice(0, indexInRank)
      .reduce(
        (sum, item) =>
          sum +
          (direction === "horizontal"
            ? getNodeSize(item, options.nodeSize).height + options.verticalGap
            : getNodeSize(item, options.nodeSize).width + options.horizontalGap),
        0
      );

    const position =
      direction === "horizontal"
        ? {
            x: rankOffsets.get(rank) ?? options.origin.x,
            y: options.origin.y + crossOffset,
          }
        : {
            x: options.origin.x + crossOffset,
            y: rankOffsets.get(rank) ?? options.origin.y,
          };

    return {
      ...node,
      position,
      size,
    };
  });
}

export function layoutFlowGraph(
  nodes: IFlowNodeEntityData[],
  edges: IFlowEdgeEntityData[] = [],
  options: FlowLayoutOptions = {}
): FlowLayoutResult {
  const resolvedOptions: Required<Omit<FlowLayoutOptions, "strategy">> = {
    origin: options.origin ?? DEFAULT_ORIGIN,
    nodeSize: options.nodeSize ?? DEFAULT_NODE_SIZE,
    horizontalGap: options.horizontalGap ?? DEFAULT_HORIZONTAL_GAP,
    verticalGap: options.verticalGap ?? DEFAULT_VERTICAL_GAP,
  };
  const strategy = options.strategy ?? "horizontal-dag";

  const laidOutNodes =
    strategy === "freeform"
      ? nodes.map((node) => ({ ...node, size: getNodeSize(node, resolvedOptions.nodeSize) }))
      : layoutDag(
          nodes,
          edges,
          resolvedOptions,
          strategy === "vertical-dag" ? "vertical" : "horizontal"
        );

  return {
    nodes: laidOutNodes,
    bounds: calculateFlowGraphBounds(laidOutNodes, resolvedOptions.nodeSize),
  };
}
