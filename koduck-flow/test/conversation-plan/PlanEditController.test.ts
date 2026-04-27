import { describe, expect, it, vi } from "vitest";
import { PlanEditController } from "../../src/conversation-plan/PlanEditController";

describe("PlanEditController", () => {
  it("posts plan edit events to the session plan endpoint", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          event_id: "event-1",
          sequence_num: 7,
          event_type: "plan.node.updated",
          payload: { nodeId: "node-1", title: "New title" },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      );
    });
    const controller = new PlanEditController({
      baseUrl: "http://localhost:30080",
      sessionId: "session-1",
      planId: "plan-1",
      fetch: fetchMock,
      headers: {
        authorization: "Bearer token",
      },
    });

    const response = await controller.updateNode("node-1", { title: "New title" }, "key-1");

    expect(response.sequence_num).toBe(7);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:30080/api/v1/ai/sessions/session-1/plans/plan-1/events",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          event_type: "plan.node.updated",
          payload: {
            nodeId: "node-1",
            title: "New title",
          },
          idempotency_key: "key-1",
        }),
      })
    );
  });

  it("throws when the edit endpoint rejects the request", async () => {
    const controller = new PlanEditController({
      sessionId: "session-1",
      planId: "plan-1",
      fetch: vi.fn(async () => new Response(null, { status: 409 })),
    });

    await expect(controller.pausePlan()).rejects.toThrow(
      "Plan edit event failed with status 409"
    );
  });

  it("posts edit and approve proposal events", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          event_id: "event-1",
          sequence_num: 8,
          event_type: "proposal.edit_and_approve",
          payload: { proposalId: "proposal-1" },
        }),
        { status: 200 }
      );
    });
    const controller = new PlanEditController({
      sessionId: "session-1",
      planId: "plan-1",
      fetch: fetchMock,
    });

    await controller.editAndApproveProposal("proposal-1", { fact: "中文" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/ai/sessions/session-1/plans/plan-1/events",
      expect.objectContaining({
        body: JSON.stringify({
          event_type: "proposal.edit_and_approve",
          payload: {
            proposalId: "proposal-1",
            afterJson: {
              fact: "中文",
            },
          },
        }),
      })
    );
  });
});
