import { GenericEvent } from "./event";

// Visual render event payload types
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
  op?: "render" | "remove"; // Defaults to render
}

export interface ViewportChangedPayload {
  x: number;
  y: number;
  zoom: number;
  size?: { w: number; h: number };
}

/**
 * RenderEventManager: Independent render event bus
 * - Upper layer (interaction tools/pages) posts visual events
 * - RenderManager only subscribes to these events for rendering
 */
export class RenderEventManager {
  // Event channels
  private readonly evRenderAll = new GenericEvent<RenderAllPayload>("render:all", {
    enableBatching: false,
  });
  private readonly evRenderEntities = new GenericEvent<RenderEntitiesPayload>("render:entities", {
    // High-frequency batch entity render requests, merged into frames
    enableBatching: true,
    batchSize: 200,
    batchInterval: 16,
  });
  private readonly evViewportChanged = new GenericEvent<ViewportChangedPayload>("render:viewport", {
    enableBatching: true,
    batchSize: 1,
    batchInterval: 16,
  });

  // Subscription API
  onRenderAll(listener: (p: RenderAllPayload) => void): () => void {
    return this.evRenderAll.addEventListener(listener);
  }
  onRenderEntities(listener: (p: RenderEntitiesPayload) => void): () => void {
    return this.evRenderEntities.addEventListener(listener);
  }
  onViewportChanged(listener: (p: ViewportChangedPayload) => void): () => void {
    return this.evViewportChanged.addEventListener(listener);
  }

  // Publish API
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
