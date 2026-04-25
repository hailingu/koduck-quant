/**
 * @module src/business/workflow/memory-store
 * @description In-memory implementation of the workflow storage backend.
 * Provides fast, non-persistent storage suitable for testing and development.
 */

import {
  type WorkflowAuditQuery,
  type WorkflowAuditRecord,
  type WorkflowDefinition,
  type WorkflowRunQuery,
  type WorkflowRunRecord,
  type WorkflowRunStatus,
  type WorkflowStore,
} from "./types";

const DEFAULT_RUN_LIST_LIMIT = 200;
const DEFAULT_AUDIT_LIST_LIMIT = 500;

/**
 * In-memory implementation of the WorkflowStore interface.
 * Stores workflow definitions, run records, and audit logs in memory.
 * All data is lost when the process terminates. Suitable for testing and development.
 *
 * @class
 * @implements {WorkflowStore}
 * @example
 * const store = new InMemoryWorkflowStore();
 * const service = new WorkflowService({ store });
 */
export class InMemoryWorkflowStore implements WorkflowStore {
  private readonly definitions = new Map<string, WorkflowDefinition>();
  private readonly runs = new Map<string, WorkflowRunRecord>();
  private readonly audits: WorkflowAuditRecord[] = [];

  /**
   * Saves a workflow definition to the store (creates or replaces).
   * Creates a deep copy to prevent external mutations.
   * @param {WorkflowDefinition} definition - The workflow definition to save
   * @returns {Promise<void>}
   * @example
   * await store.saveDefinition({
   *   id: 'workflow-1',
   *   name: 'My Workflow',
   *   version: '1.0.0',
   *   steps: []
   * });
   */
  async saveDefinition(definition: WorkflowDefinition): Promise<void> {
    this.definitions.set(definition.id, { ...definition });
  }

  /**
   * Retrieves a workflow definition by ID.
   * Returns a copy to prevent external mutations.
   * @param {string} id - The ID of the workflow definition
   * @returns {Promise<WorkflowDefinition | undefined>} The definition or undefined if not found
   */
  async getDefinition(id: string): Promise<WorkflowDefinition | undefined> {
    const existing = this.definitions.get(id);
    return existing ? { ...existing } : undefined;
  }

  /**
   * Lists all stored workflow definitions.
   * Returns copies to prevent external mutations.
   * @returns {Promise<WorkflowDefinition[]>} Array of all workflow definitions
   */
  async listDefinitions(): Promise<WorkflowDefinition[]> {
    return Array.from(this.definitions.values()).map((definition) => ({ ...definition }));
  }

  /**
   * Saves a new workflow run record to the store.
   * Creates a copy to prevent external mutations.
   * @param {WorkflowRunRecord} run - The run record to save
   * @returns {Promise<void>}
   */
  async saveRun(run: WorkflowRunRecord): Promise<void> {
    this.runs.set(run.id, { ...run });
  }

  /**
   * Updates an existing workflow run record.
   * Replaces the entire run record with the provided data.
   * @param {WorkflowRunRecord} run - The updated run record
   * @returns {Promise<void>}
   * @throws {Error} If run does not exist
   */
  async updateRun(run: WorkflowRunRecord): Promise<void> {
    this.runs.set(run.id, { ...run });
  }

  /**
   * Retrieves a specific workflow run by ID.
   * Returns a copy to prevent external mutations.
   * @param {string} id - The ID of the run
   * @returns {Promise<WorkflowRunRecord | undefined>} The run record or undefined if not found
   */
  async getRun(id: string): Promise<WorkflowRunRecord | undefined> {
    const existing = this.runs.get(id);
    return existing ? { ...existing } : undefined;
  }

