import { useCallback, useEffect, useState } from "react";
import type { IFlowEdgeEntityData, PortSystemConfig, Position } from "../types";
import {
  getDefaultConnectionValidation,
  normalizePortConnection,
  type ConnectionValidationResult,
  type FlowCanvasPortConnection,
  type FlowCanvasPortEndpoint,
} from "./connection-validation";

export interface PortConnectionDraft {
  source: FlowCanvasPortEndpoint;
  pointer: Position;
  target: FlowCanvasPortEndpoint | null;
  validation: ConnectionValidationResult;
}

export interface PortConnectionError {
  message: string;
  position: Position;
}

interface UsePortConnectionDragOptions {
  edges: IFlowEdgeEntityData[];
  portConfig?: Partial<PortSystemConfig>;
  validateConnection?: (connection: FlowCanvasPortConnection) => ConnectionValidationResult;
  onEdgeCreate?: (
    sourceNodeId: string,
    sourcePortId: string,
    targetNodeId: string,
    targetPortId: string
  ) => void;
  screenEventToCanvasPosition: (event: PointerEvent) => Position | null;
}

/**
 * Manage interactive port connection drag state for FlowCanvas.
 *
 * @returns State and actions for port connection dragging.
 */
export function usePortConnectionDrag({
  edges,
  portConfig,
  validateConnection,
  onEdgeCreate,
  screenEventToCanvasPosition,
}: UsePortConnectionDragOptions) {
  const [hoveredPortKey, setHoveredPortKey] = useState<string | null>(null);
  const [connectionDraft, setConnectionDraft] = useState<PortConnectionDraft | null>(null);
  const [connectionError, setConnectionError] = useState<PortConnectionError | null>(null);

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

  const beginConnection = useCallback((endpoint: FlowCanvasPortEndpoint) => {
    setConnectionError(null);
    setConnectionDraft({
      source: endpoint,
      pointer: endpoint.position,
      target: null,
      validation: { valid: true },
    });
  }, []);

  const hoverPort = useCallback(
    (portKey: string, endpoint: FlowCanvasPortEndpoint) => {
      setHoveredPortKey(portKey);
      setConnectionDraft((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          target: endpoint,
          validation: validatePortConnection(prev.source, endpoint),
        };
      });
    },
    [validatePortConnection]
  );

  const leavePort = useCallback((portKey: string, endpoint: FlowCanvasPortEndpoint) => {
    setHoveredPortKey((prev) => (prev === portKey ? null : prev));
    setConnectionDraft((prev) => {
      if (!prev || prev.target?.nodeId !== endpoint.nodeId || prev.target.portId !== endpoint.portId) {
        return prev;
      }

      return {
        ...prev,
        target: null,
        validation: { valid: true },
      };
    });
  }, []);

  const completeConnectionOnPort = useCallback(
    (endpoint: FlowCanvasPortEndpoint): boolean => {
      if (!connectionDraft) {
        return false;
      }

      const completed = completePortConnection(connectionDraft.source, endpoint);
      setConnectionDraft(null);
      return completed;
    },
    [completePortConnection, connectionDraft]
  );

  useEffect(() => {
    if (!connectionError) {
      return undefined;
    }

    const timer = globalThis.setTimeout(() => setConnectionError(null), 1800);
    return () => globalThis.clearTimeout(timer);
  }, [connectionError]);

  useEffect(() => {
    if (!connectionDraft) {
      return undefined;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const pointer = screenEventToCanvasPosition(event);
      if (!pointer) {
        return;
      }
      setConnectionDraft((prev) => (prev ? { ...prev, pointer } : prev));
    };

    const handlePointerUp = () => {
      setConnectionDraft((prev) => {
        if (prev?.target) {
          completePortConnection(prev.source, prev.target);
        }
        return null;
      });
    };

    globalThis.addEventListener("pointermove", handlePointerMove);
    globalThis.addEventListener("pointerup", handlePointerUp);
    globalThis.addEventListener("pointercancel", handlePointerUp);
    return () => {
      globalThis.removeEventListener("pointermove", handlePointerMove);
      globalThis.removeEventListener("pointerup", handlePointerUp);
      globalThis.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [completePortConnection, connectionDraft, screenEventToCanvasPosition]);

  return {
    hoveredPortKey,
    connectionDraft,
    connectionError,
    beginConnection,
    hoverPort,
    leavePort,
    completeConnectionOnPort,
    validatePortConnection,
  };
}
