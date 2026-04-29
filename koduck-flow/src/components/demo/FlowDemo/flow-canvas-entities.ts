/**
 * @file Flow Canvas Entities
 * @description
 * Canvas-rendered Flow node entities (Start, Action, Decision, End).
 * These entities extend UMLNodeEntity and are auto-registered via the @AutoRegistry decorator,
 * and can be created and rendered on the FlowDemo Canvas.
 *
 * @see docs/design/flow-node-canvas-integration-plan.md
 */

import type { IEntityArguments } from "../../../common/entity/types";
import { AutoRegistry } from "../../../utils/decorator/auto-registry";
import { logger } from "../../../common/logger";
import {
  DEFAULT_KODUCKFLOW_ENVIRONMENT,
  getRuntimeForEnvironment,
} from "../../../common/global-runtime";
import { UMLNodeEntity } from "./uml-entities-new-decorator";
import { FLOW_NODE_THEMES } from "../../flow-entity/themes/flow-node-themes";

// Get registry manager
const runtime = getRuntimeForEnvironment(DEFAULT_KODUCKFLOW_ENVIRONMENT);
const flowCanvasRegistryManager = runtime.RegistryManager;

logger.info("🔧 Flow Canvas entity file loaded");

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get Canvas 2D Context from render context
 * @param context - Render context object
 * @returns Canvas 2D render context, or null
 */
function getCanvasContext(context: unknown): CanvasRenderingContext2D | null {
  const ctxObj = context as { canvas?: HTMLCanvasElement } | undefined;
  const canvas = ctxObj?.canvas;
  if (!canvas) return null;
  return canvas.getContext("2d");
}

/**
 * Draw rounded rectangle path
 * @param ctx - Canvas 2D render context
 * @param x - Top-left X coordinate
 * @param y - Top-left Y coordinate
 * @param width - Rectangle width
 * @param height - Rectangle height
 * @param radius - Corner radius
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Draw rounded rectangle top (for header bar)
 * @param ctx - Canvas 2D render context
 * @param x - Top-left X coordinate
 * @param y - Top-left Y coordinate
 * @param width - Rectangle width
 * @param height - Rectangle height
 * @param radius - Corner radius
 */
