/**
 * @module src/common/entity/update-detail
 * @description Entity update detail types for tracking what changed during entity updates
 */

/**
 * Types of visual changes that can occur on an entity
 * @typedef {string} VisualChange
 * @enum {'position' | 'size' | 'style' | 'content' | 'connection'}
 * - 'position': Entity position changed
 * - 'size': Entity dimensions changed
 * - 'style': Visual style properties changed
 * - 'content': Content or data changed
 * - 'connection': Entity connections/relationships changed
 */
export type VisualChange = "position" | "size" | "style" | "content" | "connection";

/**
 * Rectangle bounds specification
 * @typedef {Object} Rect
 * @property {number} x - Left coordinate
 * @property {number} y - Top coordinate
 * @property {number} width - Width in pixels
 * @property {number} height - Height in pixels
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Detailed information about entity update changes
 * @typedef {Object} EntityUpdateDetail
 * @property {Set<VisualChange> | VisualChange[]} changes - Set of changes that occurred.
 * Can be Set or array for flexibility
 * @property {Rect | undefined} prevBounds - Previous bounding rectangle before update
 * @property {Rect | undefined} nextBounds - New bounding rectangle after update
 * @property {Object | undefined} renderHint - Hint for render optimization level
 * @property {'none' | 'partial' | 'full'} renderHint.level - Render level:
 * 'none' = no render needed, 'partial' = partial redraw, 'full' = full redraw
 * @property {Rect[]} [renderHint.rects] - Specific regions to redraw for partial rendering
 */
export interface EntityUpdateDetail {
  changes: Set<VisualChange> | VisualChange[];
  prevBounds: Rect | undefined;
  nextBounds: Rect | undefined;
  renderHint: { level: "none" | "partial" | "full"; rects?: Rect[] } | undefined;
}
