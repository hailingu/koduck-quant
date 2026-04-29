import { useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minimize2, X } from "lucide-react";
import {
  FlowEditorCanvas,
  layoutFlowGraph,
  type EdgeRenderProps,
  type IFlowEdgeEntityData,
  type IFlowNodeEntityData,
  type NodeRenderProps,
} from "@koduck-flow";
import type { ConversationFlowSpec, ConversationFlowStep, PlanNodeStatus } from "./types";

type ConversationFlowNodePosition = { x: number; y: number };
type ConversationFlowLayoutMode = "auto" | "manual";

interface PersistedConversationFlowState {
  version: 1;
  sourceSpecSignature: string;
  flowSpec: ConversationFlowSpec;
  manualNodePositions: Record<string, ConversationFlowNodePosition>;
  createdEdges?: Array<{
    id: string;
    sourceNodeId: string;
    sourcePortId: string;
    targetNodeId: string;
    targetPortId: string;
  }>;
  deletedEdgeIds: string[];
  updatedAt: number;
}

interface ConversationFlowHistorySnapshot {
  flowSpec: ConversationFlowSpec;
  manualNodePositions: Record<string, ConversationFlowNodePosition>;
  createdEdges: IFlowEdgeEntityData[];
  deletedEdgeIds: string[];
}

function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    Boolean(target.closest("[contenteditable=''], [contenteditable='true']")) ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

function normalizeNodeStatus(value: unknown, fallback: PlanNodeStatus): PlanNodeStatus {
  return value === "pending" ||
    value === "running" ||
    value === "waiting_approval" ||
    value === "completed" ||
    value === "failed" ||
    value === "skipped"
    ? value
    : fallback;
}

function normalizeFlowString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeFlowStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeFlowString(item))
      .filter((item): item is string => Boolean(item));
  }

  const singleValue = normalizeFlowString(value);
  return singleValue ? [singleValue] : [];
}

export function parseConversationFlowSpec(raw: string): ConversationFlowSpec | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  const rawSteps = Array.isArray(record.steps) ? record.steps : [];
  if (rawSteps.length === 0) {
    return null;
  }

  const steps = rawSteps
    .map((item, index): ConversationFlowStep | null => {
      if (typeof item !== "object" || item === null) {
        return null;
      }

      const step = item as Record<string, unknown>;
      const id = normalizeFlowString(step.id) ?? `step_${index + 1}`;
      const name =
        normalizeFlowString(step.name) ??
        normalizeFlowString(step.title) ??
        `Step ${index + 1}`;
      const dependsOn = [
        ...normalizeFlowStringList(step.dependsOn),
        ...normalizeFlowStringList(step.depends_on),
        ...normalizeFlowStringList(step.dependencies),
      ];

      return {
        id,
        name,
        input: normalizeFlowStringList(step.input),
        output: normalizeFlowString(step.output),
        status: normalizeNodeStatus(step.status, "pending"),
        editable: typeof step.editable === "boolean" ? step.editable : true,
        dependsOn,
      };
    })
    .filter((item): item is ConversationFlowStep => Boolean(item));

  if (steps.length === 0) {
    return null;
  }

  return {
    title:
      normalizeFlowString(record.title) ??
      normalizeFlowString(record.goal) ??
      "Conversation Flow",
    version: normalizeFlowString(record.version),
    steps,
  };
}

export function extractConversationFlowSpecFromContent(content: string): ConversationFlowSpec | null {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  const fencedCodeBlocks = normalized.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi);

  for (const match of fencedCodeBlocks) {
    const block = match[1] ?? "";
    const flowSpec = parseConversationFlowSpec(block);
    if (flowSpec) {
      return flowSpec;
    }
  }

  return parseConversationFlowSpec(normalized);
}

export function getConversationFlowSpecSignature(spec: ConversationFlowSpec): string {
  return JSON.stringify(spec);
}

function isConversationFlowNodePosition(value: unknown): value is ConversationFlowNodePosition {
  if (!value || typeof value !== "object") {
    return false;
  }

  const position = value as Partial<ConversationFlowNodePosition>;
  return typeof position.x === "number" && typeof position.y === "number";
}

