import type { RenderStrategySelectorOptions } from "./strategy-selector-options";
import type {
  ReactStrategyPluginOptions,
  WebGPUStrategyPluginOptions,
  SSRStrategyPluginOptions,
} from "./plugins/options";

export interface StrategyPluginConfig<TOptions> {
  /** 是否启用该策略插件，默认启用 */
  enabled?: boolean;
  /** 关联渲染器 ID，默认为对应插件的标准 ID */
  rendererId?: string;
  /** 插件构造时的额外选项 */
  options?: TOptions;
}

export interface WebGPUPluginConfig extends StrategyPluginConfig<WebGPUStrategyPluginOptions> {
  /** 若缺少 WebGPU 渲染器，是否自动注册默认实现。默认 true */
  autoRegisterRenderer?: boolean;
}

export interface SSRPluginConfig extends StrategyPluginConfig<SSRStrategyPluginOptions> {
  /** 当未找到 SSR 渲染器时是否视为错误。默认 true */
  required?: boolean;
}

export interface StrategyPluginInstanceLike {
  id: string;
  descriptor: {
    priority: number;
    [key: string]: unknown;
  };
  getStrategyName(): string;
  selectOptimalRenderer(...args: unknown[]): unknown;
  selectForBatch?(entities: unknown[]): Map<unknown, unknown[]>;
  canHandle?(...args: unknown[]): boolean;
}

export interface RenderStrategySelectorRuntimeConfig {
  /** 是否启用插件化策略选择器 */
  enabled?: boolean;
  /** 传递给 RenderStrategySelector 的构造选项 */
  selectorOptions?: RenderStrategySelectorOptions;
  /** React 策略插件配置，默认启用 */
  react?: StrategyPluginConfig<ReactStrategyPluginOptions>;
  /** WebGPU 策略插件配置，默认禁用 */
  webgpu?: WebGPUPluginConfig;
  /** SSR 策略插件配置，默认禁用 */
  ssr?: SSRPluginConfig;
  /** 附加的自定义策略插件 */
  plugins?: StrategyPluginInstanceLike[];
}
