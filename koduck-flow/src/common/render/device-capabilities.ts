import type { GPUTier } from "./render-constants";
import { DEVICE_DETECTION, GPU_TIERS } from "./render-constants";

/**
 * 设备能力接口
 * 描述当前运行环境的硬件和浏览器能力
 */
export interface DeviceCapabilities {
  /** 是否支持 WebGPU */
  hasWebGPU: boolean;
  /** 是否支持 OffscreenCanvas */
  hasOffscreenCanvas: boolean;
  /** 最大内存（字节），0 表示未知 */
  maxMemory: number;
  /** GPU 层级 */
  gpuTier: GPUTier;
  /** 硬件并发数（CPU 核心数） */
  hardwareConcurrency: number;
  /** 设备像素比 */
  devicePixelRatio: number;
  /** 是否已初始化 */
  initialized: boolean;
}

/**
 * 设备能力检测器
 * 单例模式，统一管理设备能力检测逻辑
 *
 * @example
 * ```typescript
 * import { deviceCapabilities } from './device-capabilities';
 *
 * // 异步检测（推荐）
 * const caps = await deviceCapabilities.detect();
 * if (caps.hasWebGPU) {
 *   // 使用 WebGPU 渲染器
 * }
 *
 * // 同步获取（如果已初始化）
 * const caps = deviceCapabilities.getSync();
 * ```
 */
