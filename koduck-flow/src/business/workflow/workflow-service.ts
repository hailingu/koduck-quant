/**
 * @module src/business/workflow/workflow-service
 * @description Workflow execution service for orchestrating workflow definitions and run lifecycle management.
 * Provides APIs for registering workflows, triggering executions, retrying failed runs, and auditing.
 */

import {
  type JsonValue,
  type TriggerWorkflowResponse,
  type WorkflowAdapter,
  type WorkflowAuditQuery,
  type WorkflowDefinition,
  type WorkflowExecutionContext,
  type WorkflowExecutionResult,
  type WorkflowMode,
  type WorkflowReplayOptions,
  type WorkflowRunQuery,
  type WorkflowRunRecord,
  type WorkflowRunError,
  type WorkflowServiceOptions,
  type WorkflowTriggerOptions,
  type WorkflowSimulationResult,
  type WorkflowAuditRecord,
  type WorkflowStore,
} from "./types";
import { InMemoryWorkflowStore } from "./memory-store";

/**
 * Generates a unique workflow run ID.
 * Uses the native crypto.randomUUID when available, otherwise falls back to timestamp-based generation.
 * @returns A unique identifier string
 * @example
 * const id = defaultIdGenerator(); // 'wf_abc123def456'
 */
function defaultIdGenerator(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `wf_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

/**
 * Returns the current timestamp in milliseconds.
 * Can be overridden in WorkflowService options for testing purposes.
 * @returns Current time in milliseconds since epoch
 */
function defaultClock(): number {
  return Date.now();
}

/**
 * Audit log entry details for workflow or run events.
 * @typedef {Object} AuditInput
 * @property {string} workflowId - ID of the workflow being audited
 * @property {string} [runId] - ID of the workflow run (optional)
 * @property {WorkflowAuditRecord['type']} type - Type of audit event
 * @property {string} summary - Brief description of the event
 * @property {unknown} [data] - Additional data associated with the event
 * @property {string} [actor] - User or system performing the action
 * @property {number} [timestamp] - Event timestamp in milliseconds
 */
type AuditInput = {
  workflowId: string;
  runId?: string;
  type: WorkflowAuditRecord["type"];
  summary: string;
  data?: unknown;
  actor?: string;
  timestamp?: number;
};

/**
 * Initial setup parameters for creating a new workflow run.
 * @typedef {Object} RunInitialization
 * @property {WorkflowMode} mode - Execution mode (live, dry-run, retry, replay)
 * @property {number} attempt - Attempt number for this run
 * @property {string} [parentRunId] - ID of parent run for retry/replay operations
 * @property {Record<string, JsonValue>} [metadata] - Custom metadata attached to the run
 * @property {string} [actor] - User or system triggering the run
 * @property {string} [traceId] - Distributed trace ID for observability
 */
type RunInitialization = {
  mode: WorkflowMode;
  attempt: number;
  parentRunId?: string;
  metadata?: Record<string, JsonValue>;
  actor?: string;
  traceId?: string;
};

/**
 * Service for managing workflow definitions and executions.
 * Handles registration, execution, and auditing of workflow runs with support for
 * multiple execution modes (live, dry-run, retry, replay) and custom adapters.
 * @class
 * @example
 * const service = new WorkflowService({
 *   store: new InMemoryWorkflowStore(),
 *   defaultAdapter: new CustomWorkflowAdapter()
 * });
 * await service.registerWorkflow(myWorkflowDefinition);
 * const response = await service.triggerWorkflow('workflow-id', { data: 'payload' });
 */
export class WorkflowService {
  private readonly store: WorkflowStore;
  private readonly adapters = new Map<string, WorkflowAdapter>();
  private defaultAdapter: WorkflowAdapter;
  private readonly idGenerator: () => string;
  private readonly clock: () => number;

  /**
   * Creates a new WorkflowService instance.
   * @param {WorkflowServiceOptions} [options] - Service configuration options
   * @param {WorkflowStore} [options.store] - Custom storage backend (defaults to InMemoryWorkflowStore)
   * @param {Record<string, WorkflowAdapter>} [options.adapters] - Named workflow adapters
   * @param {WorkflowAdapter} [options.defaultAdapter] - Default adapter for workflow execution
   * @param {() => string} [options.idGenerator] - Custom ID generator function
   * @param {() => number} [options.clock] - Custom clock function for timestamps
   * @example
   * const service = new WorkflowService({
   *   store: myCustomStore,
   *   idGenerator: () => generateUUID(),
   *   clock: () => Date.now()
   * });
   */
  constructor(options?: WorkflowServiceOptions) {
    this.store = options?.store ?? new InMemoryWorkflowStore();
    if (options?.adapters) {
      for (const [key, adapter] of Object.entries(options.adapters)) {
        this.adapters.set(key, adapter);
      }
    }
    this.defaultAdapter = options?.defaultAdapter ?? new PassThroughWorkflowAdapter();
    this.idGenerator = options?.idGenerator ?? defaultIdGenerator;
    this.clock = options?.clock ?? defaultClock;
  }

  /**
   * Registers or updates a workflow definition in the service.
   * Automatically determines whether this is a new registration or an update and records
   * the appropriate audit event.
   * @param {WorkflowDefinition} definition - The workflow definition to register
   * @returns {Promise<void>}
   * @throws {Error} If the definition is invalid or storage fails
   * @example
   * const definition = {
   *   id: 'workflow-1',
   *   name: 'My Workflow',
   *   version: '1.0.0',
   *   steps: [...]
   * };
   * await service.registerWorkflow(definition);
   */
  async registerWorkflow(definition: WorkflowDefinition): Promise<void> {
    const existing = await this.store.getDefinition(definition.id);
    await this.store.saveDefinition(definition);

    await this.appendAudit({
      workflowId: definition.id,
      type: existing ? "workflow.updated" : "workflow.registered",
      summary: `${definition.name}#${definition.version}`,
      data: definition.metadata,
    });
  }

  /**
   * Lists all registered workflow definitions in the service.
   * @returns {Promise<WorkflowDefinition[]>} Array of all workflow definitions
   * @example
   * const workflows = await service.listWorkflows();
   * workflows.forEach(wf => console.log(wf.name));
   */
  listWorkflows(): Promise<WorkflowDefinition[]> {
    return this.store.listDefinitions();
  }

  /**
   * Retrieves a specific workflow definition by ID.
   * @param {string} id - The ID of the workflow definition to retrieve
   * @returns {Promise<WorkflowDefinition | undefined>} The workflow definition or undefined if not found
   * @example
   * const definition = await service.getWorkflow('workflow-1');
   * if (definition) {
   *   console.log(definition.name);
   * }
   */
  getWorkflow(id: string): Promise<WorkflowDefinition | undefined> {
    return this.store.getDefinition(id);
  }

  /**
   * Triggers the execution of a workflow with the given payload.
   * Creates a new workflow run and executes it according to the workflow definition.
   * @param {string} workflowId - ID of the workflow to execute
   * @param {unknown} payload - Input data for the workflow execution
   * @param {WorkflowTriggerOptions} [options] - Execution options
   * @param {boolean} [options.dryRun] - If true, simulates execution without persistence
   * @param {Record<string, JsonValue>} [options.metadata] - Custom metadata for this run
   * @param {string} [options.actor] - User or system triggering the workflow
   * @param {string} [options.traceId] - Distributed trace ID for observability
   * @returns {Promise<TriggerWorkflowResponse>} Response containing run status and result
   * @throws {Error} If workflow not found or execution fails
   * @example
   * const response = await service.triggerWorkflow('workflow-1', { userId: '123' }, {
   *   actor: 'user@example.com',
   *   traceId: 'trace-xyz'
   * });
   * console.log(response.runId, response.status);
   */
  async triggerWorkflow(
    workflowId: string,
    payload: unknown,
    options?: WorkflowTriggerOptions
  ): Promise<TriggerWorkflowResponse> {
    const definition = await this.requireDefinition(workflowId);
    const mode: WorkflowMode = options?.dryRun ? "dry-run" : "live";
    const init: RunInitialization = {
      mode,
      attempt: 1,
    };
    if (options?.metadata) {
      init.metadata = options.metadata;
    }
    if (options?.actor) {
      init.actor = options.actor;
    }
    if (options?.traceId) {
      init.traceId = options.traceId;
    }
    return this.createAndExecuteRun(definition, payload, init);
  }

  /**
   * Retries a failed workflow run with an incremented attempt number.
   * Respects the workflow's retry policy and maintains parent run tracking.
   * @param {string} runId - ID of the run to retry
   * @param {WorkflowReplayOptions} [options] - Retry options
   * @param {Record<string, JsonValue>} [options.metadata] - Optional metadata override (uses original if not provided)
   * @param {string} [options.actor] - User or system triggering the retry
   * @returns {Promise<TriggerWorkflowResponse>} Response of the new retry run
   * @throws {Error} If run not found, max retries exceeded, or execution fails
   * @example
   * const retryResponse = await service.retryRun('run-123', {
   *   actor: 'admin@example.com'
   * });
   * console.log('Retry run ID:', retryResponse.runId);
   */
  async retryRun(runId: string, options?: WorkflowReplayOptions): Promise<TriggerWorkflowResponse> {
    const run = await this.requireRun(runId);
    const definition = await this.requireDefinition(run.workflowId);

    const nextAttempt = run.attempt + 1;
    const maxAttempts = definition.retryPolicy?.maxAttempts;
    if (typeof maxAttempts === "number" && nextAttempt > maxAttempts) {
      throw new Error(`Retry attempts exceeded for workflow ${definition.id}`);
    }

    const init: RunInitialization = {
      mode: "retry",
      attempt: nextAttempt,
      parentRunId: run.parentRunId ?? run.id,
    };
    const metadata = options?.metadata ?? run.metadata;
    if (metadata) {
      init.metadata = metadata;
    }
    if (options?.actor) {
      init.actor = options.actor;
    }
    if (run.traceId) {
      init.traceId = run.traceId;
    }
    return this.createAndExecuteRun(definition, run.payload, init);
  }

  /**
   * Replays a failed workflow run with the same execution context and input payload.
   * Used for debugging and recovery without incrementing attempt count.
   * @param {string} runId - ID of the failed run to replay
   * @param {WorkflowReplayOptions} [options] - Replay options
   * @param {Record<string, JsonValue>} [options.metadata] - Optional metadata override
   * @param {string} [options.actor] - User or system triggering the replay
   * @returns {Promise<TriggerWorkflowResponse>} Response of the replay run
   * @throws {Error} If run not found, run is not in failed status, or execution fails
   * @example
   * const replayResponse = await service.replayFailure('run-123', {
   *   metadata: { debugMode: true }
   * });
   */
  async replayFailure(
    runId: string,
    options?: WorkflowReplayOptions
  ): Promise<TriggerWorkflowResponse> {
    const run = await this.requireRun(runId);
    if (run.status !== "failed") {
      throw new Error(`Can only replay failed runs. Current status: ${run.status}`);
    }
    const definition = await this.requireDefinition(run.workflowId);

    const init: RunInitialization = {
      mode: "replay",
      attempt: run.attempt,
      parentRunId: run.parentRunId ?? run.id,
    };
    const metadata = options?.metadata ?? run.metadata;
    if (metadata) {
      init.metadata = metadata;
    }
    if (options?.actor) {
      init.actor = options.actor;
    }
    if (run.traceId) {
      init.traceId = run.traceId;
    }
    return this.createAndExecuteRun(definition, run.payload, init);
  }

  /**
   * Retrieves a specific workflow run by ID.
   * @param {string} runId - ID of the run to retrieve
   * @returns {Promise<WorkflowRunRecord | undefined>} The run record or undefined if not found
   * @example
   * const run = await service.getRun('run-123');
   * if (run) {
   *   console.log('Status:', run.status);
   * }
   */
  getRun(runId: string): Promise<WorkflowRunRecord | undefined> {
    return this.store.getRun(runId);
  }

  /**
   * Lists workflow runs matching the specified filter criteria.
   * @param {WorkflowRunQuery} [filter] - Query filter options
   * @param {string} [filter.workflowId] - Filter by workflow ID
   * @param {WorkflowRunStatus} [filter.status] - Filter by run status (pending, success, failed)
   * @param {WorkflowMode} [filter.mode] - Filter by execution mode
   * @param {number} [filter.since] - Filter runs created after this timestamp
   * @param {number} [filter.limit] - Maximum number of results to return
   * @returns {Promise<WorkflowRunRecord[]>} Array of matching workflow runs
   * @example
   * const recentRuns = await service.listRuns({
   *   workflowId: 'workflow-1',
   *   status: 'failed',
   *   limit: 10
   * });
   */
  listRuns(filter?: WorkflowRunQuery): Promise<WorkflowRunRecord[]> {
    return this.store.listRuns(filter);
  }

  /**
   * Lists audit log entries matching the specified filter criteria.
   * Provides history of all workflow and run events.
   * @param {WorkflowAuditQuery} [filter] - Query filter options
   * @param {string} [filter.workflowId] - Filter by workflow ID
   * @param {string} [filter.runId] - Filter by run ID
   * @param {WorkflowAuditRecord['type'][]} [filter.types] - Filter by event types
   * @param {string[]} [filter.actors] - Filter by actors
   * @param {number} [filter.since] - Filter entries after this timestamp
   * @param {number} [filter.limit] - Maximum number of results to return
   * @returns {Promise<WorkflowAuditRecord[]>} Array of audit records
   * @example
   * const auditTrail = await service.listAudits({
   *   workflowId: 'workflow-1',
   *   types: ['run.triggered', 'run.completed'],
   *   limit: 50
   * });
   */
  listAudits(filter?: WorkflowAuditQuery): Promise<WorkflowAuditRecord[]> {
    return this.store.listAudits(filter);
  }

  /**
   * Registers a named workflow adapter.
   * Adapters customize workflow execution behavior for different use cases.
   * @param {string} key - Unique identifier for the adapter
   * @param {WorkflowAdapter} adapter - The adapter instance to register
   * @example
   * const customAdapter = new CustomWorkflowAdapter();
   * service.attachAdapter('custom', customAdapter);
   */
  attachAdapter(key: string, adapter: WorkflowAdapter): void {
    this.adapters.set(key, adapter);
  }

  /**
   * Sets the default workflow adapter used when no specific adapter is specified.
   * @param {WorkflowAdapter} adapter - The adapter to use as default
   * @example
   * service.setDefaultAdapter(new ParallelWorkflowAdapter());
   */
  setDefaultAdapter(adapter: WorkflowAdapter): void {
    this.defaultAdapter = adapter;
  }

  private async createAndExecuteRun(
    definition: WorkflowDefinition,
    payload: unknown,
    init: RunInitialization
  ): Promise<TriggerWorkflowResponse> {
    const run: WorkflowRunRecord = {
      id: this.idGenerator(),
      workflowId: definition.id,
      mode: init.mode,
      status: "pending",
      attempt: init.attempt,
      payload: this.toJsonValue(payload),
      createdAt: this.clock(),
    };

    if (init.metadata) {
      run.metadata = this.cloneMetadata(init.metadata);
    }
    if (init.actor) {
      run.actor = init.actor;
    }
    if (init.traceId) {
      run.traceId = init.traceId;
    }
    if (init.parentRunId) {
      run.parentRunId = init.parentRunId;
    }

    await this.store.saveRun(run);
    const auditData: Record<string, JsonValue> = { attempt: run.attempt };
    if (run.metadata) {
      auditData.metadata = run.metadata;
    }
    const auditInput: AuditInput = {
      workflowId: definition.id,
      runId: run.id,
      type: "run.triggered",
      summary: `${definition.name} mode=${run.mode}`,
      data: auditData,
    };
    if (run.actor) {
      auditInput.actor = run.actor;
    }
    await this.appendAudit(auditInput);

    if (run.mode === "dry-run") {
      const dryRunAudit: AuditInput = {
        workflowId: definition.id,
        runId: run.id,
        type: "run.dry-run",
        summary: "Dry run scheduled",
      };
      if (run.actor) {
        dryRunAudit.actor = run.actor;
      }
      await this.appendAudit(dryRunAudit);
    }

    return this.executeRun(definition, run);
  }

  private async executeRun(
    definition: WorkflowDefinition,
    run: WorkflowRunRecord
  ): Promise<TriggerWorkflowResponse> {
    const adapter = this.resolveAdapter(definition);
    const context = this.createExecutionContext(definition, run);

    run.startedAt = this.clock();
    await this.store.updateRun(run);
    const startedAudit: AuditInput = {
      workflowId: definition.id,
      runId: run.id,
      type: "run.started",
      summary: `Run started (mode=${run.mode}, attempt=${run.attempt})`,
    };
    if (run.actor) {
      startedAudit.actor = run.actor;
    }
    await this.appendAudit(startedAudit);

    try {
      let result: WorkflowExecutionResult | WorkflowSimulationResult;
      if (run.mode === "dry-run") {
        if (adapter.simulate) {
          result = await adapter.simulate(definition, run.payload, context);
        } else {
          result = { logs: ["Dry run fallback executed"], output: run.payload };
        }
      } else {
        result = await adapter.execute(definition, run.payload, context);
      }

      run.status = "success";
      if (result.output !== undefined) {
        run.result = this.toJsonValue(result.output);
      }
      run.finishedAt = this.clock();
      await this.store.updateRun(run);

      const completedAuditData: Record<string, JsonValue> = {
        status: run.status,
        mode: run.mode,
      };
      const completedAudit: AuditInput = {
        workflowId: definition.id,
        runId: run.id,
        type: "run.completed",
        summary: `Run completed in ${run.finishedAt - (run.startedAt ?? run.createdAt)}ms`,
        data: completedAuditData,
      };
      if (run.actor) {
        completedAudit.actor = run.actor;
      }
      await this.appendAudit(completedAudit);

      return { run: { ...run }, result };
    } catch (error) {
      const normalized = this.normalizeError(error);
      run.status = "failed";
      run.error = normalized;
      run.finishedAt = this.clock();
      await this.store.updateRun(run);

      let failureType: WorkflowAuditRecord["type"];
      if (run.mode === "replay") {
        failureType = "run.replayed";
      } else if (run.mode === "retry") {
        failureType = "run.retried";
      } else {
        failureType = "run.failed";
      }

      const failureAudit: AuditInput = {
        workflowId: definition.id,
        runId: run.id,
        type: failureType,
        summary: `Run ${run.status}: ${normalized.message}`,
        data: normalized,
      };
      if (run.actor) {
        failureAudit.actor = run.actor;
      }
      await this.appendAudit(failureAudit);

      if (run.mode === "live" || run.mode === "dry-run") {
        const failureSummaryAudit: AuditInput = {
          workflowId: definition.id,
          runId: run.id,
          type: "run.failed",
          summary: `Run failed (attempt=${run.attempt})`,
          data: normalized,
        };
        if (run.actor) {
          failureSummaryAudit.actor = run.actor;
        }
        await this.appendAudit(failureSummaryAudit);
      }

      return { run: { ...run } };
    }
  }

  private createExecutionContext(
    definition: WorkflowDefinition,
    run: WorkflowRunRecord
  ): WorkflowExecutionContext {
    const context: WorkflowExecutionContext = {
      mode: run.mode,
      attempt: run.attempt,
      runId: run.id,
      workflow: definition,
      emitAudit: (event) => {
        const auditRecord: AuditInput = {
          workflowId: definition.id,
          runId: run.id,
          type: event.type,
          summary: event.summary,
          data: event.data,
        };
        if (typeof event.timestamp === "number") {
          auditRecord.timestamp = event.timestamp;
        }
        const actor = event.actor ?? run.actor;
        if (actor) {
          auditRecord.actor = actor;
        }
        void this.appendAudit(auditRecord);
      },
    };

    if (run.traceId) {
      context.traceId = run.traceId;
    }
    if (run.actor) {
      context.actor = run.actor;
    }
    if (run.metadata) {
      context.metadata = run.metadata;
    }

    return context;
  }

  private resolveAdapter(definition: WorkflowDefinition): WorkflowAdapter {
    if (definition.adapterKey) {
      const adapter = this.adapters.get(definition.adapterKey);
      if (!adapter) {
        throw new Error(`Missing workflow adapter '${definition.adapterKey}'`);
      }
      return adapter;
    }
    return this.defaultAdapter;
  }

  private async appendAudit(entry: AuditInput): Promise<void> {
    const normalized: WorkflowAuditRecord = {
      id: this.idGenerator(),
      timestamp: entry.timestamp ?? this.clock(),
      workflowId: entry.workflowId,
      type: entry.type,
      summary: entry.summary,
    };
    if (entry.runId) {
      normalized.runId = entry.runId;
    }
    if (entry.actor) {
      normalized.actor = entry.actor;
    }
    if (entry.data !== undefined) {
      normalized.data = this.toJsonValue(entry.data);
    }
    await this.store.appendAudit(normalized);
  }

  private normalizeError(error: unknown): WorkflowRunError {
    if (!error) {
      return { message: "Unknown error" };
    }

    if (error instanceof Error) {
      const enriched = error as Error & { code?: string; retryable?: boolean; details?: unknown };
      const normalized: WorkflowRunError = { message: enriched.message };
      if (typeof enriched.code === "string") {
        normalized.code = enriched.code;
      }
      if (typeof enriched.retryable === "boolean") {
        normalized.retryable = enriched.retryable;
      }
      if (enriched.details !== undefined) {
        normalized.details = this.toJsonValue(enriched.details);
      }
      return normalized;
    }

    if (typeof error === "object") {
      const record = error as {
        message?: unknown;
        code?: unknown;
        retryable?: unknown;
        details?: unknown;
      };
      const normalized: WorkflowRunError = {
        message: typeof record.message === "string" ? record.message : JSON.stringify(record),
      };
      if (typeof record.code === "string") {
        normalized.code = record.code;
      }
      if (typeof record.retryable === "boolean") {
        normalized.retryable = record.retryable;
      }
      if (record.details !== undefined) {
        normalized.details = this.toJsonValue(record.details);
      }
      return normalized;
    }

    return { message: String(error) };
  }

  private async requireDefinition(workflowId: string): Promise<WorkflowDefinition> {
    const definition = await this.store.getDefinition(workflowId);
    if (!definition) {
      throw new Error(`Workflow '${workflowId}' is not registered`);
    }
    return definition;
  }

  private async requireRun(runId: string): Promise<WorkflowRunRecord> {
    const run = await this.store.getRun(runId);
    if (!run) {
      throw new Error(`Workflow run '${runId}' not found`);
    }
    return run;
  }

  private toJsonValue(value: unknown): JsonValue {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.toJsonValue(item));
    }
    if (typeof value === "object") {
      const result: Record<string, JsonValue> = {};
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        result[key] = this.toJsonValue(val);
      }
      return result;
    }
    return String(value);
  }

  private cloneMetadata(metadata: Record<string, JsonValue>): Record<string, JsonValue> {
    const result: Record<string, JsonValue> = {};
    for (const [key, value] of Object.entries(metadata)) {
      result[key] = this.toJsonValue(value);
    }
    return result;
  }
}

class PassThroughWorkflowAdapter implements WorkflowAdapter {
  async execute(): Promise<WorkflowExecutionResult> {
    return { logs: ["No adapter registered. Execution skipped."], diagnostics: { skipped: true } };
  }

  async simulate(): Promise<WorkflowSimulationResult> {
    return {
      logs: ["No adapter registered. Simulation performed."],
      diagnostics: { skipped: true },
      steps: [],
    };
  }
}
