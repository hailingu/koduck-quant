import type { IFlowNodeEntityData, PathConfig, Position } from "../types";

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

/**
 * Remove duplicate and collinear points from an orthogonal route.
 *
 * @param points - Candidate route points.
 * @returns Compacted route points.
 */
export function compactRoutePoints(points: Position[]): Position[] {
  const compacted: Position[] = [];

  for (const point of points) {
    const previous = compacted.at(-1);
    if (
      previous &&
      Math.abs(previous.x - point.x) < 0.001 &&
      Math.abs(previous.y - point.y) < 0.001
    ) {
      continue;
    }

    const beforePrevious = compacted.at(-2);
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

/**
 * Build an SVG path for an orthogonal polyline with rounded corners.
 *
 * @param points - Route points in canvas coordinates.
 * @param radius - Maximum corner radius.
 * @returns SVG path data.
 */
export function buildRoundedOrthogonalPath(points: Position[], radius = 12): string {
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

  const last = compacted.at(-1);
  if (!last) return path;
  return `${path} L ${last.x} ${last.y}`;
}

function buildLaneCandidates(
  rects: RoutingRect[],
  sourceY: number,
  targetY: number,
  offset: number
): number[] {
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

/**
 * Build a routed edge path that avoids node obstacles when possible.
 *
 * @param root0 - Routing context.
 * @param root0.sourceNode - Source node.
 * @param root0.targetNode - Target node.
 * @param root0.sourcePosition - Source port position.
 * @param root0.targetPosition - Target port position.
 * @param root0.nodes - Nodes used as routing obstacles.
 * @param root0.parallelIndex - Edge index within its parallel group.
 * @param root0.parallelCount - Number of edges in the parallel group.
 * @param root0.pathConfig - Optional path rendering configuration.
 * @returns Routed edge geometry.
 */
export function buildOrthogonalRoute({
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
  const stub = typeof pathConfig?.offset === "number" ? Math.max(24, pathConfig.offset) : 56;
  const cornerRadius =
    typeof pathConfig?.borderRadius === "number" ? Math.max(0, pathConfig.borderRadius) : 14;
  const sourceStub = { x: sourcePosition.x + direction * stub, y: sourcePosition.y };
  const targetStub = { x: targetPosition.x - direction * stub, y: targetPosition.y };
  const candidateLanes = buildLaneCandidates(
    obstacleRects,
    sourcePosition.y,
    targetPosition.y,
    parallelOffset
  );

  const candidateRoutes = candidateLanes.map((laneY) =>
    compactRoutePoints([
      sourcePosition,
      sourceStub,
      { x: sourceStub.x, y: laneY },
      { x: targetStub.x, y: laneY },
      targetStub,
      targetPosition,
    ])
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
