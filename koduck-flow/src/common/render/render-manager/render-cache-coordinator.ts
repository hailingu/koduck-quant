import type { IRenderContext, ICanvasRenderer } from "../types";
import type { RenderMetricsModule } from "./render-metrics-module";
import type {
  IEntityLifecycleTracker,
  IRenderCacheCoordinator,
  RenderCanvasArtifacts,
} from "./contracts";

export type RenderCacheCoordinatorOptions = {
  metrics: RenderMetricsModule;
  resolveCanvasRenderer: (rendererId?: string) => ICanvasRenderer | undefined;
  defaultRendererId?: string;
};

export class RenderCacheCoordinator implements IRenderCacheCoordinator {
  private readonly metrics: RenderMetricsModule;
  private resolveCanvasRenderer: (rendererId?: string) => ICanvasRenderer | undefined;
  private version = 0;
  private readonly defaultRendererId: string;

  constructor(options: RenderCacheCoordinatorOptions) {
    this.metrics = options.metrics;
    this.resolveCanvasRenderer = options.resolveCanvasRenderer;
    this.defaultRendererId = options.defaultRendererId ?? "canvas";
  }

  getVersion(): number {
    return this.version;
  }

  bumpVersion(): number {
    this.version += 1;
    return this.version;
  }

  setRenderContext(context: IRenderContext): void {
    const renderer = this.resolveCanvasRenderer(this.defaultRendererId);
    renderer?.setRenderContext(context);
    this.metrics.recordContextOperation("set");
    this.bumpVersion();
  }

  getRenderContext(): IRenderContext | undefined {
    const renderer = this.resolveCanvasRenderer(this.defaultRendererId);
    return renderer?.getRenderContext();
  }

  updateRenderContext(updates: Partial<IRenderContext>): void {
    const renderer = this.resolveCanvasRenderer(this.defaultRendererId);
    renderer?.updateRenderContext(updates);
    this.metrics.recordContextOperation("update");
    this.bumpVersion();
  }

  renderAll(tracker: IEntityLifecycleTracker): void {
    tracker.renderAll(() => this.getCanvasArtifacts());
  }

  getCanvasArtifacts(): RenderCanvasArtifacts {
    const renderer = this.resolveCanvasRenderer(this.defaultRendererId);
    const context = renderer?.getRenderContext?.();
    const canvas = context?.canvas;
    const c2d = canvas?.getContext("2d") ?? undefined;
    return { renderer, context, canvas, c2d };
  }

  getPerformanceStats() {
    return this.metrics.getPerformanceStats();
  }

  setCanvasResolver(resolver: (rendererId?: string) => ICanvasRenderer | undefined): void {
    this.resolveCanvasRenderer = resolver;
  }

  dispose(): void {
    // no-op for now
  }
}
