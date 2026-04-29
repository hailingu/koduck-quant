/**
 * Configuration management interface
 *
 * Provides unified configuration management capabilities, including CRUD, validation, import/export, etc.
 * Can be implemented by multiple interfaces and classes to manage their respective configurations.
 */
export interface IConfig {
  /** Get default configuration */
  getDefaultConfig(): Record<string, unknown>;

  /** Get configuration of specified type */
  getConfig(nodeType: string): Record<string, unknown> | undefined;

  /** Register new configuration */
  registerConfig(nodeType: string, config: Record<string, unknown>): void;

  /** Unregister configuration */
  unregisterConfig(nodeType: string): void;

  /** Get all available configurations */
  getAvailableConfigs(): Record<string, Record<string, unknown>>;

  /** Validate configuration */
  validateConfig(config: Record<string, unknown>): boolean;

  /** Get configuration schema */
  getConfigSchema(): Record<string, unknown>;

  /** Export configuration */
  exportConfig(nodeType: string): string;

  /** Import configuration */
  importConfig(configJson: string): void;
}