function drawRoundedRectTop(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// ============================================================================
// Flow Start Canvas Entity
// ============================================================================

/**
 * Flow start node - Canvas version
 *
 * @description
 * Green card-style node representing the start of a flow.
 * Contains title, description, trigger type badge, and form content area.
 * Has only one output port, no input ports.
 */
@AutoRegistry({
  registryManager: flowCanvasRegistryManager,
  autoRegister: true,
  registryName: "flow-start-canvas",
  capabilities: ["render", "execute", "validate"],
  priority: 1,
  enableCapabilityDetection: true,
  meta: {
    description: "Flow Start node for canvas rendering",
    flowType: "start",
    category: "flow",
  },
})
export class FlowStartCanvasEntity extends UMLNodeEntity {
  static readonly type = "flow-start-canvas";

  /**
   * Create Flow start node entity
   * @param args - Entity initialization arguments
   */
  constructor(args?: IEntityArguments) {
    super(args);

    const theme = FLOW_NODE_THEMES.start;
    if (this.data) {
      this.data.fillColor = theme.backgroundColor;
      this.data.borderColor = theme.borderColor;
      this.data.textColor = theme.textColor;
      this.data.width =
        ((args as Record<string, unknown> | undefined)?.width as number) ?? theme.defaultWidth;
      this.data.height =
        ((args as Record<string, unknown> | undefined)?.height as number) ?? theme.defaultHeight;
    }

    // Set output port
    this.setPorts([{ name: "out", direction: "out", side: "bottom", offset: 0.5 }]);

    logger.debug("FlowStartCanvasEntity created", { id: this.id });
  }

  /**
   * Render start node to Canvas - disabled, now rendered using React BaseFlowNode component
   * @param context - Render context
   */
  override async render(_context?: unknown): Promise<void> {
    // Start node is now rendered by React BaseFlowNode component, no longer drawn with Canvas
    // This enables border drag/resize and other interactive features
    return;
  }
}

// ============================================================================
// Flow Action Canvas Entity
// ============================================================================

/**
 * Flow action node - Canvas version
 *
 * @description
 * Blue rounded rectangle node representing an operation step in the flow.
 * Has one input port and one output port.
 */
@AutoRegistry({
  registryManager: flowCanvasRegistryManager,
  autoRegister: true,
  registryName: "flow-action-canvas",
  capabilities: ["render", "execute", "validate"],
  priority: 1,
  enableCapabilityDetection: true,
  meta: {
    description: "Flow Action node for canvas rendering",
    flowType: "action",
    category: "flow",
  },
})
export class FlowActionCanvasEntity extends UMLNodeEntity {
  static readonly type = "flow-action-canvas";

  /**
   * Create Flow action node entity
   * @param args - Entity initialization arguments
   */
  constructor(args?: IEntityArguments) {
    super(args);

    const theme = FLOW_NODE_THEMES.action;
    if (this.data) {
      this.data.fillColor = theme.backgroundColor;
      this.data.borderColor = theme.borderColor;
      this.data.textColor = theme.textColor;
      this.data.width =
        ((args as Record<string, unknown> | undefined)?.width as number) ?? theme.defaultWidth;
      this.data.height =
        ((args as Record<string, unknown> | undefined)?.height as number) ?? theme.defaultHeight;
    }

    // Set input and output ports
    this.setPorts([
      { name: "in", direction: "in", side: "top", offset: 0.5 },
      { name: "out", direction: "out", side: "bottom", offset: 0.5 },
    ]);

    logger.debug("FlowActionCanvasEntity created", { id: this.id });
  }

  /**
   * Render action node to Canvas
   * @param context - Render context
   */
  override async render(context?: unknown): Promise<void> {
    const ctx = getCanvasContext(context);
    if (!ctx) return;

    const { x, y, width, height } = this.getBounds();
    const theme = FLOW_NODE_THEMES.action;
    const radius = theme.borderRadius;
    const headerHeight = 24;

    ctx.save();

    // Draw rounded rectangle background
    drawRoundedRect(ctx, x, y, width, height, radius);
    ctx.fillStyle = theme.backgroundColor;
    ctx.fill();
    ctx.strokeStyle = theme.borderColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw header bar
    ctx.save();
    ctx.clip();
    drawRoundedRectTop(ctx, x, y, width, headerHeight, radius);
    ctx.fillStyle = theme.headerColor;
    ctx.fill();
    ctx.restore();

    // Draw label (in header)
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(this.label || "Action", x + 10, y + headerHeight / 2);

    ctx.restore();

    // Render ports
    this.renderPorts(ctx);
  }
}

// ============================================================================
// Flow Decision Canvas Entity
// ============================================================================

/**
 * Flow decision node - Canvas version
 *
 * @description
 * Yellow diamond node representing a conditional decision in the flow.
 * Has one input port and multiple output ports (yes/no branches).
 */
@AutoRegistry({
  registryManager: flowCanvasRegistryManager,
  autoRegister: true,
  registryName: "flow-decision-canvas",
  capabilities: ["render", "execute", "validate"],
  priority: 1,
  enableCapabilityDetection: true,
  meta: {
    description: "Flow Decision node for canvas rendering",
    flowType: "decision",
    category: "flow",
  },
})
export class FlowDecisionCanvasEntity extends UMLNodeEntity {
  static readonly type = "flow-decision-canvas";

  /**
   * Create Flow decision node entity
   * @param args - Entity initialization arguments
   */
  constructor(args?: IEntityArguments) {
    super(args);

    const theme = FLOW_NODE_THEMES.decision;
    if (this.data) {
      this.data.fillColor = theme.backgroundColor;
      this.data.borderColor = theme.borderColor;
      this.data.textColor = theme.textColor;
      this.data.width =
        ((args as Record<string, unknown> | undefined)?.width as number) ?? theme.defaultWidth;
      this.data.height =
        ((args as Record<string, unknown> | undefined)?.height as number) ?? theme.defaultHeight;
    }

    // Set ports: top input, left/right outputs (yes/no branches)
    this.setPorts([
      { name: "in", direction: "in", side: "top", offset: 0.5 },
      { name: "yes", direction: "out", side: "right", offset: 0.5 },
      { name: "no", direction: "out", side: "bottom", offset: 0.5 },
    ]);

    logger.debug("FlowDecisionCanvasEntity created", { id: this.id });
  }

  /**
   * Render decision node to Canvas
   * @param context - Render context
   */
  override async render(context?: unknown): Promise<void> {
    const ctx = getCanvasContext(context);
    if (!ctx) return;

    const { x, y, width, height } = this.getBounds();
    const theme = FLOW_NODE_THEMES.decision;
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    ctx.save();

    // Draw diamond
    ctx.beginPath();
    ctx.moveTo(centerX, y); // Top vertex
    ctx.lineTo(x + width, centerY); // Right vertex
    ctx.lineTo(centerX, y + height); // Bottom vertex
    ctx.lineTo(x, centerY); // Left vertex
    ctx.closePath();
    ctx.fillStyle = theme.backgroundColor;
    ctx.fill();
    ctx.strokeStyle = theme.borderColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw label
    ctx.fillStyle = theme.textColor;
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.label || "Decision", centerX, centerY);

    ctx.restore();

    // Render ports
    this.renderPorts(ctx);
  }
}