function normalizeConversationFlowNodePositions(
  value: unknown,
): Record<string, ConversationFlowNodePosition> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, ConversationFlowNodePosition] =>
        typeof entry[0] === "string" && isConversationFlowNodePosition(entry[1]),
    ),
  );
}

function normalizeConversationFlowCreatedEdges(value: unknown): PersistedConversationFlowState["createdEdges"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((edge): edge is NonNullable<PersistedConversationFlowState["createdEdges"]>[number] => {
    if (!edge || typeof edge !== "object") {
      return false;
    }

    const candidate = edge as Record<string, unknown>;
    return (
      typeof candidate.id === "string" &&
      typeof candidate.sourceNodeId === "string" &&
      typeof candidate.sourcePortId === "string" &&
      typeof candidate.targetNodeId === "string" &&
      typeof candidate.targetPortId === "string"
    );
  });
}

function isConversationFlowSpec(value: unknown): value is ConversationFlowSpec {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ConversationFlowSpec>;
  return (
    typeof candidate.title === "string" &&
    Array.isArray(candidate.steps) &&
    candidate.steps.every(
      (step) =>
        step &&
        typeof step === "object" &&
        typeof (step as Partial<ConversationFlowStep>).id === "string" &&
        typeof (step as Partial<ConversationFlowStep>).name === "string" &&
        Array.isArray((step as Partial<ConversationFlowStep>).input),
    )
  );
}

function readStoredConversationFlowState(
  storageKey: string | undefined,
  sourceSpecSignature: string,
): PersistedConversationFlowState | null {
  if (typeof window === "undefined" || !storageKey) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const record = parsed as Partial<PersistedConversationFlowState>;
    if (
      record.version !== 1 ||
      record.sourceSpecSignature !== sourceSpecSignature ||
      !isConversationFlowSpec(record.flowSpec)
    ) {
      return null;
    }

    return {
      version: 1,
      sourceSpecSignature,
      flowSpec: record.flowSpec,
      manualNodePositions: normalizeConversationFlowNodePositions(record.manualNodePositions),
      createdEdges: normalizeConversationFlowCreatedEdges(record.createdEdges),
      deletedEdgeIds: Array.isArray(record.deletedEdgeIds)
        ? record.deletedEdgeIds.filter((edgeId): edgeId is string => typeof edgeId === "string")
        : [],
      updatedAt: typeof record.updatedAt === "number" ? record.updatedAt : 0,
    };
  } catch {
    return null;
  }
}

function persistConversationFlowState(
  storageKey: string | undefined,
  state: PersistedConversationFlowState,
) {
  if (typeof window === "undefined" || !storageKey) {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(state));
}

function flowExecutionStateFromPlanStatus(status: PlanNodeStatus): IFlowNodeEntityData["executionState"] {
  if (status === "completed") {
    return "success";
  }
  if (status === "failed") {
    return "error";
  }
  if (status === "skipped") {
    return "skipped";
  }
  if (status === "running") {
    return "running";
  }
  return "pending";
}

type ConversationFlowRelationKind = "dependency" | "summary" | "needs_info";

function inferConversationFlowRelationKind(step: ConversationFlowStep): ConversationFlowRelationKind {
  const text = `${step.id} ${step.name} ${step.input.join(" ")} ${step.output ?? ""}`.toLowerCase();
  if (step.status === "waiting_approval" || /补充|资料|信息不足|确认|confirm|approval/.test(text)) {
    return "needs_info";
  }
  if (/综合|结论|汇总|总结|conclusion|summary/.test(text)) {
    return "summary";
  }
  return "dependency";
}

function conversationFlowRelationLabel(kind: ConversationFlowRelationKind): string {
  if (kind === "needs_info") {
    return "发现资料缺口";
  }
  if (kind === "summary") {
    return "汇总到结论";
  }
  return "输出作为输入";
}

const CONVERSATION_FLOW_NODE_WIDTH = 320;
const CONVERSATION_FLOW_MIN_NODE_HEIGHT = 170;
const CONVERSATION_FLOW_TEXT_UNITS_PER_LINE = 25;

