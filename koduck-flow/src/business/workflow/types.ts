export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type WorkflowMode = "live" | "dry-run" | "replay" | "retry";

export type WorkflowRunStatus = "pending" | "success" | "failed";

export interface WorkflowDefinition {
  id: string;
  name: string;
  version: string;
  description?: string;
  metadata?: Record<string, JsonValue>;
  adapterKey?: string;
  /** Arbitrary JSON schema or contract descriptor */
  contract?: JsonValue;
  /** Default retry policy (max attempts) */
  retryPolicy?: WorkflowRetryPolicy;
}

export interface WorkflowRetryPolicy {
  maxAttempts?: number;
  backoffMs?: number;
}

export interface WorkflowTriggerOptions {
  dryRun?: boolean;
  metadata?: Record<string, JsonValue>;
  traceId?: string;
  actor?: string;
}

export interface WorkflowReplayOptions {
  actor?: string;
  metadata?: Record<string, JsonValue>;
}

export interface WorkflowRunRecord {
  id: string;
  workflowId: string;
  mode: WorkflowMode;
  status: WorkflowRunStatus;
  attempt: number;
  payload: JsonValue;
  result?: JsonValue;
  error?: WorkflowRunError;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  metadata?: Record<string, JsonValue>;
  traceId?: string;
  actor?: string;
  parentRunId?: string;
}

export interface WorkflowRunError {
  message: string;
  code?: string;
  details?: JsonValue;
  retryable?: boolean;
}

export interface WorkflowAuditRecord {
  id: string;
  workflowId: string;
  runId?: string;
  timestamp: number;
  actor?: string;
  type: WorkflowAuditEvent;
  summary: string;
  data?: JsonValue;
}

export type WorkflowAuditEvent =
  | "workflow.registered"
  | "workflow.updated"
  | "run.triggered"
  | "run.started"
  | "run.completed"
  | "run.failed"
  | "run.retried"
  | "run.replayed"
  | "run.dry-run"
  | "audit.note";

export interface WorkflowExecutionContext {
  mode: WorkflowMode;
  attempt: number;
  runId: string;
  workflow: WorkflowDefinition;
  traceId?: string;
  actor?: string;
  metadata?: Record<string, JsonValue>;
  /** optional audit trail aggregator */
  emitAudit?: (
    event: Omit<WorkflowAuditRecord, "id" | "timestamp"> & { timestamp?: number }
  ) => void;
}

export interface WorkflowExecutionResult {
  output?: JsonValue;
  logs?: string[];
  diagnostics?: JsonValue;
}

export interface WorkflowSimulationResult extends WorkflowExecutionResult {
  steps?: Array<{
    id: string;
    name: string;
    description?: string;
    expectedDurationMs?: number;
    risk?: "low" | "medium" | "high";
  }>;
}

export interface WorkflowAdapter {
  execute(
    definition: WorkflowDefinition,
    payload: JsonValue,
    ctx: WorkflowExecutionContext
  ): Promise<WorkflowExecutionResult>;
  simulate?(
    definition: WorkflowDefinition,
    payload: JsonValue,
    ctx: WorkflowExecutionContext
  ): Promise<WorkflowSimulationResult>;
}

export interface WorkflowStore {
  saveDefinition(definition: WorkflowDefinition): Promise<void>;
  getDefinition(id: string): Promise<WorkflowDefinition | undefined>;
  listDefinitions(): Promise<Array<WorkflowDefinition>>;
  saveRun(run: WorkflowRunRecord): Promise<void>;
  updateRun(run: WorkflowRunRecord): Promise<void>;
  getRun(id: string): Promise<WorkflowRunRecord | undefined>;
  listRuns(filter?: WorkflowRunQuery): Promise<Array<WorkflowRunRecord>>;
  appendAudit(entry: WorkflowAuditRecord): Promise<void>;
  listAudits(filter?: WorkflowAuditQuery): Promise<Array<WorkflowAuditRecord>>;
}

export interface WorkflowRunQuery {
  workflowId?: string;
  status?: WorkflowRunStatus;
  mode?: WorkflowMode;
  limit?: number;
  since?: number;
}

export interface WorkflowAuditQuery {
  workflowId?: string;
  runId?: string;
  types?: WorkflowAuditEvent[];
  actors?: string[];
  since?: number;
  limit?: number;
}

export interface WorkflowServiceOptions {
  store?: WorkflowStore;
  adapters?: Record<string, WorkflowAdapter>;
  defaultAdapter?: WorkflowAdapter;
  idGenerator?: () => string;
  clock?: () => number;
}

export interface TriggerWorkflowResponse {
  run: WorkflowRunRecord;
  result?: WorkflowExecutionResult | WorkflowSimulationResult;
}
