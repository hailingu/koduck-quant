/**
 * @module src/common/config/loader
 * @description Configuration loading and management system for Koduck Flow.
 * Provides singleton-based configuration loader with support for:
 * - Multiple configuration sources (files, environment, CLI, HTTP, runtime overrides)
 * - Hot reload with file watching and HTTP server
 * - Runtime configuration overrides with audit trail
 * - Configuration validation and merge conflict detection
 * - Snapshot and rollback capabilities
 * - Performance metrics collection
 *
 * Architecture:
 * - **Singleton Pattern**: Single ConfigLoader instance per application
 * - **Delegation**: Core logic delegated to specialized modules (loader/*)
 * - **Event-Driven**: Configuration changes broadcast via event bus
 * - **Metrics-Instrumented**: All operations tracked for performance analysis
 *
 * Configuration Sources (priority order):
 * 1. File-based configuration (schema.json, environment configs)
 * 2. Environment variables (DUCK_FLOW_* prefix)
 * 3. CLI arguments (--config options)
 * 4. Runtime overrides (API-driven updates)
 * 5. HTTP server overrides (remote configuration updates)
 *
 * Key Features:
 * - **Atomic Updates**: All-or-nothing configuration merges
 * - **Validation**: Schema validation on every load
 * - **Conflict Detection**: Reports merge conflicts with resolution strategies
 * - **Audit Trail**: Records all runtime override operations
 * - **Snapshot Management**: Create and restore configuration states
 * - **Metrics Tracking**: Load times, override counts, cache statistics
 *
 * Usage Pattern:
 * ```typescript
 * const loader = ConfigLoader.getInstance();
 * await loader.load(); // Initial load from all sources
 * loader.on('change', (config) => console.log('Config updated'));
 * await loader.applyRuntimeOverride('setting.key', 'value');
 * await loader.enableHotReload(); // Watch file changes
 * ```
 *
 * @example
 * ```typescript
 * import { ConfigLoader } from '@/config/loader';
 * import type { KoduckFlowConfig, RuntimeOverrideOptions } from '@/config/loader/types';
 *
 * async function initializeConfig() {
 *   // Get singleton instance
 *   const loader = ConfigLoader.getInstance();
 *
 *   // Initial load from all sources
 *   await loader.load();
 *   console.log('Configuration loaded:', loader.getConfig());
 *
 *   // Listen to configuration changes
 *   loader.on('config:change', (config, context) => {
 *     console.log('Configuration updated by:', context.trigger);
 *   });
 *
 *   // Apply runtime override with audit trail
 *   const result = await loader.applyRuntimeOverride('cache.maxSize', 1000, {
 *     actor: 'admin',
 *     reason: 'Performance tuning',
 *     dryRun: false
 *   });
 *
 *   if (!result.success) {
 *     console.error('Override failed:', result.warnings);
 *   }
 *
 *   // Enable hot reload for file changes
 *   await loader.enableHotReload();
 *
 *   // Create snapshot for later restoration
 *   const snapshot = loader.createSnapshot();
 *
 *   // Apply experimental config
 *   await loader.applyRuntimeOverride('experimental.feature', true);
 *
 *   // Rollback if needed
 *   await loader.rollbackToSnapshot(snapshot);
 *
 *   // Setup HTTP override endpoint
 *   await loader.setupHTTPOverrides({
 *     port: 3000,
 *     path: '/api/config/overrides'
 *   });
 * }
 *
 * initializeConfig();
 * ```
 */

import type { FSWatcher } from "node:fs";
import type { Server as HttpServer } from "node:http";

import type { ConfigSource, KoduckFlowConfig, ValidationIssue, ValidationResult } from "./schema";
import { validateConfig } from "./schema";
import { logger } from "../logger";
import { meter } from "../metrics/global";
import type { Counter, Gauge, Histogram } from "../metrics/types";
import { ScopedMeter } from "../metrics/scoped-meter";
import { createEventBus, type EventBus } from "../event";

import { DEFAULT_HTTP_OVERRIDE_PATH, METRIC_SCOPE } from "./loader/constants";
import type {
  ConfigChangeContext,
  HttpOverrideOptions,
  MergeConflict,
  MergeSource,
  RuntimeOverrideAuditRecord,
  RuntimeOverrideOptions,
  RuntimeOverrideResult,
} from "./loader/types";
import { loadOverridesFromCLI } from "./loader/cli";
import {
  computeConfigurationImpl,
  loadImpl,
  notifyConfigChangeImpl,
  refreshRuntimeOverrideGaugeImpl,
  reloadImpl,
  updateConfigSourcesImpl,
} from "./loader/core";
import {
  applyRuntimeOverridesImpl,
  getRuntimeAuditTrailImpl,
  getRuntimeOverridesImpl,
} from "./loader/runtime-manager";
import { enableHotReloadImpl, disableHotReloadImpl } from "./loader/hot-reload";
import { setupHTTPOverridesImpl, shutdownHTTPOverridesImpl } from "./loader/http-server";
import {
  getRollbackManager,
  createConfigSnapshot,
  rollbackToSnapshot,
  rollbackToPrevious,
} from "./loader/rollback";
import type { IConfigLoaderInternal } from "./loader/types/config-loader-internal.interface";
import { ConfigStateManager } from "./loader/state-manager";
import { configEventEmitter } from "./loader/config-event-emitter";

