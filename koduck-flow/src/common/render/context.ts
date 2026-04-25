import type { IEntity } from "../entity/types";

/**
 * 渲染上下文接口
 * 包含渲染所需的所有信息
 */
export interface IRenderContext {
  /** 要渲染的节点列表 */
  nodes: IEntity[];

  /** 视口信息 */
  viewport: {
    x: number;
    y: number;
    zoom: number;
    width: number;
    height: number;
  };
  /** Canvas元素（可选，React 渲染路径不需要） */
  canvas?: HTMLCanvasElement;
  /** 渲染时间戳 */
  timestamp: number;
  /** 额外的元数据 */
  metadata?: Record<string, unknown>;
  /** 支持扩展 */
  [key: string]: unknown;
}
