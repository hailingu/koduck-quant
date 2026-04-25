import { GenericEvent } from "./event";

// 视觉渲染事件载荷类型
export interface RenderAllPayload {
  reason?: string;
  hints?: {
    onlyEntities?: string[];
    onlyLayers?: string[];
  };
}

export interface RenderEntitiesPayload {
  entityIds: string[];
  reason?: string;
  op?: "render" | "remove"; // 缺省为 render
}

export interface ViewportChangedPayload {
  x: number;
  y: number;
  zoom: number;
  size?: { w: number; h: number };
}

/**
 * RenderEventManager：独立的渲染事件总线
 * - 上层（交互工具/页面）投递视觉事件
 * - RenderManager 仅订阅这些事件以进行渲染
 */
export class RenderEventManager {
  // 事件通道
  private readonly evRenderAll = new GenericEvent<RenderAllPayload>("render:all", {
    enableBatching: false,
  });
  private readonly evRenderEntities = new GenericEvent<RenderEntitiesPayload>("render:entities", {
    // 高频批量实体渲染请求，合并到帧
    enableBatching: true,
    batchSize: 200,
    batchInterval: 16,
  });
  private readonly evViewportChanged = new GenericEvent<ViewportChangedPayload>("render:viewport", {
    enableBatching: true,
    batchSize: 1,
    batchInterval: 16,
  });

  // 订阅 API
  onRenderAll(listener: (p: RenderAllPayload) => void): () => void {
    return this.evRenderAll.addEventListener(listener);
  }
  onRenderEntities(listener: (p: RenderEntitiesPayload) => void): () => void {
    return this.evRenderEntities.addEventListener(listener);
  }
  onViewportChanged(listener: (p: ViewportChangedPayload) => void): () => void {
    return this.evViewportChanged.addEventListener(listener);
  }

  // 发布 API
  requestRenderAll(payload?: RenderAllPayload): void {
    this.evRenderAll.fire(payload ?? {});
  }
  requestRenderEntities(payload: RenderEntitiesPayload): void {
    if (!payload || !Array.isArray(payload.entityIds)) return;
    const unique = Array.from(new Set(payload.entityIds));
    if (unique.length === 0) return;
    this.evRenderEntities.fire({ ...payload, entityIds: unique });
  }
  notifyViewportChanged(payload: ViewportChangedPayload): void {
    this.evViewportChanged.fire(payload);
  }

  setDebugMode(enabled: boolean): this {
    this.evRenderAll.setDebugMode(enabled);
    this.evRenderEntities.setDebugMode(enabled);
    this.evViewportChanged.setDebugMode(enabled);
    return this;
  }
}

export function createRenderEventManager(): RenderEventManager {
  return new RenderEventManager();
}

export type { RenderAllPayload as RenderAllEvent, RenderEntitiesPayload as RenderEntitiesEvent };
