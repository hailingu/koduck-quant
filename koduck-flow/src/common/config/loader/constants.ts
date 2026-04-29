export const DEFAULT_HTTP_OVERRIDE_PATH = "/api/config/override";
export const LOAD_TIME_WARN_THRESHOLD_MS = 10;
export const METRIC_SCOPE = "koduckflow.config.loader";
export const RUNTIME_AUDIT_MAX_ENTRIES = 100;

export const isBrowserEnv =
  globalThis.window !== undefined &&
  globalThis.document !== undefined &&
  !(process !== undefined && process.versions?.node);

export const hasProcessEnv = process !== undefined && process.env !== undefined;
