import type {
  PlanCanvasArtifact,
  PlanCanvasEdge,
  PlanCanvasNode,
  PlanCanvasProposal,
  PlanCanvasState,
  PlanEventType,
  PlanNodeKind,
  PlanNodeStatus,
  PlanStatus,
  PlanStreamEventEnvelope,
} from "./types";

const DEFAULT_NODE_KIND: PlanNodeKind = "analysis";

export function createInitialPlanCanvasState(
  seed: Partial<PlanCanvasState> = {}
): PlanCanvasState {
  return {
    status: seed.status ?? "draft",
    nodes: seed.nodes ?? [],
    edges: seed.edges ?? [],
    artifacts: seed.artifacts ?? [],
    proposals: seed.proposals ?? [],
    ...(seed.planId ? { planId: seed.planId } : {}),
    ...(seed.sessionId ? { sessionId: seed.sessionId } : {}),
    ...(seed.goal ? { goal: seed.goal } : {}),
    ...(seed.lastSequence !== undefined ? { lastSequence: seed.lastSequence } : {}),
  };
}

export function applyPlanStreamEvent(
  state: PlanCanvasState,
  envelope: PlanStreamEventEnvelope
): PlanCanvasState {
  const sequence = envelope.sequence_num ?? state.lastSequence;
  const baseState = sequence === undefined ? state : { ...state, lastSequence: sequence };

  switch (envelope.event_type) {
    case "plan.created":
      return applyPlanCreated(baseState, envelope.payload);
    case "plan.paused":
      return { ...baseState, status: "paused" };
    case "plan.resumed":
      return { ...baseState, status: "running" };
    case "plan.completed":
      return { ...baseState, status: "completed" };
    case "plan.failed":
      return { ...baseState, status: "failed" };
    case "plan.cancelled":
      return { ...baseState, status: "cancelled" };
    case "plan.updated":
      return applyPlanUpdate(baseState, envelope.payload);
    case "plan.node.added":
    case "plan.node.updated":
    case "plan.node.started":
    case "plan.node.completed":
    case "plan.node.failed":
    case "plan.node.skipped":
    case "plan.node.waiting_approval":
      return upsertNode(baseState, eventToNode(envelope.event_type, envelope.payload));
    case "artifact.created":
      return addArtifact(baseState, eventToArtifact(envelope.payload));
    case "proposal.created":
    case "memory.patch.proposed":
    case "knowledge.patch.proposed":
    case "proposal.approved":
    case "proposal.rejected":
    case "memory.patch.applied":
    case "knowledge.patch.applied":
      return upsertProposal(baseState, eventToProposal(envelope.event_type, envelope.payload));
    default:
      return baseState;
  }
}

export function applyPlanStreamEvents(
  state: PlanCanvasState,
  envelopes: readonly PlanStreamEventEnvelope[]
): PlanCanvasState {
  return envelopes.reduce(applyPlanStreamEvent, state);
}

function applyPlanCreated(
  state: PlanCanvasState,
  payload: Record<string, unknown>
): PlanCanvasState {
  const planId = readString(payload.planId) ?? readString(payload.plan_id);
  const sessionId = readString(payload.sessionId) ?? readString(payload.session_id);
  const goal = readString(payload.goal);

  return {
    ...state,
    status: readPlanStatus(payload.status) ?? "running",
    ...(planId ? { planId } : {}),
    ...(sessionId ? { sessionId } : {}),
    ...(goal ? { goal } : {}),
  };
}

function applyPlanUpdate(
  state: PlanCanvasState,
  payload: Record<string, unknown>
): PlanCanvasState {
  const status = readPlanStatus(payload.status);
  const goal = readString(payload.goal);
  const edges = Array.isArray(payload.edges) ? payload.edges.map(readEdge).filter(isDefined) : undefined;

  return {
    ...state,
    ...(status ? { status } : {}),
    ...(goal ? { goal } : {}),
    ...(edges ? { edges } : {}),
  };
}

function upsertNode(state: PlanCanvasState, node: PlanCanvasNode): PlanCanvasState {
  const existing = state.nodes.find((item) => item.nodeId === node.nodeId);
  const nodes = existing
    ? state.nodes.map((item) =>
        item.nodeId === node.nodeId
          ? { ...item, ...node, artifacts: node.artifacts.length > 0 ? node.artifacts : item.artifacts }
          : item
      )
    : [...state.nodes, node];

  return {
    ...state,
    status: state.status === "draft" ? "running" : state.status,
    nodes,
  };
}

function addArtifact(state: PlanCanvasState, artifact: PlanCanvasArtifact): PlanCanvasState {
  const artifacts = upsertById(state.artifacts, artifact, "artifactId");
  const nodes = artifact.nodeId
    ? state.nodes.map((node) =>
        node.nodeId === artifact.nodeId
          ? { ...node, artifacts: upsertById(node.artifacts, artifact, "artifactId") }
          : node
      )
    : state.nodes;

  return {
    ...state,
    artifacts,
    nodes,
  };
}

function upsertProposal(
  state: PlanCanvasState,
  proposal: PlanCanvasProposal
): PlanCanvasState {
  return {
    ...state,
    proposals: upsertById(state.proposals, proposal, "proposalId"),
  };
}

