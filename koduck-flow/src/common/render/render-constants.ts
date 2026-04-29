/**
 * Render system configuration constants
 * Unified management of all rendering-related thresholds and configuration parameters
 */

/**
 * Complexity threshold configuration
 */
export const COMPLEXITY_THRESHOLDS = {
  /** Low complexity threshold */
  LOW: 0.3,
  /** Medium complexity threshold */
  MEDIUM: 0.6,
  /** High complexity threshold */
  HIGH: 0.8,
  /** Ultra-high complexity threshold (WebGPU recommended) */
  ULTRA_HIGH: 0.7,
} as const;

/**
 * Performance threshold configuration
 */
export const PERFORMANCE_THRESHOLDS = {
  /** Minimum FPS threshold */
  MIN_FPS: 30,
  /** Target FPS */
  TARGET_FPS: 60,
  /** Max memory usage rate */
  MAX_MEMORY: 0.8,
  /** Memory warning threshold */
  MEMORY_WARNING: 0.6,
  /** High confidence threshold */
  HIGH_CONFIDENCE: 0.95,
  /** Medium confidence threshold */
  MEDIUM_CONFIDENCE: 0.85,
  /** Low confidence threshold */
  LOW_CONFIDENCE: 0.75,
  /** FPS smoothing factor */
  FPS_SMOOTHING_FACTOR: 0.9,
} as const;

/**
 * Cache configuration
 */
export const CACHE_LIMITS = {
  /** Selection cache max size */
  SELECTION_CACHE_SIZE: 50,
  /** Cache TTL (seconds) */
  TTL_SECONDS: 30,
  /** LRU cache threshold */
  LRU_THRESHOLD: 45,
} as const;

/**
 * Entity count thresholds
 */
export const ENTITY_COUNT_THRESHOLDS = {
  /** Small dataset */
  SMALL: 100,
  /** Medium dataset */
  MEDIUM: 1000,
  /** Large dataset */
  LARGE: 5000,
  /** Ultra-large dataset */
  ULTRA_LARGE: 10000,
} as const;

/**
 * LOD configuration constants
 */
export const LOD_CONFIG = {
  /** Performance threshold */
  PERFORMANCE_THRESHOLD: 1000,
  /** Viewport margin */
  VIEWPORT_MARGIN: 100,
  /** Cluster radius */
  CLUSTER_RADIUS: 50,
  /** LOD level definitions */
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
 * GPU tier definitions
 */
export const GPU_TIERS = {
  /** Integrated GPU */
  INTEGRATED: 1,
  /** Mid-range discrete GPU */
  MIDRANGE: 2,
  /** High-end discrete GPU */
  HIGH_END: 3,
} as const;

/**
 * Device detection configuration
 */
export const DEVICE_DETECTION = {
  /** Device capability detection timeout (milliseconds) */
  TIMEOUT_MS: 1000,
  /** Whether to enable async detection */
  ASYNC_DETECTION: true,
  /** Default GPU tier */
  DEFAULT_GPU_TIER: GPU_TIERS.INTEGRATED,
} as const;

/**
 * Renderer priority
 */
export const RENDERER_PRIORITY = {
  REACT: 90,
  CANVAS: 75,
  LOD: 85,
  WEBGPU: 95,
} as const;

/**
 * Debug configuration
 */
export const DEBUG_CONFIG = {
  /** Whether to enable selection reason logging */
  ENABLE_SELECTION_REASONS: true,
  /** Whether to enable performance monitoring */
  ENABLE_PERFORMANCE_MONITORING: true,
  /** Whether to enable cache statistics */
  ENABLE_CACHE_STATS: true,
} as const;

/**
 * Type definitions
 */
export type ComplexityLevel = keyof typeof COMPLEXITY_THRESHOLDS;
export type GPUTier = (typeof GPU_TIERS)[keyof typeof GPU_TIERS];
export type EntityCountCategory = keyof typeof ENTITY_COUNT_THRESHOLDS;
