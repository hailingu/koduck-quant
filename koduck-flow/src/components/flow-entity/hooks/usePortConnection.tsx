/**
 * @file usePortConnection Hook
 * @description React hook providing port connection interaction for flow nodes.
 * Implements drag-to-connect behavior with validation and preview support.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 2.5
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PortDefinition, PortDataType, Position } from "../types";

// =============================================================================
// Types
// =============================================================================

/**
 * Represents a port connection endpoint (source or target)
 */
export interface PortConnection {
  /** The node entity containing the port */
  nodeId: string;
  /** The port ID */
  portId: string;
  /** The port definition */
  port: PortDefinition;
}

/**
 * Internal state for tracking connection operation
 */
export interface ConnectionState {
  /** Whether a connection operation is in progress */
  isConnecting: boolean;
  /** Source port definition */
  sourcePort: PortDefinition | null;
  /** Source node ID */
  sourceNodeId: string | null;
  /** Current preview position during drag (for rendering connection preview line) */
  previewPosition: Position | null;
  /** Currently hovered target port */
  hoveredTargetPort: PortDefinition | null;
  /** Currently hovered target node ID */
  hoveredTargetNodeId: string | null;
  /** Whether the current hovered target is valid for connection */
  isValidTarget: boolean;
}

/**
 * Connection validation result
 */
export interface ConnectionValidationResult {
  /** Whether the connection is valid */
  valid: boolean;
  /** Error message if invalid */
  reason?: string;
}

/**
 * Port connection validation rules configuration
 */
export interface ConnectionValidationRules {
  /**
   * Allow connecting output to output ports
   * @default false
   */
  allowOutputToOutput?: boolean;

  /**
   * Allow connecting input to input ports
   * @default false
   */
  allowInputToInput?: boolean;

  /**
   * Allow self-connection (connecting a node to itself)
   * @default false
   */
  allowSelfConnection?: boolean;

  /**
   * Allow connecting ports with incompatible data types
   * @default false
   */
  allowIncompatibleTypes?: boolean;

  /**
   * Allow multiple connections to a single input port
   * @default false
   */
  allowMultipleInputConnections?: boolean;

  /**
   * Custom validation function for additional rules
   */
  customValidator?: (source: PortConnection, target: PortConnection) => ConnectionValidationResult;
}

/**
 * Options for configuring the usePortConnection hook
 */
export interface UsePortConnectionOptions {
  /**
   * Callback invoked when a valid connection is completed
   * @param source - Source port connection info
   * @param target - Target port connection info
   */
  onConnect?: (source: PortConnection, target: PortConnection) => void;

  /**
   * Callback invoked when a connection attempt starts
   * @param source - Source port connection info
   */
  onConnectionStart?: (source: PortConnection) => void;

  /**
   * Callback invoked when a connection attempt is cancelled
   */
  onConnectionCancel?: () => void;

  /**
   * Callback invoked when a connection attempt fails validation
   * @param source - Source port connection info
   * @param target - Target port connection info
   * @param reason - Validation failure reason
   */
  onConnectionFailed?: (source: PortConnection, target: PortConnection, reason: string) => void;

  /**
   * Callback invoked when preview position updates during drag
   * @param position - Current preview position
   */
  onPreviewUpdate?: (position: Position | null) => void;

  /**
   * Callback invoked when hovering over a potential target port
   * @param target - Hovered port connection info (null when leaving)
   * @param isValid - Whether it's a valid target
   */
  onTargetHover?: (target: PortConnection | null, isValid: boolean) => void;

  /**
   * Connection validation rules
   */
  validationRules?: ConnectionValidationRules;

  /**
   * Whether connection is disabled
   * @default false
   */
  disabled?: boolean;

  /**
   * Set of existing connection strings to check for duplicates
   * Format: "sourceNodeId:sourcePortId->targetNodeId:targetPortId"
   */
  existingConnections?: Set<string>;
}

/**
 * Return value of the usePortConnection hook
 */