function eventToNode(
  eventType: PlanEventType,
  payload: Record<string, unknown>
): PlanCanvasNode {
  const nodeId = readString(payload.nodeId) ?? readString(payload.node_id) ?? "root";
  const title = readString(payload.title) ?? readString(payload.name) ?? "Plan step";
  const status = readNodeStatus(payload.status) ?? eventTypeToNodeStatus(eventType);
  const summary = readString(payload.summary);
  const parentNodeId = readString(payload.parentNodeId) ?? readString(payload.parent_node_id);
  const updatedAt = readString(payload.updatedAt) ?? readString(payload.updated_at);

  return {
    nodeId,
    title,
    kind: readNodeKind(payload.kind) ?? DEFAULT_NODE_KIND,
    status,
    artifacts: [],
    ...(summary ? { summary } : {}),
    ...(parentNodeId ? { parentNodeId } : {}),
    ...(isRecord(payload.metadata) ? { metadata: payload.metadata } : {}),
    ...(updatedAt ? { updatedAt } : {}),
  };
}

function eventToArtifact(payload: Record<string, unknown>): PlanCanvasArtifact {
  const artifactId =
    readString(payload.artifactId) ?? readString(payload.artifact_id) ?? cryptoSafeId("artifact");
  const nodeId = readString(payload.nodeId) ?? readString(payload.node_id);
  const uri = readString(payload.uri);

  return {
    artifactId,
    kind: readString(payload.kind) ?? "document",
    title: readString(payload.title) ?? "Artifact",
    ...(nodeId ? { nodeId } : {}),
    ...(uri ? { uri } : {}),
    ...(isRecord(payload.metadata) ? { metadata: payload.metadata } : {}),
  };
}

function eventToProposal(
  eventType: PlanEventType,
  payload: Record<string, unknown>
): PlanCanvasProposal {
  const status =
    eventType === "proposal.approved" ||
    eventType === "memory.patch.applied" ||
    eventType === "knowledge.patch.applied"
      ? "approved"
      : eventType === "proposal.rejected"
        ? "rejected"
        : "pending";
  const proposalId =
    readString(payload.proposalId) ?? readString(payload.proposal_id) ?? cryptoSafeId("proposal");
  const nodeId = readString(payload.nodeId) ?? readString(payload.node_id);
  const summary = readString(payload.summary);
  const targetKind =
    readString(payload.targetKind) ??
    readString(payload.target_kind) ??
    (eventType.startsWith("memory.") ? "memory" : undefined) ??
    (eventType.startsWith("knowledge.") ? "knowledge" : undefined);
  const operation = readString(payload.operation);
  const beforeJson = payload.beforeJson ?? payload.before_json;
  const afterJson = payload.afterJson ?? payload.after_json;

  return {
    proposalId,
    title: readString(payload.title) ?? defaultProposalTitle(targetKind),
    status,
    ...(nodeId ? { nodeId } : {}),
    ...(targetKind ? { targetKind } : {}),
    ...(operation ? { operation } : {}),
    ...(summary ? { summary } : {}),
    ...(beforeJson !== undefined ? { beforeJson } : {}),
    ...(afterJson !== undefined ? { afterJson } : {}),
    ...(isRecord(payload.metadata) ? { metadata: payload.metadata } : {}),
  };
}

function defaultProposalTitle(targetKind: string | undefined): string {
  if (targetKind === "memory") {
    return "Memory update";
  }
  if (targetKind === "knowledge") {
    return "Knowledge update";
  }
  return "Proposal";
}

function eventTypeToNodeStatus(eventType: PlanEventType): PlanNodeStatus {
  switch (eventType) {
    case "plan.node.started":
      return "running";
    case "plan.node.completed":
      return "completed";
    case "plan.node.failed":
      return "failed";
    case "plan.node.skipped":
      return "skipped";
    case "plan.node.waiting_approval":
      return "waiting_approval";
    default:
      return "pending";
  }
}

function readEdge(value: unknown): PlanCanvasEdge | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const sourceNodeId = readString(value.sourceNodeId) ?? readString(value.source_node_id);
  const targetNodeId = readString(value.targetNodeId) ?? readString(value.target_node_id);
  const label = readString(value.label);

  if (!sourceNodeId || !targetNodeId) {
    return undefined;
  }

  return {
    edgeId: readString(value.edgeId) ?? readString(value.edge_id) ?? `${sourceNodeId}:${targetNodeId}`,
    sourceNodeId,
    targetNodeId,
    ...(label ? { label } : {}),
  };
}

function readPlanStatus(value: unknown): PlanStatus | undefined {
  if (
    value === "draft" ||
    value === "running" ||
    value === "paused" ||
    value === "completed" ||
    value === "failed" ||
    value === "cancelled"
  ) {
    return value;
  }
  return undefined;
}

function readNodeKind(value: unknown): PlanNodeKind | undefined {
  if (
    value === "research" ||
    value === "analysis" ||
    value === "implementation" ||
    value === "verification" ||
    value === "decision" ||
    value === "handoff"
  ) {
    return value;
  }
  return undefined;
}

function readNodeStatus(value: unknown): PlanNodeStatus | undefined {
  if (
    value === "pending" ||
    value === "running" ||
    value === "waiting_approval" ||
    value === "completed" ||
    value === "failed" ||
    value === "skipped"
  ) {
    return value;
  }
  return undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function upsertById<T extends Record<K, string>, K extends keyof T>(
  items: readonly T[],
  next: T,
  key: K
): readonly T[] {
  return items.some((item) => item[key] === next[key])
    ? items.map((item) => (item[key] === next[key] ? next : item))
    : [...items, next];
}

function cryptoSafeId(prefix: string): string {
  if (globalThis.crypto && "randomUUID" in globalThis.crypto) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}`;
}
