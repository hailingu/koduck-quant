import type { IRenderContext } from "../types";
import type { CanvasRender } from "../canvas-render";
import type { RenderFrameScheduler } from "./render-frame-scheduler";
import type { IEntity, IRenderableEntity } from "../../entity";
import type { ScopedMeter } from "../../metrics";
import type { Bounds, DirtyRegion } from "./types";
import type { LoggerContextAdapter } from "../../logger";
import { borrowEntityArray, releaseEntityArray } from "../../memory";

export const DirtyRegionEvent = {
  BoundsExtractionError: "dirty-region:bounds-extraction-error",
  GridRenderError: "dirty-region:grid-render-error",
} as const;

/**
 *
 */
export interface DirtyRegionManagerArtifacts {
  renderer?: CanvasRender | undefined;
  context?: IRenderContext | undefined;
  canvas?: HTMLCanvasElement | undefined;
  c2d?: CanvasRenderingContext2D | undefined;
}

/**
 *
 */
export interface DirtyRegionManagerOptions {
  frameScheduler: RenderFrameScheduler;
  diagnostics: {
    debug: (message: string, data?: Record<string, unknown>) => void;
  };
  logger: LoggerContextAdapter;
  metrics: ScopedMeter;
  getCanvasArtifacts: () => DirtyRegionManagerArtifacts;
  getTrackedEntities: () => Iterable<IEntity>;
  onFullRedrawRequired: (reason: string) => void;
  onPartialFlush: () => void;
  maxDirtyRegions?: number;
  dirtyRegionPadding?: number;
}

/**
 *DirtyRegionManager
 */
export class DirtyRegionManager {
  private readonly frameScheduler: RenderFrameScheduler;
  private readonly diagnostics: DirtyRegionManagerOptions["diagnostics"];
  private readonly logger: DirtyRegionManagerOptions["logger"];
  private readonly metrics: ScopedMeter;
  private readonly getCanvasArtifacts: () => DirtyRegionManagerArtifacts;
  private readonly getTrackedEntities: () => Iterable<IEntity>;
  private readonly onFullRedrawRequired: (reason: string) => void;
  private readonly onPartialFlush: () => void;
  private readonly maxDirtyRegions: number;
  private readonly dirtyRegionPadding: number;

  private readonly dirtyEntities = new Set<string>();
  private dirtyRegions: DirtyRegion[] = [];
  private dirtyFlushScheduled = false;

  /**
   *constructor
   *
   * @param options
   */
  constructor(options: DirtyRegionManagerOptions) {
    this.frameScheduler = options.frameScheduler;
    this.diagnostics = options.diagnostics;
    this.logger = options.logger;
    this.metrics = options.metrics;
    this.getCanvasArtifacts = options.getCanvasArtifacts;
    this.getTrackedEntities = options.getTrackedEntities;
    this.onFullRedrawRequired = options.onFullRedrawRequired;
    this.onPartialFlush = options.onPartialFlush;
    this.maxDirtyRegions = options.maxDirtyRegions ?? 24;
    this.dirtyRegionPadding = options.dirtyRegionPadding ?? 12;
  }

  /**
   *markEntityDirty
   *
   * @param entity
   * @param reason
   */
  markEntityDirty(entity: IEntity, reason: string): boolean {
    const bounds = this.extractEntityBounds(entity);
    if (!bounds) {
      this.diagnostics.debug("⚠️ Entity missing bounds info, triggering full redraw", {
        entityId: entity.id,
        reason,
      });
      this.requestFullRedraw(`${reason}:no_bounds`);
      return false;
    }

    const registered = this.registerDirtyRegion(bounds, reason);
    if (!registered) {
      return false;
    }

    this.dirtyEntities.add(entity.id);
    return true;
  }

  /**
   *schedulePartialFlush
   *
   */
  schedulePartialFlush(): void {
    if (this.frameScheduler.isFullRedrawPending()) {
      return;
    }
    if (this.dirtyRegions.length === 0) {
      return;
    }
    if (this.dirtyFlushScheduled) {
      return;
    }
    if (this.frameScheduler.isBackpressureActive()) {
      this.diagnostics.debug("⏳ Render queue is in backpressure phase, skipping partial flush", {
        dirtyRegions: this.dirtyRegions.length,
      });
      return;
    }

    this.dirtyFlushScheduled = true;
    this.frameScheduler.runOnNextFrame(() => {
      this.dirtyFlushScheduled = false;
      if (this.frameScheduler.isFullRedrawPending()) {
        return;
      }
      this.flushDirtyRegions();
      this.onPartialFlush();
    });
  }

