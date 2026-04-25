/**
 * @file FlowNodePorts Component
 * @description Sub-component for rendering input/output port placeholders on a flow node.
 * Renders ports based on entity data and supports custom port rendering.
 * Integrates with usePortConnection hook for drag-to-connect functionality.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 1.9, Task 2.5
 */

import React, { useMemo, type CSSProperties, type ReactNode } from "react";
import { useFlowEntityContext } from "../context";
import { usePortConnectionContextOptional } from "../hooks/usePortConnection.jsx";
import type { PortDefinition, PortState, FlowNodeTheme } from "../types";
import type { FlowNodeEntity } from "../../../common/flow/flow-node-entity";

// =============================================================================
// Constants
// =============================================================================

/**
 * Default port size in pixels
 */
const DEFAULT_PORT_SIZE = 12;

/**
 * Default port spacing from node edge
 */
const DEFAULT_PORT_OFFSET = -6;

// =============================================================================
// Types
// =============================================================================

/**
 * Position for rendering a port
 */
export type PortPosition = "top" | "bottom" | "left" | "right";

/**
 * Props for custom port renderer
 */
export interface PortRendererProps {
  /** Port definition */
  port: PortDefinition;
  /** Port runtime state */
  state?: PortState;
  /** Port position on the node */
  position: PortPosition;
  /** Computed position for the port element */
  style: CSSProperties;
  /** Whether the port is being hovered */
  isHovered?: boolean;
  /** Whether the port can accept a connection */
  isValidTarget?: boolean;
}

/**
 * Props for FlowNodePorts component
 */
export interface FlowNodePortsProps {
  /**
   * The flow node entity this ports container belongs to
   */
  entity: FlowNodeEntity;

  /**
   * Position for input ports
   * @default "top"
   */
  inputPosition?: PortPosition;

  /**
   * Position for output ports
   * @default "bottom"
   */
  outputPosition?: PortPosition;

  /**
   * Callback when a port connection is initiated (mousedown on output port)
   */
  onPortConnect?: (entity: FlowNodeEntity, portId: string, portType: "input" | "output") => void;

  /**
   * Callback when mouse enters a port (for connection preview)
   */
  onPortMouseEnter?: (entity: FlowNodeEntity, portId: string, portType: "input" | "output") => void;

  /**
   * Callback when mouse leaves a port
   */
  onPortMouseLeave?: (entity: FlowNodeEntity, portId: string, portType: "input" | "output") => void;

  /**
   * Custom renderer for individual ports
   */
  portRenderer?: (props: PortRendererProps) => ReactNode;

  /**
   * Port size in pixels
   * @default 12
   */
  portSize?: number;

  /**
   * Additional CSS class name
   */
  className?: string;

  /**
   * Additional inline styles
   */
  style?: CSSProperties;