/**
 * Configuration Loader - Singleton service for centralized configuration management
 *
 * Coordinates configuration loading from multiple sources, manages runtime overrides,
 * handles hot reload, and provides audit trail for all configuration changes.
 *
 * Key Responsibilities:
 * - Load and merge configuration from multiple sources
 * - Validate configuration against schema
 * - Track runtime overrides with audit trail
 * - Support hot reload with file watching
 * - Provide HTTP endpoint for remote configuration updates
 * - Manage configuration snapshots and rollback
 * - Emit events on configuration changes
 * - Collect performance metrics
 *
 * Singleton Usage:
 * - Only one instance per application process
 * - Access via ConfigLoader.getInstance()
 * - All state is maintained by singleton instance
 *
 * @class ConfigLoader
 * @implements {IConfigLoaderInternal}
 *
 * @example
 * ```typescript
 * const loader = ConfigLoader.getInstance();
 * await loader.load();
 * const config = loader.getConfig();
 * ```
 */
export class ConfigLoader implements IConfigLoaderInternal {
  private static instance: ConfigLoader;

  // Public properties (required by IConfigLoaderInternal for core module access)
  public configCache: KoduckFlowConfig | undefined;
  public configSources: Map<ConfigSource, Partial<KoduckFlowConfig>> = new Map();
  public runtimeOverrides: Partial<KoduckFlowConfig> = {};
  public hasLoadedOnce = false;
  public loadMetrics: { loadCount: number; totalLoadTime: number; lastLoadTime: number } = {
    loadCount: 0,
    totalLoadTime: 0,
    lastLoadTime: 0,
  };
  public metrics: {
    loadCounter: Counter;
    loadDuration: Histogram;
    runtimeOverridesApplied: Counter;
    runtimeOverridesRejected: Counter;
    activeRuntimeOverrides: Gauge;
  };
  public lastConflicts: MergeConflict[] = [];
  public lastValidationWarnings: ValidationIssue[] = [];
  public configChangeListeners: Array<(config: KoduckFlowConfig) => void> = [];
  public eventBus: EventBus;

  // Private properties (internal implementation details)
  private fileWatcher: FSWatcher | null = null;
  private hotReloadEnabled = false;
  private httpServer: HttpServer | null = null;
  private httpPort?: number;
  private httpPath: string = DEFAULT_HTTP_OVERRIDE_PATH;
  private runtimeAuditTrail: RuntimeOverrideAuditRecord[] = [];
  private scopedMeter: ScopedMeter;
  private configStateManager: ConfigStateManager | null = null;
  private constructor() {
    this.eventBus = createEventBus();
    this.scopedMeter = new ScopedMeter(meter(METRIC_SCOPE), { component: "ConfigLoader" });
    this.metrics = {
      loadCounter: this.scopedMeter.counter("load.count", {
        description: "Total configuration loads",
      }),
      loadDuration: this.scopedMeter.histogram("load.duration", {
        description: "Configuration load duration",
        unit: "ms",
        boundaries: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2000],
      }),
      runtimeOverridesApplied: this.scopedMeter.counter("runtime.override.applied", {
        description: "Runtime overrides applied successfully",
      }),
      runtimeOverridesRejected: this.scopedMeter.counter("runtime.override.rejected", {
        description: "Runtime overrides rejected",
      }),
      activeRuntimeOverrides: this.scopedMeter.gauge("runtime.override.active", {
        description: "Number of active runtime overrides",
      }),
    };

    this.metrics.activeRuntimeOverrides.set(0);

    // Subscribe to configuration reload events from hot-reload module
    configEventEmitter.on("reload", (event) => {
      this.reload(event.options, event.context);
    });

