import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { PlanCanvas } from "../../src/conversation-plan/PlanCanvas";
import type { PlanCanvasState } from "../../src/conversation-plan/types";

describe("PlanCanvas", () => {
  const state: PlanCanvasState = {
    planId: "plan-1",
    sessionId: "session-1",
    goal: "Ship Plan Canvas",
    status: "running",
    nodes: [
      {
        nodeId: "node-1",
        title: "Implement adapter",
        kind: "implementation",
        status: "failed",
        artifacts: [
          {
            artifactId: "artifact-1",
            kind: "markdown",
            title: "ADR",
          },
        ],
      },
    ],
    edges: [],
    artifacts: [],
    proposals: [
      {
        proposalId: "proposal-1",
        title: "Approve retry",
        targetKind: "memory",
        status: "pending",
        beforeJson: {},
        afterJson: {
          fact: "用户偏好中文回答",
          token: "secret-token",
        },
      },
    ],
  };

  it("renders plan nodes, artifacts, and proposal controls", () => {
    render(<PlanCanvas state={state} />);

    expect(screen.getByText("Ship Plan Canvas")).toBeInTheDocument();
    expect(screen.getByTestId("plan-node-node-1")).toHaveTextContent("Implement adapter");
    expect(screen.getByText("ADR")).toBeInTheDocument();
    expect(screen.getByText("Approve retry")).toBeInTheDocument();
    expect(screen.getByText(/用户偏好中文回答/)).toBeInTheDocument();
    expect(screen.getByText(/redacted/)).toBeInTheDocument();
    expect(screen.queryByText("secret-token")).not.toBeInTheDocument();
  });

  it("calls node and plan callbacks", () => {
    const onNodeRetry = vi.fn();
    const onNodeSkip = vi.fn();
    const onPlanPause = vi.fn();
    const onProposalApprove = vi.fn();
    const onProposalEditAndApprove = vi.fn();

    render(
      <PlanCanvas
        state={state}
        onNodeRetry={onNodeRetry}
        onNodeSkip={onNodeSkip}
        onPlanPause={onPlanPause}
        onProposalApprove={onProposalApprove}
        onProposalEditAndApprove={onProposalEditAndApprove}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry Implement adapter" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip Implement adapter" }));
    fireEvent.click(screen.getByRole("button", { name: "Pause plan" }));
    fireEvent.click(screen.getByRole("button", { name: "Approve Approve retry" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit and approve Approve retry" }));

    expect(onNodeRetry).toHaveBeenCalledWith(state.nodes[0]);
    expect(onNodeSkip).toHaveBeenCalledWith(state.nodes[0]);
    expect(onPlanPause).toHaveBeenCalledTimes(1);
    expect(onProposalApprove).toHaveBeenCalledWith(state.proposals[0]);
    expect(onProposalEditAndApprove).toHaveBeenCalledWith(
      state.proposals[0],
      state.proposals[0]?.afterJson
    );
  });
});
