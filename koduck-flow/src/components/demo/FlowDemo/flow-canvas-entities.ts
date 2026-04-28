/**
 * @file Flow Canvas Entities
 * @description
 * Canvas 渲染版本的 Flow 节点实体（Start, Action, Decision, End）。
 * 这些实体继承自 UMLNodeEntity，使用 @AutoRegistry 装饰器自动注册，
 * 可在 FlowDemo 的 Canvas 画布中创建和渲染。
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

// 获取注册表管理器
const runtime = getRuntimeForEnvironment(DEFAULT_KODUCKFLOW_ENVIRONMENT);
const flowCanvasRegistryManager = runtime.RegistryManager;

logger.info("🔧 Flow Canvas 实体文件被加载");

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 从渲染上下文获取 Canvas 2D Context
 * @param context - 渲染上下文对象
 * @returns Canvas 2D 渲染上下文，或 null
 */
function getCanvasContext(context: unknown): CanvasRenderingContext2D | null {
  const ctxObj = context as { canvas?: HTMLCanvasElement } | undefined;
  const canvas = ctxObj?.canvas;
  if (!canvas) return null;
  return canvas.getContext("2d");
}

/**
 * 绘制圆角矩形路径
 * @param ctx - Canvas 2D 渲染上下文
 * @param x - 左上角 X 坐标
 * @param y - 左上角 Y 坐标
 * @param width - 矩形宽度
 * @param height - 矩形高度
 * @param radius - 圆角半径
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
 * 绘制圆角矩形顶部（用于 header bar）
 * @param ctx - Canvas 2D 渲染上下文
 * @param x - 左上角 X 坐标
 * @param y - 左上角 Y 坐标
 * @param width - 矩形宽度
 * @param height - 矩形高度
 * @param radius - 圆角半径
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
 * Flow 开始节点 - Canvas 版本
 *
 * @description
 * 绿色卡片式节点，表示流程的起点。
 * 包含标题、描述、触发类型 badge 和表单内容区域。
 * 只有一个输出端口，没有输入端口。
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
   * 创建 Flow 开始节点实体
   * @param args - 实体初始化参数
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

    // 设置输出端口
    this.setPorts([{ name: "out", direction: "out", side: "bottom", offset: 0.5 }]);

    logger.debug("FlowStartCanvasEntity created", { id: this.id });
  }

  /**
   * 渲染开始节点到 Canvas - 已禁用，改为使用 React BaseFlowNode 组件渲染
   * @param context - 渲染上下文
   */
  override async render(_context?: unknown): Promise<void> {
    // Start 节点现在由 React BaseFlowNode 组件渲染，不再使用 Canvas 绘制
    // 这样可以支持边框拖拽缩放等交互功能
    return;
  }
}

// ============================================================================
// Flow Action Canvas Entity
// ============================================================================

/**
 * Flow 操作节点 - Canvas 版本
 *
 * @description
 * 蓝色圆角矩形节点，表示流程中的操作步骤。
 * 有一个输入端口和一个输出端口。
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
   * 创建 Flow 操作节点实体
   * @param args - 实体初始化参数
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

    // 设置输入和输出端口
    this.setPorts([
      { name: "in", direction: "in", side: "top", offset: 0.5 },
      { name: "out", direction: "out", side: "bottom", offset: 0.5 },
    ]);

    logger.debug("FlowActionCanvasEntity created", { id: this.id });
  }

  /**
   * 渲染操作节点到 Canvas
   * @param context - 渲染上下文
   */
  override async render(context?: unknown): Promise<void> {
    const ctx = getCanvasContext(context);
    if (!ctx) return;

    const { x, y, width, height } = this.getBounds();
    const theme = FLOW_NODE_THEMES.action;
    const radius = theme.borderRadius;
    const headerHeight = 24;

    ctx.save();

    // 绘制圆角矩形背景
    drawRoundedRect(ctx, x, y, width, height, radius);
    ctx.fillStyle = theme.backgroundColor;
    ctx.fill();
    ctx.strokeStyle = theme.borderColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 绘制 Header bar
    ctx.save();
    ctx.clip();
    drawRoundedRectTop(ctx, x, y, width, headerHeight, radius);
    ctx.fillStyle = theme.headerColor;
    ctx.fill();
    ctx.restore();

    // 绘制标签（在 header 中）
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(this.label || "操作", x + 10, y + headerHeight / 2);

    ctx.restore();

    // 渲染端口
    this.renderPorts(ctx);
  }
}

// ============================================================================
// Flow Decision Canvas Entity
// ============================================================================

/**
 * Flow 判断节点 - Canvas 版本
 *
 * @description
 * 黄色菱形节点，表示流程中的条件判断。
 * 有一个输入端口和多个输出端口（是/否分支）。
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
   * 创建 Flow 判断节点实体
   * @param args - 实体初始化参数
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

    // 设置端口：顶部输入，左右两侧输出（是/否分支）
    this.setPorts([
      { name: "in", direction: "in", side: "top", offset: 0.5 },
      { name: "yes", direction: "out", side: "right", offset: 0.5 },
      { name: "no", direction: "out", side: "bottom", offset: 0.5 },
    ]);

    logger.debug("FlowDecisionCanvasEntity created", { id: this.id });
  }

  /**
   * 渲染判断节点到 Canvas
   * @param context - 渲染上下文
   */
  override async render(context?: unknown): Promise<void> {
    const ctx = getCanvasContext(context);
    if (!ctx) return;

    const { x, y, width, height } = this.getBounds();
    const theme = FLOW_NODE_THEMES.decision;
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    ctx.save();

    // 绘制菱形
    ctx.beginPath();
    ctx.moveTo(centerX, y); // 上顶点
    ctx.lineTo(x + width, centerY); // 右顶点
    ctx.lineTo(centerX, y + height); // 下顶点
    ctx.lineTo(x, centerY); // 左顶点
    ctx.closePath();
    ctx.fillStyle = theme.backgroundColor;
    ctx.fill();
    ctx.strokeStyle = theme.borderColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 绘制标签
    ctx.fillStyle = theme.textColor;
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.label || "判断", centerX, centerY);

    ctx.restore();

    // 渲染端口
    this.renderPorts(ctx);
  }
}

// ============================================================================
// Flow End Canvas Entity
// ============================================================================

/**
 * Flow 结束节点 - Canvas 版本
 *
 * @description
 * 红色双圆环节点，表示流程的终点。
 * 只有一个输入端口，没有输出端口。
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
   * 创建 Flow 结束节点实体
   * @param args - 实体初始化参数
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

    // 设置输入端口
    this.setPorts([{ name: "in", direction: "in", side: "top", offset: 0.5 }]);

    logger.debug("FlowEndCanvasEntity created", { id: this.id });
  }

  /**
   * 渲染结束节点到 Canvas
   * @param context - 渲染上下文
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

    // 绘制外圆
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = theme.backgroundColor;
    ctx.fill();
    ctx.strokeStyle = theme.borderColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 绘制内圆（双圆环效果）
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.7, 0, Math.PI * 2);
    ctx.strokeStyle = theme.borderColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 绘制标签
    ctx.fillStyle = theme.textColor;
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.label || "结束", centerX, centerY);

    ctx.restore();

    // 渲染端口
    this.renderPorts(ctx);
  }
}

// ============================================================================
// 日志：注册完成
// ============================================================================

logger.info("✅ Flow Canvas 实体注册完成", {
  entities: ["flow-start-canvas", "flow-action-canvas", "flow-decision-canvas", "flow-end-canvas"],
});
