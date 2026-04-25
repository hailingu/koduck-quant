import React from "react";
import type { IRenderContext } from "../../common/render/types";
import type { IEntity } from "../../common/entity";

export interface EditorProps {
  /** Canvas 引用，用于直接操作 Canvas 元素 */
  canvasRef: HTMLCanvasElement | null;
  /** 设置 Canvas 引用的回调函数 */
  setCanvasRef: (canvas: HTMLCanvasElement | null) => void;
  /** 鼠标按下事件处理器 */
  onMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  /** 鼠标移动事件处理器 */
  onMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  /** 鼠标释放事件处理器 */
  onMouseUp: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  /** 鼠标离开事件处理器 */
  onMouseLeave?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  /** 鼠标点击事件处理器 */
  onClick?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  /** 绘制函数，负责在 Canvas 上绘制内容 */
  onDraw: (canvas: HTMLCanvasElement) => void;
  /** 编辑器宽度 */
  width?: string | number;
  /** 编辑器高度 */
  height?: string | number;
  /** 是否正在拖拽，影响鼠标样式 */
  isDragging?: boolean;
  /** 是否正在批量拖拽，影响鼠标样式 */
  isDraggingMultiple?: boolean;
  /** 是否正在框选，影响鼠标样式 */
  isSelecting?: boolean;
  /** Canvas 样式自定义 */
  canvasStyle?: React.CSSProperties;
  /** 容器样式自定义 */
  containerStyle?: React.CSSProperties;
  /** 是否显示边框 */
  showBorder?: boolean;
  /** 编辑器类名 */
  className?: string;
  /** 是否禁用编辑器 */
  disabled?: boolean;
  /** 视口状态变化回调 */
  onViewportChange?: (viewport: IRenderContext["viewport"]) => void;
  /** 渲染上下文构建器就绪回调 */
  onRenderContextReady?: (contextBuilder: RenderContextBuilder) => void;
  /** 外部控制的视口状态 */
  viewport?: Partial<IRenderContext["viewport"]>;
}

/**
 * 渲染上下文构建器接口
 * 提供构建和操作 IRenderContext 的方法
 */
export interface RenderContextBuilder {
  /** 获取当前 Canvas 元素 */
  getCanvas(): HTMLCanvasElement | null;

  /** 获取当前视口信息 */
  getViewport(): IRenderContext["viewport"];

  /** 构建完整的 IRenderContext */
  buildContext(
    nodes: IEntity[],
    metadata?: Record<string, unknown>
  ): IRenderContext;

  /** 更新视口信息 */
  updateViewport(updates: Partial<IRenderContext["viewport"]>): void;
}

// Use only named exports for types
