import { describe, expect, it } from "vitest";
import {
  applyPlanStreamEvents,
  createInitialPlanCanvasState,
} from "../../src/conversation-plan/PlanEventAdapter";

describe("PlanEventAdapter", () => {
  it("applies plan and node events into canvas state", () => {
    const state = applyPlanStreamEvents(createInitialPlanCanvasState(), [
      {
        event_type: "plan.created",
        sequence_num: 1,
        payload: {
          planId: "plan-1",
          sessionId: "session-1",
          goal: "Ship Plan Canvas",
        },
      },
      {
        event_type: "plan.node.started",
        sequence_num: 2,
        payload: {
          nodeId: "node-1",
          title: "Implement adapter",
          kind: "implementation",
        },
      },
      {
        event_type: "plan.node.completed",
        sequence_num: 3,
        payload: {
          nodeId: "node-1",
          title: "Implement adapter",
          kind: "implementation",
        },
      },
    ]);

    expect(state.planId).toBe("plan-1");
    expect(state.sessionId).toBe("session-1");
    expect(state.goal).toBe("Ship Plan Canvas");
    expect(state.status).toBe("running");
    expect(state.lastSequence).toBe(3);
    expect(state.nodes).toHaveLength(1);
    expect(state.nodes[0]).toMatchObject({
      nodeId: "node-1",
      title: "Implement adapter",
      kind: "implementation",
      status: "completed",
    });
  });

  it("attaches artifacts to their node and global artifact list", () => {
    const state = applyPlanStreamEvents(createInitialPlanCanvasState(), [
      {
        event_type: "plan.node.added",
        payload: {
          nodeId: "node-1",
          title: "Draft ADR",
        },
      },
      {
        event_type: "artifact.created",
        payload: {
          artifactId: "artifact-1",
          nodeId: "node-1",
          kind: "markdown",
          title: "ADR",
        },
      },
    ]);

    expect(state.artifacts).toEqual([
      {
        artifactId: "artifact-1",
        nodeId: "node-1",
        kind: "markdown",
        title: "ADR",
      },
    ]);
    expect(state.nodes[0]?.artifacts).toEqual(state.artifacts);
  });

  it("tracks approval proposals", () => {
    const state = applyPlanStreamEvents(createInitialPlanCanvasState(), [
      {
        event_type: "proposal.created",
        payload: {
          proposalId: "proposal-1",
          title: "Use event sourcing",
        },
      },
      {
        event_type: "proposal.approved",
        payload: {
          proposalId: "proposal-1",
          title: "Use event sourcing",
        },
      },
    ]);

    expect(state.proposals).toEqual([
      {
        proposalId: "proposal-1",
        title: "Use event sourcing",
        status: "approved",
      },
    ]);
  });

  it("maps memory patch events into proposal diffs", () => {
    const state = applyPlanStreamEvents(createInitialPlanCanvasState(), [
      {
        event_type: "memory.patch.proposed",
        payload: {
          proposalId: "proposal-1",
          operation: "append",
          beforeJson: {},
          afterJson: {
            fact: "用户偏好中文回答",
          },
        },
      },
    ]);

    expect(state.proposals).toEqual([
      {
        proposalId: "proposal-1",
        title: "Memory update",
        targetKind: "memory",
        operation: "append",
        beforeJson: {},
        afterJson: {
          fact: "用户偏好中文回答",
        },
        status: "pending",
      },
    ]);
  });
});
