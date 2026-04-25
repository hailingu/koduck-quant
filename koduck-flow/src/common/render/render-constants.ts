/**
 * 渲染系统配置常量
 * 统一管理所有渲染相关的阈值和配置参数
 */

/**
 * 复杂度阈值配置
 */
export const COMPLEXITY_THRESHOLDS = {
  /** 低复杂度阈值 */
  LOW: 0.3,
  /** 中等复杂度阈值 */
  MEDIUM: 0.6,
  /** 高复杂度阈值 */
  HIGH: 0.8,
  /** 超高复杂度阈值（WebGPU推荐） */
  ULTRA_HIGH: 0.7,
} as const;

/**
 * 性能阈值配置
 */
export const PERFORMANCE_THRESHOLDS = {
  /** 最低FPS阈值 */
  MIN_FPS: 30,
  /** 目标FPS */
  TARGET_FPS: 60,
  /** 最大内存使用率 */
  MAX_MEMORY: 0.8,
  /** 内存警告阈值 */
  MEMORY_WARNING: 0.6,
  /** 高置信度阈值 */
  HIGH_CONFIDENCE: 0.95,
  /** 中等置信度阈值 */
  MEDIUM_CONFIDENCE: 0.85,
  /** 低置信度阈值 */
  LOW_CONFIDENCE: 0.75,
  /** FPS平滑因子 */
  FPS_SMOOTHING_FACTOR: 0.9,
} as const;

/**
 * 缓存配置
 */
export const CACHE_LIMITS = {
  /** 选择缓存最大大小 */
  SELECTION_CACHE_SIZE: 50,
  /** 缓存TTL（秒） */
  TTL_SECONDS: 30,
  /** LRU缓存阈值 */
  LRU_THRESHOLD: 45,
} as const;

/**
 * 实体数量阈值
 */
export const ENTITY_COUNT_THRESHOLDS = {
  /** 小规模数据集 */
  SMALL: 100,
  /** 中等规模数据集 */
  MEDIUM: 1000,
  /** 大规模数据集 */
  LARGE: 5000,
  /** 超大规模数据集 */
  ULTRA_LARGE: 10000,
} as const;

/**
 * LOD配置常量
 */
export const LOD_CONFIG = {
  /** 性能阈值 */
  PERFORMANCE_THRESHOLD: 1000,
  /** 视口边距 */
  VIEWPORT_MARGIN: 100,
  /** 聚类半径 */
  CLUSTER_RADIUS: 50,
  /** LOD级别定义 */
  LEVELS: [
    {
      minZoom: 0,
      maxZoom: 0.5,
      strategy: "pixel-blocks" as const,
      name: "cluster",
      maxNodes: 100,
    },
    {
      minZoom: 0.5,
      maxZoom: 1.0,
      strategy: "basic-shapes" as const,
      name: "simplified",
      maxNodes: 500,
    },
    {
      minZoom: 1.0,
      maxZoom: 2.0,
      strategy: "reduced-details" as const,
      name: "normal",
      maxNodes: 2000,
    },
    {
      minZoom: 2.0,
      maxZoom: Number.MAX_VALUE,
      strategy: "full-details" as const,
      name: "detailed",
      maxNodes: Number.MAX_VALUE,
    },
  ],
} as const;

/**
 * GPU层级定义
 */
export const GPU_TIERS = {
  /** 集成显卡 */
  INTEGRATED: 1,
  /** 中端独显 */
  MIDRANGE: 2,
  /** 高端独显 */
  HIGH_END: 3,
} as const;

/**
 * 设备检测配置
 */
export const DEVICE_DETECTION = {
  /** 设备能力检测超时时间（毫秒） */
  TIMEOUT_MS: 1000,
  /** 是否启用异步检测 */
  ASYNC_DETECTION: true,
  /** 默认GPU层级 */
  DEFAULT_GPU_TIER: GPU_TIERS.INTEGRATED,
} as const;

/**
 * 渲染器优先级
 */
export const RENDERER_PRIORITY = {
  REACT: 90,
  CANVAS: 75,
  LOD: 85,
  WEBGPU: 95,
} as const;

/**
 * 调试配置
 */
export const DEBUG_CONFIG = {
  /** 是否启用选择原因记录 */
  ENABLE_SELECTION_REASONS: true,
  /** 是否启用性能监控 */
  ENABLE_PERFORMANCE_MONITORING: true,
  /** 是否启用缓存统计 */
  ENABLE_CACHE_STATS: true,
} as const;

/**
 * 类型定义
 */
export type ComplexityLevel = keyof typeof COMPLEXITY_THRESHOLDS;
export type GPUTier = (typeof GPU_TIERS)[keyof typeof GPU_TIERS];
export type EntityCountCategory = keyof typeof ENTITY_COUNT_THRESHOLDS;
