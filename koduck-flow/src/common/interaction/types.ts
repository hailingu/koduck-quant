/**
 * @module src/common/interaction/types
 * @description Interaction types and interfaces for canvas-based tools and viewport handling.
 * Defines contracts for viewport management, event handling, and tool operations
 */

/**
 * Viewport configuration for canvas rendering and coordinate transformation
 * @typedef {Object} ViewportLike
 * @property {number} x - Horizontal offset of viewport origin (canvas units)
 * @property {number} y - Vertical offset of viewport origin (canvas units)
 * @property {number} zoom - Zoom level scaling factor (1.0 = 100%)
 * @property {number} width - Viewport width in pixels
 * @property {number} height - Viewport height in pixels
 */
export interface ViewportLike {
  x: number;
  y: number;
  zoom: number;
  width: number;
  height: number;
}

/**
 * Provider interface for accessing canvas element
 * @interface
 */
export interface CanvasProvider {
  /**
   * Get the HTML canvas element
   * @returns {HTMLCanvasElement | null} Canvas element or null if not available
   */
  getCanvas: () => HTMLCanvasElement | null;
}

/**
 * Provider interface for accessing viewport configuration
 * @interface
 */
export interface ViewportProvider {
  /**
   * Get the current viewport configuration
   * @returns {ViewportLike} Current viewport parameters
   */
  getViewport: () => ViewportLike;
}

/**
 * Pointer event-like object for cross-platform event handling
 * @typedef {Object} PointerLikeEvent
 * @property {number} clientX - X coordinate of pointer relative to viewport
 * @property {number} clientY - Y coordinate of pointer relative to viewport
 * @property {boolean} [altKey] - Alt/Option key pressed
 * @property {boolean} [shiftKey] - Shift key pressed
 * @property {boolean} [metaKey] - Meta/Command key pressed
 * @property {Function} [preventDefault] - Optional method to prevent default event handling
 */
export type PointerLikeEvent = {
  clientX: number;
  clientY: number;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  preventDefault?: () => void;
};

/**
 * Interaction environment combining canvas and viewport providers
 * @interface
 * @augments {CanvasProvider}
 * @augments {ViewportProvider}
 */
export interface InteractionEnv extends CanvasProvider, ViewportProvider {}

/**
 * Base interface for interaction tools handling mouse events
 * @interface
 */
export interface Tool {
  /**
   * Unique name identifier for the tool
   * @type {string}
   */
  name: string;

  /**
   * Handler for mouse down events
   * @param {PointerLikeEvent} e - Pointer event details
   * @param {InteractionEnv} env - Interaction environment with canvas and viewport
   * @returns {boolean | void} Return true to consume event and stop propagation
   */
  onMouseDown?: (e: PointerLikeEvent, env: InteractionEnv) => boolean | void;

  /**
   * Handler for mouse move events
   * @param {PointerLikeEvent} e - Pointer event details
   * @param {InteractionEnv} env - Interaction environment with canvas and viewport
   * @returns {boolean | void} Return true to consume event and stop propagation
   */
  onMouseMove?: (e: PointerLikeEvent, env: InteractionEnv) => boolean | void;

  /**
   * Handler for mouse up events
   * @param {PointerLikeEvent} e - Pointer event details
   * @param {InteractionEnv} env - Interaction environment with canvas and viewport
   * @returns {boolean | void} Return true to consume event and stop propagation
   */
  onMouseUp?: (e: PointerLikeEvent, env: InteractionEnv) => boolean | void;

  /**
   * Handler for mouse leave events
   * @param {PointerLikeEvent} e - Pointer event details
   * @param {InteractionEnv} env - Interaction environment with canvas and viewport
   * @returns {boolean | void} Return true to consume event and stop propagation
   */
  onMouseLeave?: (e: PointerLikeEvent, env: InteractionEnv) => boolean | void;

  /**
   * Cleanup method called when tool is deactivated or destroyed
   */
  dispose?: () => void;
}