function estimateConversationFlowTextUnits(text: string): number {
  return Array.from(text).reduce((sum, char) => {
    if (/[\u3400-\u9fff\u3000-\u303f\uff00-\uffef]/.test(char)) {
      return sum + 1;
    }
    if (/\s/.test(char)) {
      return sum + 0.25;
    }
    return sum + 0.55;
  }, 0);
}

function estimateConversationFlowWrappedLines(text: string): number {
  const normalized = text.trim();
  if (!normalized) {
    return 0;
  }

  return normalized
    .split(/\n+/)
    .reduce(
      (lines, line) =>
        lines + Math.max(1, Math.ceil(estimateConversationFlowTextUnits(line) / CONVERSATION_FLOW_TEXT_UNITS_PER_LINE)),
      0,
    );
}

function estimateConversationFlowNodeSize(step: ConversationFlowStep) {
  const inputLines = step.input.reduce(
    (sum, item) => sum + estimateConversationFlowWrappedLines(item),
    0,
  );
  const outputLines = estimateConversationFlowWrappedLines(step.output ?? "");
  const titleLines = estimateConversationFlowWrappedLines(step.name);
  const sectionCount = (inputLines > 0 ? 1 : 0) + (outputLines > 0 ? 1 : 0);
  const estimatedHeight =
    42 +
    Math.max(34, titleLines * 20) +
    24 +
    sectionCount * 28 +
    (inputLines + outputLines) * 20 +
    (step.editable ? 30 : 0);

  return {
    width: CONVERSATION_FLOW_NODE_WIDTH,
    height: Math.max(CONVERSATION_FLOW_MIN_NODE_HEIGHT, Math.ceil(estimatedHeight)),
  };
}

function buildConversationFlowGraph(spec: ConversationFlowSpec) {
  const nodes = spec.steps.map((step) => {
    const nodeSize = estimateConversationFlowNodeSize(step);
    return ({
      id: step.id,
      nodeType: step.name.includes("确认") ? "decision" : "research",
      label: step.name,
      position: { x: 0, y: 0 },
      size: nodeSize,
      executionState: flowExecutionStateFromPlanStatus(step.status),
      inputPorts: [
        {
          id: "in",
          name: "Input",
          type: "input",
          dataType: "object",
          side: "left",
          alignment: "center",
          visibility: "connected",
        },
      ],
      outputPorts: [
        {
          id: "out",
          name: "Output",
          type: "output",
          dataType: "object",
          side: "right",
          alignment: "center",
          visibility: "connected",
        },
      ],
      config: {
        input: step.input,
        output: step.output,
        editable: step.editable,
        status: step.status,
      },
      metadata: { source: "koduck-ai-conversation-flow" },
    }) as unknown as IFlowNodeEntityData;
  });

  const edges: IFlowEdgeEntityData[] = [];
  spec.steps.forEach((step, index) => {
    if (index === 0) {
      return;
    }

    const sourceId = spec.steps[index - 1].id;
    const relationKind = inferConversationFlowRelationKind(step);
    edges.push({
      id: `${sourceId}->${step.id}`,
      edgeType: "conversation-flow",
      label: conversationFlowRelationLabel(relationKind),
      sourceNodeId: sourceId,
      sourcePortId: "out",
      targetNodeId: step.id,
      targetPortId: "in",
      animationState: step.status === "running" ? "flowing" : "idle",
      metadata: { relationKind },
    } as unknown as IFlowEdgeEntityData);
  });

  const layout = layoutFlowGraph(nodes, edges, {
    strategy: "horizontal-dag",
    nodeSize: { width: CONVERSATION_FLOW_NODE_WIDTH, height: CONVERSATION_FLOW_MIN_NODE_HEIGHT },
    origin: { x: 48, y: 60 },
    horizontalGap: 180,
    verticalGap: 80,
  });

  const inputConnectedNodeIds = new Set(edges.map((edge) => edge.targetNodeId));
  const outputConnectedNodeIds = new Set(edges.map((edge) => edge.sourceNodeId));
  const nodesWithConnectionState = layout.nodes.map((node) => ({
    ...node,
    config: {
      ...((node.config ?? {}) as Record<string, unknown>),
      showInputPort: inputConnectedNodeIds.has(node.id),
      showOutputPort: outputConnectedNodeIds.has(node.id),
    },
  }));

  return { nodes: nodesWithConnectionState, edges };
}

