import type { ScopedMeter } from "../../metrics";
import { VisibilityIndex } from "./visibility-index";
import { VisibilityController } from "./visibility-controller";

export class VisibilityModule {
  private readonly index: VisibilityIndex;
  private readonly controller: VisibilityController;

  constructor(scope: ScopedMeter) {
    this.index = new VisibilityIndex({ metrics: scope });
    this.controller = new VisibilityController(this.index);
  }

  getController(): VisibilityController {
    return this.controller;
  }

  markEntityVisible(viewId: string, entityId: string): void {
    this.controller.markEntityVisible(viewId, entityId);
  }

  markEntityInvisible(viewId: string, entityId: string): void {
    this.controller.markEntityInvisible(viewId, entityId);
  }

  isEntityVisibleInView(viewId: string, entityId: string): boolean {
    return this.controller.isEntityVisibleInView(viewId, entityId);
  }

  getVisibleEntities(viewId: string): Set<string> {
    return this.controller.getVisibleEntities(viewId);
  }

  setViewVisibility(viewId: string, entityIds: Iterable<string>): void {
    this.controller.setViewVisibility(viewId, entityIds);
  }

  clearViewVisibility(viewId: string): void {
    this.controller.clearViewVisibility(viewId);
  }

  clearEntityVisibility(entityId: string): void {
    this.controller.clearEntityVisibility(entityId);
  }

  getViewsForEntity(entityId: string): Set<string> {
    return this.controller.getViewsForEntity(entityId);
  }

  clearAll(): void {
    this.controller.clearAll();
  }
}
