export type PlanStatus =
  | "draft"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export type PlanNodeKind =
  | "research"
  | "analysis"
  | "implementation"
  | "verification"
  | "decision"
  | "handoff";

export type PlanNodeStatus =
  | "pending"
  | "running"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "skipped";

export type PlanEventType =
  | "plan.created"
  | "plan.updated"
  | "plan.paused"
  | "plan.resumed"
  | "plan.completed"
  | "plan.failed"
  | "plan.cancelled"
  | "plan.node.added"
  | "plan.node.updated"
  | "plan.node.started"
  | "plan.node.completed"
  | "plan.node.failed"
  | "plan.node.skipped"
  | "plan.node.waiting_approval"
  | "artifact.created"
  | "proposal.created"
  | "proposal.approved"
  | "proposal.rejected"
  | "proposal.edit_and_approve"
  | "memory.patch.proposed"
  | "memory.patch.applied"
  | "knowledge.patch.proposed"
  | "knowledge.patch.applied";

export interface PlanCanvasArtifact {
  readonly artifactId: string;
  readonly nodeId?: string;
  readonly kind: string;
  readonly title: string;
  readonly uri?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface PlanCanvasProposal {
  readonly proposalId: string;
  readonly nodeId?: string;
  readonly targetKind?: string;
  readonly operation?: string;
  readonly status: "pending" | "approved" | "rejected";
  readonly title: string;
  readonly summary?: string;
  readonly beforeJson?: unknown;
  readonly afterJson?: unknown;
  readonly metadata?: Record<string, unknown>;
}

export interface PlanCanvasNode {
  readonly nodeId: string;
  readonly title: string;
  readonly kind: PlanNodeKind;
  readonly status: PlanNodeStatus;
  readonly summary?: string;
  readonly parentNodeId?: string;
  readonly artifacts: readonly PlanCanvasArtifact[];
  readonly metadata?: Record<string, unknown>;
  readonly updatedAt?: string;
}

export interface PlanCanvasEdge {
  readonly edgeId: string;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly label?: string;
}

export interface PlanCanvasState {
  readonly planId?: string;
  readonly sessionId?: string;
  readonly goal?: string;
  readonly status: PlanStatus;
  readonly nodes: readonly PlanCanvasNode[];
  readonly edges: readonly PlanCanvasEdge[];
  readonly artifacts: readonly PlanCanvasArtifact[];
  readonly proposals: readonly PlanCanvasProposal[];
  readonly lastSequence?: number;
}

export interface PlanStreamEventEnvelope {
  readonly event_type: PlanEventType;
  readonly payload: Record<string, unknown>;
  readonly sequence_num?: number;
  readonly event_id?: string;
  readonly session_id?: string;
  readonly request_id?: string;
}

export interface PlanEditEventRequest {
  readonly event_type: PlanEventType;
  readonly payload: Record<string, unknown>;
  readonly idempotency_key?: string;
}

export interface PlanEditEventResponse {
  readonly event_id: string;
  readonly sequence_num: number;
  readonly event_type: PlanEventType;
  readonly payload: Record<string, unknown>;
}

export interface PlanCanvasCallbacks {
  readonly onNodeRetry?: (node: PlanCanvasNode) => void;
  readonly onNodeSkip?: (node: PlanCanvasNode) => void;
  readonly onProposalApprove?: (proposal: PlanCanvasProposal) => void;
  readonly onProposalReject?: (proposal: PlanCanvasProposal) => void;
  readonly onProposalEditAndApprove?: (proposal: PlanCanvasProposal, afterJson: unknown) => void;
  readonly onPlanPause?: () => void;
  readonly onPlanResume?: () => void;
}