  /**
   *requestFullRedraw
   *
   * @param reason
   */
  requestFullRedraw(reason: string): void {
    this.diagnostics.debug("♻️ Upgrade to full redraw", { reason });
    this.frameScheduler.setFullRedrawPending(true);
    this.resetForFullRedraw();
    this.onFullRedrawRequired(reason);
  }

  /**
   *resetForFullRedraw
   *
   */
  resetForFullRedraw(): void {
    this.dirtyFlushScheduled = false;
    this.dirtyRegions = [];
    this.dirtyEntities.clear();
  }

  /**
   *getDirtyRegionCount
   *
   */
  getDirtyRegionCount(): number {
    return this.dirtyRegions.length;
  }

  /**
   *getDirtyEntityCount
   *
   */
  getDirtyEntityCount(): number {
    return this.dirtyEntities.size;
  }

  /**
   *getDirtyRegionsSnapshot
   *
   */
  getDirtyRegionsSnapshot(): DirtyRegion[] {
    return this.dirtyRegions.map((region) => ({ ...region }));
  }

  /**
   *getDirtyEntityIds
   *
   */
  getDirtyEntityIds(): Set<string> {
    return new Set(this.dirtyEntities);
  }

  private flushDirtyRegions(): void {
    if (this.dirtyRegions.length === 0) {
      return;
    }

    const { renderer: canvasRenderer, context, canvas, c2d } = this.getCanvasArtifacts();

    if (!canvasRenderer || !context || !canvas || !c2d) {
      this.requestFullRedraw("dirty_flush:no_canvas");
      return;
    }

    const regions = this.consumeDirtyRegions();
    const impactedEntities = this.collectEntitiesForRegions(regions);

    try {
      for (const region of regions) {
        this.paintBackground(c2d, canvas, context, region);
      }

      if (impactedEntities.length > 0) {
        const renderable = impactedEntities.filter((ent) => canvasRenderer.canRender?.(ent));
        if (renderable.length > 0) {
          canvasRenderer.batchRender?.(renderable);
          this.metrics.counter("render.partial").add(1, {
            renderer: "canvas",
            regions: regions.length,
            entities: renderable.length,
          });
        }
      }
    } finally {
      releaseEntityArray(impactedEntities);
    }
  }

  private consumeDirtyRegions(): DirtyRegion[] {
    const regions = this.dirtyRegions.map((region) => ({ ...region }));
    this.dirtyRegions = [];
    this.dirtyEntities.clear();
    return regions;
  }

  private collectEntitiesForRegions(regions: DirtyRegion[]): IEntity[] {
    const impacted = borrowEntityArray<IEntity>();
    for (const entity of this.getTrackedEntities()) {
      const bounds = this.extractEntityBounds(entity);
      if (!bounds) continue;
      if (regions.some((region) => this.isIntersecting(region, bounds))) {
        impacted.push(entity);
      }
    }
    return impacted;
  }

  private registerDirtyRegion(bounds: Bounds, reason: string): boolean {
    const { canvas } = this.getCanvasArtifacts();
    if (!canvas) {
      this.diagnostics.debug("⚠️ No available Canvas, upgrade to full redraw", {
        reason,
      });
      this.requestFullRedraw(`${reason}:no_canvas`);
      return false;
    }

    const expanded = this.expandBounds(bounds, this.dirtyRegionPadding, canvas);
    if (!expanded) {
      this.requestFullRedraw(`${reason}:invalid_bounds`);
      return false;
    }

    this.dirtyRegions.push(expanded);
    this.coalesceDirtyRegions();

    if (this.dirtyRegions.length > this.maxDirtyRegions) {
      this.requestFullRedraw(`${reason}:too_many_regions`);
      return false;
    }

    // Performance optimization: Check if accumulated dirty regions exceed a threshold
    // If too much area is marked dirty, it's more efficient to do a full redraw
    // than to perform many partial update operations
    const canvasArea = canvas.width * canvas.height;
    if (canvasArea > 0) {
      // Calculate total area of all dirty regions (in pixels)
      const dirtyArea = this.dirtyRegions.reduce(
        (sum, region) => sum + region.width * region.height,
        0
      );

      // Threshold: If dirty area exceeds 60% of canvas, switch to full redraw
      // Rationale: Drawing 60%+ of the canvas is often slower than full redraw
      // due to context switch overhead and individual region batching costs
      if (dirtyArea / canvasArea > 0.6) {
        this.requestFullRedraw(`${reason}:large_area`);
        return false;
      }
    }

    return true;
  }