  /**
   * Test ID for testing
   */
  "data-testid"?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculates the style for a port based on its position and index
 * @param position
 * @param index
 * @param totalPorts
 * @param portSize
 * @param nodeTheme
 */
function calculatePortStyle(
  position: PortPosition,
  index: number,
  totalPorts: number,
  portSize: number,
  nodeTheme: FlowNodeTheme
): CSSProperties {
  const offset = DEFAULT_PORT_OFFSET;
  const spacing = totalPorts > 1 ? 100 / (totalPorts + 1) : 50;
  const positionPercent = spacing * (index + 1);

  const baseStyle: CSSProperties = {
    position: "absolute",
    width: portSize,
    height: portSize,
    borderRadius: "50%",
    backgroundColor: nodeTheme.portColors?.default ?? "#6b7280",
    border: `2px solid ${nodeTheme.borderColor}`,
    cursor: "crosshair",
    pointerEvents: "auto",
    transition: "background-color 0.15s, transform 0.15s",
  };

  switch (position) {
    case "top":
      return {
        ...baseStyle,
        top: offset,
        left: `${positionPercent}%`,
        transform: "translateX(-50%)",
      };
    case "bottom":
      return {
        ...baseStyle,
        bottom: offset,
        left: `${positionPercent}%`,
        transform: "translateX(-50%)",
      };
    case "left":
      return {
        ...baseStyle,
        left: offset,
        top: `${positionPercent}%`,
        transform: "translateY(-50%)",
      };
    case "right":
      return {
        ...baseStyle,
        right: offset,
        top: `${positionPercent}%`,
        transform: "translateY(-50%)",
      };
  }
}

// =============================================================================
// Component
// =============================================================================

/**
 * FlowNodePorts - Sub-component for flow node port rendering
 *
 * Renders input and output ports for a flow node with:
 * - Automatic positioning based on port count
 * - Theme-based styling for port colors
 * - Support for custom port rendering
 * - Interaction callbacks for connection handling
 *
 * Input ports are rendered on the top by default.
 * Output ports are rendered on the bottom by default.
 *
 * @example
 * ```tsx
 * <FlowNodePorts
 *   entity={nodeEntity}
 *   onPortConnect={(entity, portId, type) => {
 *     console.log(`Starting connection from ${type} port ${portId}`);
 *   }}
 * />
 * ```
 *
 * @example With custom port renderer
 * ```tsx
 * <FlowNodePorts
 *   entity={nodeEntity}
 *   portRenderer={({ port, position, style }) => (
 *     <div style={style} title={port.name}>
 *       {port.dataType === 'function' ? '⚡' : '●'}
 *     </div>
 *   )}
 * />
 * ```
 */
export const FlowNodePorts: React.FC<FlowNodePortsProps> = React.memo(function FlowNodePorts({
  entity,
  inputPosition = "top",
  outputPosition = "bottom",
  onPortConnect,
  onPortMouseEnter,
  onPortMouseLeave,
  portRenderer,
  portSize = DEFAULT_PORT_SIZE,
  className,
  style,
  "data-testid": testId,
}) {
  // Get theme from context
  const { theme } = useFlowEntityContext();
  const nodeTheme = theme.node;

  // Get port connection context (optional - may not be within a provider)
  const connectionContext = usePortConnectionContextOptional();

  // Extract ports from entity
  const inputPorts = entity.getInputPorts();
  const outputPorts = entity.getOutputPorts();

  // Container styles - overlay on the node
  const containerStyle = useMemo<CSSProperties>(
    () => ({
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      pointerEvents: "none",
      ...style,
    }),
    [style]
  );

  // Render a single port
  const renderPort = (
    port: PortDefinition,
    index: number,
    totalPorts: number,
    position: PortPosition,
    portType: "input" | "output"
  ): ReactNode => {
    const basePortStyle = calculatePortStyle(position, index, totalPorts, portSize, nodeTheme);

    // Check if this port is a valid connection target
    const isValidTarget = connectionContext?.isConnecting
      ? connectionContext.canConnectTo(entity.id, port)
      : false;

    // Check if this is the currently hovered target
    const isHoveredTarget =
      connectionContext?.connectionState.hoveredTargetNodeId === entity.id &&
      connectionContext?.connectionState.hoveredTargetPort?.id === port.id;

    // Enhanced port style with connection feedback
    const portStyle: CSSProperties = {
      ...basePortStyle,
      // Visual feedback for valid/invalid targets during connection
      ...(connectionContext?.isConnecting && {
        boxShadow: isHoveredTarget
          ? isValidTarget
            ? "0 0 8px 2px rgba(34, 197, 94, 0.6)" // Green glow for valid
            : "0 0 8px 2px rgba(239, 68, 68, 0.6)" // Red glow for invalid
          : isValidTarget
            ? "0 0 4px 1px rgba(34, 197, 94, 0.3)" // Subtle green for valid targets
            : undefined,
        transform: isHoveredTarget
          ? `${basePortStyle.transform ?? ""} scale(1.3)`.trim()
          : basePortStyle.transform,
        cursor: isValidTarget ? "crosshair" : "not-allowed",
      }),
    };

    // Handle port mouse down (start connection)
    const handleMouseDown = (e: React.MouseEvent) => {
      e.stopPropagation();

      // If we have connection context, use it to start connection
      if (connectionContext) {
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        const position = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
        connectionContext.startConnection(entity.id, port, position);
      }

      // Also call the legacy callback
      onPortConnect?.(entity, port.id, portType);
    };

    // Handle port mouse enter (for connection preview)
    const handleMouseEnter = () => {
      // If we have connection context and are connecting, notify about hover
      if (connectionContext?.isConnecting) {
        connectionContext.hoverPort(entity.id, port);
      }
      onPortMouseEnter?.(entity, port.id, portType);
    };

    // Handle port mouse leave
    const handleMouseLeave = () => {
      // If we have connection context and are connecting, clear hover
      if (connectionContext?.isConnecting) {
        connectionContext.hoverPort(null, null);
      }
      onPortMouseLeave?.(entity, port.id, portType);
    };

    // Handle port mouse up (complete connection)
    const handleMouseUp = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (connectionContext?.isConnecting && isValidTarget) {
        connectionContext.completeConnection(entity.id, port);
      }
    };

    // Use custom renderer if provided
    if (portRenderer) {
      return (
        <div
          key={port.id}
          onMouseDown={handleMouseDown}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          data-port-id={port.id}
          data-port-type={portType}
        >
          {portRenderer({
            port,
            position,
            style: portStyle,
            isHovered: isHoveredTarget,
            isValidTarget,
          })}
        </div>
      );
    }

    // Default port rendering
    return (
      <div
        key={port.id}
        className={`flow-node-port flow-node-port--${portType}${isValidTarget ? " flow-node-port--valid-target" : ""}${isHoveredTarget ? " flow-node-port--hovered" : ""}`}
        style={portStyle}
        onMouseDown={handleMouseDown}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        data-testid={`flow-node-port-${entity.id}-${port.id}`}
        data-port-id={port.id}
        data-port-type={portType}
        data-port-data-type={port.dataType}
        data-valid-target={isValidTarget}
        title={port.name}
        role="button"
        aria-label={`${portType} port: ${port.name}`}
      />
    );
  };

  return (
    <div
      className={`flow-node-ports ${className ?? ""}`.trim()}
      style={containerStyle}
      data-testid={testId ?? `flow-node-ports-${entity.id}`}
    >
      {/* Input ports - rendered at configurable position */}
      {inputPorts.map((port, index) =>
        renderPort(port, index, inputPorts.length, inputPosition, "input")
      )}

      {/* Output ports - rendered at configurable position */}
      {outputPorts.map((port, index) =>
        renderPort(port, index, outputPorts.length, outputPosition, "output")
      )}
    </div>
  );
});

// Default export for convenience
export default FlowNodePorts;
