/**
 * Workflow Service 单元测试
 *
 * 测试工作流服务的核心功能：注册、触发、重试、重放、审计等
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { WorkflowService } from "../../../src/business/workflow/workflow-service";
import { InMemoryWorkflowStore } from "../../../src/business/workflow/memory-store";
import type {
  WorkflowDefinition,
  WorkflowAdapter,
  WorkflowTriggerOptions,
  WorkflowRunRecord,
  WorkflowAuditRecord,
} from "../../../src/business/workflow/types";

describe("WorkflowService", () => {
  let service: WorkflowService;
  let mockStore: InMemoryWorkflowStore;
  let mockAdapter: WorkflowAdapter;
  let mockIdGenerator: () => string;
  let mockClock: () => number;

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

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock store
    mockStore = new InMemoryWorkflowStore();
    mockStore.saveDefinition = vi.fn();
    mockStore.getDefinition = vi.fn();
    mockStore.listDefinitions = vi.fn();
    mockStore.saveRun = vi.fn();
    mockStore.getRun = vi.fn();
    mockStore.updateRun = vi.fn();
    mockStore.listRuns = vi.fn();
    mockStore.listAudits = vi.fn();
    mockStore.appendAudit = vi.fn();

    // Mock adapter
    mockAdapter = {
      execute: vi.fn(),
      simulate: vi.fn(),
    };

    // Mock functions
    mockIdGenerator = vi.fn(() => "generated-id");
    mockClock = vi.fn(() => 1234567890);

    // Create service with mocks
    service = new WorkflowService({
      store: mockStore,
      adapters: { "test-adapter": mockAdapter },
      defaultAdapter: mockAdapter,
      idGenerator: mockIdGenerator,
      clock: mockClock,
    });
  });

  describe("constructor", () => {
    it("should create service with default options", () => {
      const defaultService = new WorkflowService();
      expect(defaultService).toBeInstanceOf(WorkflowService);
    });

    it("should create service with custom store", () => {
      const customStore = new InMemoryWorkflowStore();
      const serviceWithStore = new WorkflowService({ store: customStore });
      expect(serviceWithStore).toBeDefined();
    });

    it("should create service with adapters", () => {
      const adapters = { adapter1: mockAdapter };
      const serviceWithAdapters = new WorkflowService({ adapters });
      expect(serviceWithAdapters).toBeDefined();
    });

    it("should create service with custom id generator", () => {
      const customIdGenerator = () => "custom-id";
      const serviceWithIdGen = new WorkflowService({ idGenerator: customIdGenerator });
      expect(serviceWithIdGen).toBeDefined();
    });

    it("should create service with custom clock", () => {
      const customClock = () => 999999;
      const serviceWithClock = new WorkflowService({ clock: customClock });
      expect(serviceWithClock).toBeDefined();
    });
  });

  describe("registerWorkflow", () => {
    it("should register new workflow and create audit record", async () => {
      vi.mocked(mockStore.getDefinition).mockResolvedValue(undefined);
      vi.mocked(mockStore.saveDefinition).mockResolvedValue();
      vi.mocked(mockStore.appendAudit).mockResolvedValue();

      await service.registerWorkflow(mockDefinition);

      expect(mockStore.saveDefinition).toHaveBeenCalledWith(mockDefinition);
      expect(mockStore.appendAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowId: "test-workflow",
          type: "workflow.registered",
          summary: "Test Workflow#1.0.0",
        })
      );
    });

    it("should update existing workflow and create audit record", async () => {
      vi.mocked(mockStore.getDefinition).mockResolvedValue(mockDefinition);
      vi.mocked(mockStore.saveDefinition).mockResolvedValue();
      vi.mocked(mockStore.appendAudit).mockResolvedValue();

      await service.registerWorkflow(mockDefinition);

      expect(mockStore.saveDefinition).toHaveBeenCalledWith(mockDefinition);
      expect(mockStore.appendAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowId: "test-workflow",
          type: "workflow.updated",
          summary: "Test Workflow#1.0.0",
        })
      );
    });
  });

  describe("listWorkflows", () => {
    it("should return list of workflows from store", async () => {
      const workflows = [mockDefinition];
      vi.mocked(mockStore.listDefinitions).mockResolvedValue(workflows);

      const result = await service.listWorkflows();

      expect(result).toBe(workflows);
      expect(mockStore.listDefinitions).toHaveBeenCalled();
    });
  });

  describe("getWorkflow", () => {
    it("should return workflow definition from store", async () => {
      vi.mocked(mockStore.getDefinition).mockResolvedValue(mockDefinition);

      const result = await service.getWorkflow("test-workflow");

      expect(result).toBe(mockDefinition);
      expect(mockStore.getDefinition).toHaveBeenCalledWith("test-workflow");
    });

    it("should return undefined for non-existent workflow", async () => {
      vi.mocked(mockStore.getDefinition).mockResolvedValue(undefined);

      const result = await service.getWorkflow("non-existent");

      expect(result).toBeUndefined();
    });
  });

  describe("triggerWorkflow", () => {
    beforeEach(() => {
      vi.mocked(mockStore.getDefinition).mockResolvedValue(mockDefinition);
      vi.mocked(mockStore.saveRun).mockResolvedValue();
      vi.mocked(mockStore.updateRun).mockResolvedValue();
      vi.mocked(mockStore.appendAudit).mockResolvedValue();
      vi.mocked(mockAdapter.execute).mockResolvedValue({
        logs: ["Execution successful"],
        output: { result: "success" },
      });
    });

    it("should trigger workflow in live mode", async () => {
      const payload = { input: "test" };
      const options: WorkflowTriggerOptions = {
        metadata: { key: "value" },
        actor: "test-user",
        traceId: "trace-123",
      };

      const result = await service.triggerWorkflow("test-workflow", payload, options);

      expect(result.run.workflowId).toBe("test-workflow");
      expect(result.run.mode).toBe("live");
      expect(result.run.status).toBe("success");
      expect(result.run.attempt).toBe(1);
      expect(result.run.payload).toEqual(payload);
      expect(result.run.metadata).toEqual(options.metadata);
      expect(result.run.actor).toBe(options.actor);
      expect(result.run.status).toBe("success");
      expect(result.result?.output).toEqual({ result: "success" });
    });

    it("should trigger workflow in dry-run mode", async () => {
      const mockAdapterWithSimulate = {
        execute: vi.fn(),
        simulate: vi.fn().mockResolvedValue({
          logs: ["Simulation successful"],
          output: { result: "simulated" },
          steps: [],
        }),
      };

      const serviceWithSimulate = new WorkflowService({
        store: mockStore,
        adapters: { "test-adapter": mockAdapterWithSimulate },
        defaultAdapter: mockAdapterWithSimulate,
        idGenerator: mockIdGenerator,
        clock: mockClock,
      });

      vi.mocked(mockStore.getDefinition).mockResolvedValue(mockDefinition);
      vi.mocked(mockStore.saveRun).mockResolvedValue();
      vi.mocked(mockStore.updateRun).mockResolvedValue();
      vi.mocked(mockStore.appendAudit).mockResolvedValue();

      const result = await serviceWithSimulate.triggerWorkflow(
        "test-workflow",
        {},
        { dryRun: true }
      );

      expect(result.run.mode).toBe("dry-run");
      expect(mockAdapterWithSimulate.simulate).toHaveBeenCalled();
    });

    it("should throw error for non-existent workflow", async () => {
      vi.mocked(mockStore.getDefinition).mockResolvedValue(undefined);

      await expect(service.triggerWorkflow("non-existent", {})).rejects.toThrow(
        "Workflow 'non-existent' is not registered"
      );
    });

    it("should handle execution errors", async () => {
      vi.mocked(mockAdapter.execute).mockRejectedValue(new Error("Execution failed"));

      const result = await service.triggerWorkflow("test-workflow", {});

      expect(result.run.status).toBe("failed");
      expect(result.run.error).toEqual(
        expect.objectContaining({
          message: "Execution failed",
        })
      );
    });
  });

  describe("retryRun", () => {
    beforeEach(() => {
      vi.mocked(mockStore.getRun).mockResolvedValue(mockRun);
      vi.mocked(mockStore.getDefinition).mockResolvedValue(mockDefinition);
      vi.mocked(mockStore.saveRun).mockResolvedValue();
      vi.mocked(mockStore.updateRun).mockResolvedValue();
      vi.mocked(mockStore.appendAudit).mockResolvedValue();
      vi.mocked(mockAdapter.execute).mockResolvedValue({
        logs: ["Retry successful"],
        output: { result: "retried" },
      });
    });

    it("should retry failed run", async () => {
      const failedRun = { ...mockRun, status: "failed" as const };
      vi.mocked(mockStore.getRun).mockResolvedValue(failedRun);

      const result = await service.retryRun("run-123");

      expect(result.run.attempt).toBe(2);
      expect(result.run.mode).toBe("retry");
      expect(result.run.parentRunId).toBe("run-123");
    });

    it("should throw error when retry attempts exceeded", async () => {
      const failedRun = { ...mockRun, status: "failed" as const, attempt: 3 };
      vi.mocked(mockStore.getRun).mockResolvedValue(failedRun);

      await expect(service.retryRun("run-123")).rejects.toThrow(
        "Retry attempts exceeded for workflow test-workflow"
      );
    });

    it("should throw error for non-existent run", async () => {
      vi.mocked(mockStore.getRun).mockResolvedValue(undefined);

      await expect(service.retryRun("non-existent")).rejects.toThrow(
        "Workflow run 'non-existent' not found"
      );
    });
  });

  describe("replayFailure", () => {
    beforeEach(() => {
      vi.mocked(mockStore.getRun).mockResolvedValue({ ...mockRun, status: "failed" });
      vi.mocked(mockStore.getDefinition).mockResolvedValue(mockDefinition);
      vi.mocked(mockStore.saveRun).mockResolvedValue();
      vi.mocked(mockStore.updateRun).mockResolvedValue();
      vi.mocked(mockStore.appendAudit).mockResolvedValue();
      vi.mocked(mockAdapter.execute).mockResolvedValue({
        logs: ["Replay successful"],
        output: { result: "replayed" },
      });
    });

    it("should replay failed run", async () => {
      const result = await service.replayFailure("run-123");

      expect(result.run.mode).toBe("replay");
      expect(result.run.attempt).toBe(1); // Same attempt number for replay
      expect(result.run.parentRunId).toBe("run-123");
    });

    it("should throw error for non-failed run", async () => {
      const successRun = { ...mockRun, status: "success" as const };
      vi.mocked(mockStore.getRun).mockResolvedValue(successRun);

      await expect(service.replayFailure("run-123")).rejects.toThrow(
        "Can only replay failed runs. Current status: success"
      );
    });
  });

  describe("getRun", () => {
    it("should return run record from store", async () => {
      vi.mocked(mockStore.getRun).mockResolvedValue(mockRun);

      const result = await service.getRun("run-123");

      expect(result).toBe(mockRun);
      expect(mockStore.getRun).toHaveBeenCalledWith("run-123");
    });
  });

  describe("listRuns", () => {
    it("should return filtered runs from store", async () => {
      const runs = [mockRun];
      vi.mocked(mockStore.listRuns).mockResolvedValue(runs);

      const filter = { workflowId: "test-workflow" };
      const result = await service.listRuns(filter);

      expect(result).toBe(runs);
      expect(mockStore.listRuns).toHaveBeenCalledWith(filter);
    });
  });

  describe("listAudits", () => {
    it("should return filtered audits from store", async () => {
      const audits: WorkflowAuditRecord[] = [
        {
          id: "audit-1",
          timestamp: 1234567890,
          workflowId: "test-workflow",
          type: "workflow.registered",
          summary: "Workflow registered",
        },
      ];
      vi.mocked(mockStore.listAudits).mockResolvedValue(audits);

      const filter = { workflowId: "test-workflow" };
      const result = await service.listAudits(filter);

      expect(result).toBe(audits);
      expect(mockStore.listAudits).toHaveBeenCalledWith(filter);
    });
  });

  // Removed redundant adapter management tests that only verified methods don't throw
  // without validating actual business logic (Task 3.2 cleanup)
});
