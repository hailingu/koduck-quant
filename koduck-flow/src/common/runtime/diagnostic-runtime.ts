/**
 * @module src/common/runtime/diagnostic-runtime
 * @description Diagnostic runtime wrapper for debugging and monitoring runtime creation and lifecycle.
 * Provides labeled runtime instances with diagnostic logging for troubleshooting and observability.
 * @example
 * ```typescript
 * const diagnosticRuntime = createDiagnosticRuntime({
 *   label: 'integration-test-runtime',
 *   enableMetrics: true
 * });
 * // Logs: Diagnostic runtime created with label 'integration-test-runtime'
 * ```
 */

import { logger } from "../logger";
import { createDuckFlowRuntime, type DuckFlowRuntime } from "./duck-flow-runtime";
import type { RuntimeCreationOptions } from "./runtime-factory";

/**
 * Options for creating a diagnostic runtime instance
 * @interface DiagnosticRuntimeOptions
 * @augments {RuntimeCreationOptions}
 * @property {string} [label] - Optional label for diagnostic logging and identification
 */
export interface DiagnosticRuntimeOptions extends RuntimeCreationOptions {
  readonly label?: string;
}

/**
 * Create a diagnostic runtime with optional labeling for debugging
 * @param {DiagnosticRuntimeOptions} [options={}] - Runtime creation options with optional diagnostic label
 * @returns {DuckFlowRuntime} Configured runtime instance with diagnostic logging
 * @example
 * ```typescript
 * const runtime = createDiagnosticRuntime({
 *   label: 'my-test-runtime',
 *   enableMetrics: true,
 *   enableCache: true
 * });
 * ```
 */
export function createDiagnosticRuntime(options: DiagnosticRuntimeOptions = {}): DuckFlowRuntime {
  const runtime = createDuckFlowRuntime(options);

  if (options.label) {
    logger.info("Diagnostic runtime created", {
      event: "runtime-created",
      metadata: {
        label: options.label,
        factory: "DiagnosticRuntime",
      },
    });
  }

  return runtime;
}
