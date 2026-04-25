import { logger, type LogLevel } from "../logger";

const diagnosticsLogger = logger.withContext({
  tag: "render-diagnostics",
  metadata: { component: "RenderDiagnostics" },
});

export type RenderDiagnosticsConfig = {
  enabled?: boolean;
  logLevel?: LogLevel;
  sampleRate?: number;
};

const DEFAULT_CONFIG: Required<RenderDiagnosticsConfig> = {
  enabled: false,
  logLevel: "warn",
  sampleRate: 1,
};

let currentConfig: Required<RenderDiagnosticsConfig> = { ...DEFAULT_CONFIG };

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldEmit(level: LogLevel): boolean {
  if (!currentConfig.enabled) return false;
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[currentConfig.logLevel]) {
    return false;
  }
  const rate = Math.max(0, Math.min(1, currentConfig.sampleRate));
  if (rate < 1 && Math.random() > rate) {
    return false;
  }
  return true;
}

export function setRenderDiagnostics(config?: RenderDiagnosticsConfig): void {
  currentConfig = {
    enabled: config?.enabled ?? currentConfig.enabled,
    logLevel: config?.logLevel ?? currentConfig.logLevel,
    sampleRate: config?.sampleRate ?? currentConfig.sampleRate,
  };
}

export function getRenderDiagnosticsConfig(): Required<RenderDiagnosticsConfig> {
  return { ...currentConfig };
}

export const diagnostics = {
  debug(message: unknown, ...rest: unknown[]): void {
    if (!shouldEmit("debug")) return;
    diagnosticsLogger.debug(message, ...rest);
  },
  info(message: unknown, ...rest: unknown[]): void {
    if (!shouldEmit("info")) return;
    diagnosticsLogger.info(message, ...rest);
  },
  warn(message: unknown, ...rest: unknown[]): void {
    if (!shouldEmit("warn")) return;
    diagnosticsLogger.warn(message, ...rest);
  },
  error(message: unknown, ...rest: unknown[]): void {
    if (!shouldEmit("error")) return;
    diagnosticsLogger.error(message, ...rest);
  },
};

export function resetRenderDiagnostics(): void {
  currentConfig = { ...DEFAULT_CONFIG };
}
