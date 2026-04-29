/**
 * @module src/common/interaction/tools/drag-tool
 * @description Drag tool for moving entities on canvas. Supports single and group drag operations
 * with grid snapping and selection management
 *
 * Features:
 * - Single entity dragging with position tracking
 * - Multi-select group dragging with anchor point
 * - Grid snapping for alignment (configurable pixel size)
 * - Selection callbacks for UI integration
 * - Drag lifecycle callbacks (onDragStart, onDragEnd)
 * - Efficient render updates via batch operations
 *
 * @example
 * ```typescript
 * import { DragTool } from '@/interaction/tools/drag-tool';
 * import type { DragToolOptions } from '@/interaction/tools/drag-tool';
 * import type { InteractionEnv } from '@/interaction/types';
 *
 * // Create drag tool with configuration
 * const selectedIds = new Set<string>();
 * const dragTool = new DragTool({
 *   entityManager: entityManager,
 *   renderEvents: renderEventManager,
 *   gridSnap: 10, // Snap to 10px grid
 *   getSelectedIds: () => selectedIds,
 *   setSelectedIds: (next) => {
 *     selectedIds.clear();
 *     for (const id of next) selectedIds.add(id);
 *   },
 *   onDragStart: () => console.log('Drag started'),
 *   onDragEnd: () => console.log('Drag ended')
 * });
 *
 * // Set up interaction environment
 * const canvas = document.getElementById('canvas') as HTMLCanvasElement;
 * const interactionEnv: InteractionEnv = {
 *   getCanvas: () => canvas,
 *   getViewport: () => ({ x: 0, y: 0, width: 800, height: 600 }),
 *   getProvider: () => ({})
 * };
 *
 * // Simulate mouse down to start drag
 * const mouseDownEvent = new PointerEvent('pointerdown', {
 *   clientX: 100,
 *   clientY: 100,
 *   buttons: 1
 * });
 * dragTool.onMouseDown?.(
 *   { clientX: 100, clientY: 100 } as PointerLikeEvent,
 *   interactionEnv
 * );
 *
 * // Simulate mouse move to drag entity
 * dragTool.onMouseMove?.(
 *   { clientX: 150, clientY: 150 } as PointerLikeEvent,
 *   interactionEnv
 * );
 *
 * // Simulate mouse up to end drag
 * dragTool.onMouseUp?.(
 *   { clientX: 150, clientY: 150 } as PointerLikeEvent,
 *   interactionEnv
 * );
 * ```
 */

import type { Tool, InteractionEnv, PointerLikeEvent } from "../types";
import type { EntityUpdateDetail } from "../../entity/update-detail";
import type { IEntity } from "../../entity";
import type { EntityManager } from "../../entity/entity-manager";
import type { RenderEventManager } from "../../event";

/**
 * State tracking during drag operation
 * @typedef {Object} DragState
 * Union of single and group drag states
 */
type DragState =
  | {
      mode: "single";
      id: string;
      startX: number;
      startY: number;
      entityStartX: number;
      entityStartY: number;
    }
  | {
      mode: "group";
      ids: string[];
      anchorId: string;
      startX: number;
      startY: number;
      starts: Map<string, { x: number; y: number }>;
    };

