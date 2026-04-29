/**
 * Memory Store unit tests
 *
 * Tests in-memory storage implementation: workflow definitions, run records, and audit records management
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  InMemoryWorkflowStore,
  deriveRunStatus,
} from "../../../src/business/workflow/memory-store";
import type {
  WorkflowDefinition,
  WorkflowRunRecord,
  WorkflowAuditRecord,
  WorkflowRunQuery,
  WorkflowAuditQuery,
} from "../../../src/business/workflow/types";

describe("InMemoryWorkflowStore", () => {
  let store: InMemoryWorkflowStore;

  const mockDefinition: WorkflowDefinition = {
    id: "test-workflow",
    name: "Test Workflow",
    version: "1.0.0",
    description: "A test workflow",
    adapterKey: "test-adapter",
    retryPolicy: { maxAttempts: 3 },
    metadata: { key: "value" },
  };

  const mockRun: WorkflowRunRecord = {
    id: "run-123",
    workflowId: "test-workflow",
    mode: "live",
    status: "pending",
    attempt: 1,
    payload: { input: "test" },
    createdAt: 1000,
    startedAt: 1001,
    finishedAt: 1002,
    result: { output: "success" },
    metadata: { key: "value" },
    actor: "test-user",
    traceId: "trace-123",
  };

  const mockAudit: WorkflowAuditRecord = {
    id: "audit-1",
    timestamp: 1234567890,
    workflowId: "test-workflow",
    type: "workflow.registered",
    summary: "Workflow registered",
    runId: "run-123",
    actor: "test-user",
    data: { key: "value" },
  };

  beforeEach(() => {
    store = new InMemoryWorkflowStore();
  });

  describe("workflow definitions", () => {
    it("should save and retrieve workflow definition", async () => {
      await store.saveDefinition(mockDefinition);

      const retrieved = await store.getDefinition("test-workflow");

      expect(retrieved).toEqual(mockDefinition);
      expect(retrieved).not.toBe(mockDefinition); // Should return a copy
    });

    it("should return undefined for non-existent definition", async () => {
      const retrieved = await store.getDefinition("non-existent");

      expect(retrieved).toBeUndefined();
    });

    it("should list all workflow definitions", async () => {
      const definition2 = { ...mockDefinition, id: "workflow-2", name: "Workflow 2" };

      await store.saveDefinition(mockDefinition);
      await store.saveDefinition(definition2);

      const definitions = await store.listDefinitions();

      expect(definitions).toHaveLength(2);
      expect(definitions).toContainEqual(mockDefinition);
      expect(definitions).toContainEqual(definition2);
      expect(definitions[0]).not.toBe(mockDefinition); // Should return copies
    });

    it("should overwrite existing definition", async () => {
      const updatedDefinition = { ...mockDefinition, name: "Updated Workflow" };

      await store.saveDefinition(mockDefinition);
      await store.saveDefinition(updatedDefinition);

      const retrieved = await store.getDefinition("test-workflow");

      expect(retrieved?.name).toBe("Updated Workflow");
    });
  });

  describe("workflow runs", () => {
    it("should save and retrieve workflow run", async () => {
      await store.saveRun(mockRun);

      const retrieved = await store.getRun("run-123");

      expect(retrieved).toEqual(mockRun);
      expect(retrieved).not.toBe(mockRun); // Should return a copy
    });

    it("should update existing run", async () => {
      const updatedRun = { ...mockRun, status: "success" as const };

      await store.saveRun(mockRun);
      await store.updateRun(updatedRun);

      const retrieved = await store.getRun("run-123");

      expect(retrieved?.status).toBe("success");
    });

    it("should return undefined for non-existent run", async () => {
      const retrieved = await store.getRun("non-existent");

      expect(retrieved).toBeUndefined();
    });

    it("should list runs with no filter", async () => {
      const run2 = { ...mockRun, id: "run-456", createdAt: 2000 };

      await store.saveRun(mockRun);
      await store.saveRun(run2);

      const runs = await store.listRuns();

      expect(runs).toHaveLength(2);
      expect(runs[0].id).toBe("run-456"); // Should be sorted by createdAt desc
      expect(runs[1].id).toBe("run-123");
    });

    it("should filter runs by workflowId", async () => {
      const run2 = { ...mockRun, id: "run-456", workflowId: "other-workflow" };

      await store.saveRun(mockRun);
      await store.saveRun(run2);

      const filter: WorkflowRunQuery = { workflowId: "test-workflow" };
      const runs = await store.listRuns(filter);

      expect(runs).toHaveLength(1);
      expect(runs[0].id).toBe("run-123");
    });

    it("should filter runs by status", async () => {
      const run2 = { ...mockRun, id: "run-456", status: "success" as const };

      await store.saveRun(mockRun);
      await store.saveRun(run2);

      const filter: WorkflowRunQuery = { status: "pending" };
      const runs = await store.listRuns(filter);

      expect(runs).toHaveLength(1);
      expect(runs[0].id).toBe("run-123");
    });

    it("should filter runs by mode", async () => {
      const run2 = { ...mockRun, id: "run-456", mode: "dry-run" as const };

      await store.saveRun(mockRun);
      await store.saveRun(run2);

      const filter: WorkflowRunQuery = { mode: "live" };
      const runs = await store.listRuns(filter);

      expect(runs).toHaveLength(1);
      expect(runs[0].id).toBe("run-123");
    });

    it("should filter runs by since timestamp", async () => {
      const run2 = { ...mockRun, id: "run-456", createdAt: 2000 };

      await store.saveRun(mockRun);
      await store.saveRun(run2);

      const filter: WorkflowRunQuery = { since: 1500 };
      const runs = await store.listRuns(filter);

      expect(runs).toHaveLength(1);
      expect(runs[0].id).toBe("run-456");
    });

    it("should limit results", async () => {
      const run2 = { ...mockRun, id: "run-456", createdAt: 2000 };
      const run3 = { ...mockRun, id: "run-789", createdAt: 3000 };

      await store.saveRun(mockRun);
      await store.saveRun(run2);
      await store.saveRun(run3);

      const filter: WorkflowRunQuery = { limit: 2 };
      const runs = await store.listRuns(filter);

      expect(runs).toHaveLength(2);
      expect(runs[0].id).toBe("run-789"); // Most recent first
      expect(runs[1].id).toBe("run-456");
    });

    it("should apply multiple filters", async () => {
      const run2 = {
        ...mockRun,
        id: "run-456",
        workflowId: "test-workflow",
        status: "success" as const,
        createdAt: 2000,
      };
      const run3 = {
        ...mockRun,
        id: "run-789",
        workflowId: "other-workflow",
        status: "success" as const,
        createdAt: 3000,
      };

      await store.saveRun(mockRun);
      await store.saveRun(run2);
      await store.saveRun(run3);

      const filter: WorkflowRunQuery = {
        workflowId: "test-workflow",
        status: "success",
        since: 1500,
        limit: 10,
      };
      const runs = await store.listRuns(filter);

      expect(runs).toHaveLength(1);
      expect(runs[0].id).toBe("run-456");
    });
  });

  describe("audit records", () => {
    it("should append and list audit records", async () => {
      await store.appendAudit(mockAudit);

      const audits = await store.listAudits();

      expect(audits).toHaveLength(1);
      expect(audits[0]).toEqual(mockAudit);
      expect(audits[0]).not.toBe(mockAudit); // Should return a copy
    });

    it("should filter audits by workflowId", async () => {
      const audit2 = { ...mockAudit, id: "audit-2", workflowId: "other-workflow" };

      await store.appendAudit(mockAudit);
      await store.appendAudit(audit2);

      const filter: WorkflowAuditQuery = { workflowId: "test-workflow" };
      const audits = await store.listAudits(filter);

      expect(audits).toHaveLength(1);
      expect(audits[0].id).toBe("audit-1");
    });

    it("should filter audits by runId", async () => {
      const audit2 = { ...mockAudit, id: "audit-2", runId: "other-run" };

      await store.appendAudit(mockAudit);
      await store.appendAudit(audit2);

      const filter: WorkflowAuditQuery = { runId: "run-123" };
      const audits = await store.listAudits(filter);

      expect(audits).toHaveLength(1);
      expect(audits[0].id).toBe("audit-1");
    });

    it("should filter audits by types", async () => {
      const audit2 = { ...mockAudit, id: "audit-2", type: "run.triggered" as const };

      await store.appendAudit(mockAudit);
      await store.appendAudit(audit2);

      const filter: WorkflowAuditQuery = { types: ["workflow.registered"] };
      const audits = await store.listAudits(filter);

      expect(audits).toHaveLength(1);
      expect(audits[0].id).toBe("audit-1");
    });

    it("should filter audits by since timestamp", async () => {
      const audit2 = { ...mockAudit, id: "audit-2", timestamp: 2000000000 };

      await store.appendAudit(mockAudit);
      await store.appendAudit(audit2);

      const filter: WorkflowAuditQuery = { since: 1500000000 };
      const audits = await store.listAudits(filter);

      expect(audits).toHaveLength(1);
      expect(audits[0].id).toBe("audit-2");
    });

    it("should limit audit results", async () => {
      const audit2 = { ...mockAudit, id: "audit-2", timestamp: 2000000000 };
      const audit3 = { ...mockAudit, id: "audit-3", timestamp: 3000000000 };

      await store.appendAudit(mockAudit);
      await store.appendAudit(audit2);
      await store.appendAudit(audit3);

      const filter: WorkflowAuditQuery = { limit: 2 };
      const audits = await store.listAudits(filter);

      expect(audits).toHaveLength(2);
      expect(audits[0].id).toBe("audit-3"); // Most recent first
      expect(audits[1].id).toBe("audit-2");
    });

    it("should apply multiple audit filters", async () => {
      const audit2 = {
        ...mockAudit,
        id: "audit-2",
        workflowId: "test-workflow",
        runId: "run-123",
        type: "run.triggered" as const,
        timestamp: 2000000000,
        actor: "user1",
      };
      const audit3 = {
        ...mockAudit,
        id: "audit-3",
        workflowId: "test-workflow",
        runId: "run-123",
        type: "run.completed" as const,
        timestamp: 3000000000,
        actor: "user2",
      };

      await store.appendAudit(mockAudit);
      await store.appendAudit(audit2);
      await store.appendAudit(audit3);

      const filter: WorkflowAuditQuery = {
        workflowId: "test-workflow",
        runId: "run-123",
        types: ["workflow.registered", "run.triggered", "run.completed"],
        actors: ["test-user", "user1", "user2"],
        since: 1000000000,
        limit: 10,
      };
      const audits = await store.listAudits(filter);

      expect(audits).toHaveLength(3);
      expect(audits.map((a) => a.id)).toEqual(["audit-3", "audit-2", "audit-1"]);
    });

    it("should sort audits by timestamp descending", async () => {
      const audit2 = { ...mockAudit, id: "audit-2", timestamp: 2000000000 };
      const audit3 = { ...mockAudit, id: "audit-3", timestamp: 1000000000 };

      await store.appendAudit(mockAudit);
      await store.appendAudit(audit2);
      await store.appendAudit(audit3);

      const audits = await store.listAudits();

      expect(audits).toHaveLength(3);
      expect(audits[0].id).toBe("audit-2"); // Most recent first
      expect(audits[1].id).toBe("audit-1");
      expect(audits[2].id).toBe("audit-3");
    });
  });

  describe("data isolation", () => {
    it("should not modify original objects when saving", async () => {
      await store.saveDefinition(mockDefinition);
      await store.saveRun(mockRun);
      await store.appendAudit(mockAudit);

      // Modify originals
      mockDefinition.name = "Modified";
      mockRun.status = "success";
      mockAudit.summary = "Modified";

      // Retrieved objects should be unchanged
      const retrievedDefinition = await store.getDefinition("test-workflow");
      const retrievedRun = await store.getRun("run-123");
      const retrievedAudits = await store.listAudits();

      expect(retrievedDefinition?.name).toBe("Test Workflow");
      expect(retrievedRun?.status).toBe("pending");
      expect(retrievedAudits[0]?.summary).toBe("Workflow registered");
    });
  });
});

describe("deriveRunStatus", () => {
  it("should count runs by status", () => {
    const runs: WorkflowRunRecord[] = [
      {
        id: "1",
        workflowId: "wf1",
        mode: "live",
        status: "success",
        attempt: 1,
        payload: {},
        createdAt: 1000,
      },
      {
        id: "2",
        workflowId: "wf1",
        mode: "live",
        status: "failed",
        attempt: 1,
        payload: {},
        createdAt: 1001,
      },
      {
        id: "3",
        workflowId: "wf1",
        mode: "live",
        status: "success",
        attempt: 1,
        payload: {},
        createdAt: 1002,
      },
      {
        id: "4",
        workflowId: "wf1",
        mode: "live",
        status: "pending",
        attempt: 1,
        payload: {},
        createdAt: 1003,
      },
    ];

    const statusCounts = deriveRunStatus(runs);

    expect(statusCounts).toEqual({
      pending: 1,
      success: 2,
      failed: 1,
    });
  });

  it("should handle empty array", () => {
    const statusCounts = deriveRunStatus([]);

    expect(statusCounts).toEqual({
      pending: 0,
      success: 0,
      failed: 0,
    });
  });

  it("should handle runs with only one status", () => {
    const runs: WorkflowRunRecord[] = [
      {
        id: "1",
        workflowId: "wf1",
        mode: "live",
        status: "success",
        attempt: 1,
        payload: {},
        createdAt: 1000,
      },
      {
        id: "2",
        workflowId: "wf1",
        mode: "live",
        status: "success",
        attempt: 1,
        payload: {},
        createdAt: 1001,
      },
    ];

    const statusCounts = deriveRunStatus(runs);

    expect(statusCounts).toEqual({
      pending: 0,
      success: 2,
      failed: 0,
    });
  });
});
