import type { IDisposable } from "../disposable";
import type { Data } from "../data";
import React from "react";

/**
 * 实体构造函数接口
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
 * 实体参数接口
 */
export interface IEntityArguments {
  [key: string]: unknown;
}

// 向后兼容的别名
export type EntityArguments = IEntityArguments;

/**
 * 实体接口
 * 定义了实体对象的基本契约
 */
export interface IEntity<D extends Data = Data, C extends IEntityArguments = IEntityArguments>
  extends IDisposable {
  /** 实体唯一标识符 */
  readonly id: string;

  /** 实体数据 */
  data: D | undefined;

  /** 实体配置 */
  config: C | undefined;

  /** 实体类型标识 */
  readonly type: string;

  /** 释放资源 */
  dispose(): void;
}

/**
 * 可渲染实体接口
 * 扩展基础实体接口，添加渲染相关的属性和方法
 */
export interface IRenderableEntity<
  D extends Data = Data,
  C extends IEntityArguments = IEntityArguments,
> extends IEntity<D, C> {
  /** 实体在画布上的位置 */
  position?: { x: number; y: number };

  /** 实体宽度 */
  width: number;

  /** 实体高度 */
  height: number;

  /** 实体显示标签 */
  label: string;

  /** 实体颜色 */
  color?: string;

  /** 实体边框颜色 */
  borderColor?: string;

  /** 实体边框宽度 */
  borderWidth?: number;

  /** 实体是否可见 */
  visible: boolean;

  /** 实体是否被选中 */
  selected: boolean;

  /** 自定义样式属性 */
  style?: React.CSSProperties;

  /** 实体额外渲染属性 */
  renderProps?: Record<string, unknown>;

  /**
   * 更新实体位置
   * @param x 新的 X 坐标
   * @param y 新的 Y 坐标
   */
  updatePosition(x: number, y: number): void;

  /**
   * 更新实体尺寸
   * @param width 新的宽度
   * @param height 新的高度
   */
  updateSize(width: number, height: number): void;

  /**
   * 获取实体边界框
   * @returns 边界框信息
   */
  getBounds(): { x: number; y: number; width: number; height: number };

  /**
   * 检查点是否在实体内
   * @param x 点的 X 坐标
   * @param y 点的 Y 坐标
   * @returns 是否包含该点
   */
  containsPoint(x: number, y: number): boolean;

  /**
   * 获取实体的渲染样式
   * @returns CSS 样式对象
   */
  getRenderStyle(): React.CSSProperties;
}

/**
 * 可渲染实体参数接口
 * 定义创建可渲染实体时的参数
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