export function ConversationKoduckFlowCanvas({
  spec,
  storageKey,
}: {
  spec: ConversationFlowSpec;
  storageKey?: string;
}) {
  const specSignature = useMemo(() => getConversationFlowSpecSignature(spec), [spec]);
  const initialPersistedState = useMemo(
    () => readStoredConversationFlowState(storageKey, specSignature),
    [specSignature, storageKey],
  );
  const [flowSpec, setFlowSpec] = useState(initialPersistedState?.flowSpec ?? spec);
  const [sourceSpecSignature, setSourceSpecSignature] = useState(specSignature);
  const [sourceStorageKey, setSourceStorageKey] = useState(storageKey);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [manualNodePositions, setManualNodePositions] = useState<
    Record<string, ConversationFlowNodePosition>
  >(initialPersistedState?.manualNodePositions ?? {});
  const [createdEdges, setCreatedEdges] = useState<IFlowEdgeEntityData[]>(
    () =>
      (initialPersistedState?.createdEdges ?? []).map(
        (edge) =>
          ({
            ...edge,
            edgeType: "conversation-flow",
            label: "自定义连接",
            animationState: "idle",
            metadata: { relationKind: "dependency", userCreated: true },
          }) as unknown as IFlowEdgeEntityData,
      ),
  );
  const [deletedEdgeIds, setDeletedEdgeIds] = useState<Set<string>>(
    () => new Set(initialPersistedState?.deletedEdgeIds ?? []),
  );
  const [fullscreen, setFullscreen] = useState(false);
  const fullscreenHistoryActiveRef = useRef(false);
  const undoStackRef = useRef<ConversationFlowHistorySnapshot[]>([]);
  const redoStackRef = useRef<ConversationFlowHistorySnapshot[]>([]);
  const activeNodeDragUndoRef = useRef<{ nodeId: string; cleanup: () => void } | null>(null);
  const layoutMode: ConversationFlowLayoutMode =
    Object.keys(manualNodePositions).length > 0 || deletedEdgeIds.size > 0 || createdEdges.length > 0
      ? "manual"
      : "auto";
  const { nodes, edges } = useMemo(() => {
    const graph = buildConversationFlowGraph(flowSpec);
    const graphEdgeKeys = new Set(
      graph.edges.map(
        (edge) =>
          `${edge.sourceNodeId}:${edge.sourcePortId}->${edge.targetNodeId}:${edge.targetPortId}`,
      ),
    );
    const mergedEdges = [
      ...graph.edges,
      ...createdEdges.filter(
        (edge) =>
          !graphEdgeKeys.has(
            `${edge.sourceNodeId}:${edge.sourcePortId}->${edge.targetNodeId}:${edge.targetPortId}`,
          ),
      ),
    ];
    const positionedNodes = graph.nodes.map((node) => ({
      ...node,
      position: manualNodePositions[node.id] ?? node.position,
      metadata: {
        ...((node.metadata ?? {}) as Record<string, unknown>),
        layoutMode: manualNodePositions[node.id] ? "manual" : "auto",
      },
    }));
    return {
      nodes: positionedNodes,
      edges: mergedEdges.filter((edge) => !deletedEdgeIds.has(edge.id)),
    };
  }, [createdEdges, deletedEdgeIds, flowSpec, manualNodePositions]);
  const selectedStep =
    flowSpec.steps.find((step) => step.id === editingStepId) ?? null;

  const createHistorySnapshot = (): ConversationFlowHistorySnapshot => ({
    flowSpec,
    manualNodePositions,
    createdEdges,
    deletedEdgeIds: Array.from(deletedEdgeIds),
  });

  const restoreHistorySnapshot = (snapshot: ConversationFlowHistorySnapshot) => {
    setFlowSpec(snapshot.flowSpec);
    setManualNodePositions(snapshot.manualNodePositions);
    setCreatedEdges(snapshot.createdEdges);
    setDeletedEdgeIds(new Set(snapshot.deletedEdgeIds));
  };

  const pushUndoSnapshot = () => {
    undoStackRef.current = [...undoStackRef.current.slice(-49), createHistorySnapshot()];
    redoStackRef.current = [];
  };

  const undoConversationFlowEdit = () => {
    const snapshot = undoStackRef.current.pop();
    if (!snapshot) {
      return;
    }

    redoStackRef.current.push(createHistorySnapshot());
    restoreHistorySnapshot(snapshot);
  };

  const redoConversationFlowEdit = () => {
    const snapshot = redoStackRef.current.pop();
    if (!snapshot) {
      return;
    }

    undoStackRef.current.push(createHistorySnapshot());
    restoreHistorySnapshot(snapshot);
  };

  useEffect(() => {
    if (specSignature === sourceSpecSignature && storageKey === sourceStorageKey) {
      return;
    }

    undoStackRef.current = [];
    redoStackRef.current = [];
    const persistedState = readStoredConversationFlowState(storageKey, specSignature);
    setSourceSpecSignature(specSignature);
    setSourceStorageKey(storageKey);
    setFlowSpec(persistedState?.flowSpec ?? spec);
    setManualNodePositions(persistedState?.manualNodePositions ?? {});
    setCreatedEdges(
      (persistedState?.createdEdges ?? []).map(
        (edge) =>
          ({
            ...edge,
            edgeType: "conversation-flow",
            label: "自定义连接",
            animationState: "idle",
            metadata: { relationKind: "dependency", userCreated: true },
          }) as unknown as IFlowEdgeEntityData,
      ),
    );
    setDeletedEdgeIds(new Set(persistedState?.deletedEdgeIds ?? []));
    setSelectedStepId(null);
    setSelectedEdgeId(null);
    setEditingStepId(null);
  }, [sourceSpecSignature, sourceStorageKey, spec, specSignature, storageKey]);

  useEffect(
    () => () => {
      activeNodeDragUndoRef.current?.cleanup();
      activeNodeDragUndoRef.current = null;
    },
    [],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableEventTarget(event.target) || (!event.ctrlKey && !event.metaKey)) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key !== "z" && key !== "y") {
        return;
      }

      event.preventDefault();
      if (key === "y" || event.shiftKey) {
        redoConversationFlowEdit();
        return;
      }
      undoConversationFlowEdit();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  useEffect(() => {
    const currentNodeIds = new Set(flowSpec.steps.map((step) => step.id));
    setManualNodePositions((prev) => {
      const next = Object.fromEntries(
        Object.entries(prev).filter(([nodeId]) => currentNodeIds.has(nodeId)),
      );
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
    setCreatedEdges((prev) =>
      prev.filter(
        (edge) =>
          currentNodeIds.has(edge.sourceNodeId) && currentNodeIds.has(edge.targetNodeId),
      ),
    );
  }, [flowSpec.steps]);

  useEffect(() => {
    persistConversationFlowState(storageKey, {
      version: 1,
      sourceSpecSignature,
      flowSpec,
      manualNodePositions,
      createdEdges: createdEdges.map((edge) => ({
        id: edge.id,
        sourceNodeId: edge.sourceNodeId,
        sourcePortId: edge.sourcePortId,
        targetNodeId: edge.targetNodeId,
        targetPortId: edge.targetPortId,
      })),
      deletedEdgeIds: Array.from(deletedEdgeIds),
      updatedAt: Date.now(),
    });
  }, [createdEdges, deletedEdgeIds, flowSpec, manualNodePositions, sourceSpecSignature, storageKey]);

  useEffect(() => {
    if (!fullscreen) {
      return undefined;
    }

    const handlePopState = () => {
      fullscreenHistoryActiveRef.current = false;
      setFullscreen(false);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [fullscreen]);

  const openFullscreen = () => {
    if (!fullscreenHistoryActiveRef.current) {
      window.history.pushState({ koduckAiFlowFullscreen: true }, "", window.location.href);
      fullscreenHistoryActiveRef.current = true;
    }
    setFullscreen(true);
  };

  const closeFullscreen = () => {
    if (fullscreenHistoryActiveRef.current) {
      fullscreenHistoryActiveRef.current = false;
      window.history.back();
      return;
    }
    setFullscreen(false);
  };

  const updateSelectedStep = (patch: Partial<ConversationFlowStep>) => {
    if (!editingStepId) {
      return;
    }

    pushUndoSnapshot();
    setFlowSpec((prev) => ({
      ...prev,
      steps: prev.steps.map((step) =>
        step.id === editingStepId ? { ...step, ...patch } : step,
      ),
    }));
  };

  const handleCanvasClick = () => {
    setSelectedStepId(null);
    setSelectedEdgeId(null);
  };

  const handleNodeSelect = (nodeIds: string[]) => {
    setSelectedStepId(nodeIds[0] ?? null);
    setSelectedEdgeId(null);
  };

  const handleEdgeSelect = (edgeIds: string[]) => {
    setSelectedEdgeId(edgeIds[0] ?? null);
    setSelectedStepId(null);
  };

  const handleNodeMove = (nodeId: string, position: { x: number; y: number }) => {
    if (activeNodeDragUndoRef.current?.nodeId !== nodeId) {
      activeNodeDragUndoRef.current?.cleanup();
      pushUndoSnapshot();

      const cleanup = () => {
        window.removeEventListener("pointerup", cleanup);
        window.removeEventListener("pointercancel", cleanup);
        if (activeNodeDragUndoRef.current?.nodeId === nodeId) {
          activeNodeDragUndoRef.current = null;
        }
      };

      activeNodeDragUndoRef.current = { nodeId, cleanup };
      window.addEventListener("pointerup", cleanup);
      window.addEventListener("pointercancel", cleanup);
    }

    setManualNodePositions((prev) => ({
      ...prev,
      [nodeId]: position,
    }));
  };

  const handleEdgeDelete = (edgeId: string) => {
    pushUndoSnapshot();
    setDeletedEdgeIds((prev) => new Set(prev).add(edgeId));
    setSelectedEdgeId(null);
  };

  const handleEdgeCreate = (
    sourceNodeId: string,
    sourcePortId: string,
    targetNodeId: string,
    targetPortId: string,
  ) => {
    pushUndoSnapshot();
    const edgeId = `${sourceNodeId}:${sourcePortId}->${targetNodeId}:${targetPortId}`;
    const baseEdgeId = `${sourceNodeId}->${targetNodeId}`;
    const sourceStepIndex = flowSpec.steps.findIndex((step) => step.id === sourceNodeId);
    const isBaseGraphEdge =
      sourcePortId === "out" &&
      targetPortId === "in" &&
      sourceStepIndex >= 0 &&
      flowSpec.steps[sourceStepIndex + 1]?.id === targetNodeId;

    if (isBaseGraphEdge) {
      setDeletedEdgeIds((prev) => {
        if (!prev.has(baseEdgeId)) {
          return prev;
        }
        const next = new Set(prev);
        next.delete(baseEdgeId);
        return next;
      });
      setSelectedEdgeId(baseEdgeId);
      return;
    }

    setCreatedEdges((prev) => {
      if (prev.some((edge) => edge.id === edgeId)) {
        return prev;
      }

      return [
        ...prev,
        {
          id: edgeId,
          edgeType: "conversation-flow",
          label: "自定义连接",
          sourceNodeId,
          sourcePortId,
          targetNodeId,
          targetPortId,
          animationState: "idle",
          metadata: { relationKind: "dependency", userCreated: true },
        } as unknown as IFlowEdgeEntityData,
      ];
    });
    setDeletedEdgeIds((prev) => {
      if (!prev.has(edgeId)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(edgeId);
      return next;
    });
    setSelectedEdgeId(edgeId);
  };

  const renderFlowNode = (isEditor: boolean) => ({ node, selected }: NodeRenderProps) => (
    <div
      className="h-full w-full text-left outline-none transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[#0d8b6d]"
      onDoubleClick={() => {
        if (isEditor) {
          setEditingStepId(node.id);
        }
      }}
    >
      <ConversationFlowNode node={node} selected={selected} />
    </div>
  );

  const renderEditorCanvas = () => (
    <FlowEditorCanvas
      nodes={nodes}
      edges={edges}
      selectedNodeIds={selectedStepId ? [selectedStepId] : []}
      selectedEdgeIds={selectedEdgeId ? [selectedEdgeId] : []}
      width="100vw"
      height="100vh"
      initialFit="contain"
      fitPadding={80}
      fallbackNodeSize={{
        width: CONVERSATION_FLOW_NODE_WIDTH,
        height: CONVERSATION_FLOW_MIN_NODE_HEIGHT,
      }}
      showGrid
      showMinimap
      showZoomControls
      showLocationControls
      gridPattern={{ size: 24, opacity: 0.35 }}
      theme={{ canvasBackground: "#f8fafc" }}
      onCanvasClick={handleCanvasClick}
      onNodeSelect={handleNodeSelect}
      onEdgeSelect={handleEdgeSelect}
      onNodeMove={handleNodeMove}
      onEdgeCreate={handleEdgeCreate}
      onEdgeDelete={handleEdgeDelete}
      renderNode={renderFlowNode(true)}
      renderEdge={(props) => <ConversationFlowEdge {...props} />}
    />
  );

  return (
    <section
      className="relative mb-4 w-full max-w-3xl overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
      data-layout-mode={layoutMode}
      style={{ width: 760, maxWidth: "100%" }}
    >
      <FlowEditorCanvas
        nodes={nodes}
        edges={edges}
        selectedNodeIds={selectedStepId ? [selectedStepId] : []}
        selectedEdgeIds={selectedEdgeId ? [selectedEdgeId] : []}
        width="100%"
        height={320}
        initialFit="contain"
        fitPadding={48}
        minZoom={0.25}
        maxZoom={1.5}
        fallbackNodeSize={{
          width: CONVERSATION_FLOW_NODE_WIDTH,
          height: CONVERSATION_FLOW_MIN_NODE_HEIGHT,
        }}
        className="relative overflow-hidden bg-gray-50"
        showGrid
        gridPattern={{ size: 24, opacity: 0.35 }}
        theme={{ canvasBackground: "#f8fafc" }}
        onCanvasClick={handleCanvasClick}
        onNodeSelect={handleNodeSelect}
        onEdgeSelect={handleEdgeSelect}
        onNodeMove={handleNodeMove}
        onEdgeCreate={handleEdgeCreate}
        onEdgeDelete={handleEdgeDelete}
        renderNode={renderFlowNode(false)}
        renderEdge={(props) => <ConversationFlowEdge {...props} />}
        overlay={
          <button
            type="button"
            className="absolute bottom-3 right-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white/95 text-gray-700 shadow-sm hover:bg-gray-50"
            onClick={openFullscreen}
            aria-label="最大化编辑 Flow"
            title="最大化编辑"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        }
      />
      {fullscreen ? (
        <div className="fixed inset-0 z-50 bg-white">
          <div className="absolute inset-0 bg-gray-50">
            {renderEditorCanvas()}
          </div>
          <button
            type="button"
            className="absolute bottom-5 right-5 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white/95 text-gray-700 shadow-lg hover:bg-gray-50"
            onClick={closeFullscreen}
            aria-label="退出全屏编辑"
            title="退出全屏"
          >
            <Minimize2 className="h-4 w-4" />
          </button>
        </div>
      ) : null}
      {selectedStep ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-6">
          <div className="w-full max-w-3xl rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Edit flow node
                </div>
                <h2 className="text-xl font-semibold text-gray-950">{selectedStep.name}</h2>
              </div>
              <button
                type="button"
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                onClick={() => setEditingStepId(null)}
                aria-label="关闭节点编辑"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid gap-4 px-6 py-5">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-gray-700">节点名称</span>
                <input
                  className="rounded-lg border border-gray-200 px-3 py-2 text-base outline-none focus:border-[#0d8b6d] focus:ring-2 focus:ring-[#0d8b6d]/15"
                  value={selectedStep.name}
                  onChange={(event) => updateSelectedStep({ name: event.target.value })}
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-gray-700">输入</span>
                <textarea
                  className="min-h-28 rounded-lg border border-gray-200 px-3 py-2 text-base outline-none focus:border-[#0d8b6d] focus:ring-2 focus:ring-[#0d8b6d]/15"
                  value={selectedStep.input.join("\n")}
                  onChange={(event) =>
                    updateSelectedStep({
                      input: event.target.value
                        .split("\n")
                        .map((item) => item.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-gray-700">输出</span>
                <input
                  className="rounded-lg border border-gray-200 px-3 py-2 text-base outline-none focus:border-[#0d8b6d] focus:ring-2 focus:ring-[#0d8b6d]/15"
                  value={selectedStep.output ?? ""}
                  onChange={(event) => updateSelectedStep({ output: event.target.value })}
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-gray-700">状态</span>
                <select
                  className="rounded-lg border border-gray-200 px-3 py-2 text-base outline-none focus:border-[#0d8b6d] focus:ring-2 focus:ring-[#0d8b6d]/15"
                  value={selectedStep.status}
                  onChange={(event) =>
                    updateSelectedStep({ status: event.target.value as PlanNodeStatus })
                  }
                >
                  <option value="pending">pending</option>
                  <option value="running">running</option>
                  <option value="waiting_approval">waiting_approval</option>
                  <option value="completed">completed</option>
                  <option value="failed">failed</option>
                  <option value="skipped">skipped</option>
                </select>
              </label>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ConversationFlowNode({ node, selected }: NodeRenderProps) {
  const config = (node.config ?? {}) as Record<string, unknown>;
  const input = normalizeFlowStringList(config.input);
  const output = normalizeFlowString(config.output);
  const editable = config.editable !== false;
  const status = normalizeFlowString(config.status) ?? node.executionState;
  const showInputPort = config.showInputPort === true;
  const showOutputPort = config.showOutputPort === true;

  return (
    <article
      className={`relative h-full overflow-visible rounded-lg border bg-white shadow-sm transition-shadow ${
        selected ? "border-[#0d8b6d] ring-2 ring-[#0d8b6d]/20" : "border-gray-200"
      }`}
    >
      {showInputPort ? (
        <span
          className="absolute left-0 top-1/2 z-10 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#2563eb] shadow"
          title="Input port"
        />
      ) : null}
      {showOutputPort ? (
        <span
          className="absolute right-0 top-1/2 z-10 h-3 w-3 -translate-y-1/2 translate-x-1/2 rounded-full border-2 border-white bg-[#2563eb] shadow"
          title="Output port"
        />
      ) : null}
      <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
        <div className="min-w-0">
          <h3 className="break-words text-sm font-semibold leading-5 text-gray-950">{node.label}</h3>
          <p className="mt-0.5 text-xs text-gray-500">{node.nodeType}</p>
        </div>
        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-700">
          {status}
        </span>
      </div>
      <div className="space-y-2 px-4 py-3 text-xs leading-5 text-gray-700">
        {input.length > 0 ? (
          <div>
            <div className="font-medium text-gray-950">Input</div>
            <div className="whitespace-pre-wrap break-words">{input.join("\n")}</div>
          </div>
        ) : null}
        {output ? (
          <div>
            <div className="font-medium text-gray-950">Output</div>
            <div className="whitespace-pre-wrap break-words">{output}</div>
          </div>
        ) : null}
        {editable ? (
          <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
            editable
          </span>
        ) : null}
      </div>
    </article>
  );
}

function ConversationFlowEdge({ edge, sourcePosition, targetPosition, route, selected }: EdgeRenderProps) {
  const path =
    route?.path ??
    `M ${sourcePosition.x} ${sourcePosition.y} L ${targetPosition.x} ${targetPosition.y}`;
  const relationKind =
    ((edge.metadata as Record<string, unknown> | undefined)?.relationKind as
      | ConversationFlowRelationKind
      | undefined) ?? "dependency";
  const color =
    relationKind === "needs_info"
      ? "#d97706"
      : relationKind === "summary"
        ? "#7c3aed"
        : "#2563eb";
  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke={selected ? "#0d8b6d" : "#cbd5e1"}
        strokeLinecap="round"
        strokeWidth={selected ? 8 : 6}
      />
      <path
        d={path}
        fill="none"
        stroke={selected ? "#0d8b6d" : color}
        strokeLinecap="round"
        strokeWidth={selected ? 3 : 2.25}
        markerEnd="url(#flow-edge-arrow)"
      />
    </g>
  );
}