export interface UsePortConnectionResult {
  /** Current connection state */
  connectionState: ConnectionState;

  /** Whether a connection operation is in progress */
  isConnecting: boolean;

  /** Current preview position (for rendering preview line) */
  previewPosition: Position | null;

  /** Whether the current hovered target is valid */
  isValidTarget: boolean;

  /**
   * Start a connection from a port
   * @param nodeId - The node ID containing the source port
   * @param port - The source port definition
   * @param position - Initial position (usually mouse position)
   */
  startConnection: (nodeId: string, port: PortDefinition, position: Position) => void;

  /**
   * Update preview position during drag
   * @param position - Current mouse/pointer position
   */
  updatePreview: (position: Position) => void;

  /**
   * Set hovered target port (for validation feedback)
   * @param nodeId - Target node ID (null to clear)
   * @param port - Target port definition (null to clear)
   */
  hoverPort: (nodeId: string | null, port: PortDefinition | null) => void;

  /**
   * Complete the connection (on mouse up over valid target)
   * @param targetNodeId - Target node ID
   * @param targetPort - Target port definition
   * @returns Whether connection was successful
   */
  completeConnection: (targetNodeId: string, targetPort: PortDefinition) => boolean;

  /**
   * Cancel the current connection attempt
   */
  cancelConnection: () => void;

  /**
   * Validate a potential connection without completing it
   * @param sourceNodeId - Source node ID
   * @param sourcePort - Source port definition
   * @param targetNodeId - Target node ID
   * @param targetPort - Target port definition
   * @returns Validation result
   */
  validateConnection: (
    sourceNodeId: string,
    sourcePort: PortDefinition,
    targetNodeId: string,
    targetPort: PortDefinition
  ) => ConnectionValidationResult;

  /**
   * Check if a specific port can be a valid target for current connection
   * @param nodeId - Target node ID
   * @param port - Target port definition
   * @returns Whether the port is a valid target
   */
  canConnectTo: (nodeId: string, port: PortDefinition) => boolean;
}

// =============================================================================
// Default Values
// =============================================================================

/**
 * Initial connection state
 */
const INITIAL_CONNECTION_STATE: ConnectionState = {
  isConnecting: false,
  sourcePort: null,
  sourceNodeId: null,
  previewPosition: null,
  hoveredTargetPort: null,
  hoveredTargetNodeId: null,
  isValidTarget: false,
};

/**
 * Default validation rules
 */
const DEFAULT_VALIDATION_RULES: ConnectionValidationRules = {
  allowOutputToOutput: false,
  allowInputToInput: false,
  allowSelfConnection: false,
  allowIncompatibleTypes: false,
  allowMultipleInputConnections: false,
};

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Check if two port data types are compatible
 * @param sourceType - Source port data type
 * @param targetType - Target port data type
 * @returns Whether the types are compatible
 */
export function areTypesCompatible(
  sourceType: PortDataType | undefined,
  targetType: PortDataType | undefined
): boolean {
  // If either is undefined or 'any', they're compatible
  if (!sourceType || !targetType) return true;
  if (sourceType === "any" || targetType === "any") return true;

  // Direct match
  if (sourceType === targetType) return true;

  // Special compatibility rules
  // number -> string (implicit conversion)
  if (sourceType === "number" && targetType === "string") return true;
  // boolean -> string (implicit conversion)
  if (sourceType === "boolean" && targetType === "string") return true;

  return false;
}

/**
 * Create a connection key string for duplicate checking
 */
