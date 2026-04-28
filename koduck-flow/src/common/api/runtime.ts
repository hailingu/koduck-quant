/**
 * Runtime facade API exports and re-exports.
 *
 * Provides a stable public surface over the internal `runtime-context` module,
 * allowing consumers to import runtime helpers and utilities without directly
 * referencing implementation details. This module acts as the primary entry point
 * for all runtime-related functionality.
 *
 * Exported functionality includes:
 * 1. Runtime context management (setting/clearing/querying active runtime)
 * 2. Event listeners for runtime lifecycle and missing-runtime events
 * 3. Configuration management for runtime behavior
 * 4. The transparent runtime proxy for automatic runtime resolution
 * 5. Type definitions for runtime metadata and configuration
 *
 * Usage example:
 * ```typescript
 * import {
 *   setApiRuntime,
 *   clearApiRuntime,
 *   runWithApiRuntime,
 *   runtime,
 *   addApiRuntimeMissingListener,
 *   ApiRuntimeMetadata,
 * } from './runtime';
 *
 * // Set up runtime for current scope
 * const token = setApiRuntime(runtimeInstance, { tenantId: 'org-123' });
 *
 * // Use the transparent proxy
 * const entity = runtime.createEntity('MyType');
 *
 * // Clean up
 * clearApiRuntime(token);
 *
 * // Or use wrapper function
 * await runWithApiRuntime(runtimeInstance, async () => {
 *   await runtime.performOperation();
 * });
 *
 * // Monitor for missing runtime situations
 * addApiRuntimeMissingListener((info) => {
 *   console.error('No active runtime!', info);
 * });
 * ```
 *
 * @module runtime
 * @see {@link ./entity | Entity API}
 * @see {@link ./render | Render API}
 * @see {@link ./flow | Flow API}
 * @see {@link ./manager | Manager API}
 * @see {@link ./runtime-context | Runtime Context (Implementation)}
 */
export {
  addApiRuntimeMissingListener,
  removeApiRuntimeMissingListener,
  addApiRuntimeFallbackListener,
  removeApiRuntimeFallbackListener,
  setApiRuntimeConfig,
  getApiRuntimeConfig,
  resetApiRuntimeConfig,
  setApiRuntime,
  clearApiRuntime,
  getApiRuntime,
  getApiRuntimeInfo,
  runWithApiRuntime,
  runtime,
  getRuntimeProxy,
  KoduckFlowRuntimeMissingError,
} from "./runtime-context";

export type {
  ApiRuntimeMetadata,
  ApiRuntimeToken,
  ApiRuntimeMissingInfo,
  ApiRuntimeConfig,
} from "./runtime-context";
