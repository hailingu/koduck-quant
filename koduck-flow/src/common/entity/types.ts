import type { IDisposable } from "../disposable";
import type { Data } from "../data";
import React from "react";

/**
 * Entity constructor interface
 */
export interface IEntityConstructor<
  T extends IEntity = IEntity,
  Args extends unknown[] = [IEntityArguments?],
> {
  new (...args: Args): T;
  prototype: T;
  readonly type?: string;
}

/**
 * Entity arguments interface
 */
export interface IEntityArguments {
  [key: string]: unknown;
}

// Backward-compatible alias
export type EntityArguments = IEntityArguments;

/**
 * Entity interface
 * Defines the basic contract for entity objects
 */
export interface IEntity<D extends Data = Data, C extends IEntityArguments = IEntityArguments>
  extends IDisposable {
  /** Entity unique identifier */
  readonly id: string;

  /** Entity data */
  data: D | undefined;

  /** Entity configuration */
  config: C | undefined;

  /** Entity type identifier */
  readonly type: string;

  /** Release resources */
  dispose(): void;
}

/**
 * Renderable entity interface
 * Extends the base entity interface, adding rendering-related properties and methods
 */
export interface IRenderableEntity<
  D extends Data = Data,
  C extends IEntityArguments = IEntityArguments,
> extends IEntity<D, C> {
  /** Entity position on canvas */
  position?: { x: number; y: number };

  /** Entity width */
  width: number;

  /** Entity height */
  height: number;

  /** Entity display label */
  label: string;

  /** Entity color */
  color?: string;

  /** Entity border color */
  borderColor?: string;

  /** Entity border width */
  borderWidth?: number;

  /** Whether the entity is visible */
  visible: boolean;

  /** Whether the entity is selected */
  selected: boolean;

  /** Custom style properties */
  style?: React.CSSProperties;

  /** Entity extra rendering properties */
  renderProps?: Record<string, unknown>;

  /**
   * Update entity position
   * @param x New X coordinate
   * @param y New Y coordinate
   */
  updatePosition(x: number, y: number): void;

  /**
   * Update entity size
   * @param width New width
   * @param height New height
   */
  updateSize(width: number, height: number): void;

  /**
   * Get entity bounding box
   * @returns Bounding box information
   */
  getBounds(): { x: number; y: number; width: number; height: number };

  /**
   * Check if a point is inside the entity
   * @param x Point X coordinate
   * @param y Point Y coordinate
   * @returns Whether the point is contained
   */
  containsPoint(x: number, y: number): boolean;

  /**
   * Get entity rendering style
   * @returns CSS style object
   */
  getRenderStyle(): React.CSSProperties;
}

/**
 * Renderable entity arguments interface
 * Defines parameters for creating renderable entities
 */
export interface IRenderableEntityArguments extends IEntityArguments {
  position?: { x: number; y: number };
  width?: number;
  height?: number;
  label?: string;
  color?: string;
  borderColor?: string;
  borderWidth?: number;
  visible?: boolean;
  selected?: boolean;
  style?: React.CSSProperties;
  renderProps?: Record<string, unknown>;
}
