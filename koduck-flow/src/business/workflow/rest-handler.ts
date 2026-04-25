/**
 * @module src/business/workflow/rest-handler
 * @description HTTP request handler for RESTful workflow API endpoints.
 * Provides HTTP routing, parsing, and response formatting for workflow operations.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { WorkflowService } from "./workflow-service";
import {
  type JsonValue,
  type WorkflowAuditEvent,
  type WorkflowAuditQuery,
  type WorkflowDefinition,
  type WorkflowReplayOptions,
  type WorkflowRunQuery,
  type WorkflowServiceOptions,
  type WorkflowTriggerOptions,
} from "./types";

/**
 * Configuration options for HTTP handler initialization.
 * @interface WorkflowHttpHandlerOptions
 * @property {WorkflowService} [service] - Pre-configured service instance (creates new if not provided)
 * @property {WorkflowServiceOptions} [serviceOptions] - Options for service construction
 * @property {string} [prefix] - URL path prefix for all endpoints (e.g., "/api")
 * @property {boolean} [enableCors] - Enable permissive CORS headers for local development
 * @property {Object} [logger] - Logger interface (console subset)
 */
export interface WorkflowHttpHandlerOptions {
  /** Optional pre-configured service instance. */
  service?: WorkflowService;
  /** Options used when the handler needs to construct the service. */
  serviceOptions?: WorkflowServiceOptions;
  /** Optional URL path prefix (e.g. "/api"). */
  prefix?: string;
  /** Enable permissive CORS headers for simple local development. */
  enableCors?: boolean;
  /** Optional logger interface (console subset). */
  logger?: Pick<Console, "error" | "warn" | "info">;
}

/**
 * HTTP request handler function for processing workflow API requests.
 * @callback WorkflowHttpHandler
 * @param {IncomingMessage} req - Incoming HTTP request
 * @param {ServerResponse} res - HTTP response object
 * @returns {Promise<void>}
 */
export type WorkflowHttpHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

/**
 * HTTP error with status code and optional details.
 * @class HttpError
 * @augments Error
 */
export class HttpError extends Error {
  public readonly status: number;
  public readonly details?: JsonValue;

  /**
   * Creates an HTTP error instance.
   * @param {number} status - HTTP status code
   * @param {string} message - Error message
   * @param {JsonValue} [details] - Additional error details
   */
  constructor(status: number, message: string, details?: JsonValue) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    if (details !== undefined) {
      this.details = details;
    }
  }
}

const DEFAULT_PREFIX = "";

/**
 * Normalizes URL path prefix to ensure consistent format.
 * @param {string | undefined} prefix - The prefix to normalize
 * @returns {string} Normalized prefix (empty string or "/path" format)
 */
function normalizePrefix(prefix: string | undefined): string {
  if (!prefix) {
    return DEFAULT_PREFIX;
  }
  if (prefix === "/") {
    return "";
  }
  return prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
}

function sendJson(
  res: ServerResponse,
  status: number,
  payload: JsonValue | { [key: string]: JsonValue | JsonValue[] }
): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function sendEmpty(res: ServerResponse, status: number): void {
  res.statusCode = status;
  res.end();
}

async function parseJsonBody<T = unknown>(req: IncomingMessage): Promise<T> {
  const chunks: Array<string> = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
  }
  const raw = chunks.join("");
  if (!raw) {
    return {} as T;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new HttpError(400, "Invalid JSON body", { raw });
  }
}

