import type { IConfig } from "../../types/config";
import type { IEntity, IEntityArguments, IEntityConstructor } from "../entity/types";

/**
 * 简化的渲染上下文接口，避免循环依赖
 */
export interface IRenderContext {
  canvas?: HTMLCanvasElement | OffscreenCanvas;
  gl?: WebGLRenderingContext | WebGL2RenderingContext | null;
  [key: string]: unknown;
}

/**
 * 元信息接口
 *
 * 提供实体的基本元信息，支持结构化扩展
 */
export interface IMeta<TExtras = Record<string, unknown>> {
  /** 实体类型标识 */
  type: string;
  /** 可选的描述信息 */
  description?: string;
  /** 结构化的扩展属性 */
  extras?: TExtras;
}

/**
 * 注册表接口
 *
 * 泛型化的注册表接口，支持不同类型的元信息
 */
export interface IRegistry<T extends IEntity, TMeta extends IMeta = IMeta> {
  /** 可选的构造参数 */
  readonly args?: IEntityArguments;
  /** 元信息 */
  readonly meta?: TMeta;
  /** 获取实体构造函数 */
  getConstructor(): IEntityConstructor<T>;
}

/**
 * 注册表管理器接口
 *
 * 定义了管理多个注册表实例的标准接口，支持：
 * - 默认注册表的设置和获取
 * - 注册表实例的注册和注销
 * - 扩展方法可在具体实现中添加（如按名称查询、批量操作等）
 */
export interface IRegistryManager<T extends IEntity, TMeta extends IMeta = IMeta> {
  /** 获取默认注册表（新 API） */
  getDefaultRegistry(): IRegistry<T, TMeta> | undefined;

  /** 根据名称获取注册表（新 API） */
  getRegistry(name: string): IRegistry<T, TMeta> | undefined;

  getRegistryForEntity(entity: IEntity): IRegistry<T, TMeta> | undefined;

  getRegistryForType(type: string): IRegistry<T, TMeta> | undefined;

  /**
   * 添加命名注册表实例
   *
   * @param name 注册表名称
   * @param registry 要添加的注册表实例
   */
  addRegistry(name: string, registry: IRegistry<T, TMeta>): void;

  /** 设置默认注册表名称（新 API） */
  setDefaultRegistry(name: string): void;

  /** 移除命名注册表（实现可扩展） */
  removeRegistry?(name: string): boolean;

  /** 类型与注册表绑定（实现可扩展） */
  bindTypeToRegistry?(type: string, name: string): void;
  unbindType?(type: string): void;
}

export interface ICapabilityAwareRegistry<T extends IEntity, TMeta extends IMeta = IMeta>
  extends IRegistry<T, TMeta> {
  readonly meta?: TMeta & {
    // capabilitiesDetectedAt 仍保留（外部可用来做调试）
    capabilitiesDetectedAt?: number;
  };

  getConstructor(): IEntityConstructor<T>;
  createEntity(...args: [IEntityArguments?]): T;

  // 能力管理方法
  hasCapability(name: string): boolean;
  executeCapability(name: string, ...args: unknown[]): Promise<unknown>;
  getCapabilities(): string[];

  // 批量能力操作
  checkCapabilities?(entity: T, capabilities: string[]): boolean[];
  executeCapabilities?(
    entity: T,
    operations: Array<{ capability: string; args: unknown[] }>
  ): Promise<unknown[]>;
}

/**
 * 可渲染实体注册表接口
 *
 * 核心特性：
 * 1. 继承现有的 IRegistry<T, TMeta> 接口，完全兼容
 * 2. 支持动态配置不同形状的节点 (通过 IRenderCapabilities 的扩展属性)
 * 3. 支持多领域节点类型 (通过 extras 的扩展属性)
 * 4. 提供完整的渲染配置管理
 * 5. 与 RegistryManager 完全兼容
 */
export interface IRenderableRegistry<T extends IEntity = IEntity, TMeta extends IMeta = IMeta>
  extends IRegistry<T, TMeta>,
    IConfig {
  /** 获取实体构造函数 (继承自 IRegistry) */
  getConstructor(): IEntityConstructor<T>;

  /** 创建实体实例 */
  createEntity(
    nodeType: string,
    position?: { x: number; y: number },
    overrides?: Record<string, unknown>
  ): T;

  /**
   * 判断实体是否可渲染
   */
  canRender(entity: IEntity): boolean;
  canRender(type: string): boolean;

  /**
   * 显式渲染方法：由 registry 提供实现
   * - 返回 React 元素（由 React renderer 处理）或返回 void（代表 registry 在 canvas/webgpu 上直接绘制）
   */
  render(entity: IEntity, context?: IRenderContext): Promise<React.ReactElement | void>;

  /**
   * 可选的批量渲染接口（在有批量优化需求时实现）
   */
  batchRender?(entities: IEntity[], context?: IRenderContext): Promise<void | React.ReactElement[]>;
}