export class DeviceCapabilityDetector {
  private static instance: DeviceCapabilityDetector;
  private capabilities: DeviceCapabilities | null = null;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): DeviceCapabilityDetector {
    if (!DeviceCapabilityDetector.instance) {
      DeviceCapabilityDetector.instance = new DeviceCapabilityDetector();
    }
    return DeviceCapabilityDetector.instance;
  }

  /**
   * 异步检测设备能力
   * @returns Promise<DeviceCapabilities> 完整的设备能力信息
   */
  async detect(): Promise<DeviceCapabilities> {
    if (this.capabilities?.initialized) {
      return this.capabilities;
    }

    const capabilities: DeviceCapabilities = {
      hasWebGPU: this.detectWebGPU(),
      hasOffscreenCanvas: this.detectOffscreenCanvas(),
      maxMemory: this.detectMemory(),
      gpuTier: await this.detectGPUTier(),
      hardwareConcurrency: this.detectHardwareConcurrency(),
      devicePixelRatio: this.detectDevicePixelRatio(),
      initialized: true,
    };

    this.capabilities = capabilities;
    return capabilities;
  }

  /**
   * 同步获取设备能力
   * 如果未初始化，将执行快速同步检测（不含异步 GPU 层级检测）
   * @returns DeviceCapabilities 设备能力信息
   */
  getSync(): DeviceCapabilities {
    if (!this.capabilities) {
      // 快速同步初始化，使用默认 GPU 层级
      this.capabilities = {
        hasWebGPU: this.detectWebGPU(),
        hasOffscreenCanvas: this.detectOffscreenCanvas(),
        maxMemory: this.detectMemory(),
        gpuTier: DEVICE_DETECTION.DEFAULT_GPU_TIER,
        hardwareConcurrency: this.detectHardwareConcurrency(),
        devicePixelRatio: this.detectDevicePixelRatio(),
        initialized: true,
      };
    } else {
      // 确保实时能力反映最新环境
      this.capabilities = {
        ...this.capabilities,
        hasWebGPU: this.detectWebGPU(),
        hasOffscreenCanvas: this.detectOffscreenCanvas(),
        hardwareConcurrency: this.detectHardwareConcurrency(),
        devicePixelRatio: this.detectDevicePixelRatio(),
      };
    }
    return this.capabilities;
  }

  /**
   * 检测 WebGPU 支持
   */
  private detectWebGPU(): boolean {
    if (typeof navigator === "undefined") {
      return false;
    }
    return "gpu" in navigator && navigator.gpu !== undefined;
  }

  /**
   * 检测 OffscreenCanvas 支持
   */
  private detectOffscreenCanvas(): boolean {
    return typeof OffscreenCanvas !== "undefined";
  }

  /**
   * 检测可用内存
   * @returns 内存大小（字节），0 表示未知
   */
  private detectMemory(): number {
    if (typeof performance === "undefined" || !("memory" in performance)) {
      return 0;
    }
    const memory = (performance as unknown as { memory?: { jsHeapSizeLimit?: number } }).memory;
    return memory?.jsHeapSizeLimit || 0;
  }

  /**
   * 异步检测 GPU 层级
   * 通过 WebGL 或 WebGPU 信息判断 GPU 性能
   */
  private async detectGPUTier(): Promise<GPUTier> {
    // 优先使用 WebGPU 检测
    if (this.detectWebGPU()) {
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (adapter) {
          // WebGPU adapter 信息较为有限，主要通过 WebGL 检测
          return this.detectGPUTierFromWebGL();
        }
      } catch {
        // WebGPU 检测失败，降级到 WebGL
      }
    }

    // 降级使用 WebGL 检测
    return this.detectGPUTierFromWebGL();
  }

  /**
   * 通过 WebGL 检测 GPU 层级
   */
  private detectGPUTierFromWebGL(): GPUTier {
    if (typeof document === "undefined") {
      return DEVICE_DETECTION.DEFAULT_GPU_TIER;
    }

    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");

      if (!gl) {
        return DEVICE_DETECTION.DEFAULT_GPU_TIER;
      }

      const debugInfo = (
        gl as WebGLRenderingContext & {
          getExtension(name: "WEBGL_debug_renderer_info"): {
            UNMASKED_RENDERER_WEBGL: number;
          } | null;
        }
      ).getExtension("WEBGL_debug_renderer_info");

      if (!debugInfo) {
        return DEVICE_DETECTION.DEFAULT_GPU_TIER;
      }

      const renderer =
        (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || "";
      return this.classifyGPUTierByRenderer(String(renderer));
    } catch {
      return DEVICE_DETECTION.DEFAULT_GPU_TIER;
    }
  }

  /**
   * 根据 WebGL 渲染器字符串分类 GPU 层级
   */
  private classifyGPUTierByRenderer(renderer: string): GPUTier {
    const rendererLower = renderer.toLowerCase();

    // 高端 GPU 特征
    if (
      rendererLower.includes("nvidia") &&
      (rendererLower.includes("rtx") || rendererLower.includes("gtx"))
    ) {
      return GPU_TIERS.HIGH_END;
    }

    // 中端 GPU 特征
    if (rendererLower.includes("amd") && rendererLower.includes("radeon")) {
      return GPU_TIERS.MIDRANGE;
    }

    // 集成显卡特征
    if (rendererLower.includes("intel")) {
      return GPU_TIERS.INTEGRATED;
    }

    // 默认为集成显卡
    return GPU_TIERS.INTEGRATED;
  }

  /**
   * 检测硬件并发数（CPU 核心数）
   */
  private detectHardwareConcurrency(): number {
    if (typeof navigator === "undefined" || !("hardwareConcurrency" in navigator)) {
      return 1;
    }
    return navigator.hardwareConcurrency || 1;
  }

  /**
   * 检测设备像素比
   */
  private detectDevicePixelRatio(): number {
    if (typeof window === "undefined" || !("devicePixelRatio" in window)) {
      return 1;
    }
    return window.devicePixelRatio || 1;
  }

  /**
   * 重置检测结果（用于测试或强制重新检测）
   */
  reset(): void {
    this.capabilities = null;
  }
}

/**
 * 导出单例实例
 * @example
 * ```typescript
 * import { deviceCapabilities } from './device-capabilities';
 *
 * const caps = await deviceCapabilities.detect();
 * console.log('WebGPU support:', caps.hasWebGPU);
 * ```
 */
export const deviceCapabilities = DeviceCapabilityDetector.getInstance();