function numberFromQuery(value: string | null): number | undefined {
  if (value === null) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const RUN_STATUSES = ["pending", "success", "failed"] as const;
function isWorkflowRunStatus(value: string): value is (typeof RUN_STATUSES)[number] {
  return (RUN_STATUSES as readonly string[]).includes(value);
}

const WORKFLOW_MODES = ["live", "dry-run", "replay", "retry"] as const;
function isWorkflowMode(value: string): value is (typeof WORKFLOW_MODES)[number] {
  return (WORKFLOW_MODES as readonly string[]).includes(value);
}

const AUDIT_EVENTS: readonly WorkflowAuditEvent[] = [
  "workflow.registered",
  "workflow.updated",
  "run.triggered",
  "run.started",
  "run.completed",
  "run.failed",
  "run.retried",
  "run.replayed",
  "run.dry-run",
  "audit.note",
] as const;
function isWorkflowAuditEvent(value: string): value is WorkflowAuditEvent {
  return (AUDIT_EVENTS as readonly string[]).includes(value);
}

function parseRunQuery(url: URL): WorkflowRunQuery | undefined {
  const filter: WorkflowRunQuery = {};
  const workflowId = url.searchParams.get("workflowId");
  if (workflowId) {
    filter.workflowId = workflowId;
  }
  const status = url.searchParams.get("status");
  if (status && isWorkflowRunStatus(status)) {
    filter.status = status;
  }
  const mode = url.searchParams.get("mode");
  if (mode && isWorkflowMode(mode)) {
    filter.mode = mode;
  }
  const limit = numberFromQuery(url.searchParams.get("limit"));
  if (typeof limit === "number") {
    filter.limit = limit;
  }
  const since = numberFromQuery(url.searchParams.get("since"));
  if (typeof since === "number") {
    filter.since = since;
  }
  return Object.keys(filter).length ? filter : undefined;
}

function parseAuditQuery(url: URL): WorkflowAuditQuery | undefined {
  const query: WorkflowAuditQuery = {};
  const workflowId = url.searchParams.get("workflowId");
  if (workflowId) {
    query.workflowId = workflowId;
  }
  const runId = url.searchParams.get("runId");
  if (runId) {
    query.runId = runId;
  }
  const types = url.searchParams.get("types");
  if (types) {
    const parsed = types
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry): entry is WorkflowAuditEvent => isWorkflowAuditEvent(entry));
    if (parsed.length > 0) {
      query.types = parsed;
    }
  }
  const limit = numberFromQuery(url.searchParams.get("limit"));
  if (typeof limit === "number") {
    query.limit = limit;
  }
  const since = numberFromQuery(url.searchParams.get("since"));
  if (typeof since === "number") {
    query.since = since;
  }
  return Object.keys(query).length ? query : undefined;
}

function buildTriggerOptions(body: Record<string, unknown>): WorkflowTriggerOptions | undefined {
  const options: WorkflowTriggerOptions = {};
  if (typeof body.dryRun === "boolean") {
    options.dryRun = body.dryRun;
  }
  if (body.metadata && typeof body.metadata === "object") {
    options.metadata = body.metadata as Record<string, JsonValue>;
  }
  if (typeof body.traceId === "string") {
    options.traceId = body.traceId;
  }
  if (typeof body.actor === "string") {
    options.actor = body.actor;
  }
  return Object.keys(options).length ? options : undefined;
}

function buildReplayOptions(body: Record<string, unknown>): WorkflowReplayOptions | undefined {
  const options: WorkflowReplayOptions = {};
  if (body.metadata && typeof body.metadata === "object") {
    options.metadata = body.metadata as Record<string, JsonValue>;
  }
  if (typeof body.actor === "string") {
    options.actor = body.actor;
  }
  return Object.keys(options).length ? options : undefined;
}

interface RouteContext {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  method: string;
  path: string;
  service: WorkflowService;
}

type RouteHandler = (context: RouteContext) => Promise<void>;
type DynamicRouteHandler = (context: RouteContext, match: RegExpExecArray) => Promise<void>;

const staticRoutes: Record<string, RouteHandler> = {
  "GET /workflows": async ({ res, service }) => {
    const definitions = await service.listWorkflows();
    sendJson(res, 200, { workflows: definitions as unknown as JsonValue });
  },
  "POST /workflows": async ({ req, res, service }) => {
    const body = await parseJsonBody<WorkflowDefinition>(req);
    if (!body || typeof body !== "object" || !body.id || !body.name || !body.version) {
      throw new HttpError(400, "Workflow definition requires id, name, and version");
    }
    await service.registerWorkflow(body);
    sendJson(res, 201, body as unknown as JsonValue);
  },
  "GET /runs": async ({ res, service, url }) => {
    const filter = parseRunQuery(url);
    const runs = await service.listRuns(filter);
    sendJson(res, 200, { runs: runs as unknown as JsonValue });
  },
  "GET /audits": async ({ res, service, url }) => {
    const filter = parseAuditQuery(url);
    const audits = await service.listAudits(filter);
    sendJson(res, 200, { audits: audits as unknown as JsonValue });
  },
};