// ============================================================================
// Flow End Canvas Entity
// ============================================================================

/**
 * Flow end node - Canvas version
 *
 * @description
 * Red double-circle node representing the end of a flow.
 * Has only one input port, no output ports.
 */
@AutoRegistry({
  registryManager: flowCanvasRegistryManager,
  autoRegister: true,
  registryName: "flow-end-canvas",
  capabilities: ["render", "execute", "validate"],
  priority: 1,
  enableCapabilityDetection: true,
  meta: {
    description: "Flow End node for canvas rendering",
    flowType: "end",
    category: "flow",
  },
})
export class FlowEndCanvasEntity extends UMLNodeEntity {
  static readonly type = "flow-end-canvas";

  /**
   * Create Flow end node entity
   * @param args - Entity initialization arguments
   */
  constructor(args?: IEntityArguments) {
    super(args);

    const theme = FLOW_NODE_THEMES.end;
    if (this.data) {
      this.data.fillColor = theme.backgroundColor;
      this.data.borderColor = theme.borderColor;
      this.data.textColor = theme.textColor;
      this.data.width =
        ((args as Record<string, unknown> | undefined)?.width as number) ?? theme.defaultWidth;
      this.data.height =
        ((args as Record<string, unknown> | undefined)?.height as number) ?? theme.defaultHeight;
    }

    // Set input port
    this.setPorts([{ name: "in", direction: "in", side: "top", offset: 0.5 }]);

    logger.debug("FlowEndCanvasEntity created", { id: this.id });
  }

  /**
   * Render end node to Canvas
   * @param context - Render context
   */
  override async render(context?: unknown): Promise<void> {
    const ctx = getCanvasContext(context);
    if (!ctx) return;

    const { x, y, width, height } = this.getBounds();
    const theme = FLOW_NODE_THEMES.end;
    const radius = Math.min(width, height) / 2;
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    ctx.save();

    // Draw outer circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = theme.backgroundColor;
    ctx.fill();
    ctx.strokeStyle = theme.borderColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw inner circle (double-circle effect)
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.7, 0, Math.PI * 2);
    ctx.strokeStyle = theme.borderColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw label
    ctx.fillStyle = theme.textColor;
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.label || "End", centerX, centerY);

    ctx.restore();

    // Render ports
    this.renderPorts(ctx);
  }
}

// ============================================================================
// Log: registration complete
// ============================================================================

logger.info("✅ Flow Canvas entity registration complete", {
  entities: ["flow-start-canvas", "flow-action-canvas", "flow-decision-canvas", "flow-end-canvas"],
});
