import type { ConfigSource, DuckFlowConfig, ValidationIssue } from "../schema";
import type { IncomingMessage } from "node:http";

/**
 * @module src/common/config/loader/types
 * @description Type definitions for configuration loading, merging, and runtime overrides
 */

/**
 * Conflict information when merging configurations from multiple sources
 * @typedef {Object} MergeConflict
 * @property {string} path - JSON path where conflict occurred
 * @property {Array<{source: ConfigSource, value: unknown}>} sources - Values from conflicting sources
 * @property {unknown} resolvedValue - Final resolved value for the conflict
 * @property {'override' | 'merge'} resolutionStrategy - Strategy used to resolve the conflict
 */
export interface MergeConflict {
  path: string;
  sources: Array<{ source: ConfigSource; value: unknown }>;
  resolvedValue: unknown;
  resolutionStrategy: "override" | "merge";
}

/**
 * Source types for runtime configuration overrides
 * @typedef {string} RuntimeOverrideSource
 * @enum {'cli' | 'http' | 'api'}
 */
export type RuntimeOverrideSource = "cli" | "http" | "api";

/**
 * Types of events that trigger configuration changes
 * @typedef {string} ConfigChangeTrigger
 * @enum {'initial-load' | 'reload' | 'file-watcher' | 'runtime-api' | 'runtime-http' | 'runtime-cli'}
 */
export type ConfigChangeTrigger =
  | "initial-load"
  | "reload"
  | "file-watcher"
  | "runtime-api"
  | "runtime-http"
  | "runtime-cli";

/**
 * Audit record for configuration override operations
 * @typedef {Object} RuntimeOverrideAuditRecord
 * @property {RuntimeOverrideSource} source - Source of the override (cli, http, or api)
 * @property {Partial<DuckFlowConfig>} overrides - Requested override configuration
 * @property {Partial<DuckFlowConfig>} appliedOverrides - Actually applied overrides after validation
 * @property {string} [actor] - User or process that initiated the override
 * @property {Record<string, unknown>} [metadata] - Additional metadata about the override
 * @property {number} timestamp - Unix timestamp of override operation
 * @property {'applied' | 'rejected'} status - Whether override was applied or rejected
 * @property {string} [reason] - Reason for rejection if status is 'rejected'
 * @property {boolean} [dryRun] - Whether this was a dry-run test override
 */
export interface RuntimeOverrideAuditRecord {
  source: RuntimeOverrideSource;
  overrides: Partial<DuckFlowConfig>;
  appliedOverrides: Partial<DuckFlowConfig>;
  actor?: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
  status: "applied" | "rejected";
  reason?: string;
  dryRun?: boolean;
}

/**
 * Options for applying runtime configuration overrides
 * @typedef {Object} RuntimeOverrideOptions
 * @property {RuntimeOverrideSource} [source] - Override source (defaults to 'api')
 * @property {string} [actor] - User or process applying the override
 * @property {Record<string, unknown>} [metadata] - Metadata to track with override
 * @property {boolean} [dryRun] - If true, validate without applying
 */
export interface RuntimeOverrideOptions {
  source?: RuntimeOverrideSource;
  actor?: string;
  metadata?: Record<string, unknown>;
  dryRun?: boolean;
}

/**
 * Result of attempting to apply runtime configuration overrides
 * @typedef {Object} RuntimeOverrideResult
 * @property {DuckFlowConfig} config - Final merged configuration
 * @property {Partial<DuckFlowConfig>} appliedOverrides - Overrides that were applied
 * @property {MergeConflict[]} conflicts - Any conflicts encountered during merge
 * @property {ValidationIssue[]} warnings - Validation warnings about the override
 * @property {RuntimeOverrideAuditRecord} audit - Audit record of the operation
 * @property {boolean} dryRun - Whether this was a dry-run test
 */
export interface RuntimeOverrideResult {
  config: DuckFlowConfig;
  appliedOverrides: Partial<DuckFlowConfig>;
  conflicts: MergeConflict[];
  warnings: ValidationIssue[];
  audit: RuntimeOverrideAuditRecord;
  dryRun: boolean;
}

/**
 * Context information for a configuration change event
 * @typedef {Object} ConfigChangeContext
 * @property {ConfigChangeTrigger} trigger - What triggered this change
 * @property {string} [actor] - User or process that caused change
 * @property {Record<string, unknown>} [metadata] - Additional context data
 * @property {Partial<DuckFlowConfig>} [overrides] - Configuration overrides applied
 * @property {RuntimeOverrideSource} [source] - Source of overrides if applicable
 * @property {boolean} [dryRun] - Whether this was a dry-run test
 */
export interface ConfigChangeContext {
  trigger: ConfigChangeTrigger;
  actor?: string;
  metadata?: Record<string, unknown>;
  overrides?: Partial<DuckFlowConfig>;
  source?: RuntimeOverrideSource;
  dryRun?: boolean;
}

/**
 * Options for HTTP configuration override endpoint
 * @typedef {Object} HttpOverrideOptions
 * @property {string} [path] - HTTP endpoint path (defaults to '/api/config/override')
 * @property {Function} [authenticate] - Function to authenticate HTTP requests
 * @property {Function} [metadataResolver] - Function to extract metadata from requests
 * @property {Function} [actorResolver] - Function to extract actor identity from requests
 */
export interface HttpOverrideOptions {
  path?: string;
  authenticate?: (req: IncomingMessage) => Promise<boolean> | boolean;
  metadataResolver?: (req: IncomingMessage) => Record<string, unknown>;
  actorResolver?: (req: IncomingMessage) => string | undefined;
}

/**
 * Payload sent in HTTP configuration override requests
 * @typedef {Object} HttpOverridePayload
 * @property {Partial<DuckFlowConfig>} [overrides] - Configuration overrides to apply
 * @property {string} [actor] - Actor applying the override
 * @property {Record<string, unknown>} [metadata] - Metadata about this override
 * @property {boolean} [dryRun] - Whether to validate without applying
 */
export interface HttpOverridePayload {
  overrides?: Partial<DuckFlowConfig>;
  actor?: string;
  metadata?: Record<string, unknown>;
  dryRun?: boolean;
}

/**
 * Configuration source and its associated config values
 * @typedef {Object} MergeSource
 * @property {ConfigSource} source - The configuration source type
 * @property {Partial<DuckFlowConfig>} config - Configuration values from this source
 */
export type MergeSource = { source: ConfigSource; config: Partial<DuckFlowConfig> };
