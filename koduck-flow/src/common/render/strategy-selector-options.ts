/**
 * RenderStrategySelector 可配置选项。
 */
export interface RenderStrategySelectorOptions {
  /** 允许覆盖同名策略 */
  allowOverride?: boolean;
  /** 自定义日志标签 */
  loggerTag?: string;
  /** 注册完成后的默认策略顺序是否按 priority 降序排序（默认 true） */
  autoSort?: boolean;
}
