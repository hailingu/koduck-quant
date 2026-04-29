import React, { useCallback, useRef, useState } from "react";
import { useFlow } from "../../provider/hooks/useFlow";
import { useKoduckFlowManagers } from "../../provider/hooks/useKoduckFlowRuntime";
import { KoduckFlowProvider } from "../../provider/KoduckFlowProvider";
import { Editor, type RenderContextBuilder } from "../../editor/Editor";
import { VirtualList } from "../../virtualized/VirtualList";
import { logger } from "../../../common/logger";
import { DEFAULT_KODUCKFLOW_ENVIRONMENT } from "../../../common/global-runtime";
// Ensure UML entities are loaded and registered before UI renders
import "./uml-entities-new-decorator";
// Ensure Flow Canvas entities (Start, Action, Decision, End) are loaded and registered
import "./flow-canvas-entities";
import { InteractionManager, DragTool, PortConnectionTool } from "../../../common/interaction";
import type { FormSchema } from "../../flow-entity/types";
import { FlowNodeForm } from "../../flow-entity/node/form";
import { FLOW_NODE_THEMES } from "../../flow-entity/themes/flow-node-themes";
import {
  ACTION_FORM_SCHEMA,
  DECISION_FORM_SCHEMA,
  END_FORM_SCHEMA,
  START_FORM_SCHEMA,
} from "../../flow-entity/examples";
import { BaseFlowNode } from "../../flow-entity/node/BaseFlowNode";
import { FlowEntityProvider } from "../../flow-entity/context";
import { FlowNodeEntity } from "../../../common/flow/flow-node-entity";

const ENABLE_CANVAS_ZOOM = false;

const FlowDemoEvent = {
  Init: "flow-demo:init",
  RegistryState: "flow-demo:registry-state",
  ViewportChanged: "flow-demo:viewport-changed",
  ViewportSyncFailed: "flow-demo:viewport-sync-failed",
  RenderContextReady: "flow-demo:render-context-ready",
  RenderContextApplied: "flow-demo:render-context-applied",
  NodesUpdated: "flow-demo:nodes-updated",
  FlowCreateRequested: "flow-demo:flow-create-requested",
  FlowInstanceStatus: "flow-demo:flow-instance-status",
  UmlEntityCreateStart: "flow-demo:uml-entity-create-start",
  UmlEntityCreateSuccess: "flow-demo:uml-entity-create-success",
  UmlEntityCreateFailure: "flow-demo:uml-entity-create-failure",
  EntityMetrics: "flow-demo:entity-metrics",
  EntityDetails: "flow-demo:entity-details",
  EntitySummary: "flow-demo:entity-summary",
  RenderContextUpdated: "flow-demo:render-context-updated",
} as const;

const flowLogger = logger.withContext({
  tag: "flow-demo",
  metadata: {
    component: "FlowDemo",
  },
});

type VirtualTelemetryItem = {
  readonly id: string;
  readonly label: string;
  readonly severity: "info" | "warn" | "error";
  readonly durationMs: number;
};

const VIRTUAL_LIST_PRESETS = {
  sample: 2000,
  production: 25000,
  stress: 100000,
} as const;

const DEFAULT_VIRTUAL_LIST_SIZE = VIRTUAL_LIST_PRESETS.production;
const VIRTUAL_LIST_CONTAINER_HEIGHT = 400;
const VIRTUAL_LIST_BUFFER_SIZE = 8;

type FlowCommand = {
  description: string;
  undo: () => void;
  redo: () => void;
};

type FlowEntityLike = {
  id: string;
  type?: string;
  label?: string;
  getBounds?: () => { x: number; y: number; width: number; height: number };
  data?: {
    label?: string;
    width?: number;
    height?: number;
    size?: { width?: number; height?: number };
    position?: { x: number; y: number };
    config?: Record<string, unknown>;
    [key: string]: unknown;
  };
  config?: Record<string, unknown>;
};

const FLOW_CANVAS_NODE_TYPES = {
  Start: "flow-start-canvas",
  Action: "flow-action-canvas",
  Decision: "flow-decision-canvas",
  End: "flow-end-canvas",
} as const;

type FlowCanvasNodeType = (typeof FLOW_CANVAS_NODE_TYPES)[keyof typeof FLOW_CANVAS_NODE_TYPES];

type FlowNodeFormDefinition = {
  schema: FormSchema;
  defaults: Record<string, unknown>;
  title: string;
  description: string;
  themeKey: keyof typeof FLOW_NODE_THEMES;
  badgeField?: string;
  minHeight?: number;
};

const FLOW_NODE_FORM_MIN_HEIGHT = 180;

const FLOW_NODE_FORM_DEFINITIONS: Record<FlowCanvasNodeType, FlowNodeFormDefinition> = {
  [FLOW_CANVAS_NODE_TYPES.Start]: {
    schema: START_FORM_SCHEMA,
    defaults: {
      triggerType: "manual",
      triggerDescription: "",
    },
    title: "流程入口",
    description: "配置触发方式与触发描述，帮助团队理解这是如何启动的节点。",
    themeKey: "start",
    badgeField: "triggerType",
    minHeight: 200,
  },
  [FLOW_CANVAS_NODE_TYPES.Action]: {
    schema: ACTION_FORM_SCHEMA,
    defaults: {
      actionType: "process",
      description: "",
      customAction: "",
    },
    title: "动作节点",
    description: "直接在画布上定义要执行的动作、描述以及可选的自定义指令。",
    themeKey: "action",
    badgeField: "actionType",
    minHeight: 240,
  },
  [FLOW_CANVAS_NODE_TYPES.Decision]: {
    schema: DECISION_FORM_SCHEMA,
    defaults: {
      condition: "",
      trueLabel: "Yes",
      falseLabel: "No",
    },
    title: "条件判断",
    description: "维护条件表达式与分支标签，让逻辑分支和文案保持一致。",
    themeKey: "decision",
    minHeight: 220,
  },
  [FLOW_CANVAS_NODE_TYPES.End]: {
    schema: END_FORM_SCHEMA,
    defaults: {
      endType: "success",
      endDescription: "",
      returnValue: "",
    },
    title: "结束节点",
    description: "定义流程的结束状态以及返回值说明，便于下游消费。",
    themeKey: "end",
    badgeField: "endType",
    minHeight: 200,
  },
};

function resolveFlowNodeType(entity?: FlowEntityLike | null): FlowCanvasNodeType | null {
  const candidate = entity?.type ?? (entity?.data as { type?: string } | undefined)?.type;
  if (!candidate) {
    return null;
  }
  switch (candidate) {
    case FLOW_CANVAS_NODE_TYPES.Start:
    case FLOW_CANVAS_NODE_TYPES.Action:
    case FLOW_CANVAS_NODE_TYPES.Decision:
    case FLOW_CANVAS_NODE_TYPES.End:
      return candidate;
    default:
      return null;
  }
}

function buildDefaultNodeConfig(nodeType: FlowCanvasNodeType, entity?: FlowEntityLike) {
  const definition = FLOW_NODE_FORM_DEFINITIONS[nodeType];
  const entityConfig =
    (entity?.data as { config?: Record<string, unknown> } | undefined)?.config ||
    entity?.config ||
    {};
  return {
    ...definition.defaults,
    ...entityConfig,
  } satisfies Record<string, unknown>;
}

function syncNodeConfigsWithNodes(
  prevConfigs: Record<string, Record<string, unknown>>,
  flowNodes: readonly FlowEntityLike[]
) {
  const next: Record<string, Record<string, unknown>> = {};
  let changed = false;

  for (const node of flowNodes) {
    const existing = prevConfigs[node.id];
    if (existing) {
      next[node.id] = existing;
      continue;
    }
    const nodeType = resolveFlowNodeType(node);
    if (!nodeType) {
      continue;
    }
    next[node.id] = buildDefaultNodeConfig(nodeType, node);
    changed = true;
  }

  if (!changed && Object.keys(prevConfigs).length === Object.keys(next).length) {
    return prevConfigs;
  }
  return next;
}

