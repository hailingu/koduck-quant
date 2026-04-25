import type { IEntity } from "../../entity";
import type { IRenderContext, RenderResult, IRenderStrategy } from "../types";
import { diagnostics } from "../render-diagnostics";
import { logger } from "../../logger";
import type { ScopedMeter } from "../../metrics";
import type { DirtyRegionManager } from "./dirty-region-manager";
import { VisibilityModule } from "./visibility";
import type {
  IEntityLifecycleTracker,
  RenderCanvasArtifacts,
  RenderModuleRenderOutput,
} from "./contracts";
import { EntityLifecycleTrackerEvent } from "./entity-lifecycle-events";
import {
  markEntityDirtyById as markEntityDirtyByIdHelper,
  renderAllEntities,
  renderEntity,
} from "./entity-lifecycle-renderer";

const trackerLogger = logger.withContext({
  tag: "render-manager:tracker",
  metadata: { component: "EntityLifecycleTracker" },
});

export type EntityLifecycleTrackerOptions = {
  dirtyRegionManager: DirtyRegionManager;
  visibilityModule: VisibilityModule;
  meter: ScopedMeter;
  scheduleDirtyFlush: () => void;
  requestFullRedraw: (reason: string) => void;
  createStrategyContext?: (entity: IEntity) => IRenderContext;
  resolveExternalEntity?: (entityId: string) => IEntity | undefined;
};

export class EntityLifecycleTracker implements IEntityLifecycleTracker {
  private readonly renderEntities = new Map<string, IEntity>();
  private readonly renderResults = new Map<string, RenderResult>();
  private readonly dirtyRegionManager: DirtyRegionManager;
  private readonly visibilityModule: VisibilityModule;
  private readonly meter: ScopedMeter;
  private readonly scheduleDirtyFlushFn: () => void;
  private readonly requestFullRedraw: (reason: string) => void;
  private createStrategyContext: (entity: IEntity) => IRenderContext;
  private resolveExternalEntity: ((entityId: string) => IEntity | undefined) | undefined;
  private renderStrategy: IRenderStrategy | undefined;

  constructor(options: EntityLifecycleTrackerOptions) {
    this.dirtyRegionManager = options.dirtyRegionManager;
    this.visibilityModule = options.visibilityModule;
    this.meter = options.meter;
    this.scheduleDirtyFlushFn = options.scheduleDirtyFlush;
    this.requestFullRedraw = options.requestFullRedraw;
    this.createStrategyContext =
      options.createStrategyContext ?? ((entity) => this.createDefaultContext(entity));
    this.resolveExternalEntity = options.resolveExternalEntity;
  }

  bootstrap(entities: Iterable<IEntity>, options?: { markDirty?: boolean }): number {
    let initialized = 0;
    for (const entity of entities) {
      if (!this.renderEntities.has(entity.id)) {
        this.renderEntities.set(entity.id, entity);
        const shouldMarkDirty = options?.markDirty ?? false;
        if (shouldMarkDirty) {
          if (this.dirtyRegionManager.markEntityDirty(entity, "bootstrap")) {
            this.scheduleDirtyFlushFn();
          }
        }
        initialized += 1;
      }
    }
    return initialized;
  }

  addEntity(entity: IEntity, options?: { markDirty?: boolean }): void {
    diagnostics.debug("🎯 添加实体到渲染队列:", entity.id);
    this.renderEntities.set(entity.id, entity);
    this.meter.counter("queue.add").add(1);

    const shouldMarkDirty = options?.markDirty ?? true;
    if (!shouldMarkDirty) {
      return;
    }

    if (this.dirtyRegionManager.markEntityDirty(entity, "add")) {
      this.scheduleDirtyFlushFn();
    }
  }

  removeEntity(entityId: string, options?: { markDirty?: boolean; schedule?: boolean }): void {
    diagnostics.debug("🗑️ 从渲染队列移除实体:", entityId);
    const shouldMarkDirty = options?.markDirty ?? true;
    const entity = this.renderEntities.get(entityId);
    const removed = this.renderEntities.delete(entityId);

    if (!removed) {
      trackerLogger.warn({
        event: EntityLifecycleTrackerEvent.EntityNotTracked,
        message: "Attempted to remove entity that is not tracked",
        emoji: "⚠️",
        metadata: { entityId },
      });
      this.meter.counter("queue.remove.miss").add(1);
      return;
    }

    this.renderResults.delete(entityId);
    this.visibilityModule.clearEntityVisibility(entityId);
    diagnostics.debug("✅ 实体已从渲染队列移除");
    this.meter.counter("queue.remove").add(1);

    if (!shouldMarkDirty) {
      return;
    }

    if (entity && this.dirtyRegionManager.markEntityDirty(entity, "remove")) {
      if (options?.schedule !== false) {
        this.scheduleDirtyFlushFn();
      }
    } else if (!entity) {
      this.requestFullRedraw("remove:missing_entity_state");
    }
  }

