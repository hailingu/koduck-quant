/**
 * 配置管理接口
 *
 * 提供统一的配置管理能力，包括增删改查、验证、导入导出等功能。
 * 可被多个接口和类实现，用于管理各自的配置。
 */
export interface IConfig {
  /** 获取默认配置 */
  getDefaultConfig(): Record<string, unknown>;

  /** 获取指定类型的配置 */
  getConfig(nodeType: string): Record<string, unknown> | undefined;

  /** 注册新配置 */
  registerConfig(nodeType: string, config: Record<string, unknown>): void;

  /** 注销配置 */
  unregisterConfig(nodeType: string): void;

  /** 获取所有可用配置 */
  getAvailableConfigs(): Record<string, Record<string, unknown>>;

  /** 验证配置 */
  validateConfig(config: Record<string, unknown>): boolean;

  /** 获取配置模式 */
  getConfigSchema(): Record<string, unknown>;

  /** 导出配置 */
  exportConfig(nodeType: string): string;

  /** 导入配置 */
  importConfig(configJson: string): void;
}