  /**
   * Lists workflow runs matching the specified query filters.
   * Results are sorted by creation date (newest first) and include pagination.
   * @param {WorkflowRunQuery} [filter] - Query filter options
   * @param {string} [filter.workflowId] - Filter by workflow ID
   * @param {WorkflowRunStatus} [filter.status] - Filter by status (pending, success, failed)
   * @param {string} [filter.mode] - Filter by execution mode
   * @param {number} [filter.since] - Include only runs created after this timestamp
   * @param {number} [filter.limit] - Maximum number of results (default: 200)
   * @returns {Promise<WorkflowRunRecord[]>} Matching run records sorted by creation date descending
   * @example
   * const failedRuns = await store.listRuns({
   *   workflowId: 'workflow-1',
   *   status: 'failed',
   *   limit: 50
   * });
   */
  async listRuns(filter?: WorkflowRunQuery): Promise<WorkflowRunRecord[]> {
    const { workflowId, status, mode, since, limit } = filter ?? {};
    const normalizedLimit = limit ?? DEFAULT_RUN_LIST_LIMIT;
    const results: WorkflowRunRecord[] = [];

    for (const run of this.runs.values()) {
      if (workflowId && run.workflowId !== workflowId) continue;
      if (status && run.status !== status) continue;
      if (mode && run.mode !== mode) continue;
      if (since && run.createdAt < since) continue;
      results.push({ ...run });
    }

    results.sort((a, b) => b.createdAt - a.createdAt);
    return results.slice(0, normalizedLimit);
  }

  /**
   * Appends an audit log entry to the audit trail.
   * Creates a copy to prevent external mutations.
   * @param {WorkflowAuditRecord} entry - The audit entry to record
   * @returns {Promise<void>}
   */
  async appendAudit(entry: WorkflowAuditRecord): Promise<void> {
    this.audits.push({ ...entry });
  }

  /**
   * Lists audit log entries matching the specified query filters.
   * Results are sorted by timestamp (newest first) and include pagination.
   * @param {WorkflowAuditQuery} [filter] - Query filter options
   * @param {string} [filter.workflowId] - Filter by workflow ID
   * @param {string} [filter.runId] - Filter by run ID
   * @param {WorkflowAuditRecord['type'][]} [filter.types] - Filter by event types
   * @param {string[]} [filter.actors] - Filter by actor names
   * @param {number} [filter.since] - Include only entries after this timestamp
   * @param {number} [filter.limit] - Maximum number of results (default: 500)
   * @returns {Promise<WorkflowAuditRecord[]>} Matching audit records sorted by timestamp descending
   */
  async listAudits(filter?: WorkflowAuditQuery): Promise<WorkflowAuditRecord[]> {
    const { workflowId, runId, types, actors, since, limit } = filter ?? {};
    const normalizedLimit = limit ?? DEFAULT_AUDIT_LIST_LIMIT;
    const allowedTypes = types?.length ? new Set(types) : undefined;
    const allowedActors = actors?.length ? new Set(actors) : undefined;

    const results = this.audits
      .filter((entry) => {
        if (workflowId && entry.workflowId !== workflowId) return false;
        if (runId && entry.runId !== runId) return false;
        if (allowedTypes && !allowedTypes.has(entry.type)) return false;
        if (allowedActors && entry.actor && !allowedActors.has(entry.actor)) return false;
        if (since && entry.timestamp < since) return false;
        return true;
      })
      .map((entry) => ({ ...entry }))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, normalizedLimit);

    return results;
  }
}

/**
 * Derives workflow run status counts from a list of run records.
 * Aggregates runs by status to provide overview metrics.
 * @param {WorkflowRunRecord[]} runs - Array of workflow run records
 * @returns {Record<WorkflowRunStatus, number>} Count of runs for each status
 * @example
 * const runs = await store.listRuns({ workflowId: 'workflow-1' });
 * const statusCounts = deriveRunStatus(runs);
 * console.log(`Failed: ${statusCounts.failed}, Success: ${statusCounts.success}`);
 */
export function deriveRunStatus(runs: WorkflowRunRecord[]): Record<WorkflowRunStatus, number> {
  return runs.reduce<Record<WorkflowRunStatus, number>>(
    (acc, run) => {
      acc[run.status] = (acc[run.status] ?? 0) + 1;
      return acc;
    },
    { pending: 0, success: 0, failed: 0 }
  );
}
