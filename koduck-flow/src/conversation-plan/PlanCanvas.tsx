import React from "react";
import type {
  PlanCanvasCallbacks,
  PlanCanvasNode,
  PlanCanvasProposal,
  PlanCanvasState,
} from "./types";

export interface PlanCanvasProps extends PlanCanvasCallbacks {
  readonly state: PlanCanvasState;
  readonly className?: string;
}

const statusLabels: Record<string, string> = {
  draft: "Draft",
  running: "Running",
  paused: "Paused",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
  pending: "Pending",
  waiting_approval: "Approval",
  skipped: "Skipped",
};

export function PlanCanvas(props: PlanCanvasProps) {
  const {
    state,
    className,
    onNodeRetry,
    onNodeSkip,
    onProposalApprove,
    onProposalReject,
    onProposalEditAndApprove,
    onPlanPause,
    onPlanResume,
  } = props;
  const rootClassName = className ? `koduck-plan-canvas ${className}` : "koduck-plan-canvas";

  return (
    <section className={rootClassName} data-testid="plan-canvas" aria-label="Plan canvas">
      <header className="koduck-plan-canvas__header">
        <div>
          <h2 className="koduck-plan-canvas__title">{state.goal ?? "Plan"}</h2>
          <span className={`koduck-plan-canvas__status is-${state.status}`}>
            {statusLabels[state.status] ?? state.status}
          </span>
        </div>
        <div className="koduck-plan-canvas__actions">
          {state.status === "running" && onPlanPause ? (
            <button type="button" aria-label="Pause plan" onClick={onPlanPause}>
              Pause
            </button>
          ) : null}
          {state.status === "paused" && onPlanResume ? (
            <button type="button" aria-label="Resume plan" onClick={onPlanResume}>
              Resume
            </button>
          ) : null}
        </div>
      </header>

      <ol className="koduck-plan-canvas__nodes">
        {state.nodes.map((node, index) => {
          const callbacks = {
            ...(onNodeRetry ? { onNodeRetry } : {}),
            ...(onNodeSkip ? { onNodeSkip } : {}),
          };

          return <PlanNodeCard key={node.nodeId} node={node} index={index} {...callbacks} />;
        })}
      </ol>

      {state.proposals.length > 0 ? (
        <aside className="koduck-plan-canvas__proposals" aria-label="Plan proposals">
          {state.proposals.map((proposal) => {
            const callbacks = {
              ...(onProposalApprove ? { onProposalApprove } : {}),
              ...(onProposalReject ? { onProposalReject } : {}),
              ...(onProposalEditAndApprove ? { onProposalEditAndApprove } : {}),
            };

            return <PlanProposalCard key={proposal.proposalId} proposal={proposal} {...callbacks} />;
          })}
        </aside>
      ) : null}
    </section>
  );
}

interface PlanNodeCardProps
  extends Pick<PlanCanvasCallbacks, "onNodeRetry" | "onNodeSkip"> {
  readonly node: PlanCanvasNode;
  readonly index: number;
}

function PlanNodeCard(props: PlanNodeCardProps) {
  const { node, index, onNodeRetry, onNodeSkip } = props;

  return (
    <li
      className={`koduck-plan-canvas__node is-${node.status}`}
      data-testid={`plan-node-${node.nodeId}`}
    >
      <div className="koduck-plan-canvas__node-index">{index + 1}</div>
      <div className="koduck-plan-canvas__node-body">
        <div className="koduck-plan-canvas__node-heading">
          <h3>{node.title}</h3>
          <span>{statusLabels[node.status] ?? node.status}</span>
        </div>
        {node.summary ? <p>{node.summary}</p> : null}
        {node.artifacts.length > 0 ? (
          <ul className="koduck-plan-canvas__artifacts" aria-label={`${node.title} artifacts`}>
            {node.artifacts.map((artifact) => (
              <li key={artifact.artifactId}>{artifact.title}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="koduck-plan-canvas__node-actions">
        {node.status === "failed" && onNodeRetry ? (
          <button type="button" aria-label={`Retry ${node.title}`} onClick={() => onNodeRetry(node)}>
            Retry
          </button>
        ) : null}
        {node.status !== "completed" && node.status !== "skipped" && onNodeSkip ? (
          <button type="button" aria-label={`Skip ${node.title}`} onClick={() => onNodeSkip(node)}>
            Skip
          </button>
        ) : null}
      </div>
    </li>
  );
}

interface PlanProposalCardProps
  extends Pick<
    PlanCanvasCallbacks,
    "onProposalApprove" | "onProposalReject" | "onProposalEditAndApprove"
  > {
  readonly proposal: PlanCanvasProposal;
}

function PlanProposalCard(props: PlanProposalCardProps) {
  const { proposal, onProposalApprove, onProposalReject, onProposalEditAndApprove } = props;
  const hasDiff = proposal.beforeJson !== undefined || proposal.afterJson !== undefined;

  return (
    <article className={`koduck-plan-canvas__proposal is-${proposal.status}`}>
      <h3>{proposal.title}</h3>
      {proposal.summary ? <p>{proposal.summary}</p> : null}
      {hasDiff ? (
        <div className="koduck-plan-canvas__proposal-diff">
          <ProposalJsonBlock label="Before" value={proposal.beforeJson} />
          <ProposalJsonBlock label="After" value={proposal.afterJson} />
        </div>
      ) : null}
      {proposal.status === "pending" ? (
        <div className="koduck-plan-canvas__proposal-actions">
          {onProposalApprove ? (
            <button
              type="button"
              aria-label={`Approve ${proposal.title}`}
              onClick={() => onProposalApprove(proposal)}
            >
              Approve
            </button>
          ) : null}
          {onProposalReject ? (
            <button
              type="button"
              aria-label={`Reject ${proposal.title}`}
              onClick={() => onProposalReject(proposal)}
            >
              Reject
            </button>
          ) : null}
          {onProposalEditAndApprove && proposal.afterJson !== undefined ? (
            <button
              type="button"
              aria-label={`Edit and approve ${proposal.title}`}
              onClick={() => onProposalEditAndApprove(proposal, proposal.afterJson)}
            >
              Edit
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function ProposalJsonBlock(props: { readonly label: string; readonly value: unknown }) {
  return (
    <div className="koduck-plan-canvas__proposal-json">
      <span>{props.label}</span>
      <pre>{stringifyRedactedJson(props.value)}</pre>
    </div>
  );
}

function stringifyRedactedJson(value: unknown): string {
  if (value === undefined || value === null || value === "") {
    return "{}";
  }

  return JSON.stringify(redactSensitiveJson(value), null, 2);
}

function redactSensitiveJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactSensitiveJson);
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => {
      if (/password|passwd|secret|token|api[_-]?key/i.test(key)) {
        return [key, "[redacted]"];
      }
      return [key, redactSensitiveJson(item)];
    })
  );
}