function readBounds(ent: unknown): { x: number; y: number; width: number; height: number } | null {
  // 1) 优先使用实体提供的 getBounds（通常在首次渲染后可用）
  const m = ent as { getBounds?: () => unknown };
  const b = m?.getBounds?.() as
    | Partial<{ x: number; y: number; width: number; height: number }>
    | undefined;
  if (
    b &&
    typeof b.x === "number" &&
    typeof b.y === "number" &&
    typeof b.width === "number" &&
    typeof b.height === "number"
  ) {
    return { x: b.x, y: b.y, width: b.width, height: b.height };
  }

  // 2) 首帧回退：在还未有 getBounds 之前，依据实体的 position/size 字段进行命中
  const e = ent as {
    data?: {
      position?: { x?: number; y?: number };
      size?: { width?: number; height?: number };
      width?: number;
      height?: number;
    };
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
  const x = e?.data?.position?.x ?? e?.x;
  const y = e?.data?.position?.y ?? e?.y;
  const width = e?.data?.size?.width ?? e?.width ?? e?.data?.width;
  const height = e?.data?.size?.height ?? e?.height ?? e?.data?.height;

  if (
    typeof x === "number" &&
    typeof y === "number" &&
    typeof width === "number" &&
    typeof height === "number"
  ) {
    if (width > 0 && height > 0) {
      return { x, y, width, height };
    }

    const lineWidth = Math.max(
      2,
      ((ent as { data?: { lineWidth?: number } }).data?.lineWidth ?? 0) || 0
    );
    const x2 = x + width;
    const y2 = y + height;
    const minX = Math.min(x, x2);
    const minY = Math.min(y, y2);
    const maxX = Math.max(x, x2);
    const maxY = Math.max(y, y2);
    const pad = lineWidth / 2;
    const bboxWidth = Math.max(maxX - minX, lineWidth);
    const bboxHeight = Math.max(maxY - minY, lineWidth);

    return {
      x: minX - pad,
      y: minY - pad,
      width: bboxWidth + lineWidth,
      height: bboxHeight + lineWidth,
    };
  }

  return null;
}

function readPosition(ent: unknown): { x: number; y: number } {
  const e = ent as {
    data?: { position?: { x?: number; y?: number } };
    x?: number;
    y?: number;
  };
  const x = e?.data?.position?.x ?? e?.x ?? 0;
  const y = e?.data?.position?.y ?? e?.y ?? 0;
  return { x, y };
}

function writePosition(ent: unknown, x: number, y: number): boolean {
  const e = ent as {
    data?: { position?: { x?: number; y?: number } };
    setPosition?: (x: number, y: number) => void;
  };
  if (e?.data?.position) {
    e.data.position = { x, y };
    return true;
  }
  if (typeof e?.setPosition === "function") {
    e.setPosition(x, y);
    return true;
  }
  return false;
}

/**
 *
 */
export interface DragToolOptions {
  /**
   * Entity manager for retrieving and updating entities during drag operations
   */
  entityManager: EntityManager;
  /**
   * Render event manager for notifying render system of entity position changes
   */
  renderEvents: RenderEventManager;
  /**
   * Grid size in pixels for snapping entity position (defaults to 10px)
   */
  gridSnap?: number; // Defaults to 10
  /**
   * Callback to get currently selected entity IDs
   */
  getSelectedIds?: () => Set<string>;
  /**
   * Callback to update selected entity IDs
   */
  setSelectedIds?: (next: Set<string>) => void;
  /**
   * Callback fired when drag operation starts
   */
  onDragStart?: () => void;
  /**
   * Callback fired when drag operation ends
   */
  onDragEnd?: () => void;
}

/**
 * Tool for dragging entities on canvas with multi-select and grid snap support
 * @class
 * @implements {Tool}
 */
export class DragTool implements Tool {
  name = "drag-tool";
  private dragging: DragState | null = null;
  private rafId: number | null = null;
  private pending: Array<{ id: string; x: number; y: number }> | null = null;
  private readonly entityManager: EntityManager;
  private readonly renderEvents: RenderEventManager;
  private readonly opts: Required<Omit<DragToolOptions, "entityManager" | "renderEvents">>;

  /**
   * Create a new DragTool instance
   * @param {DragToolOptions} options - Configuration including entity manager, render events,
   * grid snap size, and selection callbacks
   */
  constructor(options: DragToolOptions) {
    this.entityManager = options.entityManager;
    this.renderEvents = options.renderEvents;
    this.opts = {
      gridSnap: options.gridSnap ?? 10,
      getSelectedIds: options.getSelectedIds ?? (() => new Set<string>()),
      setSelectedIds: options.setSelectedIds ?? (() => {}),
      onDragStart: options.onDragStart ?? (() => {}),
      onDragEnd: options.onDragEnd ?? (() => {}),
    };
  }

  onMouseDown = (e: PointerLikeEvent, env: InteractionEnv) => {
    const canvas = env.getCanvas();
    if (!canvas) return false;
    const rect = canvas.getBoundingClientRect();
    const vp = env.getViewport();
    const zoom = vp.zoom || 1;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const modelX = mouseX / zoom + (vp.x || 0);
    const modelY = mouseY / zoom + (vp.y || 0);

    const entities = this.entityManager.getEntities();
    let hit: IEntity | null = null;
    for (let i = entities.length - 1; i >= 0; i--) {
      const ent = entities[i] as unknown;
      const b = readBounds(ent);
      if (!b) continue;
      if (modelX >= b.x && modelX <= b.x + b.width && modelY >= b.y && modelY <= b.y + b.height) {
        hit = entities[i];
        break;
      }
    }

    if (!hit) {
      this.dragging = null;
      return false; // 未处理，交给其他工具
    }

    // 更新选择集
    const current = this.opts.getSelectedIds();
    if (e.shiftKey || e.metaKey) {
      const next = new Set(current);
      if (next.has(hit.id)) next.delete(hit.id);
      else next.add(hit.id);
      this.opts.setSelectedIds(next);
    } else {
      if (!current.has(hit.id)) this.opts.setSelectedIds(new Set([hit.id]));
    }

    const selection = (() => {
      const cur = this.opts.getSelectedIds();
      return cur.size > 0 ? cur : new Set([hit.id]);
    })();

    if (selection.size > 1 && selection.has(hit.id)) {
      // 组拖
      const starts = new Map<string, { x: number; y: number }>();
      selection.forEach((id) => {
        const ent = this.entityManager.getEntity(id);
        const pos = ent ? readPosition(ent) : { x: 0, y: 0 };
        starts.set(id, pos);
      });
      this.dragging = {
        mode: "group",
        ids: Array.from(selection),
        anchorId: hit.id,
        startX: modelX,
        startY: modelY,
        starts,
      };
    } else {
      // 单拖
      const pos = readPosition(hit);
      this.dragging = {
        mode: "single",
        id: hit.id,
        startX: modelX,
        startY: modelY,
        entityStartX: pos.x,
        entityStartY: pos.y,
      };
    }
    this.opts.onDragStart?.();
    return true; // 已处理
  };

  onMouseMove = (e: PointerLikeEvent, env: InteractionEnv) => {
    if (!this.dragging) return false;
    const canvas = env.getCanvas();
    if (!canvas) return false;
    const rect = canvas.getBoundingClientRect();
    const vp = env.getViewport();
    const zoom = vp.zoom || 1;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const modelX = mouseX / zoom + (vp.x || 0);
    const modelY = mouseY / zoom + (vp.y || 0);

    const dx = modelX - this.dragging.startX;
    const dy = modelY - this.dragging.startY;

    const updates: Array<{ id: string; x: number; y: number }> = [];
    const snap = (v: number) =>
      !e.altKey && this.opts.gridSnap > 0
        ? Math.round(v / this.opts.gridSnap) * this.opts.gridSnap
        : v;

    if (this.dragging.mode === "single") {
      let nx = this.dragging.entityStartX + dx;
      let ny = this.dragging.entityStartY + dy;
      nx = snap(nx);
      ny = snap(ny);
      updates.push({ id: this.dragging.id, x: nx, y: ny });
    } else if (this.dragging.mode === "group") {
      const g = this.dragging; // narrow to group
      const anchorStart = g.starts.get(g.anchorId)!;
      let ax = anchorStart.x + dx;
      let ay = anchorStart.y + dy;
      ax = snap(ax);
      ay = snap(ay);
      const sdx = ax - anchorStart.x;
      const sdy = ay - anchorStart.y;
      g.ids.forEach((id) => {
        const st = g.starts.get(id)!;
        updates.push({ id, x: st.x + sdx, y: st.y + sdy });
      });
    }

    this.pending = updates;
    if (this.rafId == null) {
      this.rafId = requestAnimationFrame(() => {
        this.rafId = null;
        const batch = this.pending;
        this.pending = null;
        if (!batch || batch.length === 0) return;
        for (const u of batch) {
          const ent = this.entityManager.getEntity(u.id);
          if (!ent) continue;
          // 尝试读取旧/新 bounds 用于后续脏矩形优化
          const prevBounds = readBounds(ent) || undefined;
          if (writePosition(ent, u.x, u.y)) {
            const nextBounds = readBounds(ent) || undefined;
            const detail: EntityUpdateDetail = {
              changes: ["position"],
              prevBounds,
              nextBounds,
              renderHint: { level: "partial" },
            };
            this.entityManager.updateEntity(ent, detail);
          }
        }
        // 批量实体位置更新后，投递渲染事件（方案1）：只渲染涉及的实体
        const ids = Array.from(new Set(batch.map((b) => b.id)));
        this.renderEvents.requestRenderEntities({
          entityIds: ids,
          reason: "drag-move",
          op: "render",
        });
      });
    }
    return true;
  };

  onMouseUp = () => {
    this.dragging = null;
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.pending = null;
    this.opts.onDragEnd?.();
    // 拖拽结束后触发一次全量或增量渲染以巩固最终状态
    this.renderEvents.requestRenderAll({ reason: "drag-end" });
    return true;
  };

  onMouseLeave = () => {
    this.dragging = null;
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.pending = null;
    this.opts.onDragEnd?.();
    return false; // 允许其他工具继续处理
  };

  /**
   *
   */
  dispose() {
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.pending = null;
    this.dragging = null;
  }
}
