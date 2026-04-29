/**
 * Config loader internal interface
 * Used by internal modules such as core.ts to access the loader's internal state and methods
 *
 * Note: this interface is for internal use only and should not be exposed externally
 */

import type { KoduckFlowConfig, ConfigSource } from "../../schema";
import type { ConfigChangeContext, MergeConflict } from "../types";
import type { IConfigProvider } from "./config-provider.interface";
import type { IConfigRuntimeOverride } from "./config-runtime-override.interface";
import type { Attributes } from "../../../metrics/types";

/**
 * Loader metrics type
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
 * Load statistics
 */
export interface LoadMetrics {
  loadCount: number;
  totalLoadTime: number;
  lastLoadTime: number;
}

/**
 * Event bus interface (simplified)
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
 * Config loader internal interface
 * Extends IConfigProvider and IConfigRuntimeOverride, adding internal state access
 */
export interface IConfigLoaderInternal extends IConfigProvider, IConfigRuntimeOverride {
  // Internal state properties
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

  // Internal methods
  now(): number;
  load(options?: Partial<KoduckFlowConfig>, context?: ConfigChangeContext): KoduckFlowConfig;
}
