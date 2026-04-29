import type { ScopedMeter } from "../../metrics";

export interface VisibilityIndexOptions {
  metrics: ScopedMeter;
}

export class VisibilityIndex {
  private readonly metrics: ScopedMeter;
  private readonly viewVisibleEntities = new Map<string, Set<string>>();
  private readonly entityVisibleInViews = new Map<string, Set<string>>();

  constructor(options: VisibilityIndexOptions) {
    this.metrics = options.metrics;
  }

  markEntityVisible(viewId: string, entityId: string): void {
    let viewSet = this.viewVisibleEntities.get(viewId);
    if (!viewSet) {
      viewSet = new Set<string>();
      this.viewVisibleEntities.set(viewId, viewSet);
    }

    if (viewSet.has(entityId)) {
      return;
    }

    viewSet.add(entityId);
    let entityViews = this.entityVisibleInViews.get(entityId);
    if (!entityViews) {
      entityViews = new Set<string>();
      this.entityVisibleInViews.set(entityId, entityViews);
    }
    entityViews.add(viewId);

    this.metrics.counter("visibility.add").add(1, { viewId });
  }

  markEntityInvisible(viewId: string, entityId: string): void {
    const viewSet = this.viewVisibleEntities.get(viewId);
    if (!viewSet?.delete(entityId)) {
      return;
    }

    if (viewSet.size === 0) {
      this.viewVisibleEntities.delete(viewId);
    }

    const entityViews = this.entityVisibleInViews.get(entityId);
    if (entityViews) {
      entityViews.delete(viewId);
      if (entityViews.size === 0) {
        this.entityVisibleInViews.delete(entityId);
      }
    }

    this.metrics.counter("visibility.remove").add(1, { viewId });
  }

  isEntityVisibleInView(viewId: string, entityId: string): boolean {
    return this.viewVisibleEntities.get(viewId)?.has(entityId) ?? false;
  }

  getVisibleEntities(viewId: string): Set<string> {
    const set = this.viewVisibleEntities.get(viewId);
    return new Set<string>(set ?? []);
  }

  getViewsForEntity(entityId: string): Set<string> {
    const set = this.entityVisibleInViews.get(entityId);
    return new Set<string>(set ?? []);
  }

  setViewVisibility(viewId: string, entityIds: Iterable<string>): void {
    const prev = this.viewVisibleEntities.get(viewId);
    if (prev) {
      for (const entityId of prev) {
        const views = this.entityVisibleInViews.get(entityId);
        if (!views) continue;
        views.delete(viewId);
        if (views.size === 0) {
          this.entityVisibleInViews.delete(entityId);
        }
      }
    }

    const nextSet = new Set<string>(entityIds);
    this.viewVisibleEntities.set(viewId, nextSet);

    for (const entityId of nextSet) {
      let views = this.entityVisibleInViews.get(entityId);
      if (!views) {
        views = new Set<string>();
        this.entityVisibleInViews.set(entityId, views);
      }
      views.add(viewId);
    }

    this.metrics.counter("visibility.view.set").add(1, { viewId });
  }

  clearViewVisibility(viewId: string): void {
    const set = this.viewVisibleEntities.get(viewId);
    if (!set) {
      return;
    }

    for (const entityId of set) {
      const views = this.entityVisibleInViews.get(entityId);
      if (!views) continue;
      views.delete(viewId);
      if (views.size === 0) {
        this.entityVisibleInViews.delete(entityId);
      }
    }

    this.viewVisibleEntities.delete(viewId);
    this.metrics.counter("visibility.view.clear").add(1, { viewId });
  }

  clearEntityVisibility(entityId: string): void {
    const views = this.entityVisibleInViews.get(entityId);
    if (!views) {
      return;
    }

    for (const viewId of views) {
      const set = this.viewVisibleEntities.get(viewId);
      if (!set) continue;
      set.delete(entityId);
      if (set.size === 0) {
        this.viewVisibleEntities.delete(viewId);
      }
    }

    this.entityVisibleInViews.delete(entityId);
    this.metrics.counter("visibility.entity.clear").add(1);
  }

  clearAll(): void {
    this.viewVisibleEntities.clear();
    this.entityVisibleInViews.clear();
  }
}
