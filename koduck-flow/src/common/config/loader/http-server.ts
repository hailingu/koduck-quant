import type { IncomingMessage, Server as HttpServer, ServerResponse } from "node:http";

import { logger } from "../../logger";
import type { KoduckFlowConfig } from "../schema";
import { DEFAULT_HTTP_OVERRIDE_PATH, isBrowserEnv } from "./constants";
import { isEmptyOverride } from "./merge";
import type { HttpOverrideOptions, HttpOverridePayload, RuntimeOverrideOptions } from "./types";
import type { IConfigRuntimeOverride } from "./types/config-runtime-override.interface";

interface HttpState {
  httpServer: HttpServer | null;
  httpPort?: number;
  httpPath: string;
  configProvider: IConfigRuntimeOverride;
}

export function setupHTTPOverridesImpl(
  state: HttpState,
  port: number = 8080,
  options: HttpOverrideOptions = {}
): void {
  if (isBrowserEnv) {
    logger.warn("HTTP overrides not supported in browser environment");
    return;
  }

  if (state.httpServer) {
    logger.warn("HTTP overrides endpoint already active; ignore duplicate setup request");
    return;
  }

  if (port > 0) {
    state.httpPort = port;
  } else {
    delete state.httpPort;
  }
  state.httpPath = options.path ?? DEFAULT_HTTP_OVERRIDE_PATH;

  void startHttpOverrideServer(state, port, options).catch((error: unknown) => {
    logger.error("Failed to setup HTTP override server:", error);
  });
}

async function startHttpOverrideServer(
  state: HttpState,
  port: number,
  options: HttpOverrideOptions
): Promise<void> {
  const { createServer } = await import("node:http");

  const server = createServer(async (req, res) => {
    if (!req.url) {
      sendJsonResponse(res, 400, { success: false, error: "Missing request URL" });
      return;
    }

    const basePort = state.httpPort ?? port;
    const requestUrl = new URL(req.url, `http://localhost:${basePort}`);
    if (requestUrl.pathname !== state.httpPath) {
      sendJsonResponse(res, 404, { success: false, error: "Endpoint not found" });
      return;
    }

    if ((req.method ?? "").toUpperCase() !== "POST") {
      res.setHeader("Allow", "POST");
      sendJsonResponse(res, 405, {
        success: false,
        error: "Only POST method is supported for overrides",
      });
      return;
    }

    try {
      if (options.authenticate && !(await options.authenticate(req))) {
        sendJsonResponse(res, 401, { success: false, error: "Unauthorized" });
        return;
      }

      const payload = await parseHttpOverridePayload(req);

      const resolvedActor = payload.actor ?? options.actorResolver?.(req);
      const resolvedMetadataSource = options.metadataResolver?.(req);
      const mergedMetadata =
        resolvedMetadataSource || payload.metadata
          ? {
              ...(resolvedMetadataSource ?? {}),
              ...(payload.metadata ?? {}),
            }
          : undefined;

      const overrides = extractOverridesFromPayload(payload);
      if (!overrides || isEmptyOverride(overrides)) {
        sendJsonResponse(res, 400, {
          success: false,
          error: "Request body must include overrides",
        });
        return;
      }

      const overrideOptions: RuntimeOverrideOptions = {
        source: "http",
        dryRun: payload.dryRun ?? false,
      };
      if (resolvedActor !== undefined) {
        overrideOptions.actor = resolvedActor;
      }
      if (mergedMetadata !== undefined) {
        overrideOptions.metadata = mergedMetadata;
      }

      const result = state.configProvider.applyRuntimeOverrides(overrides, overrideOptions);

      sendJsonResponse(res, payload.dryRun ? 200 : 202, {
        success: true,
        dryRun: result.dryRun,
        appliedOverrides: result.appliedOverrides,
        conflicts: result.conflicts,
        warnings: result.warnings,
        audit: result.audit,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("HTTP override request failed:", error);
      sendJsonResponse(res, 400, { success: false, error: message });
    }
  });

  server.on("error", (error) => {
    logger.error("HTTP override server error:", error);
  });

  server.listen(port, () => {
    const address = server.address();
    const actualPort = typeof address === "object" && address !== null ? address.port : port;
    state.httpPort = actualPort;
    logger.info(
      `HTTP configuration overrides endpoint listening on port ${actualPort} at ${state.httpPath}`
    );
  });

  state.httpServer = server;
}

export function shutdownHTTPOverridesImpl(state: HttpState): void {
  if (!state.httpServer) {
    return;
  }

  logger.info("Shutting down HTTP configuration overrides endpoint");
  state.httpServer.close((error) => {
    if (error) {
      logger.error("Error while shutting down HTTP override server:", error);
    }
  });
  state.httpServer = null;
  delete state.httpPort;
}

async function parseHttpOverridePayload(req: IncomingMessage): Promise<HttpOverridePayload> {
  const body = await readRequestBody(req);
  if (!body) {
    return {};
  }
  try {
    const parsed = JSON.parse(body);
    if (parsed === null || typeof parsed !== "object") {
      throw new Error("Payload must be a JSON object");
    }
    return parsed as HttpOverridePayload;
  } catch {
    throw new Error("Invalid JSON payload");
  }
}

function extractOverridesFromPayload(
  payload: HttpOverridePayload
): Partial<KoduckFlowConfig> | undefined {
  if (payload.overrides && !isEmptyOverride(payload.overrides)) {
    return payload.overrides;
  }

  const clone: Record<string, unknown> = { ...payload };
  delete clone.overrides;
  delete clone.actor;
  delete clone.metadata;
  delete clone.dryRun;

  if (Object.keys(clone).length === 0) {
    return undefined;
  }

  return clone as Partial<KoduckFlowConfig>;
}

function sendJsonResponse(res: ServerResponse, statusCode: number, payload: unknown): void {
  if (!res.headersSent) {
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
  }
  res.end(JSON.stringify(payload));
}

async function readRequestBody(req: IncomingMessage, maxBytes = 256 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;

    req.on("data", (chunk: Buffer | string) => {
      const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
      total += buffer.length;
      if (total > maxBytes) {
        reject(new Error("Payload too large"));
        req.destroy();
        return;
      }
      chunks.push(buffer);
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf-8"));
    });

    req.on("error", (error) => reject(error));
  });
}
