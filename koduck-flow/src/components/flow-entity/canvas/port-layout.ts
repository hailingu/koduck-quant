import type {
  IFlowNodeEntityData,
  PortAlignment,
  PortSide,
  Position,
} from "../types";

const isPortSide = (value: unknown): value is PortSide =>
  value === "left" || value === "right" || value === "top" || value === "bottom";

const isPortAlignment = (value: unknown): value is PortAlignment =>
  value === "center" || value === "start" || value === "end" || value === "distributed";

function resolveAxisPosition(
  length: number,
  alignment: PortAlignment,
  total: number,
  index: number
): number {
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
}

/**
 * Resolve a node port anchor into absolute canvas coordinates.
 *
 * @param node - Node containing the port.
 * @param portId - Port identifier to resolve.
 * @param direction - Port direction used to choose the input or output collection.
 * @returns Absolute port position in canvas coordinates.
 */
export function resolveNodePortPosition(
  node: IFlowNodeEntityData,
  portId: string,
  direction: "input" | "output"
): Position {
  const nodeX = node.position?.x ?? 0;
  const nodeY = node.position?.y ?? 0;
  const nodeWidth = node.size?.width ?? 200;
  const nodeHeight = node.size?.height ?? 100;
  const config = node.config ?? {};
  const ports = direction === "input" ? node.inputPorts ?? [] : node.outputPorts ?? [];
  const index = Math.max(
    0,
    ports.findIndex((port) => port.id === portId)
  );
  const total = Math.max(ports.length, 1);
  const port = ports[index];
  const portLayouts = config.portLayouts as Record<string, unknown> | undefined;
  const legacyPortAnchors = config.portAnchors as Record<string, unknown> | undefined;
  const layoutSource =
    (portLayouts?.[portId] as Record<string, unknown> | undefined) ??
    (legacyPortAnchors?.[portId] as Record<string, unknown> | undefined);

  let side: PortSide;
  if (isPortSide(port?.side)) {
    side = port.side;
  } else if (isPortSide(layoutSource?.side)) {
    side = layoutSource.side;
  } else if (direction === "input") {
    side = "left";
  } else {
    side = "right";
  }

  let alignment: PortAlignment;
  if (isPortAlignment(port?.alignment)) {
    alignment = port.alignment;
  } else if (isPortAlignment(layoutSource?.alignment)) {
    alignment = layoutSource.alignment;
  } else if (total === 1) {
    alignment = "center";
  } else {
    alignment = "distributed";
  }

  const explicitX = typeof layoutSource?.x === "number" ? layoutSource.x : undefined;
  const explicitY = typeof layoutSource?.y === "number" ? layoutSource.y : undefined;

  if (side === "left") {
    return {
      x: nodeX + (explicitX ?? 0),
      y: nodeY + (explicitY ?? resolveAxisPosition(nodeHeight, alignment, total, index)),
    };
  }
  if (side === "right") {
    return {
      x: nodeX + (explicitX ?? nodeWidth),
      y: nodeY + (explicitY ?? resolveAxisPosition(nodeHeight, alignment, total, index)),
    };
  }
  if (side === "top") {
    return {
      x: nodeX + (explicitX ?? resolveAxisPosition(nodeWidth, alignment, total, index)),
      y: nodeY + (explicitY ?? 0),
    };
  }
  return {
    x: nodeX + (explicitX ?? resolveAxisPosition(nodeWidth, alignment, total, index)),
    y: nodeY + (explicitY ?? nodeHeight),
  };
}
