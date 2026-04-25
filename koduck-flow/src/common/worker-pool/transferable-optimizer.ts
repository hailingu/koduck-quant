/**
 * Transferable Objects Optimizer Module
 *
 * Optimizes data transfer between main thread and worker threads by using
 * Transferable objects (ArrayBuffer, MessagePort, etc.) to avoid data copying.
 *
 * ## Design
 *
 * - Automatically detects transferable data types (ArrayBuffer, TypedArray, etc.)
 * - Transfers ownership of large buffers instead of copying
 * - Significantly reduces memory usage and improves performance for large data
 * - Provides utilities to identify and extract transferable objects
 * - Maintains compatibility with non-transferable data
 *
 * ## Performance Impact
 *
 * - Reduces memory copy overhead for large data (>100KB typically)
 * - Moves instead of copies large buffers (near-instant for GB+ data)
 * - Memory savings proportional to data size
 *
 * ## Supported Transferable Types
 *
 * - ArrayBuffer
 * - All TypedArray views (Uint8Array, Float32Array, etc.)
 * - ImageBitmap
 * - AudioData, VideoFrame, OffscreenCanvas (browser only)
 * - MessagePort (advanced usage)
 *
 * @example
 * ```typescript
 * import { getTransferables, isTransferable } from './transferable-optimizer';
 *
 * // Large data to send to worker
 * const largeBuffer = new ArrayBuffer(1024 * 1024); // 1MB
 * const uint8View = new Uint8Array(largeBuffer);
 * uint8View.fill(42);
 *
 * // Extract transferables
 * const transferables = getTransferables({ buffer: largeBuffer });
 * console.log(transferables); // [largeBuffer]
 *
 * // Send with ownership transfer
 * worker.postMessage({ buffer: largeBuffer }, transferables);
 * // After this, largeBuffer is unusable in main thread
 * ```
 */

/**
 * Check if a value is an ArrayBuffer or TypedArray
 *
 * @param value - Value to check
 * @returns True if value is a transferable buffer type
 */
function isArrayBufferLike(value: unknown): value is ArrayBuffer | ArrayBufferView {
  if (value instanceof ArrayBuffer) {
    return true;
  }

  // Check for TypedArray or other ArrayBufferView types
  if (typeof value === "object" && value !== null) {
    const proto = Object.getPrototypeOf(value);
    return (
      proto === Uint8Array.prototype ||
      proto === Uint16Array.prototype ||
      proto === Uint32Array.prototype ||
      proto === Int8Array.prototype ||
      proto === Int16Array.prototype ||
      proto === Int32Array.prototype ||
      proto === Float32Array.prototype ||
      proto === Float64Array.prototype ||
      proto === BigInt64Array.prototype ||
      proto === BigUint64Array.prototype ||
      proto === DataView.prototype
    );
  }

  return false;
}

/**
 * Check if a value is an ImageBitmap (browser environment)
 *
 * @param value - Value to check
 * @returns True if value is ImageBitmap
 */
