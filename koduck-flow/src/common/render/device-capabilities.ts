import type { GPUTier } from "./render-constants";
import { DEVICE_DETECTION, GPU_TIERS } from "./render-constants";

/**
 * Device capability interface
 * Describes hardware and browser capabilities of the current runtime environment
 */
export interface DeviceCapabilities {
  /** Whether WebGPU is supported */
  hasWebGPU: boolean;
  /** Whether OffscreenCanvas is supported */
  hasOffscreenCanvas: boolean;
  /** Max memory (bytes), 0 means unknown */
  maxMemory: number;
  /** GPU tier */
  gpuTier: GPUTier;
  /** Hardware concurrency (CPU core count) */
  hardwareConcurrency: number;
  /** Device pixel ratio */
  devicePixelRatio: number;
  /** Whether initialized */
  initialized: boolean;
}

/**
 * Device capability detector
 * Singleton pattern, unified management of device capability detection logic
 *
 * @example
 * ```typescript
 * import { deviceCapabilities } from './device-capabilities';
 *
 * // Async detection (recommended)
 * const caps = await deviceCapabilities.detect();
 * if (caps.hasWebGPU) {
 *   // Use WebGPU renderer
 * }
 *
 * // Sync access (if already initialized)
 * const caps = deviceCapabilities.getSync();
 * ```
 */
export class DeviceCapabilityDetector {
  private static instance: DeviceCapabilityDetector;
  private capabilities: DeviceCapabilities | null = null;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): DeviceCapabilityDetector {
    if (!DeviceCapabilityDetector.instance) {
      DeviceCapabilityDetector.instance = new DeviceCapabilityDetector();
    }
    return DeviceCapabilityDetector.instance;
  }

  /**
   * Async detect device capabilities
   * @returns Promise<DeviceCapabilities> Complete device capability information
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
   * Sync get device capabilities
   * If not initialized, will perform fast sync detection (without async GPU tier detection)
   * @returns DeviceCapabilities Device capability information
   */
  getSync(): DeviceCapabilities {
    if (!this.capabilities) {
      // Fast sync initialization, using default GPU tier
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
      // Ensure real-time capabilities reflect latest environment
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
   * Detect WebGPU support
   */
  private detectWebGPU(): boolean {
    if (typeof navigator === "undefined") {
      return false;
    }
    return "gpu" in navigator && navigator.gpu !== undefined;
  }

  /**
   * Detect OffscreenCanvas support
   */
  private detectOffscreenCanvas(): boolean {
    return typeof OffscreenCanvas !== "undefined";
  }

  /**
   * Detect available memory
   * @returns Memory size (bytes), 0 means unknown
   */
  private detectMemory(): number {
    if (typeof performance === "undefined" || !("memory" in performance)) {
      return 0;
    }
    const memory = (performance as unknown as { memory?: { jsHeapSizeLimit?: number } }).memory;
    return memory?.jsHeapSizeLimit || 0;
  }

  /**
   * Async detect GPU tier
   * Determine GPU performance via WebGL or WebGPU information
   */
  private async detectGPUTier(): Promise<GPUTier> {
    // Prefer WebGPU detection
    if (this.detectWebGPU()) {
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (adapter) {
          // WebGPU adapter info is limited, mainly detect via WebGL
          return this.detectGPUTierFromWebGL();
        }
      } catch {
        // WebGPU detection failed, fallback to WebGL
      }
    }

    // Fallback to WebGL detection
    return this.detectGPUTierFromWebGL();
  }

  /**
   * Detect GPU tier via WebGL
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
   * Classify GPU tier by WebGL renderer string
   */
  private classifyGPUTierByRenderer(renderer: string): GPUTier {
    const rendererLower = renderer.toLowerCase();

    // High-end GPU characteristics
    if (
      rendererLower.includes("nvidia") &&
      (rendererLower.includes("rtx") || rendererLower.includes("gtx"))
    ) {
      return GPU_TIERS.HIGH_END;
    }

    // Mid-range GPU characteristics
    if (rendererLower.includes("amd") && rendererLower.includes("radeon")) {
      return GPU_TIERS.MIDRANGE;
    }

    // Integrated GPU characteristics
    if (rendererLower.includes("intel")) {
      return GPU_TIERS.INTEGRATED;
    }

    // Default to integrated GPU
    return GPU_TIERS.INTEGRATED;
  }

  /**
   * Detect hardware concurrency (CPU core count)
   */
  private detectHardwareConcurrency(): number {
    if (typeof navigator === "undefined" || !("hardwareConcurrency" in navigator)) {
      return 1;
    }
    return navigator.hardwareConcurrency || 1;
  }

  /**
   * Detect device pixel ratio
   */
  private detectDevicePixelRatio(): number {
    if (typeof globalThis === "undefined" || !("devicePixelRatio" in globalThis)) {
      return 1;
    }
    return window.devicePixelRatio || 1;
  }

  /**
   * Reset detection results (for testing or forced re-detection)
   */
  reset(): void {
    this.capabilities = null;
  }
}

/**
 * Export singleton instance
 * @example
 * ```typescript
 * import { deviceCapabilities } from './device-capabilities';
 *
 * const caps = await deviceCapabilities.detect();
 * console.log('WebGPU support:', caps.hasWebGPU);
 * ```
 */
export const deviceCapabilities = DeviceCapabilityDetector.getInstance();