    this.assertInternalUsage();
  }

  /**
   *
   */
  static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  /**
   *
   */
  load(options?: Partial<KoduckFlowConfig>, context?: ConfigChangeContext): KoduckFlowConfig {
    return loadImpl(this, options, context);
  }

  /**
   *
   */
  reload(options?: Partial<KoduckFlowConfig>, context?: ConfigChangeContext): KoduckFlowConfig {
    return reloadImpl(this, options, context);
  }

  /**
   *
   */
  enableHotReload(): void {
    enableHotReloadImpl(
      this as unknown as { fileWatcher: FSWatcher | null; hotReloadEnabled: boolean }
    );
  }

  /**
   *
   */
  disableHotReload(): void {
    disableHotReloadImpl(
      this as unknown as { fileWatcher: FSWatcher | null; hotReloadEnabled: boolean }
    );
  }

  /**
   *
   */
  onConfigChange(listener: (config: KoduckFlowConfig) => void): void {
    this.configChangeListeners.push(listener);
  }

  /**
   *
   */
  offConfigChange(listener: (config: KoduckFlowConfig) => void): void {
    const index = this.configChangeListeners.indexOf(listener);
    if (index > -1) {
      this.configChangeListeners.splice(index, 1);
    }
  }

  /**
   *
   */
  validate(config: KoduckFlowConfig): ValidationResult {
    return validateConfig(config);
  }

  /**
   *
   */
  getConfig(): KoduckFlowConfig {
    return this.load();
  }

  /**
   *
   */
  get<T = unknown>(path: string): T | undefined {
    const config = this.load();
    const keys = path.split(".");
    let value: unknown = config;
    for (const key of keys) {
      if (value && typeof value === "object" && key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }
    return value as T;
  }

  /**
   *
   */
  set(path: string, value: unknown): void {
    const keys = path.split(".");
    const lastKey = keys.pop();
    if (!lastKey) return;

    let target: Record<string, unknown> = this.runtimeOverrides as Record<string, unknown>;
    for (const key of keys) {
      if (!(key in target)) {
        target[key] = {};
      }
      target = target[key] as Record<string, unknown>;
    }
    target[lastKey] = value;
    this.reload();
  }

  /**
   *
   */
  has(path: string): boolean {
    return this.get(path) !== undefined;
  }

  /**
   *
   */
  getConfigSources(): Map<ConfigSource, Partial<KoduckFlowConfig>> {
    return new Map(this.configSources);
  }

  /**
   *
   */
  getHttpPort(): number | undefined {
    return this.httpPort;
  }

  /**
   *
   */
  loadFromCLI(): Partial<KoduckFlowConfig> {
    const cliConfig = loadOverridesFromCLI();
    if (Object.keys(cliConfig).length > 0) {
      logger.info("Loaded runtime overrides from CLI arguments");
    }
    return cliConfig;
  }

  /**
   *
   */
  applyRuntimeOverrides(
    overrides: Partial<KoduckFlowConfig>,
    options: RuntimeOverrideOptions = {}
  ): RuntimeOverrideResult {
    // Pass this as state reference for runtime manager state management
    const state = Object.assign(this, {}) as unknown as {
      runtimeOverrides: Partial<KoduckFlowConfig>;
      runtimeAuditTrail: RuntimeOverrideAuditRecord[];
      metrics: {
        runtimeOverridesApplied: {
          add: (value: number, attributes?: Record<string, unknown>) => void;
        };
        runtimeOverridesRejected: {
          add: (value: number, attributes?: Record<string, unknown>) => void;
        };
        activeRuntimeOverrides: { set: (value: number) => void };
      };
      lastConflicts: MergeConflict[];
      lastValidationWarnings: ValidationIssue[];
      validate: (config: KoduckFlowConfig) => ValidationResult;
      refreshRuntimeOverrideGauge(): void;
      reload(options?: Partial<KoduckFlowConfig>, context?: ConfigChangeContext): KoduckFlowConfig;
    };
    return applyRuntimeOverridesImpl(state, overrides, options);
  }

  /**
   *
   */
  getRuntimeOverrides(): Partial<KoduckFlowConfig> {
    // Pass this as state reference for runtime manager
    const state = Object.assign(this, {}) as unknown as {
      runtimeOverrides: Partial<KoduckFlowConfig>;
      runtimeAuditTrail: RuntimeOverrideAuditRecord[];
      metrics: {
        runtimeOverridesApplied: {
          add: (value: number, attributes?: Record<string, unknown>) => void;
        };
        runtimeOverridesRejected: {
          add: (value: number, attributes?: Record<string, unknown>) => void;
        };
        activeRuntimeOverrides: { set: (value: number) => void };
      };
      lastConflicts: MergeConflict[];
      lastValidationWarnings: ValidationIssue[];
      validate: (config: KoduckFlowConfig) => ValidationResult;
      refreshRuntimeOverrideGauge(): void;
      reload(options?: Partial<KoduckFlowConfig>, context?: ConfigChangeContext): KoduckFlowConfig;
    };
    return getRuntimeOverridesImpl(state);
  }

  /**
   *
   */
  getRuntimeAuditTrail(limit = 50): RuntimeOverrideAuditRecord[] {
    // Pass this as state reference for runtime manager
    const state = Object.assign(this, {}) as unknown as {
      runtimeOverrides: Partial<KoduckFlowConfig>;
      runtimeAuditTrail: RuntimeOverrideAuditRecord[];
      metrics: {
        runtimeOverridesApplied: {
          add: (value: number, attributes?: Record<string, unknown>) => void;
        };
        runtimeOverridesRejected: {
          add: (value: number, attributes?: Record<string, unknown>) => void;
        };
        activeRuntimeOverrides: { set: (value: number) => void };
      };
      lastConflicts: MergeConflict[];
      lastValidationWarnings: ValidationIssue[];
      validate: (config: KoduckFlowConfig) => ValidationResult;
      refreshRuntimeOverrideGauge(): void;
      reload(options?: Partial<KoduckFlowConfig>, context?: ConfigChangeContext): KoduckFlowConfig;
    };
    return getRuntimeAuditTrailImpl(state, limit);
  }

  /**
   *
   */
  setupHTTPOverrides(port: number = 8080, options: HttpOverrideOptions = {}): void {
    // Pass this with configProvider property for HTTP server state management
    const state = Object.assign(this, { configProvider: this }) as unknown as {
      httpServer: HttpServer | null;
      httpPort?: number;
      httpPath: string;
      configProvider: IConfigLoaderInternal;
    };
    setupHTTPOverridesImpl(state, port, options);
  }

  /**
   *
   */
  shutdownHTTPOverrides(): void {
    const state = Object.assign(this, { configProvider: this }) as unknown as {
      httpServer: HttpServer | null;
      httpPort?: number;
      httpPath: string;
      configProvider: IConfigLoaderInternal;
    };
    shutdownHTTPOverridesImpl(state);
  }

  /**
   *
   */
  createSnapshot(
    description?: string,
    metadata?: Record<string, unknown>
  ): import("./loader/rollback").ConfigSnapshot {
    const currentConfig = this.load();
    return createConfigSnapshot(currentConfig, description, metadata);
  }

  /**
   *
   */
  rollbackToSnapshot(snapshotId: string): import("./loader/rollback").RollbackResult {
    const stateManager = this.getOrCreateStateManager();
    return rollbackToSnapshot(snapshotId, stateManager);
  }

  /**
   *
   */
  rollbackToPrevious(): import("./loader/rollback").RollbackResult {
    const stateManager = this.getOrCreateStateManager();
    return rollbackToPrevious(stateManager);
  }

  private getOrCreateStateManager(): ConfigStateManager {
    if (!this.configStateManager) {
      const initialConfig = this.load();
      this.configStateManager = new ConfigStateManager(initialConfig);

      // 订阅 state manager 的配置变更，同步到 configCache
      this.configStateManager.subscribe((newConfig) => {
        this.configCache = newConfig;
      });
    }
    return this.configStateManager;
  }

  /**
   *
   */
  getRollbackManager(): import("./loader/rollback").RollbackManager {
    return getRollbackManager();
  }

  /**
   *
   */
  public now(): number {
    return typeof performance !== "undefined" ? performance.now() : Date.now();
  }

  private computeConfiguration(runtimeOverrides?: Partial<KoduckFlowConfig>) {
    return computeConfigurationImpl(this, runtimeOverrides);
  }

  private updateConfigSources(sources: MergeSource[]): void {
    updateConfigSourcesImpl(this, sources);
  }

  private refreshRuntimeOverrideGauge(): void {
    refreshRuntimeOverrideGaugeImpl(this);
  }

  private notifyConfigChange(config: KoduckFlowConfig, context: ConfigChangeContext): void {
    notifyConfigChangeImpl(this, config, context);
  }

  private assertInternalUsage(): void {
    const ensureReferences = [
      this.configCache,
      this.configSources,
      this.fileWatcher,
      this.hotReloadEnabled,
      this.configChangeListeners,
      this.loadMetrics,
      this.httpServer,
      this.httpPort,
      this.httpPath,
      this.runtimeOverrides,
      this.runtimeAuditTrail,
      this.eventBus,
      this.hasLoadedOnce,
      this.scopedMeter,
      this.metrics,
      this.lastConflicts,
      this.lastValidationWarnings,
      this.now,
      this.computeConfiguration,
      this.updateConfigSources,
      this.refreshRuntimeOverrideGauge,
      this.notifyConfigChange,
    ];
    ensureReferences.every(() => true);
  }
}

/**
 *
 */
export function getConfigLoader(): ConfigLoader {
  return ConfigLoader.getInstance();
}

/**
 *
 */
export function getConfig(): KoduckFlowConfig {
  return getConfigLoader().load();
}

/**
 *
 * @param options
 */
export function reloadConfig(options?: Partial<KoduckFlowConfig>): KoduckFlowConfig {
  return getConfigLoader().reload(options);
}
