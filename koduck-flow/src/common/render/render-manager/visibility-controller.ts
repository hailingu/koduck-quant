import { VisibilityIndex } from "./visibility-index";

export class VisibilityController {
  private readonly index: VisibilityIndex;

  constructor(index: VisibilityIndex) {
    this.index = index;
  }

  markEntityVisible(viewId: string, entityId: string): void {
    this.index.markEntityVisible(viewId, entityId);
  }

  markEntityInvisible(viewId: string, entityId: string): void {
    this.index.markEntityInvisible(viewId, entityId);
  }

  isEntityVisibleInView(viewId: string, entityId: string): boolean {
    return this.index.isEntityVisibleInView(viewId, entityId);
  }

  getVisibleEntities(viewId: string): Set<string> {
    return this.index.getVisibleEntities(viewId);
  }

  setViewVisibility(viewId: string, entityIds: Iterable<string>): void {
    this.index.setViewVisibility(viewId, entityIds);
  }

  clearViewVisibility(viewId: string): void {
    this.index.clearViewVisibility(viewId);
  }

  clearEntityVisibility(entityId: string): void {
    this.index.clearEntityVisibility(entityId);
  }

  getViewsForEntity(entityId: string): Set<string> {
    return this.index.getViewsForEntity(entityId);
  }

  clearAll(): void {
    this.index.clearAll();
  }
}