  private coalesceDirtyRegions(): void {
    // Merge overlapping or adjacent dirty regions to optimize partial redraw passes
    // Algorithm: Greedy incremental merging
    // - Iterate through all dirty regions
    // - For each region, try to merge it into an existing merged region
    // - If region intersects with any merged region, expand that region to include both
    // - Otherwise, add region as a new entry in merged list
    // Time complexity: O(n^2) worst case, typically O(n) with few overlaps
    // Space complexity: O(n)
    // Benefits: Reduces draw calls from many small regions to fewer larger ones

    if (this.dirtyRegions.length <= 1) return;

    const merged: DirtyRegion[] = [];

    for (const region of this.dirtyRegions) {
      let handled = false;

      // Try to merge current region into an existing merged region
      for (const target of merged) {
        if (this.isIntersecting(target, region)) {
          // Expand target region to encompass both regions
          // This uses axis-aligned bounding box (AABB) logic
          this.expandRegion(target, region);
          handled = true;
          break;
        }
      }

      // If no merge occurred, add as new region to merged list
      if (!handled) {
        merged.push({ ...region });
      }
    }

    this.dirtyRegions = merged;
  }

  private expandRegion(target: DirtyRegion, source: DirtyRegion): void {
    // Expand target region to form the axis-aligned bounding box (AABB) that contains both regions
    // Algorithm: Compute min/max coordinates for both X and Y axes
    // This operation is O(1) and commonly used in collision detection and region merging

    // Step 1: Find the leftmost point (minimum X coordinate)
    const minX = Math.min(target.x, source.x);

    // Step 2: Find the topmost point (minimum Y coordinate)
    const minY = Math.min(target.y, source.y);

    // Step 3: Find the rightmost point by checking the right edges
    // right edge = x-coordinate + width
    const maxX = Math.max(target.x + target.width, source.x + source.width);

    // Step 4: Find the bottommost point by checking the bottom edges
    // bottom edge = y-coordinate + height
    const maxY = Math.max(target.y + target.height, source.y + source.height);

    // Step 5: Update target with the computed bounding box
    target.x = minX;
    target.y = minY;
    target.width = Math.max(0, maxX - minX);
    target.height = Math.max(0, maxY - minY);
  }

  private expandBounds(
    bounds: Bounds,
    padding: number,
    canvas?: HTMLCanvasElement
  ): DirtyRegion | null {
    if (!this.isValidBounds(bounds)) {
      return null;
    }
    const raw: DirtyRegion = {
      x: Math.floor(bounds.x - padding),
      y: Math.floor(bounds.y - padding),
      width: Math.ceil(bounds.width + padding * 2),
      height: Math.ceil(bounds.height + padding * 2),
    };

    if (canvas) {
      const clampedX = Math.max(0, raw.x);
      const clampedY = Math.max(0, raw.y);
      const maxWidth = canvas.width - clampedX;
      const maxHeight = canvas.height - clampedY;
      raw.x = clampedX;
      raw.y = clampedY;
      raw.width = Math.max(0, Math.min(raw.width, maxWidth));
      raw.height = Math.max(0, Math.min(raw.height, maxHeight));
    }

    return raw;
  }

  private isIntersecting(a: Bounds, b: Bounds): boolean {
    // Check if two axis-aligned bounding boxes (AABB) overlap or touch
    // Algorithm: Separating Axis Theorem (SAT) for 2D rectangles
    // Two rectangles DO NOT intersect if one of these conditions is true:
    // 1. Rectangle A is completely to the LEFT of B (a.x + a.width < b.x)
    // 2. Rectangle A is completely to the RIGHT of B (b.x + b.width < a.x)
    // 3. Rectangle A is completely ABOVE B (a.y + a.height < b.y)
    // 4. Rectangle A is completely BELOW B (b.y + b.height < a.y)
    // If none of these are true, rectangles must overlap (or at least touch at edges)
    // Time complexity: O(1) - constant time, only 4 comparisons

    return !(
      a.x + a.width < b.x || // a is to the left of b
      b.x + b.width < a.x || // a is to the right of b
      a.y + a.height < b.y || // a is above b
      b.y + b.height < a.y // a is below b
    );
  }