function getFlowNodeDimensions(
  entity: FlowEntityLike | undefined,
  nodeType: FlowCanvasNodeType
): { width: number; height: number } {
  const theme = FLOW_NODE_THEMES[FLOW_NODE_FORM_DEFINITIONS[nodeType].themeKey];
  // Prefer size.width/size.height (fields updated by resize), then top-level width/height
  const width =
    (entity?.data as { size?: { width?: number } } | undefined)?.size?.width ??
    (entity?.data as { width?: number } | undefined)?.width ??
    theme.defaultWidth;
  const height =
    (entity?.data as { size?: { height?: number } } | undefined)?.size?.height ??
    (entity?.data as { height?: number } | undefined)?.height ??
    theme.defaultHeight;
  return { width, height };
}

function getFlowNodeLabel(entity?: FlowEntityLike | null) {
  return entity?.label ?? (entity?.data as { label?: string } | undefined)?.label ?? "未命名节点";
}

function getStringField(formData: Record<string, unknown>, fieldName: string) {
  const value = formData?.[fieldName];
  return typeof value === "string" && value.trim().length > 0 ? value : "未配置";
}

function createVirtualTelemetry(size: number): VirtualTelemetryItem[] {
  const items: VirtualTelemetryItem[] = new Array(size);
  for (let i = 0; i < size; i += 1) {
    const severityRoll = i % 17;
    let severity: VirtualTelemetryItem["severity"] = "info";
    if (severityRoll === 0) {
      severity = "error";
    } else if (severityRoll % 5 === 0) {
      severity = "warn";
    }
    items[i] = {
      id: `evt-${i.toString(36)}`,
      label: `Workflow #${(i % 500) + 1} — Batch ${(i / 500).toFixed(0)}`,
      severity,
      durationMs: 28 + ((i * 13) % 72),
    } satisfies VirtualTelemetryItem;
  }
  return items;
}

/**
 * Simplified FlowDemo component
 * Keeps only Editor and basic new Flow functionality
 * @returns The FlowDemo component
 */
