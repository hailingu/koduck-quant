import type { IEntity } from "../entity/types";

/**
 * Render context interface
 * Contains all information needed for rendering
 */
export interface IRenderContext {
  /** List of nodes to render */
  nodes: IEntity[];

  /** Viewport information */
  viewport: {
    x: number;
    y: number;
    zoom: number;
    width: number;
    height: number;
  };
  /** Canvas element (optional, not needed for React render path) */
  canvas?: HTMLCanvasElement;
  /** Render timestamp */
  timestamp: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Supports extension */
  [key: string]: unknown;
}