export function createConnectionKey(
  sourceNodeId: string,
  sourcePortId: string,
  targetNodeId: string,
  targetPortId: string
): string {
  return `${sourceNodeId}:${sourcePortId}->${targetNodeId}:${targetPortId}`;
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * usePortConnection - Hook for managing port connection interactions
 *
 * Provides drag-to-connect functionality for flow nodes:
 * - Tracks connection source and target during drag
 * - Validates connections based on port types and directions
 * - Provides preview position for visual feedback
 * - Supports custom validation rules
 *
 * @param options - Configuration options
 * @returns Connection state and control functions
 *
 * @example Basic usage
 * ```tsx
 * function FlowCanvas() {
 *   const {
 *     isConnecting,
 *     previewPosition,
 *     startConnection,
 *     updatePreview,
 *     completeConnection,
 *     cancelConnection,
 *   } = usePortConnection({
 *     onConnect: (source, target) => {
 *       console.log(`Connected ${source.nodeId}:${source.portId} to ${target.nodeId}:${target.portId}`);
 *     },
 *   });
 *
 *   // Render nodes and connection preview...
 * }
 * ```
 *
 * @example With validation rules
 * ```tsx
 * const { validateConnection, canConnectTo } = usePortConnection({
 *   validationRules: {
 *     allowSelfConnection: false,
 *     allowIncompatibleTypes: false,
 *     customValidator: (source, target) => {
 *       if (source.port.dataType === 'function' && target.port.dataType !== 'function') {
 *         return { valid: false, reason: 'Function ports can only connect to function ports' };
 *       }
 *       return { valid: true };
 *     },
 *   },
 * });
 * ```
 */
export function usePortConnection(options: UsePortConnectionOptions = {}): UsePortConnectionResult {
  const {
    onConnect,
    onConnectionStart,
    onConnectionCancel,
    onConnectionFailed,
    onPreviewUpdate,
    onTargetHover,
    validationRules = {},
    disabled = false,
    existingConnections,
  } = options;

  // Merge validation rules with defaults
  const rules = useMemo<ConnectionValidationRules>(
    () => ({
      ...DEFAULT_VALIDATION_RULES,
      ...validationRules,
    }),
    [validationRules]
  );

  // Connection state
  const [connectionState, setConnectionState] = useState<ConnectionState>(INITIAL_CONNECTION_STATE);

  // Refs for stable callback references
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // ==========================================================================
  // Validation
  // ==========================================================================

  /**
   * Validate a connection between two ports
   */
  const validateConnection = useCallback(
    (
      sourceNodeId: string,
      sourcePort: PortDefinition,
      targetNodeId: string,
      targetPort: PortDefinition
    ): ConnectionValidationResult => {
      // Check self-connection
      if (!rules.allowSelfConnection && sourceNodeId === targetNodeId) {
        return { valid: false, reason: "Self-connection is not allowed" };
      }

      // Check direction compatibility
      const sourceDirection = sourcePort.type;
      const targetDirection = targetPort.type;

      // Output -> Input is the standard valid direction
      // Input -> Output is also valid (reverse connection)
      const isStandardDirection = sourceDirection === "output" && targetDirection === "input";
      const isReverseDirection = sourceDirection === "input" && targetDirection === "output";

      if (!isStandardDirection && !isReverseDirection) {
        // Same direction connections
        if (sourceDirection === "input" && targetDirection === "input") {
          if (!rules.allowInputToInput) {
            return { valid: false, reason: "Cannot connect input to input" };
          }
        } else if (sourceDirection === "output" && targetDirection === "output") {
          if (!rules.allowOutputToOutput) {
            return { valid: false, reason: "Cannot connect output to output" };
          }
        }
      }

      // Check type compatibility
      if (!rules.allowIncompatibleTypes) {
        if (!areTypesCompatible(sourcePort.dataType, targetPort.dataType)) {
          return {
            valid: false,
            reason: `Incompatible types: ${sourcePort.dataType} and ${targetPort.dataType}`,
          };
        }
      }

      // Check for duplicate connections
      if (existingConnections) {
        const connectionKey = createConnectionKey(
          sourceNodeId,
          sourcePort.id,
          targetNodeId,
          targetPort.id
        );
        if (existingConnections.has(connectionKey)) {
          return { valid: false, reason: "Connection already exists" };
        }
        // Also check reverse direction
        const reverseKey = createConnectionKey(
          targetNodeId,
          targetPort.id,
          sourceNodeId,
          sourcePort.id
        );
        if (existingConnections.has(reverseKey)) {
          return { valid: false, reason: "Connection already exists" };
        }
      }

      // Custom validation
      if (rules.customValidator) {
        const source: PortConnection = {
          nodeId: sourceNodeId,
          portId: sourcePort.id,
          port: sourcePort,
        };
        const target: PortConnection = {
          nodeId: targetNodeId,
          portId: targetPort.id,
          port: targetPort,
        };
        const customResult = rules.customValidator(source, target);
        if (!customResult.valid) {
          return customResult;
        }
      }

      return { valid: true };
    },
    [rules, existingConnections]
  );

  /**
   * Check if a port can be connected to (simplified helper)
   */
  const canConnectTo = useCallback(
    (nodeId: string, port: PortDefinition): boolean => {
      if (!connectionState.sourceNodeId || !connectionState.sourcePort) {
        return false;
      }
      const result = validateConnection(
        connectionState.sourceNodeId,
        connectionState.sourcePort,
        nodeId,
        port
      );
      return result.valid;
    },
    [connectionState.sourceNodeId, connectionState.sourcePort, validateConnection]
  );

  // ==========================================================================
  // Connection Control
  // ==========================================================================

  /**
   * Start a connection from a port
   */
  const startConnection = useCallback(
    (nodeId: string, port: PortDefinition, position: Position): void => {
      if (disabled) return;

      const newState: ConnectionState = {
        isConnecting: true,
        sourcePort: port,
        sourceNodeId: nodeId,
        previewPosition: position,
        hoveredTargetPort: null,
        hoveredTargetNodeId: null,
        isValidTarget: false,
      };

      setConnectionState(newState);

      const source: PortConnection = {
        nodeId,
        portId: port.id,
        port,
      };
      onConnectionStart?.(source);
    },
    [disabled, onConnectionStart]
  );

  /**
   * Update preview position during drag
   */
  const updatePreview = useCallback(
    (position: Position): void => {
      setConnectionState((prev) => {
        if (!prev.isConnecting) return prev;
        return {
          ...prev,
          previewPosition: position,
        };
      });
      onPreviewUpdate?.(position);
    },
    [onPreviewUpdate]
  );

  /**
   * Set hovered target port for validation feedback
   */
  const hoverPort = useCallback(
    (nodeId: string | null, port: PortDefinition | null): void => {
      setConnectionState((prev) => {
        if (!prev.isConnecting) return prev;

        // Calculate validity if we have a target
        let isValid = false;
        if (nodeId && port && prev.sourceNodeId && prev.sourcePort) {
          const result = validateConnection(prev.sourceNodeId, prev.sourcePort, nodeId, port);
          isValid = result.valid;
        }

        const newState: ConnectionState = {
          ...prev,
          hoveredTargetPort: port,
          hoveredTargetNodeId: nodeId,
          isValidTarget: isValid,
        };

        // Notify about hover change
        if (nodeId && port) {
          const target: PortConnection = {
            nodeId,
            portId: port.id,
            port,
          };
          onTargetHover?.(target, isValid);
        } else {
          onTargetHover?.(null, false);
        }

        return newState;
      });
    },
    [validateConnection, onTargetHover]
  );

  /**
   * Complete the connection
   */
  const completeConnection = useCallback(
    (targetNodeId: string, targetPort: PortDefinition): boolean => {
      const { sourceNodeId, sourcePort } = connectionState;

      if (!sourceNodeId || !sourcePort) {
        return false;
      }

      // Validate the connection
      const validationResult = validateConnection(
        sourceNodeId,
        sourcePort,
        targetNodeId,
        targetPort
      );

      if (!validationResult.valid) {
        // Notify about failed connection
        const source: PortConnection = {
          nodeId: sourceNodeId,
          portId: sourcePort.id,
          port: sourcePort,
        };
        const target: PortConnection = {
          nodeId: targetNodeId,
          portId: targetPort.id,
          port: targetPort,
        };
        onConnectionFailed?.(source, target, validationResult.reason ?? "Invalid connection");

        // Reset state
        setConnectionState(INITIAL_CONNECTION_STATE);
        return false;
      }

      // Create connection objects
      const source: PortConnection = {
        nodeId: sourceNodeId,
        portId: sourcePort.id,
        port: sourcePort,
      };
      const target: PortConnection = {
        nodeId: targetNodeId,
        portId: targetPort.id,
        port: targetPort,
      };

      // Invoke callback
      onConnect?.(source, target);

      // Reset state
      setConnectionState(INITIAL_CONNECTION_STATE);

      return true;
    },
    [connectionState, validateConnection, onConnect, onConnectionFailed]
  );

  /**
   * Cancel the current connection attempt
   */
  const cancelConnection = useCallback((): void => {
    if (connectionState.isConnecting) {
      onConnectionCancel?.();
    }
    setConnectionState(INITIAL_CONNECTION_STATE);
  }, [connectionState.isConnecting, onConnectionCancel]);

  // ==========================================================================
  // Event Listeners for Global Mouse Events
  // ==========================================================================

  useEffect(() => {
    if (!connectionState.isConnecting) return;

    // Handle mouse move for preview
    const handleMouseMove = (e: MouseEvent) => {
      updatePreview({ x: e.clientX, y: e.clientY });
    };

    // Handle mouse up to complete or cancel
    const handleMouseUp = () => {
      // If we have a valid target, completeConnection will be called by the port's onMouseUp
      // If not, we cancel the connection
      if (!connectionState.hoveredTargetPort || !connectionState.hoveredTargetNodeId) {
        cancelConnection();
      }
    };

    // Handle escape key to cancel
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cancelConnection();
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    connectionState.isConnecting,
    connectionState.hoveredTargetPort,
    connectionState.hoveredTargetNodeId,
    updatePreview,
    cancelConnection,
  ]);

  // ==========================================================================
  // Return Value
  // ==========================================================================

  return {
    connectionState,
    isConnecting: connectionState.isConnecting,
    previewPosition: connectionState.previewPosition,
    isValidTarget: connectionState.isValidTarget,
    startConnection,
    updatePreview,
    hoverPort,
    completeConnection,
    cancelConnection,
    validateConnection,
    canConnectTo,
  };
}

// =============================================================================
// Context Provider for Shared Connection State
// =============================================================================

import React, { createContext, useContext, type ReactNode } from "react";

/**
 * Context value for port connection state
 */
export type PortConnectionContextValue = UsePortConnectionResult;

/**
 * Port connection context
 */
export const PortConnectionContext = createContext<PortConnectionContextValue | undefined>(
  undefined
);

/**
 * Props for PortConnectionProvider
 */
export interface PortConnectionProviderProps extends UsePortConnectionOptions {
  children: ReactNode;
}

/**
 * Provider component for sharing port connection state across components
 *
 * @example
 * ```tsx
 * <PortConnectionProvider
 *   onConnect={(source, target) => addEdge(source, target)}
 *   validationRules={{ allowSelfConnection: false }}
 * >
 *   <FlowCanvas />
 * </PortConnectionProvider>
 * ```
 */
export const PortConnectionProvider: React.FC<PortConnectionProviderProps> = ({
  children,
  ...options
}) => {
  const connectionResult = usePortConnection(options);

  return (
    <PortConnectionContext.Provider value={connectionResult}>
      {children}
    </PortConnectionContext.Provider>
  );
};

/**
 * Hook to access port connection context
 * @throws Error if used outside PortConnectionProvider
 */
export function usePortConnectionContext(): PortConnectionContextValue {
  const context = useContext(PortConnectionContext);
  if (!context) {
    throw new Error("usePortConnectionContext must be used within a PortConnectionProvider");
  }
  return context;
}

/**
 * Hook to optionally access port connection context
 * Returns undefined if not within a provider
 */
export function usePortConnectionContextOptional(): PortConnectionContextValue | undefined {
  return useContext(PortConnectionContext);
}

// Default export
export default usePortConnection;