  private extractEntityBounds(entity: IEntity): Bounds | null {
    const maybeRenderable = entity as Partial<IRenderableEntity>;
    if (maybeRenderable && typeof maybeRenderable.getBounds === "function") {
      try {
        const bounds = maybeRenderable.getBounds();
        if (this.isValidBounds(bounds)) {
          return {
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
          };
        }
      } catch (error) {
        this.logger.warn({
          event: DirtyRegionEvent.BoundsExtractionError,
          message: "extractEntityBounds failed to compute bounds",
          emoji: "⚠️",
          metadata: { entityId: entity.id },
          error,
        });
      }
    }

    const candidatePositions = [
      (maybeRenderable?.position as { x?: number; y?: number } | undefined) ?? undefined,
      (
        entity as unknown as {
          data?: { position?: { x?: number; y?: number } };
        }
      )?.data?.position,
      (
        entity as unknown as {
          config?: { position?: { x?: number; y?: number } };
        }
      )?.config?.position,
    ];

    const candidateWidths = [
      maybeRenderable?.width,
      (entity as unknown as { data?: { width?: number } })?.data?.width,
      (entity as unknown as { config?: { width?: number } })?.config?.width,
    ];

    const candidateHeights = [
      maybeRenderable?.height,
      (entity as unknown as { data?: { height?: number } })?.data?.height,
      (entity as unknown as { config?: { height?: number } })?.config?.height,
    ];

    const pos = candidatePositions.find(
      (p): p is { x: number; y: number } =>
        !!p &&
        typeof p.x === "number" &&
        !Number.isNaN(p.x) &&
        typeof p.y === "number" &&
        !Number.isNaN(p.y)
    );

    const width = candidateWidths.find(
      (w): w is number => typeof w === "number" && !Number.isNaN(w)
    );

    const height = candidateHeights.find(
      (h): h is number => typeof h === "number" && !Number.isNaN(h)
    );

    if (pos && width !== undefined && height !== undefined) {
      return { x: pos.x, y: pos.y, width, height };
    }

    return null;
  }

  private isValidBounds(bounds: Partial<Bounds> | null | undefined): bounds is Bounds {
    if (!bounds) return false;
    const { x, y, width, height } = bounds;
    return (
      typeof x === "number" &&
      Number.isFinite(x) &&
      typeof y === "number" &&
      Number.isFinite(y) &&
      typeof width === "number" &&
      Number.isFinite(width) &&
      width >= 0 &&
      typeof height === "number" &&
      Number.isFinite(height) &&
      height >= 0
    );
  }

  /**
   *paintBackground
   *
   * @param c2d
   * @param canvas
   * @param context
   * @param region
   */
  paintBackground(
    c2d: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    context: IRenderContext | undefined,
    region?: DirtyRegion
  ): void {
    const x = region ? region.x : 0;
    const y = region ? region.y : 0;
    const width = region ? region.width : canvas.width;
    const height = region ? region.height : canvas.height;

    c2d.save();
    c2d.clearRect(x, y, width, height);
    c2d.fillStyle = "#f9f9f9";
    c2d.fillRect(x, y, width, height);
    c2d.restore();

    this.drawGrid(c2d, canvas, context?.viewport, region);
  }

  private drawGrid(
    c2d: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    viewport: IRenderContext["viewport"] | undefined,
    clipRegion?: DirtyRegion
  ): void {
    try {
      const zoom = viewport?.zoom ?? 1;
      const gridSize = 20;
      const scaled = gridSize * zoom;
      const offX = ((viewport?.x ?? 0) * zoom) % scaled;
      const offY = ((viewport?.y ?? 0) * zoom) % scaled;

      c2d.save();
      if (clipRegion) {
        c2d.beginPath();
        c2d.rect(clipRegion.x, clipRegion.y, clipRegion.width, clipRegion.height);
        c2d.clip();
      }
      c2d.strokeStyle = "#e0e0e0";
      c2d.lineWidth = 1;
      for (let x = -offX; x < canvas.width; x += scaled) {
        c2d.beginPath();
        c2d.moveTo(x, 0);
        c2d.lineTo(x, canvas.height);
        c2d.stroke();
      }
      for (let y = -offY; y < canvas.height; y += scaled) {
        c2d.beginPath();
        c2d.moveTo(0, y);
        c2d.lineTo(canvas.width, y);
        c2d.stroke();
      }
      c2d.restore();
    } catch (error) {
      this.logger.warn({
        event: DirtyRegionEvent.GridRenderError,
        message: "Failed to render dirty-region debug grid",
        emoji: "⚠️",
        error,
      });
    }
  }
}
