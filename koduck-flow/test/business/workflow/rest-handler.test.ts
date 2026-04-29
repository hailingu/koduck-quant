/**
 * REST Handler unit tests
 *
 * Tests route dispatching, static routes, dynamic routes, and error handling
 */

import { describe, it, expect, vi, beforeEach, type MockedFunction } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createWorkflowHttpHandler, HttpError } from "../../../src/business/workflow/rest-handler";
import { WorkflowService } from "../../../src/business/workflow/workflow-service";
import type {
  WorkflowDefinition,
  WorkflowRunRecord,
  WorkflowAuditRecord,
} from "../../../src/business/workflow/types";

describe("REST Handler", () => {
  let mockService: WorkflowService;
  let mockReq: IncomingMessage;
  let mockRes: ServerResponse;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock service
    mockService = new WorkflowService();
    mockService.listWorkflows = vi.fn();
    mockService.registerWorkflow = vi.fn();
    mockService.getWorkflow = vi.fn();
    mockService.triggerWorkflow = vi.fn();
    mockService.listRuns = vi.fn();
    mockService.getRun = vi.fn();
    mockService.retryRun = vi.fn();
    mockService.replayFailure = vi.fn();
    mockService.listAudits = vi.fn();

    // Create mock request/response
    mockReq = {
      method: "GET",
      url: "/",
      headers: {},
    } as IncomingMessage;

    mockRes = {
      statusCode: 200,
      setHeader: vi.fn(),
      end: vi.fn(),
    } as unknown as ServerResponse;
  });

  describe("Static Routes", () => {
    describe("GET /workflows", () => {
      it("should list workflows", async () => {
        const mockWorkflows: WorkflowDefinition[] = [
          { id: "wf1", name: "Workflow 1", version: "1.0" },
        ];

        (
          mockService.listWorkflows as MockedFunction<typeof mockService.listWorkflows>
        ).mockResolvedValue(mockWorkflows);

        const handler = createWorkflowHttpHandler({ service: mockService });
        mockReq.url = "/workflows";

        await handler(mockReq, mockRes);

        expect(mockService.listWorkflows).toHaveBeenCalled();
        expect(mockRes.statusCode).toBe(200);
        expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ workflows: mockWorkflows }));
      });
    });

    describe("GET /runs", () => {
      it("should list runs with query parameters", async () => {
        const mockRuns: WorkflowRunRecord[] = [
          {
            id: "run1",
            workflowId: "wf1",
            status: "success",
            mode: "live",
            attempt: 1,
            payload: {},
            createdAt: Date.now(),
          },
        ];

        (mockService.listRuns as MockedFunction<typeof mockService.listRuns>).mockResolvedValue(
          mockRuns
        );

        const handler = createWorkflowHttpHandler({ service: mockService });
        mockReq.url = "/runs?workflowId=wf1&status=success";

        await handler(mockReq, mockRes);

        expect(mockService.listRuns).toHaveBeenCalledWith({
          workflowId: "wf1",
          status: "success",
        });
        expect(mockRes.statusCode).toBe(200);
        expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ runs: mockRuns }));
      });
    });

    describe("GET /audits", () => {
      it("should list audits with query parameters", async () => {
        const mockAudits: WorkflowAuditRecord[] = [
          {
            id: "audit1",
            type: "workflow.registered",
            workflowId: "wf1",
            timestamp: Date.now(),
            summary: "Workflow registered",
          },
        ];

        (mockService.listAudits as MockedFunction<typeof mockService.listAudits>).mockResolvedValue(
          mockAudits
        );

        const handler = createWorkflowHttpHandler({ service: mockService });
        mockReq.url = "/audits?workflowId=wf1&types=workflow.registered";

        await handler(mockReq, mockRes);

        expect(mockService.listAudits).toHaveBeenCalledWith({
          workflowId: "wf1",
          types: ["workflow.registered"],
        });
        expect(mockRes.statusCode).toBe(200);
        expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ audits: mockAudits }));
      });
    });
  });

  describe("Dynamic Routes", () => {
    describe("GET /workflows/:id", () => {
      it("should get workflow by id", async () => {
        const mockWorkflow: WorkflowDefinition = {
          id: "wf1",
          name: "Workflow 1",
          version: "1.0",
        };

        (
          mockService.getWorkflow as MockedFunction<typeof mockService.getWorkflow>
        ).mockResolvedValue(mockWorkflow);

        const handler = createWorkflowHttpHandler({ service: mockService });
        mockReq.url = "/workflows/wf1";

        await handler(mockReq, mockRes);

        expect(mockService.getWorkflow).toHaveBeenCalledWith("wf1");
        expect(mockRes.statusCode).toBe(200);
        expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify(mockWorkflow));
      });

      it("should return 404 for non-existent workflow", async () => {
        (
          mockService.getWorkflow as MockedFunction<typeof mockService.getWorkflow>
        ).mockResolvedValue(undefined);

        const handler = createWorkflowHttpHandler({ service: mockService });
        mockReq.url = "/workflows/nonexistent";

        await handler(mockReq, mockRes);

        expect(mockService.getWorkflow).toHaveBeenCalledWith("nonexistent");
        expect(mockRes.statusCode).toBe(404);
        expect(mockRes.end).toHaveBeenCalledWith(
          JSON.stringify({ error: "Workflow 'nonexistent' not found" })
        );
      });
    });

    describe("GET /runs/:id", () => {
      it("should get run by id", async () => {
        const mockRun: WorkflowRunRecord = {
          id: "run1",
          workflowId: "wf1",
          status: "success",
          mode: "live",
          attempt: 1,
          payload: {},
          createdAt: Date.now(),
        };

        (mockService.getRun as MockedFunction<typeof mockService.getRun>).mockResolvedValue(
          mockRun
        );

        const handler = createWorkflowHttpHandler({ service: mockService });
        mockReq.url = "/runs/run1";

        await handler(mockReq, mockRes);

        expect(mockService.getRun).toHaveBeenCalledWith("run1");
        expect(mockRes.statusCode).toBe(200);
        expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify(mockRun));
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle HttpError", async () => {
      (
        mockService.listWorkflows as MockedFunction<typeof mockService.listWorkflows>
      ).mockRejectedValue(new HttpError(404, "Workflow not found", { id: "wf1" }));

      const handler = createWorkflowHttpHandler({ service: mockService });
      mockReq.url = "/workflows";

      await handler(mockReq, mockRes);

      expect(mockRes.statusCode).toBe(404);
      expect(mockRes.end).toHaveBeenCalledWith(
        JSON.stringify({ error: "Workflow not found", details: { id: "wf1" } })
      );
    });

    it("should handle generic errors", async () => {
      (
        mockService.listWorkflows as MockedFunction<typeof mockService.listWorkflows>
      ).mockRejectedValue(new Error("Database connection failed"));

      const handler = createWorkflowHttpHandler({ service: mockService });
      mockReq.url = "/workflows";

      await handler(mockReq, mockRes);

      expect(mockRes.statusCode).toBe(500);
      expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ error: "Internal Server Error" }));
    });

    it("should return 404 for unknown routes", async () => {
      const handler = createWorkflowHttpHandler({ service: mockService });
      mockReq.url = "/unknown";

      await handler(mockReq, mockRes);

      expect(mockRes.statusCode).toBe(404);
      expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ error: "Route not found" }));
    });
  });

  describe("Handler Configuration", () => {
    it("should handle prefix correctly", async () => {
      const handler = createWorkflowHttpHandler({ service: mockService, prefix: "/api" });
      mockReq.url = "/api/workflows";

      (
        mockService.listWorkflows as MockedFunction<typeof mockService.listWorkflows>
      ).mockResolvedValue([]);

      await handler(mockReq, mockRes);

      expect(mockService.listWorkflows).toHaveBeenCalled();
      expect(mockRes.statusCode).toBe(200);
    });

    it("should return 404 for requests not matching prefix", async () => {
      const handler = createWorkflowHttpHandler({ service: mockService, prefix: "/api" });
      mockReq.url = "/workflows";

      await handler(mockReq, mockRes);

      expect(mockService.listWorkflows).not.toHaveBeenCalled();
      expect(mockRes.statusCode).toBe(404);
      expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ error: "Not Found" }));
    });

    it("should handle CORS preflight", async () => {
      const handler = createWorkflowHttpHandler({ service: mockService, enableCors: true });
      mockReq.method = "OPTIONS";
      mockReq.url = "/workflows";

      await handler(mockReq, mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith("Access-Control-Allow-Origin", "*");
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "Access-Control-Allow-Methods",
        "GET,POST,OPTIONS"
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "Access-Control-Allow-Headers",
        "Content-Type"
      );
      expect(mockRes.statusCode).toBe(204);
      expect(mockRes.end).toHaveBeenCalled();
    });
  });

  describe("Workflow Trigger and Run Operations", () => {
    describe("GET /workflows/:id/trigger", () => {
      it("should return 405 for GET on trigger endpoint", async () => {
        mockReq.method = "GET";
        mockReq.url = "/workflows/wf1/trigger";

        const handler = createWorkflowHttpHandler({ service: mockService });

        await handler(mockReq, mockRes);

        expect(mockService.triggerWorkflow).not.toHaveBeenCalled();
        expect(mockRes.statusCode).toBe(405);
        expect(mockRes.end).toHaveBeenCalledWith(
          JSON.stringify({ error: "Trigger endpoint requires POST" })
        );
      });
    });
  });

  describe("Path Normalization", () => {
    it("should handle trailing slashes correctly", async () => {
      const mockWorkflows: WorkflowDefinition[] = [];

      (
        mockService.listWorkflows as MockedFunction<typeof mockService.listWorkflows>
      ).mockResolvedValue(mockWorkflows);

      const handler = createWorkflowHttpHandler({ service: mockService });
      mockReq.url = "/workflows/"; // trailing slash

      await handler(mockReq, mockRes);

      expect(mockService.listWorkflows).toHaveBeenCalled();
      expect(mockRes.statusCode).toBe(200);
    });

    it("should handle root path correctly", async () => {
      const handler = createWorkflowHttpHandler({ service: mockService });
      mockReq.url = "/";

      await handler(mockReq, mockRes);

      expect(mockRes.statusCode).toBe(404);
      expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ error: "Route not found" }));
    });
  });

  describe("URL Encoding", () => {
    it("should handle URL encoded workflow IDs", async () => {
      const mockWorkflow: WorkflowDefinition = {
        id: "wf%20test",
        name: "Workflow Test",
        version: "1.0",
      };

      (mockService.getWorkflow as MockedFunction<typeof mockService.getWorkflow>).mockResolvedValue(
        mockWorkflow
      );

      const handler = createWorkflowHttpHandler({ service: mockService });
      mockReq.url = "/workflows/wf%2520test"; // URL encoded "wf%20test"

      await handler(mockReq, mockRes);

      expect(mockService.getWorkflow).toHaveBeenCalledWith("wf%20test");
      expect(mockRes.statusCode).toBe(200);
    });
  });
});