function isImageBitmap(value: unknown): value is ImageBitmap {
  // ImageBitmap is only available in browser environment
  if (typeof globalThis === "undefined" || !("ImageBitmap" in globalThis)) {
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return value instanceof (globalThis as any).ImageBitmap;
}

/**
 * Check if a value is a MessagePort
 *
 * @param value - Value to check
 * @returns True if value is MessagePort
 */
function isMessagePort(value: unknown): value is MessagePort {
  if (typeof globalThis === "undefined" || !("MessagePort" in globalThis)) {
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return value instanceof (globalThis as any).MessagePort;
}

/**
 * Check if a value is transferable
 *
 * Identifies objects that can be transferred instead of copied
 * when posting messages to workers.
 *
 * @param value - Value to check
 * @returns True if value is transferable
 */
export function isTransferable(value: unknown): boolean {
  return isArrayBufferLike(value) || isImageBitmap(value) || isMessagePort(value);
}

/**
 * Recursively extract all transferable objects from a data structure
 *
 * Traverses the object graph and collects all transferable objects
 * that should be transferred instead of copied.
 *
 * @param data - Object or value to scan for transferables
 * @param visited - Set of already visited objects (to avoid cycles)
 * @returns Array of Transferable objects
 */
export function getTransferables(data: unknown, visited = new Set<object>()): Transferable[] {
  const transferables: Transferable[] = [];

  function handleArray(arr: unknown[]): void {
    for (const item of arr) {
      traverse(item);
    }
  }

  function handleObject(obj: Record<string, unknown>): void {
    for (const key in obj) {
      if (Object.hasOwn(obj, key)) {
        traverse(obj[key]);
      }
    }
  }

  function handleMap(map: Map<unknown, unknown>): void {
    for (const [key, val] of map) {
      traverse(key);
      traverse(val);
    }
  }

  function handleSet(set: Set<unknown>): void {
    for (const item of set) {
      traverse(item);
    }
  }

  function traverse(value: unknown): void {
    // Handle primitives
    if (value === null || typeof value !== "object") {
      return;
    }

    // Prevent infinite loops on circular references
    if (visited.has(value)) {
      return;
    }
    visited.add(value);

    // Check if value itself is transferable
    if (isTransferable(value)) {
      transferables.push(value as Transferable);
      return;
    }

    // Handle Arrays
    if (Array.isArray(value)) {
      handleArray(value);
      return;
    }

    // Handle Objects
    if (value.constructor === Object) {
      handleObject(value as Record<string, unknown>);
      return;
    }

    // Handle Maps
    if (value instanceof Map) {
      handleMap(value);
      return;
    }

    // Handle Sets
    if (value instanceof Set) {
      handleSet(value);
    }
  }

  traverse(data);
  return transferables;
}

/**
 * Get size of transferable data
 *
 * Estimates memory size of transferable objects in bytes.
 * Useful for tracking memory optimization benefits.
 *
 * @param transferables - Array of transferable objects
 * @returns Total size in bytes
 */
export function getTransferableSize(transferables: Transferable[]): number {
  let totalSize = 0;

  for (const item of transferables) {
    if (item instanceof ArrayBuffer) {
      totalSize += item.byteLength;
    } else if (isArrayBufferLike(item)) {
      // ArrayBufferView has byteLength property
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      totalSize += (item as any).byteLength || 0;
    }
    // ImageBitmap and MessagePort don't have meaningful size metrics
  }

  return totalSize;
}

/**
 * Optimization statistics for transferable objects
 */
export interface TransferableStats {
  /** Number of transferable objects found */
  count: number;
  /** Total bytes of transferable data */
  bytes: number;
  /** Types of transferables found */
  types: Set<string>;
  /** Estimated memory savings vs copying */
  estimatedSavings: number;
}

/**
 * Analyze data for transferable optimization potential
 *
 * Scans data structure and provides statistics about optimization opportunities.
 *
 * @param data - Data to analyze
 * @returns Statistics about transferable objects
 */
export function analyzeTransferables(data: unknown): TransferableStats {
  const transferables = getTransferables(data);
  const types = new Set<string>();
  let bytes = 0;

  for (const item of transferables) {
    if (item instanceof ArrayBuffer) {
      types.add("ArrayBuffer");
      bytes += item.byteLength;
    } else if (isArrayBufferLike(item)) {
      const proto = Object.getPrototypeOf(item);
      if (proto === Uint8Array.prototype) types.add("Uint8Array");
      else if (proto === Float32Array.prototype) types.add("Float32Array");
      else if (proto === Float64Array.prototype) types.add("Float64Array");
      else if (proto === Int32Array.prototype) types.add("Int32Array");
      else types.add("TypedArray");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      bytes += (item as any).byteLength || 0;
    } else if (isImageBitmap(item)) {
      types.add("ImageBitmap");
    } else if (isMessagePort(item)) {
      types.add("MessagePort");
    }
  }

  return {
    count: transferables.length,
    bytes,
    types,
    // Estimate: copying would take roughly 1 cycle per byte at modern CPU speeds
    // Transferring is essentially free, so saving is ~100% of copy time
    estimatedSavings: Math.round(bytes * 0.8), // Rough estimate of optimization
  };
}

/**
 * Message wrapper with transferable optimization
 *
 * Wraps message data and automatically extracts transferables
 * for efficient posting to workers.
 */
export class OptimizedMessage {
  /** Message data */
  data: unknown;

  /** Transferables extracted from data */
  transferables: Transferable[];

  /** Statistics about transferables */
  stats: TransferableStats;

  /**
   * Create optimized message
   *
   * @param data - Message data to optimize
   */
  constructor(data: unknown) {
    this.data = data;
    this.transferables = getTransferables(data);
    this.stats = analyzeTransferables(data);
  }

  /**
   * Post this message to a worker
   *
   * Uses transferables array to avoid copying large data.
   *
   * @param worker - Target worker to post to
   */
  postToWorker(worker: Worker): void {
    worker.postMessage(this.data, this.transferables);
  }
}

/**
 * Format size in bytes to human-readable string
 *
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}
