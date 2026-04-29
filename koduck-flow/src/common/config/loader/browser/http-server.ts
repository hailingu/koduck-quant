import { logger } from "../../../logger";
import type { HttpOverrideOptions } from "../types";

/** Mutable state object tracking the HTTP server instance and port. */
interface HttpState {
  httpServer: null;
  httpPort?: number;
}

/**
 * No-op stub for HTTP override setup in the browser environment.
 * Logs a warning and resets state since HTTP servers are not supported in browsers.
 * @param state - Mutable HTTP state to reset
 * @param _port - Desired port (ignored in browser)
 * @param _options - HTTP override options (ignored in browser)
 */
export function setupHTTPOverridesImpl(
  state: HttpState,
  _port: number = 8080,
  _options: HttpOverrideOptions = {}
): void {
  state.httpServer = null;
  delete state.httpPort;
  logger.warn("HTTP overrides not supported in browser environment");
}

/**
 * Shuts down HTTP overrides by clearing the server instance and port from state.
 * @param state - Mutable HTTP state to reset
 */
export function shutdownHTTPOverridesImpl(state: HttpState): void {
  state.httpServer = null;
  delete state.httpPort;
}