const FlowDemoContent: React.FC = () => {
  const { runtime, renderManager, entityManager, renderEvents } = useKoduckFlowManagers();

  // Check registry state on component initialization
  React.useEffect(() => {
    flowLogger.info({
      event: FlowDemoEvent.Init,
      message: "FlowDemo component initialized",
      emoji: "🎪",
    });
    const registryManager = runtime.RegistryManager;
    const registries = registryManager.getRegistryNames();
    flowLogger.info({
      event: FlowDemoEvent.RegistryState,
      message: "Registry state captured",
      emoji: "📊",
      metadata: {
        registryCount: registries.length,
        hasUmlClass: registryManager.hasRegistry("uml-class-canvas"),
        hasUmlUseCase: registryManager.hasRegistry("uml-usecase-canvas"),
      },
      details: {
        registries,
      },
    });
  }, [runtime]);

  // Interaction selection and drag state

  // Editor state management
  const [canvasRef, setCanvasRef] = useState<HTMLCanvasElement | null>(null);

  // Render context builder
  const [renderContextBuilder, setRenderContextBuilder] = useState<RenderContextBuilder | null>(
    null
  );

  // Initialize useFlow with canvas reference
  const { flow, nodes, edges, nodePositions, addNode, addEdge, removeNode } = useFlow({
    canvas: canvasRef,
  });

  const renderEntities = React.useMemo(() => [...nodes, ...edges], [nodes, edges]);

  React.useEffect(() => {
    setNodeConfigs((prev) => syncNodeConfigsWithNodes(prev, nodes as FlowEntityLike[]));
  }, [nodes]);

  const [virtualListSize, setVirtualListSize] = useState<number>(DEFAULT_VIRTUAL_LIST_SIZE);
  const [virtualTelemetryItems, setVirtualTelemetryItems] = useState<VirtualTelemetryItem[]>(() =>
    createVirtualTelemetry(DEFAULT_VIRTUAL_LIST_SIZE)
  );
  const [visibleTelemetryRange, setVisibleTelemetryRange] = useState({ start: 0, end: 0 });

  const updateTelemetryItems = useCallback((size: number) => {
    setVirtualListSize(size);
    setVirtualTelemetryItems(createVirtualTelemetry(size));
  }, []);

  const handleTelemetryPreset = useCallback(
    (size: number) => () => {
      updateTelemetryItems(size);
    },
    [updateTelemetryItems]
  );

  const refreshTelemetryDataset = useCallback(() => {
    updateTelemetryItems(virtualListSize);
  }, [updateTelemetryItems, virtualListSize]);

  React.useEffect(() => {
    setVisibleTelemetryRange({
      start: 0,
      end: Math.max(0, Math.min(virtualTelemetryItems.length - 1, 40)),
    });
  }, [virtualTelemetryItems]);

  const telemetryPalette = React.useMemo(
    () => ({
      info: "#2563eb",
      warn: "#d97706",
      error: "#dc2626",
    }),
    []
  );

  const telemetryStats = React.useMemo(() => {
    let info = 0;
    let warn = 0;
    let error = 0;
    for (const item of virtualTelemetryItems) {
      if (item.severity === "error") {
        error += 1;
      } else if (item.severity === "warn") {
        warn += 1;
      } else {
        info += 1;
      }
    }
    return { info, warn, error };
  }, [virtualTelemetryItems]);

  const telemetryItemHeight = useCallback((item: VirtualTelemetryItem, index: number) => {
    let severityWeight = 8;
    if (item.severity === "error") {
      severityWeight = 32;
    } else if (item.severity === "warn") {
      severityWeight = 16;
    }
    return 48 + severityWeight + (index % 7) * 4;
  }, []);

  const renderTelemetryRow = useCallback(
    (item: VirtualTelemetryItem, index: number) => {
      const color = telemetryPalette[item.severity];
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            padding: "8px 12px",
            width: "100%",
            background: index % 2 === 0 ? "rgba(241, 245, 249, 0.55)" : "rgba(248, 250, 252, 0.35)",
            borderLeft: `4px solid ${color}`,
            borderRadius: "4px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 600, color: "#0f172a" }}>{item.label}</span>
            <span style={{ fontFamily: "monospace", fontSize: "0.85rem", color }}>{item.id}</span>
          </div>
          <div style={{ display: "flex", gap: "12px", fontSize: "0.85rem", color: "#475569" }}>
            <span>
              Severity: <strong style={{ color }}>{item.severity.toUpperCase()}</strong>
            </span>
            <span>Latency: {item.durationMs} ms</span>
            <span>Index: {index}</span>
          </div>
        </div>
      );
    },
    [telemetryPalette]
  );

  const handleTelemetryScroll = useCallback((range: { start: number; end: number }) => {
    setVisibleTelemetryRange(range);
  }, []);

  const visibleTelemetryCount = Math.max(
    0,
    visibleTelemetryRange.end - visibleTelemetryRange.start + 1
  );

  const [isDragging, setIsDragging] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isPanMode, setIsPanMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [nodeConfigs, setNodeConfigs] = useState<Record<string, Record<string, unknown>>>({});
  const [activeFlowNodeId, setActiveFlowNodeId] = useState<string | null>(null);
  const [viewportState, setViewportState] = useState({
    x: 0,
    y: 0,
    zoom: 1,
    width: 0,
    height: 0,
  });
  const [historyMetadata, setHistoryMetadata] = useState({ canUndo: false, canRedo: false });
  const undoStackRef = useRef<FlowCommand[]>([]);
  const redoStackRef = useRef<FlowCommand[]>([]);
  const nodeLabelCounterRef = useRef(0);

  const refreshHistoryState = useCallback(() => {
    setHistoryMetadata({
      canUndo: undoStackRef.current.length > 0,
      canRedo: redoStackRef.current.length > 0,
    });
  }, []);

  const pushHistoryCommand = useCallback(
    (command: FlowCommand) => {
      undoStackRef.current.push(command);
      redoStackRef.current = [];
      refreshHistoryState();
    },
    [refreshHistoryState]
  );

  const handleUndo = useCallback(() => {
    const command = undoStackRef.current.pop();
    if (!command) return;

    try {
      command.undo();
    } catch (error) {
      flowLogger.warn({
        event: "flow-demo:undo-error",
        message: "Failed to execute undo command",
        emoji: "⚠️",
        error,
        metadata: {
          description: command.description,
        },
      });
    }

    redoStackRef.current.push(command);
    refreshHistoryState();
  }, [refreshHistoryState]);

  const handleRedo = useCallback(() => {
    const command = redoStackRef.current.pop();
    if (!command) return;

    try {
      command.redo();
    } catch (error) {
      flowLogger.warn({
        event: "flow-demo:redo-error",
        message: "Failed to execute redo command",
        emoji: "⚠️",
        error,
        metadata: {
          description: command.description,
        },
      });
      // Failed redo should push the command back to redo stack for retry
      redoStackRef.current.push(command);
      return;
    }

    undoStackRef.current.push(command);
    refreshHistoryState();
  }, [refreshHistoryState]);
  // Use ref to keep latest selection set for DragTool to read, avoiding interaction manager rebuild on selection change
  const selectedIdsRef = React.useRef<Set<string>>(new Set());
  // Sync once on initialization
  if (selectedIdsRef.current !== selectedIds) {
    selectedIdsRef.current = selectedIds;
  }

  React.useEffect(() => {
    if (selectedIds.size === 0) {
      setActiveFlowNodeId((prev) => (prev === null ? prev : null));
      return;
    }

    let nextActive: string | null = null;
    for (const id of selectedIds) {
      const entity = entityManager.getEntity(id) as FlowEntityLike | undefined;
      if (resolveFlowNodeType(entity)) {
        nextActive = id;
        break;
      }
    }
    setActiveFlowNodeId((prev) => (prev === nextActive ? prev : nextActive));
  }, [entityManager, selectedIds]);

  const handleNodeFormChange = useCallback(
    (nodeId: string, formData: Record<string, unknown>) => {
      setNodeConfigs((prev) => ({
        ...prev,
        [nodeId]: formData,
      }));

      const entity = entityManager.getEntity(nodeId) as FlowEntityLike | undefined;
      if (entity) {
        if (entity.data) {
          const dataRecord = entity.data as { config?: Record<string, unknown> } & Record<
            string,
            unknown
          >;
          dataRecord.config = {
            // ...(dataRecord.config || {}),
            ...formData,
          };
        }
        if ("config" in entity) {
          (entity as { config?: Record<string, unknown> }).config = {
            // ...((entity as { config?: Record<string, unknown> }).config || {}),
            ...formData,
          };
        }
      }

      renderEvents.requestRenderAll({ reason: "flow-node-form-change" });
    },
    [entityManager, renderEvents]
  );

  const flowNodeFormOverlay = React.useMemo(() => {
    if (!activeFlowNodeId || !renderContextBuilder) {
      return null;
    }

    const formData = nodeConfigs[activeFlowNodeId];
    if (!formData) {
      return null;
    }

    const entity = entityManager.getEntity(activeFlowNodeId) as FlowEntityLike | undefined;
    const nodeType = resolveFlowNodeType(entity);
    if (!nodeType) {
      return null;
    }

    // Start node form is embedded in the card, no extra floating form needed
    if (nodeType === FLOW_CANVAS_NODE_TYPES.Start) {
      return null;
    }

    const definition = FLOW_NODE_FORM_DEFINITIONS[nodeType];
    const theme = FLOW_NODE_THEMES[definition.themeKey];
    const viewport = renderContextBuilder.getViewport();
    const zoom = viewport?.zoom ?? 1;
    const viewportX = viewport?.x ?? 0;
    const viewportY = viewport?.y ?? 0;

    const nodePosition =
      nodePositions.get(activeFlowNodeId) ??
      (entity?.data as { position?: { x: number; y: number } } | undefined)?.position;
    if (!nodePosition) {
      return null;
    }

    const { width, height } = getFlowNodeDimensions(entity, nodeType);
    const widthPx = width * zoom;
    const heightPx = height * zoom;
    const canvasWidth = canvasRef?.width ?? 800;
    const canvasHeight = canvasRef?.height ?? 600;
    const margin = 12;

    // Other node types: use floating form
    const anchorX = (nodePosition.x - viewportX) * zoom + widthPx / 2;
    const anchorY = (nodePosition.y - viewportY) * zoom;
    const overlayWidth = Math.min(Math.max(320, widthPx + 80), 420);
    const overlayHeight = definition.minHeight ?? FLOW_NODE_FORM_MIN_HEIGHT;

    let left = anchorX - overlayWidth / 2;
    if (left < margin) {
      left = margin;
    }
    if (left + overlayWidth > canvasWidth - margin) {
      left = Math.max(margin, canvasWidth - overlayWidth - margin);
    }

    let top = anchorY - overlayHeight - 16;
    if (top < margin) {
      top = anchorY + heightPx + 16;
    }
    if (top + overlayHeight > canvasHeight - margin) {
      top = Math.max(margin, canvasHeight - overlayHeight - margin);
    }

    return (
      <div
        key={activeFlowNodeId}
        style={{
          position: "absolute",
          left,
          top,
          width: overlayWidth,
          minHeight: overlayHeight,
          pointerEvents: "auto",
          borderRadius: "18px",
          border: `1px solid ${theme.borderColor}`,
          background: "rgba(255, 255, 255, 0.98)",
          boxShadow: "0 18px 50px rgba(15, 23, 42, 0.35)",
          padding: "18px 20px 20px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
        data-testid="flow-node-form-overlay"
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontSize: "0.75rem", color: theme.borderColor, fontWeight: 600 }}>
              {definition.title}
            </span>
            <strong style={{ fontSize: "1.1rem", color: "#0f172a" }}>
              {getFlowNodeLabel(entity)}
            </strong>
            <span style={{ color: "#64748b", fontSize: "0.85rem" }}>{definition.description}</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveFlowNodeId(null)}
            aria-label="关闭节点表单"
            style={{
              border: "none",
              background: "transparent",
              color: "#94a3b8",
              fontSize: "1.2rem",
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        {definition.badgeField && (
          <span
            style={{
              alignSelf: "flex-start",
              padding: "4px 10px",
              borderRadius: "999px",
              background: `${theme.borderColor}1a`,
              color: theme.borderColor,
              fontSize: "0.75rem",
              fontWeight: 600,
            }}
          >
            {getStringField(formData, definition.badgeField)}
          </span>
        )}
        <FlowNodeForm
          schema={definition.schema}
          data={formData}
          onChange={(values) => handleNodeFormChange(activeFlowNodeId, values)}
          compact
          labelPosition="top"
          testId="flow-node-form-inline"
        />
      </div>
    );
  }, [
    activeFlowNodeId,
    canvasRef,
    entityManager,
    handleNodeFormChange,
    nodeConfigs,
    nodePositions,
    renderContextBuilder,
    setActiveFlowNodeId,
  ]);

  // Start node rendered using React BaseFlowNode component (instead of Canvas)
  const startNodeOverlays = React.useMemo(() => {
    if (!renderContextBuilder) return null;

    const viewport = renderContextBuilder.getViewport();
    const zoom = viewport?.zoom ?? 1;
    const viewportX = viewport?.x ?? 0;
    const viewportY = viewport?.y ?? 0;

    // Filter nodes of type flow-start-canvas
    const startNodes = nodes.filter((entity) => {
      const entityType =
        (entity as { type?: string }).type ??
        (entity.data as { type?: string } | undefined)?.type;
      return entityType === FLOW_CANVAS_NODE_TYPES.Start;
    });

    if (startNodes.length === 0) return null;

    const theme = FLOW_NODE_THEMES.start;

    return startNodes.map((entity) => {
      const position =
        nodePositions.get(entity.id) ??
        (entity.data as { position?: { x: number; y: number } } | undefined)?.position ??
        (entity as { x?: number; y?: number });

      const posX = (position as { x?: number })?.x ?? 0;
      const posY = (position as { y?: number })?.y ?? 0;

      // Get node dimensions
      const entityData = entity.data as
        | { size?: { width?: number; height?: number }; width?: number; height?: number }
        | undefined;
      const width = entityData?.size?.width ?? entityData?.width ?? theme.defaultWidth;
      const height = entityData?.size?.height ?? entityData?.height ?? theme.defaultHeight;

      // Calculate screen coordinates
      const screenX = (posX - viewportX) * zoom;
      const screenY = (posY - viewportY) * zoom;
      const screenWidth = width * zoom;
      const screenHeight = height * zoom;

      // Get config data
      const config =
        nodeConfigs[entity.id] ??
        (entity.data as { config?: Record<string, unknown> } | undefined)?.config ??
        {};

      // Create adapted FlowNodeEntity for BaseFlowNode
      const flowNodeEntity = new FlowNodeEntity({
        nodeType: "start",
        label:
          (entity as { label?: string }).label ??
          (entity.data as { label?: string } | undefined)?.label ??
          "开始",
        position: { x: posX, y: posY },
        size: { width, height },
        formSchema: START_FORM_SCHEMA,
        theme: {
          backgroundColor: theme.backgroundColor,
          borderColor: theme.borderColor,
          headerColor: theme.headerColor,
          textColor: theme.textColor,
          borderRadius: theme.borderRadius,
        },
        config,
      });
      // Reuse original entity ID
      (flowNodeEntity as unknown as { id: string }).id = entity.id;

      // Set output ports
      flowNodeEntity.setPorts([
        { id: "output", name: "开始", type: "output", dataType: "any" },
      ]);

      const isSelected = selectedIds.has(entity.id);

      return (
        <div
          key={entity.id}
          style={{
            position: "absolute",
            left: screenX,
            top: screenY,
            width: screenWidth,
            height: screenHeight,
            transform: `scale(${1 / zoom})`,
            transformOrigin: "top left",
            pointerEvents: "auto",
            zIndex: isSelected ? 10 : 1,
          }}
          data-testid={`start-node-overlay-${entity.id}`}
        >
          <FlowEntityProvider>
            <BaseFlowNode
              entity={flowNodeEntity}
              selected={isSelected}
              onSelect={() => {
                setSelectedIds(new Set([entity.id]));
                setActiveFlowNodeId(entity.id);
              }}
              onMove={(_, newPosition) => {
                // Update original entity position
                if (entity.data) {
                  (entity.data as { position?: { x: number; y: number } }).position = newPosition;
                }
                // Also update entity itself (if it has x, y properties)
                (entity as { x?: number; y?: number }).x = newPosition.x;
                (entity as { x?: number; y?: number }).y = newPosition.y;
                // Trigger re-render
                renderEvents.requestRenderAll({ reason: "start-node-moved" });
              }}
              onResize={(_, newSize) => {
                // Update original entity size
                if (entity.data) {
                  (entity.data as { size?: { width: number; height: number } }).size = newSize;
                  (entity.data as { width?: number; height?: number }).width = newSize.width;
                  (entity.data as { width?: number; height?: number }).height = newSize.height;
                }
                // Trigger re-render
                renderEvents.requestRenderAll({ reason: "start-node-resized" });
              }}
              onFormChange={(_, values) => {
                handleNodeFormChange(entity.id, values);
              }}
            />
          </FlowEntityProvider>
        </div>
      );
    });
  }, [
    nodes,
    nodePositions,
    nodeConfigs,
    selectedIds,
    renderContextBuilder,
    renderEvents,
    handleNodeFormChange,
    setActiveFlowNodeId,
    setSelectedIds,
  ]);

  // Interaction: implemented via InteractionManager + DragTool plugin pattern
  const interactionManagerRef = useRef<InteractionManager | null>(null);

  // Initialize interaction manager and drag tool
  React.useEffect(() => {
    if (!renderContextBuilder) return;
    const mgr = new InteractionManager(
      { getCanvas: () => renderContextBuilder.getCanvas() },
      { getViewport: () => renderContextBuilder.getViewport() }
    );
    const connectionTool = new PortConnectionTool({
      entityManager,
      renderEvents,
      getFlow: () => flow,
    });
    const dragTool = new DragTool({
      entityManager,
      renderEvents,
      gridSnap: 10,
      getSelectedIds: () => selectedIdsRef.current,
      setSelectedIds: (next) => {
        const nextSet = new Set(next);
        selectedIdsRef.current = nextSet;
        setSelectedIds(nextSet);
      },
      onDragStart: () => setIsDragging(true),
      onDragEnd: () => setIsDragging(false),
    });
    mgr.register(connectionTool);
    mgr.register(dragTool);
    interactionManagerRef.current = mgr;
    return () => {
      mgr.clear();
      interactionManagerRef.current = null;
    };
  }, [entityManager, renderContextBuilder, renderEvents, flow]);

  // Drawing: delegated to RenderManager for unified full redraw
  const handleDraw = useCallback(() => {
    renderEvents.requestRenderAll({ reason: "editor-draw" });
  }, [renderEvents]);

  // Utility functions moved inside DragTool

  // Viewport change callback
  const handleViewportChange = useCallback(
    (viewport: { x: number; y: number; zoom: number; width: number; height: number }) => {
      flowLogger.debug({
        event: FlowDemoEvent.ViewportChanged,
        message: "Viewport updated",
        emoji: "📍",
        metadata: {
          zoom: viewport.zoom,
          width: viewport.width,
          height: viewport.height,
        },
        details: viewport,
      });
      setViewportState({
        x: viewport.x ?? 0,
        y: viewport.y ?? 0,
        zoom: viewport.zoom ?? 1,
        width: viewport.width ?? 0,
        height: viewport.height ?? 0,
      });
      // Sync to RenderManager and trigger a redraw to update grid/content
      try {
        renderManager.updateRenderContext({ viewport });
        const payload: {
          x: number;
          y: number;
          zoom: number;
          size?: { w: number; h: number };
        } = {
          x: viewport.x,
          y: viewport.y,
          zoom: viewport.zoom,
        };
        if (typeof viewport.width === "number" && typeof viewport.height === "number") {
          payload.size = { w: viewport.width, h: viewport.height };
        }
        renderEvents.notifyViewportChanged(payload);
      } catch (e) {
        flowLogger.warn({
          event: FlowDemoEvent.ViewportSyncFailed,
          message: "Failed to sync viewport to render manager",
          emoji: "⚠️",
          error: e,
        });
      }
    },
    [renderEvents, renderManager]
  );

  // Render context builder ready callback
  const handleRenderContextReady = useCallback(
    (builder: RenderContextBuilder) => {
      flowLogger.debug({
        event: FlowDemoEvent.RenderContextReady,
        message: "Render context builder ready",
        emoji: "🔧",
      });
      setRenderContextBuilder(builder);

      const initialViewport = builder.getViewport();
      if (initialViewport) {
        setViewportState({
          x: initialViewport.x ?? 0,
          y: initialViewport.y ?? 0,
          zoom: initialViewport.zoom ?? 1,
          width: initialViewport.width ?? 0,
          height: initialViewport.height ?? 0,
        });
      }

      // Build initial IRenderContext and set to render-manager
      const renderContext = builder.buildContext(renderEntities, {
        source: "flow-demo",
      });
      if (renderContext.canvas) {
        flowLogger.debug({
          event: FlowDemoEvent.RenderContextApplied,
          message: "Initial render context applied",
          emoji: "🎨",
          metadata: {
            entityCount: renderEntities.length,
          },
        });
        renderManager.setRenderContext(renderContext);
      }

      // No longer driven by UI callback; RenderManager triggers renderAll() automatically on entity updates
    },
    [renderEntities, renderManager]
  );

  // Listen for node changes and update render context
  React.useEffect(() => {
    if (!renderContextBuilder) return;

    flowLogger.debug({
      event: FlowDemoEvent.NodesUpdated,
      message: "Entities changed; updating render context",
      emoji: "🔄",
      metadata: {
        entityCount: renderEntities.length,
      },
    });
    const renderContext = renderContextBuilder.buildContext(renderEntities, {
      source: "flow-demo",
    });
    renderManager.setRenderContext(renderContext);
    flowLogger.debug({
      event: FlowDemoEvent.RenderContextUpdated,
      message: "Render context refreshed after entity update",
      metadata: {
        entityCount: renderEntities.length,
      },
    });
    renderEvents.requestRenderAll({ reason: "entities-updated" });
  }, [renderContextBuilder, renderEntities, renderEvents, renderManager]);

  // Basic mouse event handlers (forwarded to InteractionManager)
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    interactionManagerRef.current?.onMouseDown(e);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    interactionManagerRef.current?.onMouseMove(e);
  }, []);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    interactionManagerRef.current?.onMouseUp(e);
    setIsSelecting(false);
  }, []);

  const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    interactionManagerRef.current?.onMouseLeave(e);
    setIsSelecting(false);
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isUndoCombination =
        (e.key === "z" || e.key === "Z") && (e.metaKey || e.ctrlKey) && !e.altKey;
      const isRedoCombination = isUndoCombination && e.shiftKey;

      if (isUndoCombination) {
        e.preventDefault();
        if (isRedoCombination) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        for (const id of selectedIds) {
          removeNode(id);
        }
      }
    };

    globalThis.addEventListener("keydown", handleKeyDown);
    return () => {
      globalThis.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleRedo, handleUndo, removeNode, selectedIds]);

  // Bind wheel zoom (zoom around mouse position)
  React.useEffect(() => {
    if (!ENABLE_CANVAS_ZOOM) {
      return;
    }
    const canvas = canvasRef;
    if (!canvas || !renderContextBuilder) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const vp = renderContextBuilder.getViewport();
      const prevZoom = vp.zoom || 1;

      // Zoom step and range
      const zoomFactor = Math.exp(-e.deltaY * 0.001); // Smooth zoom
      const nextZoom = Math.min(3, Math.max(0.25, prevZoom * zoomFactor));
      if (nextZoom === prevZoom) return;

      // Keep world coordinates under mouse unchanged
      // Convert based on screen = (world - viewport) * zoom
      const worldX = mouseX / prevZoom + (vp.x || 0);
      const worldY = mouseY / prevZoom + (vp.y || 0);
      const nextX = worldX - mouseX / nextZoom;
      const nextY = worldY - mouseY / nextZoom;
      const nextViewport = {
        ...vp,
        zoom: nextZoom,
        x: nextX,
        y: nextY,
      };

      renderContextBuilder.updateViewport(nextViewport);
      try {
        renderManager.updateRenderContext({ viewport: nextViewport });
      } catch {
        // ignore syncing errors; non-fatal for zoom
      }

      const payload: {
        x: number;
        y: number;
        zoom: number;
        size?: { w: number; h: number };
      } = {
        x: nextViewport.x,
        y: nextViewport.y,
        zoom: nextViewport.zoom,
      };
      if (typeof nextViewport.width === "number" && typeof nextViewport.height === "number") {
        payload.size = { w: nextViewport.width, h: nextViewport.height };
      }
      renderEvents.notifyViewportChanged(payload);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      canvas.removeEventListener("wheel", onWheel as EventListener);
    };
  }, [canvasRef, renderContextBuilder, renderEvents, renderManager]);

  // Remove duplicate handleDraw (already defined above)

  const handleAddNode = useCallback(() => {
    if (!flow) {
      flowLogger.warn({
        event: "flow-demo:add-node-skipped",
        message: "Cannot add node without active flow instance",
        emoji: "⚠️",
      });
      return;
    }

    const nextIndex = nodeLabelCounterRef.current + 1;
    nodeLabelCounterRef.current = nextIndex;

    const position = {
      x: 120 + (nextIndex % 5) * 140,
      y: 120 + Math.floor(nextIndex / 5) * 120,
    };
    const config = {
      type: "uml-class-canvas" as const,
      label: `Node ${nextIndex}`,
      color: "#2563eb",
      position,
      width: 180,
      height: 120,
    };

    const commandState: { nodeId: string | null } = { nodeId: null };

    const entity = addNode(config);
    if (!entity) {
      flowLogger.warn({
        event: "flow-demo:add-node-failed",
        message: "addNode returned null",
        emoji: "⚠️",
        metadata: { config },
      });
      return;
    }

    commandState.nodeId = entity.id;

    flowLogger.info({
      event: "flow-demo:node-added",
      message: "Node created via toolbar",
      emoji: "🆕",
      metadata: {
        nodeId: entity.id,
        label: config.label,
        position,
      },
    });

    const command: FlowCommand = {
      description: `add-node-${entity.id}`,
      undo: () => {
        if (commandState.nodeId) {
          removeNode(commandState.nodeId);
        }
      },
      redo: () => {
        const nextEntity = addNode(config);
        commandState.nodeId = nextEntity?.id ?? commandState.nodeId;
      },
    };

    pushHistoryCommand(command);
  }, [addNode, flow, pushHistoryCommand, removeNode]);

  const applyViewportChange = useCallback(
    (
      updater: (viewport: {
        x: number;
        y: number;
        zoom: number;
        width: number;
        height: number;
      }) => {
        x: number;
        y: number;
        zoom: number;
        width: number;
        height: number;
      }
    ) => {
      if (!renderContextBuilder) return;
      const current = renderContextBuilder.getViewport();
      const baseViewport = {
        x: current.x ?? viewportState.x,
        y: current.y ?? viewportState.y,
        zoom: current.zoom ?? viewportState.zoom,
        width: current.width ?? viewportState.width ?? canvasRef?.width ?? 0,
        height: current.height ?? viewportState.height ?? canvasRef?.height ?? 0,
      };
      const nextViewport = updater(baseViewport);
      renderContextBuilder.updateViewport(nextViewport);
      handleViewportChange(nextViewport);
    },
    [canvasRef, handleViewportChange, renderContextBuilder, viewportState]
  );

  const handleZoom = useCallback(
    (factor: number) => {
      applyViewportChange((current) => {
        const nextZoom = Math.min(3, Math.max(0.25, current.zoom * factor));
        return {
          ...current,
          zoom: nextZoom,
        };
      });
    },
    [applyViewportChange]
  );

  const handleZoomIn = useCallback(() => {
    handleZoom(1.1);
  }, [handleZoom]);

  const handleZoomOut = useCallback(() => {
    handleZoom(0.9);
  }, [handleZoom]);

  const handleZoomToFit = useCallback(() => {
    applyViewportChange((current) => ({
      ...current,
      x: 0,
      y: 0,
      zoom: 1,
    }));
  }, [applyViewportChange]);

  const handleTogglePanMode = useCallback(() => {
    setIsPanMode((prev) => {
      const next = !prev;
      flowLogger.debug({
        event: "flow-demo:pan-toggle",
        message: "Pan mode toggled",
        emoji: next ? "🖐️" : "🖱️",
        metadata: {
          isPanMode: next,
        },
      });
      return next;
    });
  }, []);

  // New Flow feature
  const createNewFlow = useCallback(() => {
    flowLogger.info({
      event: FlowDemoEvent.FlowCreateRequested,
      message: "New flow creation requested",
      emoji: "🆕",
    });
    // Logic for creating a new Flow can be added here
    if (flow) {
      const entityCount = flow.getAllEntities?.().length;
      flowLogger.debug({
        event: FlowDemoEvent.FlowInstanceStatus,
        message: "Flow instance already exists",
        emoji: "✅",
        metadata: {
          entityCount,
        },
      });
    } else {
      flowLogger.warn({
        event: FlowDemoEvent.FlowInstanceStatus,
        message: "Flow instance is not available",
        emoji: "⚠️",
      });
    }
  }, [flow]);

  // Create UML Class Entity feature
  const createUMLClassEntity = useCallback(() => {
    const entityType = "uml-class-canvas" as const;
    flowLogger.info({
      event: FlowDemoEvent.UmlEntityCreateStart,
      message: "Creating UML class entity",
      emoji: "🏗️",
      metadata: {
        entityType,
      },
    });
    try {
      if (!flow) {
        flowLogger.warn({
          event: FlowDemoEvent.FlowInstanceStatus,
          message: "Flow instance unavailable for UML class creation",
          emoji: "❌",
          metadata: {
            entityType,
          },
        });
        return;
      }

      const entity = addNode({
        type: entityType,
        x: 50,
        y: 50,
        width: 120,
        height: 80,
        label: "MyClass",
      });

      if (entity) {
        flowLogger.info({
          event: FlowDemoEvent.UmlEntityCreateSuccess,
          message: "UML class entity created",
          emoji: "✅",
          metadata: {
            entityType,
            entityId: entity.id,
          },
        });

        const entities = flow.getAllEntities();
        flowLogger.debug({
          event: FlowDemoEvent.EntityMetrics,
          message: "Flow entity metrics",
          emoji: "�",
          metadata: {
            totalEntities: entities.length,
          },
        });

        const entityPosition = {
          x: entity.data?.position?.x ?? 0,
          y: entity.data?.position?.y ?? 0,
        };
        const entitySize = {
          width: (entity.data as { width?: number } | undefined)?.width ?? 0,
          height: (entity.data as { height?: number } | undefined)?.height ?? 0,
        };
        const entityLabel =
          (entity as { label?: string }).label ??
          (entity.data as { label?: string } | undefined)?.label ??
          "(unnamed)";

        flowLogger.debug({
          event: FlowDemoEvent.EntityDetails,
          message: "Created entity detail",
          emoji: "🔍",
          metadata: {
            entityType,
            entityId: entity.id,
            label: entityLabel,
          },
          details: {
            id: entity.id,
            type: entity.type,
            label: entityLabel,
            position: entityPosition,
            size: entitySize,
            raw: entity.data?.toJSON ? entity.data.toJSON() : entity.data,
          },
        });

        flowLogger.debug({
          event: FlowDemoEvent.EntitySummary,
          message: "Flow entity summary",
          emoji: "📋",
          details: entities.map((item: unknown, index: number) => {
            const info = item as {
              id?: string;
              type?: string;
              label?: string;
              data?: { label?: string };
            };
            return {
              index: index + 1,
              id: info.id ?? "unknown",
              type: info.type ?? "unknown",
              label: info.label ?? info.data?.label ?? "(none)",
            };
          }),
        });
      } else {
        flowLogger.error({
          event: FlowDemoEvent.UmlEntityCreateFailure,
          message: "Failed to create UML class entity",
          emoji: "❌",
          metadata: {
            entityType,
          },
        });
      }
    } catch (error) {
      flowLogger.error({
        event: FlowDemoEvent.UmlEntityCreateFailure,
        message: "Unexpected error during UML class creation",
        emoji: "❌",
        metadata: {
          entityType,
        },
        error,
      });
    }
  }, [addNode, flow]);

  // Generic: create UML entity of specified type
  const createUMLEntity = useCallback(
    (
      type: "uml-interface-canvas" | "uml-usecase-canvas" | "uml-actor-canvas",
      defaults: { x: number; y: number; label: string }
    ) => {
      logger.info("🏗️ 创建 UML Entity", { type });

      // Detailed log: check registry status
      const registryManager = runtime.RegistryManager;
      logger.info("🔍 检查注册表状态", {
        type,
        hasRegistry: registryManager.hasRegistry(type),
        allRegistries: registryManager.getRegistryNames(),
        registryExists: !!registryManager.getRegistry(type),
      });

      try {
        if (!flow) {
          logger.warn("❌ Flow 实例不可用");
          return;
        }

        const entity = addNode({
          type,
          x: defaults.x,
          y: defaults.y,
          width: 120,
          height: 80,
          label: defaults.label,
        });

        if (entity) {
          logger.info("✅ UML Entity 创建成功:", entity.id);
          // Rendering is handled by RenderManager's automatic full redraw

          const entities = flow.getAllEntities();
          logger.debug("📊 Flow 中当前节点数:", entities.length);
        } else {
          logger.error("❌ UML Entity 创建失败", { type });
        }
      } catch (error) {
        logger.error("❌ 创建 UML Entity 时出错:", error);
      }
    },
    [addNode, flow, runtime]
  );

  // Create other UML entity types
  const createUMLInterfaceEntity = useCallback(() => {
    createUMLEntity("uml-interface-canvas", {
      x: 200,
      y: 50,
      label: "MyInterface",
    });
  }, [createUMLEntity]);

  const createUMLUseCaseEntity = useCallback(() => {
    createUMLEntity("uml-usecase-canvas", {
      x: 350,
      y: 50,
      label: "MyUseCase",
    });
  }, [createUMLEntity]);

  const createUMLActorEntity = useCallback(() => {
    createUMLEntity("uml-actor-canvas", {
      x: 500,
      y: 50,
      label: "Actor",
    });
  }, [createUMLEntity]);

  const createUMLLineEntity = useCallback(() => {
    logger.info("🏗️ 创建 UML Line Entity");
    try {
      if (!flow) {
        logger.warn("❌ Flow 实例不可用");
        return;
      }

      const entity = addEdge({
        type: "uml-line-canvas",
        x: 120,
        y: 200,
        x2: 320,
        y2: 200,
        width: 200,
        height: 0,
        borderColor: "#1F2933",
        lineWidth: 3,
        label: "",
      });

      if (entity) {
        logger.info("✅ UML Line Entity 创建成功:", entity.id);
        if (flow && typeof flow.getAllEdgeEntities === "function") {
          logger.debug("📊 Flow 中当前边数:", flow.getAllEdgeEntities().length);
        }
      } else {
        logger.error("❌ UML Line Entity 创建失败");
      }
    } catch (error) {
      logger.error("❌ 创建 UML Line Entity 时出错:", error);
    }
  }, [addEdge, flow]);

  // ============================================================================
  // Flow Canvas node creation feature
  // ============================================================================

  /**
   * Generic: create Flow Canvas entity of specified type
   */
  const createFlowCanvasNode = useCallback(
    (type: FlowCanvasNodeType, defaults: { x: number; y: number; label: string }) => {
      const definition = FLOW_NODE_FORM_DEFINITIONS[type];
      const theme = FLOW_NODE_THEMES[definition.themeKey];

      flowLogger.info({
        event: "flow-demo:flow-node-create-start",
        message: `Creating Flow Canvas node: ${type}`,
        emoji: "🎯",
        metadata: { type, label: defaults.label },
      });

      try {
        if (!flow) {
          flowLogger.warn({
            event: "flow-demo:flow-node-create-failed",
            message: "Flow instance unavailable",
            emoji: "❌",
          });
          return;
        }

        const entity = addNode({
          type,
          x: defaults.x,
          y: defaults.y,
          width: theme.defaultWidth,
          height: theme.defaultHeight,
          label: defaults.label,
        });

        if (entity) {
          flowLogger.info({
            event: "flow-demo:flow-node-create-success",
            message: `Flow Canvas node created: ${entity.id}`,
            emoji: "✅",
            metadata: {
              entityId: entity.id,
              type,
              label: defaults.label,
            },
          });

          const entities = flow.getAllEntities();
          flowLogger.debug({
            event: "flow-demo:entity-count",
            message: "Current entity count",
            metadata: { count: entities.length },
          });
        } else {
          flowLogger.error({
            event: "flow-demo:flow-node-create-failed",
            message: `Failed to create Flow Canvas node: ${type}`,
            emoji: "❌",
          });
        }
      } catch (error) {
        flowLogger.error({
          event: "flow-demo:flow-node-create-error",
          message: "Unexpected error during Flow Canvas node creation",
          emoji: "❌",
          error,
        });
      }
    },
    [addNode, flow]
  );

  // Create Flow Start Canvas node
  const createFlowStartNode = useCallback(() => {
    createFlowCanvasNode(FLOW_CANVAS_NODE_TYPES.Start, {
      x: 50,
      y: 100,
      label: "开始",
    });
  }, [createFlowCanvasNode]);

  // Create Flow Action Canvas node
  const createFlowActionNode = useCallback(() => {
    createFlowCanvasNode(FLOW_CANVAS_NODE_TYPES.Action, {
      x: 200,
      y: 100,
      label: "处理数据",
    });
  }, [createFlowCanvasNode]);

  // Create Flow Decision Canvas node
  const createFlowDecisionNode = useCallback(() => {
    createFlowCanvasNode(FLOW_CANVAS_NODE_TYPES.Decision, {
      x: 450,
      y: 100,
      label: "条件判断",
    });
  }, [createFlowCanvasNode]);

  // Create Flow End Canvas node
  const createFlowEndNode = useCallback(() => {
    createFlowCanvasNode(FLOW_CANVAS_NODE_TYPES.End, {
      x: 600,
      y: 100,
      label: "结束",
    });
  }, [createFlowCanvasNode]);

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }} data-testid="flow-demo">
      <h1>Flow Demo</h1>
      <p>简化版本，只包含编辑器和新建 Flow 功能</p>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "center",
          marginBottom: "20px",
          padding: "12px 16px",
          borderRadius: "8px",
          border: "1px solid #e2e8f0",
          background: "#f8fafc",
        }}
      >
        <button
          onClick={handleAddNode}
          data-testid="add-node-btn"
          style={{
            padding: "8px 16px",
            borderRadius: "6px",
            border: "1px solid #3b82f6",
            background: "#2563eb",
            color: "#ffffff",
            cursor: "pointer",
          }}
        >
          添加节点
        </button>

        <button
          onClick={handleUndo}
          data-testid="undo-btn"
          disabled={!historyMetadata.canUndo}
          style={{
            padding: "8px 14px",
            borderRadius: "6px",
            border: "1px solid #cbd5f5",
            background: historyMetadata.canUndo ? "#eef2ff" : "#f8fafc",
            color: historyMetadata.canUndo ? "#4338ca" : "#94a3b8",
            cursor: historyMetadata.canUndo ? "pointer" : "not-allowed",
          }}
        >
          撤销
        </button>

        <button
          onClick={handleRedo}
          data-testid="redo-btn"
          disabled={!historyMetadata.canRedo}
          style={{
            padding: "8px 14px",
            borderRadius: "6px",
            border: "1px solid #cbd5f5",
            background: historyMetadata.canRedo ? "#eef2ff" : "#f8fafc",
            color: historyMetadata.canRedo ? "#4338ca" : "#94a3b8",
            cursor: historyMetadata.canRedo ? "pointer" : "not-allowed",
          }}
        >
          重做
        </button>

        <button
          onClick={handleZoomOut}
          data-testid="zoom-out-btn"
          style={{
            padding: "8px 12px",
            borderRadius: "6px",
            border: "1px solid #cbd5f5",
            background: "#e2e8f0",
            color: "#1f2937",
            cursor: "pointer",
          }}
        >
          缩小
        </button>

        <button
          onClick={handleZoomIn}
          data-testid="zoom-in-btn"
          style={{
            padding: "8px 12px",
            borderRadius: "6px",
            border: "1px solid #cbd5f5",
            background: "#e2e8f0",
            color: "#1f2937",
            cursor: "pointer",
          }}
        >
          放大
        </button>

        <button
          onClick={handleZoomToFit}
          data-testid="zoom-to-fit-btn"
          style={{
            padding: "8px 14px",
            borderRadius: "6px",
            border: "1px solid #0ea5e9",
            background: "#38bdf8",
            color: "#0f172a",
            cursor: "pointer",
          }}
        >
          视图复位
        </button>

        <button
          onClick={handleTogglePanMode}
          data-testid="pan-btn"
          aria-pressed={isPanMode}
          style={{
            padding: "8px 14px",
            borderRadius: "6px",
            border: "1px solid #94a3b8",
            background: isPanMode ? "#0ea5e9" : "#e2e8f0",
            color: isPanMode ? "#ffffff" : "#0f172a",
            cursor: "pointer",
          }}
        >
          平移模式
        </button>

        <span
          data-testid="node-count-display"
          style={{ fontSize: "0.9rem", color: "#0f172a", fontWeight: 500 }}
        >
          节点数：{nodes.length}
        </span>

        <span
          data-testid="connection-count-display"
          style={{ fontSize: "0.9rem", color: "#0f172a", fontWeight: 500 }}
        >
          连接数：{edges.length}
        </span>

        <span data-testid="viewport-info" style={{ fontSize: "0.85rem", color: "#475569" }}>
          视口：X {Math.round(viewportState.x)}, Y {Math.round(viewportState.y)}
        </span>

        <span data-testid="zoom-level" style={{ fontSize: "0.85rem", color: "#475569" }}>
          缩放：{viewportState.zoom.toFixed(2)}x
        </span>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <button
          onClick={createNewFlow}
          data-testid="create-flow-btn"
          style={{
            padding: "10px 20px",
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            marginRight: "10px",
          }}
        >
          新建 Flow
        </button>

        <button
          onClick={createUMLClassEntity}
          data-testid="create-uml-class-btn"
          style={{
            padding: "10px 20px",
            backgroundColor: "#2196F3",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            marginRight: "10px",
          }}
        >
          创建 UML Class
        </button>

        <button
          onClick={createUMLInterfaceEntity}
          data-testid="create-uml-interface-btn"
          style={{
            padding: "10px 20px",
            backgroundColor: "#9C27B0",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            marginRight: "10px",
          }}
        >
          创建 UML Interface
        </button>

        <button
          onClick={createUMLUseCaseEntity}
          data-testid="create-uml-usecase-btn"
          style={{
            padding: "10px 20px",
            backgroundColor: "#FF9800",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            marginRight: "10px",
          }}
        >
          创建 UML UseCase
        </button>

        <button
          onClick={createUMLActorEntity}
          data-testid="create-uml-actor-btn"
          style={{
            padding: "10px 20px",
            backgroundColor: "#607D8B",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            marginRight: "10px",
          }}
        >
          创建 UML Actor
        </button>

        <button
          onClick={createUMLLineEntity}
          data-testid="create-uml-line-btn"
          style={{
            padding: "10px 20px",
            backgroundColor: "#374151",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          创建 UML 直线
        </button>
      </div>

      {/* Flow Canvas node creation buttons */}
      <div style={{ marginBottom: "20px" }}>
        <span style={{ marginRight: "12px", fontWeight: 600, color: "#334155" }}>Flow 节点：</span>
        <button
          onClick={createFlowStartNode}
          data-testid="create-flow-start-btn"
          style={{
            padding: "10px 20px",
            backgroundColor: FLOW_NODE_THEMES.start.borderColor,
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            marginRight: "10px",
          }}
        >
          创建开始节点
        </button>

        <button
          onClick={createFlowActionNode}
          data-testid="create-flow-action-btn"
          style={{
            padding: "10px 20px",
            backgroundColor: FLOW_NODE_THEMES.action.borderColor,
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            marginRight: "10px",
          }}
        >
          创建动作节点
        </button>

        <button
          onClick={createFlowDecisionNode}
          data-testid="create-flow-decision-btn"
          style={{
            padding: "10px 20px",
            backgroundColor: FLOW_NODE_THEMES.decision.borderColor,
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            marginRight: "10px",
          }}
        >
          创建判断节点
        </button>

        <button
          onClick={createFlowEndNode}
          data-testid="create-flow-end-btn"
          style={{
            padding: "10px 20px",
            backgroundColor: FLOW_NODE_THEMES.end.borderColor,
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          创建结束节点
        </button>
      </div>

      <section
        style={{
          marginBottom: "24px",
          padding: "16px",
          border: "1px solid #e2e8f0",
          borderRadius: "8px",
          background: "#ffffff",
          boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
        }}
      >
        <header style={{ marginBottom: "12px" }}>
          <h2 style={{ margin: 0, fontSize: "1.15rem", color: "#0f172a" }}>虚拟滚动性能演示</h2>
          <p style={{ margin: "6px 0 0", color: "#475569", fontSize: "0.9rem" }}>
            通过虚拟滚动渲染大规模遥测事件列表，验证 100K 数据集仍可保持流畅滚动（60fps）。
          </p>
        </header>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "12px" }}>
          <button
            onClick={handleTelemetryPreset(VIRTUAL_LIST_PRESETS.sample)}
            style={{
              padding: "8px 14px",
              borderRadius: "6px",
              border: "1px solid #cbd5f5",
              background: "#eef2ff",
              color: "#3730a3",
              cursor: "pointer",
            }}
          >
            载入 2,000 条（示例）
          </button>
          <button
            onClick={handleTelemetryPreset(VIRTUAL_LIST_PRESETS.production)}
            style={{
              padding: "8px 14px",
              borderRadius: "6px",
              border: "1px solid #bfdbfe",
              background: "#dbeafe",
              color: "#1d4ed8",
              cursor: "pointer",
            }}
          >
            载入 25,000 条（生产规模）
          </button>
          <button
            onClick={handleTelemetryPreset(VIRTUAL_LIST_PRESETS.stress)}
            style={{
              padding: "8px 14px",
              borderRadius: "6px",
              border: "1px solid #fecdd3",
              background: "#ffe4e6",
              color: "#be123c",
              cursor: "pointer",
            }}
          >
            载入 100,000 条（压力测试）
          </button>
          <button
            onClick={refreshTelemetryDataset}
            style={{
              padding: "8px 14px",
              borderRadius: "6px",
              border: "1px solid #94a3b8",
              background: "#f8fafc",
              color: "#0f172a",
              cursor: "pointer",
            }}
          >
            重新生成数据
          </button>
        </div>

        <div
          style={{
            display: "flex",
            gap: "16px",
            flexWrap: "wrap",
            marginBottom: "12px",
            fontSize: "0.9rem",
            color: "#334155",
          }}
        >
          <span>
            当前数据量：<strong>{virtualListSize.toLocaleString()}</strong> 条
          </span>
          <span>
            可见范围：<strong>{visibleTelemetryRange.start.toLocaleString()}</strong>
            <span style={{ margin: "0 4px" }}>-</span>
            <strong>{visibleTelemetryRange.end.toLocaleString()}</strong>
          </span>
          <span>
            当前渲染：<strong>{visibleTelemetryCount.toLocaleString()}</strong> 条
          </span>
        </div>

        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            marginBottom: "16px",
            fontSize: "0.85rem",
          }}
        >
          <span
            style={{
              padding: "4px 8px",
              borderRadius: "999px",
              background: "#eff6ff",
              color: "#1d4ed8",
            }}
          >
            Info：{telemetryStats.info.toLocaleString()}
          </span>
          <span
            style={{
              padding: "4px 8px",
              borderRadius: "999px",
              background: "#fef3c7",
              color: "#b45309",
            }}
          >
            Warn：{telemetryStats.warn.toLocaleString()}
          </span>
          <span
            style={{
              padding: "4px 8px",
              borderRadius: "999px",
              background: "#fee2e2",
              color: "#b91c1c",
            }}
          >
            Error：{telemetryStats.error.toLocaleString()}
          </span>
          <span style={{ color: "#64748b" }}>BufferSize：{VIRTUAL_LIST_BUFFER_SIZE}</span>
        </div>

        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            background: "#f8fafc",
            padding: "12px",
          }}
          data-testid="telemetry-container"
        >
          <div style={{ marginBottom: "8px", color: "#475569", fontSize: "0.85rem" }}>
            虚拟列表容器高度 {VIRTUAL_LIST_CONTAINER_HEIGHT}px，使用按需计算的节点高度（severity
            加权）与 bufferSize 预加载。
          </div>
          <VirtualList
            items={virtualTelemetryItems}
            itemHeight={telemetryItemHeight}
            containerHeight={VIRTUAL_LIST_CONTAINER_HEIGHT}
            renderItem={renderTelemetryRow}
            onScroll={handleTelemetryScroll}
            bufferSize={VIRTUAL_LIST_BUFFER_SIZE}
            getItemKey={(item) => item.id}
          />
        </div>
      </section>

      {nodes.length > 0 && (
        <div
          style={{
            marginBottom: "20px",
            padding: "12px",
            border: "1px solid #e0e0e0",
            borderRadius: "6px",
            backgroundColor: "#fafafa",
          }}
          data-testid="nodes-list"
        >
          <strong data-testid="node-count-display">当前节点（{nodes.length}）</strong>
          <ul style={{ margin: "8px 0 0", paddingLeft: "20px" }}>
            {nodes.map((entity) => {
              const label =
                (entity as { label?: string }).label ??
                (entity.data as { label?: string } | undefined)?.label ??
                entity.id;
              const position = nodePositions.get(entity.id);
              return (
                <li key={entity.id} data-testid={`node-${entity.id}`}>
                  <span>{label}</span>
                  {position && (
                    <span style={{ marginLeft: "8px", color: "#555" }}>
                      @ ({Math.round(position.x)}, {Math.round(position.y)})
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Editor component */}
      <div data-testid="flow-editor-wrapper" style={{ position: "relative", marginBottom: "32px" }}>
        <Editor
          canvasRef={canvasRef}
          setCanvasRef={setCanvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onDraw={handleDraw}
          width="100%"
          height="600px"
          isDragging={isDragging}
          isDraggingMultiple={isDragging && selectedIds.size > 1}
          isSelecting={isSelecting}
          showBorder={true}
          className="flow-demo-editor"
          onViewportChange={handleViewportChange}
          onRenderContextReady={handleRenderContextReady}
        />
        {/* Start node rendered with React */}
        {startNodeOverlays}
        {flowNodeFormOverlay}
      </div>
    </div>
  );
};

export const FlowDemo: React.FC = () => (
  <KoduckFlowProvider environment={DEFAULT_KODUCKFLOW_ENVIRONMENT}>
    <FlowDemoContent />
  </KoduckFlowProvider>
);

export default FlowDemo;
