import type {
  IFlowEdgeEntityData,
  PortDataType,
  PortDefinition,
  PortSystemConfig,
  Position,
} from "../types";

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

/**
 * Normalize two port endpoints into source-output to target-input order.
 *
 * @param source - Endpoint where the drag started.
 * @param target - Endpoint where the drag ended.
 * @returns Normalized connection, or null when both endpoints have incompatible directions.
 */
export function normalizePortConnection(
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

/**
 * Validate built-in connection rules before caller-provided validation runs.
 *
 * @param connection - Normalized port connection to validate.
 * @param edges - Existing edges used to detect duplicates and occupied inputs.
 * @param portConfig - Optional port system configuration.
 * @returns Validation result with an optional user-facing reason.
 */
export function getDefaultConnectionValidation(
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
