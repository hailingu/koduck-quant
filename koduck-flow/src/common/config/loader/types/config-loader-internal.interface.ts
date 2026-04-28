/**
 * 配置加载器内部接口
 * 用于 core.ts 等内部模块访问配置加载器的内部状态和方法
 *
 * 注意：此接口仅供内部模块使用，不应暴露给外部
 */

import type { KoduckFlowConfig, ConfigSource } from "../../schema";
import type { ConfigChangeContext, MergeConflict } from "../types";
import type { IConfigProvider } from "./config-provider.interface";
import type { IConfigRuntimeOverride } from "./config-runtime-override.interface";
import type { Attributes } from "../../../metrics/types";

/**
 * 加载器指标类型
 */
export interface LoaderMetrics {
  loadCounter: {
    add: (value: number, attributes?: Attributes) => void;
  };
  loadDuration: {
    record: (value: number, attributes?: Attributes) => void;
  };
  runtimeOverridesRejected: {
    add: (value: number, attributes?: Attributes) => void;
  };
  activeRuntimeOverrides: {
    set: (value: number) => void;
  };
}

/**
 * 加载统计信息
 */
export interface LoadMetrics {
  loadCount: number;
  totalLoadTime: number;
  lastLoadTime: number;
}

/**
 * 事件总线接口（简化版）
 */
export interface EventBusLike {
  system: {
    configChange: (
      payload: { config: KoduckFlowConfig; context: ConfigChangeContext },
      source: string
    ) => void;
  };
}

/**
 * 配置加载器内部接口
 * 扩展自 IConfigProvider 和 IConfigRuntimeOverride，添加内部状态访问能力
 */
export interface IConfigLoaderInternal extends IConfigProvider, IConfigRuntimeOverride {
  // 内部状态属性
  configCache: KoduckFlowConfig | undefined;
  configSources: Map<ConfigSource, Partial<KoduckFlowConfig>>;
  runtimeOverrides: Partial<KoduckFlowConfig>;
  hasLoadedOnce: boolean;
  loadMetrics: LoadMetrics;
  metrics: LoaderMetrics;
  lastConflicts: MergeConflict[];
  lastValidationWarnings: Array<{ path: string; message: string }>;
  configChangeListeners: Array<(config: KoduckFlowConfig) => void>;
  eventBus: EventBusLike;

  // 内部方法
  now(): number;
  load(options?: Partial<KoduckFlowConfig>, context?: ConfigChangeContext): KoduckFlowConfig;
}