  render(entityId: string): RenderModuleRenderOutput {
    return renderEntity(entityId, {
      renderEntities: this.renderEntities,
      renderResults: this.renderResults,
      renderStrategy: this.renderStrategy,
      createStrategyContext: this.createStrategyContext,
      meter: this.meter,
      requestFullRedraw: this.requestFullRedraw,
      dirtyRegionManager: this.dirtyRegionManager,
      events: EntityLifecycleTrackerEvent,
      logger: trackerLogger,
      ...(this.resolveExternalEntity && {
        resolveExternalEntity: this.resolveExternalEntity,
      }),
    });
  }

  renderAll(getArtifacts: () => RenderCanvasArtifacts): void {
    renderAllEntities(getArtifacts, {
      renderEntities: this.renderEntities,
      meter: this.meter,
      dirtyRegionManager: this.dirtyRegionManager,
    });
  }

  markEntityDirty(entity: IEntity, reason: string): boolean {
    return this.dirtyRegionManager.markEntityDirty(entity, reason);
  }

  markEntityDirtyById(entityId: string, reason: string): boolean {
    return markEntityDirtyByIdHelper(entityId, reason, {
      renderEntities: this.renderEntities,
      dirtyRegionManager: this.dirtyRegionManager,
      requestFullRedraw: this.requestFullRedraw,
      ...(this.resolveExternalEntity && {
        resolveExternalEntity: this.resolveExternalEntity,
      }),
    });
  }

  scheduleDirtyFlush(): void {
    this.scheduleDirtyFlushFn();
  }

  getCachedRender(entityId: string): RenderResult | undefined {
    return this.renderResults.get(entityId);
  }

  getEntity(entityId: string): IEntity | undefined {
    return this.renderEntities.get(entityId);
  }

  getEntities(): Iterable<IEntity> {
    return this.renderEntities.values();
  }

  getSize(): number {
    return this.renderEntities.size;
  }

  getRenderResultsSize(): number {
    return this.renderResults.size;
  }

  getEntityMap(): Map<string, IEntity> {
    return this.renderEntities;
  }

  setRenderStrategy(strategy: IRenderStrategy): void {
    this.renderStrategy = strategy;
  }

  setStrategyContextBuilder(builder: (entity: IEntity) => IRenderContext): void {
    this.createStrategyContext = builder;
  }

  setExternalEntityResolver(
    resolver: ((entityId: string) => IEntity | undefined) | undefined
  ): void {
    this.resolveExternalEntity = resolver;
  }

  markEntityVisible(viewId: string, entityId: string): void {
    this.visibilityModule.markEntityVisible(viewId, entityId);
  }

  markEntityInvisible(viewId: string, entityId: string): void {
    this.visibilityModule.markEntityInvisible(viewId, entityId);
  }

  isEntityVisibleInView(viewId: string, entityId: string): boolean {
    return this.visibilityModule.isEntityVisibleInView(viewId, entityId);
  }

  getVisibleEntities(viewId: string): Set<string> {
    return this.visibilityModule.getVisibleEntities(viewId);
  }

  setViewVisibility(viewId: string, entityIds: Iterable<string>): void {
    this.visibilityModule.setViewVisibility(viewId, entityIds);
  }

  clearViewVisibility(viewId: string): void {
    this.visibilityModule.clearViewVisibility(viewId);
  }

  clearEntityVisibility(entityId: string): void {
    this.visibilityModule.clearEntityVisibility(entityId);
  }

  getViewsForEntity(entityId: string): Set<string> {
    return this.visibilityModule.getViewsForEntity(entityId);
  }

  dispose(): void {
    this.renderEntities.clear();
    this.renderResults.clear();
    this.visibilityModule.clearAll();
  }

  private createDefaultContext(entity: IEntity): IRenderContext {
    return {
      nodes: [entity],
      viewport: { x: 0, y: 0, zoom: 1, width: 0, height: 0 },
      timestamp: Date.now(),
    };
  }
}