const dynamicRoutes: Array<{ method: string; pattern: RegExp; handler: DynamicRouteHandler }> = [
  {
    method: "GET",
    pattern: /^\/workflows\/(.+?)\/trigger$/,
    handler: async () => {
      throw new HttpError(405, "Trigger endpoint requires POST");
    },
  },
  {
    method: "POST",
    pattern: /^\/workflows\/(.+?)\/trigger$/,
    handler: async ({ req, res, service }, match) => {
      const workflowId = decodeURIComponent(match[1]);
      const body = await parseJsonBody<Record<string, unknown>>(req);
      if (!("payload" in body)) {
        throw new HttpError(400, "Trigger request requires payload field");
      }
      const options = buildTriggerOptions(body);
      const response = await service.triggerWorkflow(
        workflowId,
        (body as { payload: JsonValue }).payload,
        options
      );
      sendJson(res, 202, response as unknown as JsonValue);
    },
  },
  {
    method: "GET",
    pattern: /^\/workflows\/(.+)$/, // matches /workflows/:id
    handler: async ({ res, service }, match) => {
      const workflowId = decodeURIComponent(match[1]);
      if (!workflowId) {
        throw new HttpError(400, "Missing workflow identifier");
      }
      const definition = await service.getWorkflow(workflowId);
      if (!definition) {
        throw new HttpError(404, `Workflow '${workflowId}' not found`);
      }
      sendJson(res, 200, definition as unknown as JsonValue);
    },
  },
  {
    method: "GET",
    pattern: /^\/runs\/(.+)$/,
    handler: async ({ res, service }, match) => {
      const runId = decodeURIComponent(match[1]);
      if (!runId) {
        throw new HttpError(400, "Missing run identifier");
      }
      const run = await service.getRun(runId);
      if (!run) {
        throw new HttpError(404, `Run '${runId}' not found`);
      }
      sendJson(res, 200, run as unknown as JsonValue);
    },
  },
  {
    method: "POST",
    pattern: /^\/runs\/(.+?)\/retry$/,
    handler: async ({ req, res, service }, match) => {
      const runId = decodeURIComponent(match[1]);
      if (!runId) {
        throw new HttpError(400, "Missing run identifier");
      }
      const body = await parseJsonBody<Record<string, unknown>>(req);
      const options = buildReplayOptions(body);
      const response = await service.retryRun(runId, options);
      sendJson(res, 202, response as unknown as JsonValue);
    },
  },
  {
    method: "POST",
    pattern: /^\/runs\/(.+?)\/replay$/,
    handler: async ({ req, res, service }, match) => {
      const runId = decodeURIComponent(match[1]);
      if (!runId) {
        throw new HttpError(400, "Missing run identifier");
      }
      const body = await parseJsonBody<Record<string, unknown>>(req);
      const options = buildReplayOptions(body);
      const response = await service.replayFailure(runId, options);
      sendJson(res, 202, response as unknown as JsonValue);
    },
  },
];

function normalizePathname(path: string): string {
  if (path === "/") {
    return path;
  }
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

async function dispatchWorkflowRequest(context: RouteContext): Promise<void> {
  const handler = staticRoutes[`${context.method} ${context.path}`];
  if (handler) {
    await handler(context);
    return;
  }

  for (const route of dynamicRoutes) {
    if (route.method !== context.method) {
      continue;
    }
    const match = route.pattern.exec(context.path);
    if (match) {
      await route.handler(context, match);
      return;
    }
  }

  throw new HttpError(404, "Route not found");
}

/**
 * Creates an HTTP request handler for the workflow REST API.
 * The handler implements routing for workflow CRUD operations, execution, and audit operations.
 * @param {WorkflowHttpHandlerOptions} [options] - Handler configuration
 * @param {WorkflowService} [options.service] - Pre-configured workflow service
 * @param {WorkflowServiceOptions} [options.serviceOptions] - Options for creating new service
 * @param {string} [options.prefix] - URL path prefix for all endpoints
 * @param {boolean} [options.enableCors] - Enable CORS headers for local development
 * @param {Object} [options.logger] - Logger for error logging
 * @returns {WorkflowHttpHandler} HTTP request handler function
 * @example
 * const handler = createWorkflowHttpHandler({
 *   prefix: '/api/workflows',
 *   enableCors: true
 * });
 *
 * // Use with Node HTTP server
 * const server = http.createServer(handler);
 * server.listen(3000);
 */
export function createWorkflowHttpHandler(
  options?: WorkflowHttpHandlerOptions
): WorkflowHttpHandler {
  const prefix = normalizePrefix(options?.prefix);
  const service = options?.service ?? new WorkflowService(options?.serviceOptions);
  const logger = options?.logger;
  const enableCors = options?.enableCors ?? false;

  return async (req, res) => {
    const method = (req.method ?? "GET").toUpperCase();
    const url = new URL(req.url ?? "", "http://localhost");

    if (prefix && !url.pathname.startsWith(prefix)) {
      sendJson(res, 404, { error: "Not Found" });
      return;
    }

    const rawPath = prefix ? url.pathname.slice(prefix.length) || "/" : url.pathname;
    const path = normalizePathname(rawPath);

    if (enableCors) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      if (method === "OPTIONS") {
        sendEmpty(res, 204);
        return;
      }
    }

    try {
      await dispatchWorkflowRequest({ req, res, url, method, path, service });
    } catch (error) {
      if (error instanceof HttpError) {
        if (error.details) {
          sendJson(res, error.status, { error: error.message, details: error.details });
        } else {
          sendJson(res, error.status, { error: error.message });
        }
        return;
      }
      logger?.error?.("workflow http handler error", error);
      sendJson(res, 500, { error: "Internal Server Error" });
    }
  };
}
