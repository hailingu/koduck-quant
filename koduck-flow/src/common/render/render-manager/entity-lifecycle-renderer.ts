import type { IEntity } from "../../entity";
import { releaseRenderContext } from "../../memory";
import type { IRender, IRenderContext, RenderResult, IRenderStrategy } from "../types";
import { diagnostics } from "../render-diagnostics";
import type { ScopedMeter } from "../../metrics";
import type { DirtyRegionManager } from "./dirty-region-manager";
import type { RenderCanvasArtifacts, RenderModuleRenderOutput } from "./contracts";
import type { EntityLifecycleTrackerEventMap } from "./entity-lifecycle-events";

const isNullish = (value: unknown): value is null | undefined =>
  value === null || value === undefined;

export type TrackerLogger = {
  warn: (payload: Record<string, unknown>) => void;
};

export type EntityRenderDependencies = {
  renderEntities: Map<string, IEntity>;
  renderResults: Map<string, RenderResult>;
  renderStrategy: IRenderStrategy | undefined;
  createStrategyContext: (entity: IEntity) => IRenderContext;
  meter: ScopedMeter;
  requestFullRedraw: (reason: string) => void;
  resolveExternalEntity?: (entityId: string) => IEntity | undefined;
  dirtyRegionManager: DirtyRegionManager;
  events: EntityLifecycleTrackerEventMap;
  logger: TrackerLogger;
};

export function renderEntity(
  entityId: string,
  deps: EntityRenderDependencies
): RenderModuleRenderOutput {
  diagnostics.debug("🔍 获取实体渲染元素:", entityId);

  const entity = deps.renderEntities.get(entityId);
  if (!entity) {
    deps.logger.warn({
      event: deps.events.EntityNotTracked,
      message: "Attempted to render entity that is not tracked",
      emoji: "⚠️",
      metadata: { entityId },
    });
    deps.meter.counter("render.skipped").add(1, { reason: "not_tracked" });
    return;
  }

  if (!deps.renderStrategy) {
    deps.logger.warn({
      event: deps.events.MissingRenderSelector,
      message: "Render selector not configured",
      emoji: "⚠️",
      metadata: { entityId },
    });
    deps.meter.counter("render.skipped").add(1, { reason: "no_selector" });
    return;
  }

  const context = deps.createStrategyContext(entity);
  try {
    const selection = deps.renderStrategy.selectOptimalRenderer(entity, context);
    const renderer = selection.renderer as IRender | undefined;
    if (!renderer) {
      deps.logger.warn({
        event: deps.events.MissingRenderer,
        message: "No renderer available for entity",
        emoji: "⚠️",
        metadata: { entityId },
      });
      deps.meter.counter("render.skipped").add(1, { reason: "no_renderer" });
      return;
    }

    const start = performance.now();
    const renderOutput = renderer.render(entity);
    const duration = performance.now() - start;
    const rendererType = renderer.getType?.() || "unknown";

    const serializedOutput =
      isNullish(renderOutput) && selection.renderToString
        ? selection.renderToString(entity, context)
        : undefined;
    const result = renderOutput ?? serializedOutput ?? null;

    deps.meter.counter("render.count").add(1, { renderer: rendererType });
    deps.meter
      .histogram("render.duration.ms", { unit: "ms" })
      .record(duration, { renderer: rendererType });

    const timestamp = start + duration;
    const normalizedElement = result ?? undefined;
    const renderRecord: RenderResult = {
      success: !isNullish(result),
      element: normalizedElement,
      rendererId: renderer.getName?.() ?? rendererType,
      entityId,
      timestamp,
    };

    if (renderRecord.success) {
      deps.renderResults.set(entityId, renderRecord);
    } else {
      deps.renderResults.delete(entityId);
    }

    return normalizedElement ?? undefined;
  } finally {
    releaseRenderContext(context);
  }
}

export type RenderAllDependencies = {
  renderEntities: Map<string, IEntity>;
  meter: ScopedMeter;
  dirtyRegionManager: DirtyRegionManager;
};

export function renderAllEntities(
  getArtifacts: () => RenderCanvasArtifacts,
  deps: RenderAllDependencies
): void {
  const { renderer, context, canvas, c2d } = getArtifacts();

  if (!canvas) {
    deps.meter.counter("renderAll.skipped").add(1, { reason: "no_canvas" });
    return;
  }

  if (!c2d) {
    deps.meter.counter("renderAll.skipped").add(1, { reason: "no_2d_ctx" });
    return;
  }

  deps.dirtyRegionManager.paintBackground(c2d, canvas, context);

  const entities = Array.from(deps.renderEntities.values());
  const canvasRenderer = renderer;
  const canvasRenderable = canvasRenderer
    ? entities.filter((ent) => canvasRenderer.canRender(ent))
    : [];

  if (canvasRenderer && canvasRenderable.length > 0) {
    canvasRenderer.batchRender?.(canvasRenderable);
    deps.meter.counter("renderAll.count").add(1, { renderer: "canvas" });
  }
}

export type MarkDirtyDependencies = {
  renderEntities: Map<string, IEntity>;
  dirtyRegionManager: DirtyRegionManager;
  requestFullRedraw: (reason: string) => void;
  resolveExternalEntity?: (entityId: string) => IEntity | undefined;
};

export function markEntityDirtyById(
  entityId: string,
  reason: string,
  deps: MarkDirtyDependencies
): boolean {
  let entity = deps.renderEntities.get(entityId);

  if (!entity && deps.resolveExternalEntity) {
    entity = deps.resolveExternalEntity(entityId);
    if (entity) {
      deps.renderEntities.set(entity.id, entity);
    }
  }

  if (!entity) {
    deps.requestFullRedraw(`${reason}:missing_entity`);
    return false;
  }

  const marked = deps.dirtyRegionManager.markEntityDirty(entity, reason);
  if (!marked) {
    deps.requestFullRedraw(`${reason}:mark_failed`);
  }

  return marked;
}
