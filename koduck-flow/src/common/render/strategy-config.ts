import type { RenderStrategySelectorOptions } from "./strategy-selector-options";
import type {
  ReactStrategyPluginOptions,
  WebGPUStrategyPluginOptions,
  SSRStrategyPluginOptions,
} from "./plugins/options";

export interface StrategyPluginConfig<TOptions> {
  /** Whether to enable this strategy plugin, enabled by default */
  enabled?: boolean;
  /** Associated renderer ID, defaults to the standard ID for the corresponding plugin */
  rendererId?: string;
  /** Extra options when constructing the plugin */
  options?: TOptions;
}

export interface WebGPUPluginConfig extends StrategyPluginConfig<WebGPUStrategyPluginOptions> {
  /** Whether to automatically register the default implementation if the WebGPU renderer is missing. Default true */
  autoRegisterRenderer?: boolean;
}

export interface SSRPluginConfig extends StrategyPluginConfig<SSRStrategyPluginOptions> {
  /** Whether to treat missing SSR renderer as an error. Default true */
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
  /** Whether to enable the plugin-based strategy selector */
  enabled?: boolean;
  /** Constructor options passed to RenderStrategySelector */
  selectorOptions?: RenderStrategySelectorOptions;
  /** React strategy plugin configuration, enabled by default */
  react?: StrategyPluginConfig<ReactStrategyPluginOptions>;
  /** WebGPU strategy plugin configuration, disabled by default */
  webgpu?: WebGPUPluginConfig;
  /** SSR strategy plugin configuration, disabled by default */
  ssr?: SSRPluginConfig;
  /** Additional custom strategy plugins */
  plugins?: StrategyPluginInstanceLike[];
}
