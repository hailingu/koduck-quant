export const DEFAULT_HTTP_OVERRIDE_PATH = "/api/config/override";
export const LOAD_TIME_WARN_THRESHOLD_MS = 10;
export const METRIC_SCOPE = "koduckflow.config.loader";
export const RUNTIME_AUDIT_MAX_ENTRIES = 100;

export const isBrowserEnv =
  typeof globalThis.window !== "undefined" &&
  typeof globalThis.document !== "undefined" &&
  !(typeof process !== "undefined" && process.versions?.node);

export const hasProcessEnv = typeof process !== "undefined" && typeof process.env !== "undefined";
