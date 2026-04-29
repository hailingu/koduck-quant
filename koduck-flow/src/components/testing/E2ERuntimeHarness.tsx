import { useCallback, useEffect, useMemo, useRef, useState, type HTMLAttributes } from "react";

import { VirtualList } from "../virtualized/VirtualList";

type RendererType = "react" | "canvas" | "webgpu";

type RendererSwitchState = "ready" | "switching" | "unsupported";

interface RendererStatusState {
  readonly active: RendererType;
  readonly state: RendererSwitchState;
  readonly lastUpdated: number;
  readonly history: Array<{ renderer: RendererType; timestamp: number }>;
}

const AVAILABLE_RENDERERS: RendererType[] = ["react", "canvas", "webgpu"];

interface EntityRecord {
  id: string;
  type: string;
  name: string;
}

interface FlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
}

interface FlowConnection {
  from: string;
  to: string;
  condition?: string;
}

interface FlowRecord {
  id: string;
  name: string;
  nodes: FlowNode[];
  connections: FlowConnection[];
}

interface ExecutionResult {
  flowId: string;
  status: "completed" | "failed";
  nodesExecuted: number;
  timestamp: number;
}

interface EntityFormState {
  id: string;
  type: string;
  name: string;
}

interface FlowFormState {
  id: string;
  name: string;
}

interface NodeFormState {
  id: string;
  type: string;
  x: string;
  y: string;
}

interface EntityBatchOptions {
  readonly idPrefix?: string;
  readonly namePrefix?: string;
  readonly type?: string;
  readonly startIndex?: number;
  readonly mode?: "append" | "replace";
}

interface EntityBatchResult {
  readonly tenantId: string;
  readonly total: number;
  readonly created: number;
  readonly removed: number;
  readonly mode: "append" | "replace" | "clear" | "set";
}

interface EntityRenderSignal {
  readonly iteration: number;
  readonly count: number;
  readonly timestamp: number;
}

interface EntityScrollSignal {
  readonly iteration: number;
  readonly start: number;
  readonly end: number;
  readonly timestamp: number;
}

interface TenantConfig {
  readonly id: string;
  readonly name: string;
  readonly environment: string;
  readonly theme: string;
  readonly features: {
    readonly advanced: boolean;
    readonly basic: boolean;
  };
}

interface EntityHarnessBridge {
  createEntities: (count: number, options?: EntityBatchOptions) => EntityBatchResult;
  clearEntities: () => EntityBatchResult;
  setEntities: (records: EntityRecord[]) => EntityBatchResult;
  getEntityCount: () => number;
  getRenderSignal: () => EntityRenderSignal;
  getScrollSignal: () => EntityScrollSignal;
  waitForRender: (expectedCount: number, timeoutMs?: number) => Promise<EntityRenderSignal>;
  waitForScroll: (timeoutMs?: number) => Promise<EntityScrollSignal>;
  scrollVirtualList: (position: "top" | "bottom" | number) => boolean;
  refreshView: (reason?: string) => RefreshViewSignal;
  getRefreshSignal: () => RefreshViewSignal | null;
  getWebSocketStatus: () => WebSocketStatusSnapshot;
  simulateWebSocketStatus: (patch: Partial<WebSocketStatusSnapshot>) => WebSocketStatusSnapshot;
  getErrorSnapshot: () => HarnessErrorSnapshot;
  resetErrorSnapshot: () => HarnessErrorSnapshot;
  recordError: (entry: Pick<HarnessErrorEntry, "message" | "source">) => HarnessErrorSnapshot;
  getStabilitySettings: () => StabilitySettingsSnapshot;
  setStabilityMode: (mode: StabilityModeSetting) => StabilitySettingsSnapshot;
  configureStability: (
    settings: Partial<Pick<StabilitySettingsSnapshot, "iterations" | "intervalMs" | "description">>
  ) => StabilitySettingsSnapshot;
  getActiveTenant: () => string;
  listTenants: () => string[];
  switchTenant: (tenantId: string) => string;
}

type HarnessWindow = Window & {
  __entityHarnessBridge?: EntityHarnessBridge;
};

interface EntityBatchComputationResult {
  readonly next: EntityRecord[];
  readonly created: number;
  readonly removed: number;
  readonly mode: EntityBatchResult["mode"];
}

const ENTITY_VIRTUALIZATION_THRESHOLD = 200;
const ENTITY_ROW_HEIGHT = 88;
const ENTITY_VIRTUAL_CONTAINER_HEIGHT = 520;
const DEFAULT_ENTITY_TYPE = "node";
const DEFAULT_ENTITY_NAME_PREFIX = "Entity";
const DEFAULT_ENTITY_ID_PREFIX = "entity";
const QUICK_SEED_COUNT = 2000;
const EXTENDED_SEED_COUNT = 10000;

type StabilityModeSetting = "quick" | "standard" | "extended" | "custom";

interface RefreshViewSignal {
  readonly iteration: number;
  readonly renderer: RendererType;
  readonly entityCount: number;
  readonly completedAt: number;
  readonly reason: string;
  readonly mode: StabilityModeSetting;
}

interface RenderCompletionSignal extends RefreshViewSignal {
  readonly source: "refresh" | "auto";
}

interface WebSocketStatusSnapshot {
  readonly connected: boolean;
  readonly lastChange: number;
  readonly reconnectAttempts: number;
  readonly lastMessage: string | null;
}

interface HarnessErrorEntry {
  readonly message: string;
  readonly timestamp: number;
  readonly source?: string;
  readonly type: "error" | "rejection";
}

interface HarnessErrorSnapshot {
  readonly total: number;
  readonly recent: HarnessErrorEntry[];
  readonly lastError: HarnessErrorEntry | null;
}

interface StabilitySettingsSnapshot {
  readonly mode: StabilityModeSetting;
  readonly iterations: number;
  readonly intervalMs: number;
  readonly expectedDurationMs: number;
  readonly description: string;
}

const STABILITY_PRESETS: Record<
  StabilityModeSetting,
  {
    readonly iterations: number;
    readonly intervalMs: number;
    readonly description: string;
  }
> = {
  quick: {
    iterations: 6,
    intervalMs: 10_000,
    description: "Quick verification (~1 minute)",
  },
  standard: {
    iterations: 10,
    intervalMs: 30_000,
    description: "Standard development (~5 minutes)",
  },
  extended: {
    iterations: 288,
    intervalMs: 300_000,
    description: "Extended overnight (~24 hours)",
  },
  custom: {
    iterations: 10,
    intervalMs: 30_000,
    description: "Custom configuration",
  },
};

const computeExpectedDuration = (iterations: number, intervalMs: number): number => {
  return Math.max(iterations, 0) * Math.max(intervalMs, 0);
};

const formatDuration = (ms: number): string => {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  if (ms < 3_600_000) {
    return `${(ms / 60_000).toFixed(1)}m`;
  }
  return `${(ms / 3_600_000).toFixed(1)}h`;
};

const hiddenSignalStyle = {
  display: "inline-block",
  width: 1,
  height: 1,
  overflow: "hidden",
  position: "absolute" as const,
  top: 0,
  left: 0,
  opacity: 0,
  pointerEvents: "none" as const,
};

const TENANT_OPTIONS: TenantConfig[] = [
  {
    id: "tenant-a",
    name: "Tenant Alpha",
    environment: "development",
    theme: "light",
    features: {
      advanced: true,
      basic: true,
    },
  },
  {
    id: "tenant-b",
    name: "Tenant Beta",
    environment: "staging",
    theme: "dark",
    features: {
      advanced: false,
      basic: true,
    },
  },
  {
    id: "tenant-c",
    name: "Tenant Gamma",
    environment: "production",
    theme: "contrast",
    features: {
      advanced: false,
      basic: false,
    },
  },
];

const DEFAULT_TENANT_ID = TENANT_OPTIONS[0]?.id ?? "tenant-default";

const createEmptyEntityForm = (): EntityFormState => ({ id: "", type: "", name: "" });
const createEmptyNodeForm = (): NodeFormState => ({ id: "", type: "", x: "", y: "" });
const createEmptyFlowForm = (): FlowFormState => ({ id: "", name: "" });

export const E2ERuntimeHarness = () => {
  const [isReady, setIsReady] = useState(false);
  const [renderer, setRenderer] = useState<RendererType>("react");
  const rendererSupport = useMemo(() => {
    const nav =
      typeof navigator === "undefined"
        ? undefined
        : ((navigator as Navigator & { gpu?: unknown }) ?? undefined);
    return {
      react: true,
      canvas: true,
      webgpu: Boolean(nav?.gpu),
    } satisfies Record<RendererType, boolean>;
  }, []);
  const [rendererMenuOpen, setRendererMenuOpen] = useState(false);
  const [rendererStatus, setRendererStatus] = useState<RendererStatusState>(() => {
    const timestamp = Date.now();
    return {
      active: "react",
      state: "ready",
      lastUpdated: timestamp,
      history: [{ renderer: "react", timestamp }],
    };
  });
  const rendererReadyTimer = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);

  const [entityForm, setEntityForm] = useState<EntityFormState>(() => createEmptyEntityForm());
  const initialTenantEntities = useMemo(() => {
    const seed: Record<string, EntityRecord[]> = {};
    for (const tenant of TENANT_OPTIONS) {
      seed[tenant.id] = [];
    }
    if (!seed[DEFAULT_TENANT_ID]) {
      seed[DEFAULT_TENANT_ID] = [];
    }
    return seed;
  }, []);
  const initialTenantFlows = useMemo(() => {
    const seed: Record<string, FlowRecord[]> = {};
    for (const tenant of TENANT_OPTIONS) {
      seed[tenant.id] = [];
    }
    if (!seed[DEFAULT_TENANT_ID]) {
      seed[DEFAULT_TENANT_ID] = [];
    }
    return seed;
  }, []);
  const [tenantEntities, setTenantEntities] =
    useState<Record<string, EntityRecord[]>>(initialTenantEntities);
  const [tenantFlows, setTenantFlows] = useState<Record<string, FlowRecord[]>>(initialTenantFlows);
  const tenantEntitiesRef = useRef<Record<string, EntityRecord[]>>(initialTenantEntities);
  const tenantFlowsRef = useRef<Record<string, FlowRecord[]>>(initialTenantFlows);
  const [activeTenantId, setActiveTenantId] = useState<string>(DEFAULT_TENANT_ID);
  const [entities, setEntities] = useState<EntityRecord[]>(
    () => initialTenantEntities[DEFAULT_TENANT_ID] ?? []
  );
  const entitiesRef = useRef<EntityRecord[]>([]);
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [entityPendingDelete, setEntityPendingDelete] = useState<string | null>(null);

  const [flowForm, setFlowForm] = useState<FlowFormState>(() => createEmptyFlowForm());
  const [nodeForm, setNodeForm] = useState<NodeFormState>(() => createEmptyNodeForm());
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [connections, setConnections] = useState<FlowConnection[]>([]);
  const [connectionDraft, setConnectionDraft] = useState<FlowConnection | null>(null);
  const [flows, setFlows] = useState<FlowRecord[]>(
    () => initialTenantFlows[DEFAULT_TENANT_ID] ?? []
  );
  const flowsRef = useRef<FlowRecord[]>(flows);

  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const virtualListRef = useRef<HTMLDivElement | null>(null);
  const nonVirtualScrollRef = useRef<HTMLDivElement | null>(null);
  const renderSignalRef = useRef<EntityRenderSignal>({
    iteration: 0,
    count: 0,
    timestamp: Date.now(),
  });
  const [renderSignal, setRenderSignal] = useState<EntityRenderSignal>(renderSignalRef.current);
  const scrollSignalRef = useRef<EntityScrollSignal>({
    iteration: 0,
    start: 0,
    end: 0,
    timestamp: Date.now(),
  });
  const [scrollSignal, setScrollSignal] = useState<EntityScrollSignal>(scrollSignalRef.current);
  const [lastBatchResult, setLastBatchResult] = useState<EntityBatchResult | null>(null);
  const refreshIterationRef = useRef(0);
  const refreshSignalRef = useRef<RefreshViewSignal | null>(null);
  const [refreshSignal, setRefreshSignal] = useState<RefreshViewSignal | null>(null);
  const [renderCompletionSignal, setRenderCompletionSignal] =
    useState<RenderCompletionSignal | null>(null);
  const [websocketStatus, setWebsocketStatus] = useState<WebSocketStatusSnapshot>(() => ({
    connected: true,
    lastChange: Date.now(),
    reconnectAttempts: 0,
    lastMessage: "initialized",
  }));
  const websocketStatusRef = useRef<WebSocketStatusSnapshot>(websocketStatus);
  const [errorSnapshot, setErrorSnapshot] = useState<HarnessErrorSnapshot>({
    total: 0,
    recent: [],
    lastError: null,
  });
  const errorSnapshotRef = useRef<HarnessErrorSnapshot>(errorSnapshot);
  const [stabilitySettings, setStabilitySettings] = useState<StabilitySettingsSnapshot>(() => {
    const preset = STABILITY_PRESETS.quick;
    return {
      mode: "quick",
      iterations: preset.iterations,
      intervalMs: preset.intervalMs,
      expectedDurationMs: computeExpectedDuration(preset.iterations, preset.intervalMs),
      description: preset.description,
    } as StabilitySettingsSnapshot;
  });
  const stabilitySettingsRef = useRef<StabilitySettingsSnapshot>(stabilitySettings);

  useEffect(() => {
    tenantEntitiesRef.current = tenantEntities;
  }, [tenantEntities]);

  const activeTenant = useMemo(
    () => TENANT_OPTIONS.find((tenant) => tenant.id === activeTenantId) ?? TENANT_OPTIONS[0],
    [activeTenantId]
  );

  const ensureTenantBucket = useCallback(
    (tenantId: string) => {
      const needsEntityBucket = !tenantEntitiesRef.current[tenantId];
      const needsFlowBucket = !tenantFlowsRef.current[tenantId];

      if (!needsEntityBucket && !needsFlowBucket) {
        return;
      }

      if (needsEntityBucket) {
        setTenantEntities((previous) => {
          if (previous[tenantId]) {
            return previous;
          }
          const nextMap = { ...previous, [tenantId]: [] };
          tenantEntitiesRef.current = nextMap;
          return nextMap;
        });
      }

      if (needsFlowBucket) {
        setTenantFlows((previous) => {
          if (previous[tenantId]) {
            return previous;
          }
          const nextMap = { ...previous, [tenantId]: [] };
          tenantFlowsRef.current = nextMap;
          return nextMap;
        });
      }
    },
    [setTenantEntities, setTenantFlows]
  );

  const updateEntitiesForTenant = useCallback(
    (tenantId: string, mutator: (previous: EntityRecord[]) => EntityRecord[]) => {
      const targetTenantId = tenantId || DEFAULT_TENANT_ID;
      ensureTenantBucket(targetTenantId);
      let nextEntities: EntityRecord[] = [];

      setTenantEntities((previous) => {
        const baseline = previous[targetTenantId] ?? [];
        const computed = mutator(baseline);
        nextEntities = computed;
        const nextMap = { ...previous, [targetTenantId]: computed };
        tenantEntitiesRef.current = nextMap;
        if (targetTenantId === activeTenantId) {
          setEntities(computed);
          entitiesRef.current = computed;
        }
        return nextMap;
      });

      if (targetTenantId === activeTenantId) {
        setEntities(nextEntities);
        entitiesRef.current = nextEntities;
      }

      return nextEntities;
    },
    [activeTenantId, ensureTenantBucket]
  );

  const updateEntitiesForActiveTenant = useCallback(
    (mutator: (previous: EntityRecord[]) => EntityRecord[]) => {
      const targetTenantId = activeTenantId || DEFAULT_TENANT_ID;
      return updateEntitiesForTenant(targetTenantId, mutator);
    },
    [activeTenantId, updateEntitiesForTenant]
  );

  const updateFlowsForTenant = useCallback(
    (tenantId: string, mutator: (previous: FlowRecord[]) => FlowRecord[]) => {
      const targetTenantId = tenantId || DEFAULT_TENANT_ID;
      ensureTenantBucket(targetTenantId);

      let nextFlows: FlowRecord[] = [];

      setTenantFlows((previous) => {
        const baseline = previous[targetTenantId] ?? [];
        const computed = mutator(baseline);
        nextFlows = computed;
        const nextMap = { ...previous, [targetTenantId]: computed };
        tenantFlowsRef.current = nextMap;
        if (targetTenantId === activeTenantId) {
          setFlows(computed);
          flowsRef.current = computed;
        }
        return nextMap;
      });

      if (targetTenantId === activeTenantId) {
        setFlows(nextFlows);
        flowsRef.current = nextFlows;
      }

      return nextFlows;
    },
    [activeTenantId, ensureTenantBucket]
  );

  const updateFlowsForActiveTenant = useCallback(
    (mutator: (previous: FlowRecord[]) => FlowRecord[]) => {
      const targetTenantId = activeTenantId || DEFAULT_TENANT_ID;
      return updateFlowsForTenant(targetTenantId, mutator);
    },
    [activeTenantId, updateFlowsForTenant]
  );

  const getActiveTenantId = useCallback(() => activeTenantId, [activeTenantId]);

  const listAvailableTenants = useCallback(() => TENANT_OPTIONS.map((tenant) => tenant.id), []);

  const switchActiveTenant = useCallback(
    (tenantId: string) => {
      const resolvedTenantId =
        TENANT_OPTIONS.find((tenant) => tenant.id === tenantId)?.id ?? DEFAULT_TENANT_ID;
      ensureTenantBucket(resolvedTenantId);
      setActiveTenantId(resolvedTenantId);
      return resolvedTenantId;
    },
    [ensureTenantBucket, setActiveTenantId]
  );

  useEffect(() => {
    const targetTenantId = activeTenantId || DEFAULT_TENANT_ID;
    ensureTenantBucket(targetTenantId);
    const nextEntities = tenantEntitiesRef.current[targetTenantId] ?? [];
    const nextFlows = tenantFlows[targetTenantId] ?? tenantFlowsRef.current[targetTenantId] ?? [];
    setEntities(nextEntities);
    entitiesRef.current = nextEntities;
    setFlows(nextFlows);
    flowsRef.current = nextFlows;
  }, [activeTenantId, ensureTenantBucket, tenantFlows]);

  useEffect(() => {
    websocketStatusRef.current = websocketStatus;
  }, [websocketStatus]);

  useEffect(() => {
    errorSnapshotRef.current = errorSnapshot;
  }, [errorSnapshot]);

  useEffect(() => {
    stabilitySettingsRef.current = stabilitySettings;
  }, [stabilitySettings]);

  useEffect(() => {
    refreshSignalRef.current = refreshSignal;
  }, [refreshSignal]);

  useEffect(() => {
    return () => {
      if (rendererReadyTimer.current) {
        globalThis.clearTimeout(rendererReadyTimer.current);
        rendererReadyTimer.current = null;
      }
    };
  }, []);

  const updateStabilityMode = useCallback(
    (mode: StabilityModeSetting): StabilitySettingsSnapshot => {
      const preset = STABILITY_PRESETS[mode] ?? STABILITY_PRESETS.custom;
      const next: StabilitySettingsSnapshot = {
        mode,
        iterations: preset.iterations,
        intervalMs: preset.intervalMs,
        expectedDurationMs: computeExpectedDuration(preset.iterations, preset.intervalMs),
        description: preset.description,
      };
      stabilitySettingsRef.current = next;
      setStabilitySettings(next);
      return next;
    },
    []
  );

  const configureStabilitySettings = useCallback(
    (
      settings: Partial<
        Pick<StabilitySettingsSnapshot, "iterations" | "intervalMs" | "description">
      >
    ): StabilitySettingsSnapshot => {
      let snapshot = stabilitySettingsRef.current;
      setStabilitySettings((previous) => {
        const iterations = Math.max(settings.iterations ?? previous.iterations, 1);
        const intervalMs = Math.max(settings.intervalMs ?? previous.intervalMs, 1);
        const next: StabilitySettingsSnapshot = {
          mode: previous.mode,
          iterations,
          intervalMs,
          expectedDurationMs: computeExpectedDuration(iterations, intervalMs),
          description: settings.description ?? previous.description,
        };
        snapshot = next;
        stabilitySettingsRef.current = next;
        return next;
      });
      return snapshot;
    },
    []
  );

  const appendErrorEntry = useCallback((entry: HarnessErrorEntry): HarnessErrorSnapshot => {
    let snapshot = errorSnapshotRef.current;
    setErrorSnapshot((previous) => {
      const nextRecent = [entry, ...previous.recent].slice(0, 10);
      const next: HarnessErrorSnapshot = {
        total: previous.total + 1,
        recent: nextRecent,
        lastError: entry,
      };
      snapshot = next;
      errorSnapshotRef.current = next;
      return next;
    });
    return snapshot;
  }, []);

  const resetErrorState = useCallback((): HarnessErrorSnapshot => {
    const reset: HarnessErrorSnapshot = { total: 0, recent: [], lastError: null };
    errorSnapshotRef.current = reset;
    setErrorSnapshot(reset);
    return reset;
  }, []);

  const recordErrorEntry = useCallback(
    (entry: Pick<HarnessErrorEntry, "message" | "source">): HarnessErrorSnapshot => {
      const payload: HarnessErrorEntry = {
        message: entry.message,
        timestamp: Date.now(),
        type: "error",
        ...(entry.source ? { source: entry.source } : {}),
      };
      return appendErrorEntry(payload);
    },
    [appendErrorEntry]
  );

  const simulateWebSocketStatus = useCallback(
    (patch: Partial<WebSocketStatusSnapshot>): WebSocketStatusSnapshot => {
      let snapshot = websocketStatusRef.current;
      setWebsocketStatus((previous) => {
        const hasConnectionChange =
          typeof patch.connected === "boolean" && patch.connected !== previous.connected;
        const reconnectAttempts =
          patch.reconnectAttempts ??
          (hasConnectionChange && patch.connected === false
            ? previous.reconnectAttempts + 1
            : previous.reconnectAttempts);

        let nextMessage = patch.lastMessage ?? previous.lastMessage;
        if (hasConnectionChange) {
          nextMessage = patch.connected ? "reconnected" : "connection-lost";
        }

        const next: WebSocketStatusSnapshot = {
          connected: patch.connected ?? previous.connected,
          lastChange: patch.lastChange ?? Date.now(),
          reconnectAttempts,
          lastMessage: nextMessage,
        };

        snapshot = next;
        websocketStatusRef.current = next;
        return next;
      });

      return snapshot;
    },
    []
  );

  const handleRefreshView = useCallback(
    (reason = "manual-refresh"): RefreshViewSignal => {
      const iteration = refreshIterationRef.current + 1;
      refreshIterationRef.current = iteration;
      const timestamp = Date.now();
      const nextRenderSignal: EntityRenderSignal = {
        iteration: renderSignalRef.current.iteration + 1,
        count: entitiesRef.current.length,
        timestamp,
      };
      renderSignalRef.current = nextRenderSignal;
      setRenderSignal(nextRenderSignal);

      const signal: RefreshViewSignal = {
        iteration,
        renderer,
        entityCount: nextRenderSignal.count,
        completedAt: timestamp,
        reason,
        mode: stabilitySettingsRef.current.mode,
      };

      refreshSignalRef.current = signal;
      setRefreshSignal(signal);
      setRenderCompletionSignal({
        ...signal,
        source: "refresh",
      });
      return signal;
    },
    [renderer]
  );

  useEffect(() => {
    if (renderSignal.count < 100) {
      return;
    }

    setRenderCompletionSignal((previous) => {
      if (previous && previous.completedAt >= renderSignal.timestamp) {
        return previous;
      }

      return {
        iteration: renderSignal.iteration,
        renderer,
        entityCount: renderSignal.count,
        completedAt: renderSignal.timestamp,
        reason: "auto-threshold",
        source: "auto",
        mode: stabilitySettingsRef.current.mode,
      };
    });
  }, [renderSignal, renderer]);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      appendErrorEntry({
        message: event.message || "Uncaught runtime error",
        source: event.filename,
        timestamp: Date.now(),
        type: "error",
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      let message: string;
      if (reason instanceof Error) {
        message = reason.message;
      } else if (typeof reason === "string") {
        message = reason;
      } else {
        try {
          message = JSON.stringify(reason);
        } catch {
          message = String(reason);
        }
      }

      appendErrorEntry({
        message,
        source: "unhandledrejection",
        timestamp: Date.now(),
        type: "rejection",
      });
    };

    globalThis.addEventListener("error", handleError);
    globalThis.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      globalThis.removeEventListener("error", handleError);
      globalThis.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, [appendErrorEntry]);

  useEffect(() => {
    const syncConnection = () => {
      simulateWebSocketStatus({
        connected: navigator.onLine,
        lastMessage: navigator.onLine ? "browser-online" : "browser-offline",
      });
    };

    syncConnection();
    globalThis.addEventListener("online", syncConnection);
    globalThis.addEventListener("offline", syncConnection);

    return () => {
      globalThis.removeEventListener("online", syncConnection);
      globalThis.removeEventListener("offline", syncConnection);
    };
  }, [simulateWebSocketStatus]);

  useEffect(() => {
    const readyTimer = globalThis.setTimeout(() => {
      setIsReady(true);
    }, 100);
    return () => {
      globalThis.clearTimeout(readyTimer);
    };
  }, []);

  useEffect(() => {
    updateEntitiesForActiveTenant((previous) => previous.map((entity) => ({ ...entity })));
  }, [renderer, updateEntitiesForActiveTenant]);

  useEffect(() => {
    entitiesRef.current = entities;
  }, [entities]);

  useEffect(() => {
    flowsRef.current = flows;
  }, [flows]);

  useEffect(() => {
    let frame = 0;
    frame = globalThis.requestAnimationFrame(() => {
      const nextSignal: EntityRenderSignal = {
        iteration: renderSignalRef.current.iteration + 1,
        count: entities.length,
        timestamp: Date.now(),
      };
      renderSignalRef.current = nextSignal;
      setRenderSignal(nextSignal);
    });
    return () => {
      globalThis.cancelAnimationFrame(frame);
    };
  }, [entities.length, renderer]);

  const shouldVirtualize = entities.length > ENTITY_VIRTUALIZATION_THRESHOLD;

  useEffect(() => {
    if (shouldVirtualize) {
      nonVirtualScrollRef.current = null;
    }
  }, [shouldVirtualize]);

  useEffect(() => {
    if (!shouldVirtualize) {
      const nextSignal: EntityScrollSignal = {
        iteration: scrollSignalRef.current.iteration + 1,
        start: 0,
        end: Math.max(entities.length - 1, 0),
        timestamp: Date.now(),
      };
      scrollSignalRef.current = nextSignal;
      setScrollSignal(nextSignal);
      virtualListRef.current = null;
    }
  }, [entities.length, shouldVirtualize]);

  const handleVirtualRangeUpdate = useCallback((range: { start: number; end: number }) => {
    const nextSignal: EntityScrollSignal = {
      iteration: scrollSignalRef.current.iteration + 1,
      start: range.start,
      end: range.end,
      timestamp: Date.now(),
    };
    scrollSignalRef.current = nextSignal;
    setScrollSignal(nextSignal);
  }, []);

  const applyBatchMutation = useCallback(
    (
      mutation: (previous: EntityRecord[]) => EntityBatchComputationResult,
      tenantId?: string
    ): EntityBatchResult => {
      const targetTenant = tenantId ?? (activeTenantId || DEFAULT_TENANT_ID);
      ensureTenantBucket(targetTenant);

      let computationResult: EntityBatchComputationResult | null = null;
      const resolvedEntities = updateEntitiesForTenant(targetTenant, (previous) => {
        const result = mutation(previous);
        computationResult = result;
        return result.next;
      });

      const summary: EntityBatchComputationResult = computationResult ?? {
        next: resolvedEntities,
        created: 0,
        removed: 0,
        mode: "set",
      };

      const resolved: EntityBatchResult = {
        tenantId: targetTenant,
        created: summary.created,
        removed: summary.removed,
        total: resolvedEntities.length,
        mode: summary.mode,
      };

      setLastBatchResult(resolved);
      return resolved;
    },
    [activeTenantId, ensureTenantBucket, setLastBatchResult, updateEntitiesForTenant]
  );

  const createEntitiesBatch = useCallback(
    (count: number, options?: EntityBatchOptions) => {
      const safeCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
      const idPrefix = options?.idPrefix ?? DEFAULT_ENTITY_ID_PREFIX;
      const namePrefix = options?.namePrefix ?? DEFAULT_ENTITY_NAME_PREFIX;
      const entityType = options?.type ?? DEFAULT_ENTITY_TYPE;
      const mode = options?.mode ?? "append";
      const startIndex =
        options?.startIndex ?? (mode === "append" ? entitiesRef.current.length : 0);

      if (safeCount <= 0) {
        return applyBatchMutation((previous) => ({
          next: previous,
          created: 0,
          removed: 0,
          mode: mode === "replace" ? "replace" : "append",
        }));
      }

      return applyBatchMutation((previous) => {
        const base = mode === "replace" ? [] : previous;
        const generated: EntityRecord[] = Array.from({ length: safeCount }, (_, index) => {
          const resolvedIndex = startIndex + index;
          return {
            id: `${idPrefix}-${resolvedIndex}`,
            name: `${namePrefix} ${resolvedIndex}`,
            type: entityType,
          };
        });

        let removed = 0;
        let next: EntityRecord[];

        if (mode === "replace") {
          removed = previous.length;
          next = generated;
        } else {
          const incomingIds = new Set(generated.map((record) => record.id));
          const preserved = base.filter((record) => !incomingIds.has(record.id));
          next = [...preserved, ...generated];
        }

        return {
          next,
          created: generated.length,
          removed,
          mode: mode === "replace" ? "replace" : "append",
        };
      });
    },
    [applyBatchMutation, entitiesRef]
  );

  const clearEntitiesBatch = useCallback(() => {
    return applyBatchMutation((previous) => ({
      next: [],
      created: 0,
      removed: previous.length,
      mode: "clear",
    }));
  }, [applyBatchMutation]);

  const setEntitiesBatch = useCallback(
    (records: EntityRecord[]) => {
      const sanitized = records.map((record, index) => {
        const fallbackId = `${DEFAULT_ENTITY_ID_PREFIX}-${index}`;
        const id = record.id?.trim() || fallbackId;
        const type = record.type?.trim() || DEFAULT_ENTITY_TYPE;
        const name = record.name?.trim() || `${DEFAULT_ENTITY_NAME_PREFIX} ${index}`;
        return {
          id,
          type,
          name,
        };
      });

      return applyBatchMutation((previous) => ({
        next: sanitized,
        created: sanitized.length,
        removed: previous.length,
        mode: "set",
      }));
    },
    [applyBatchMutation]
  );

  const handleQuickSeedEntities = useCallback(() => {
    createEntitiesBatch(QUICK_SEED_COUNT, {
      mode: "replace",
      idPrefix: DEFAULT_ENTITY_ID_PREFIX,
      namePrefix: DEFAULT_ENTITY_NAME_PREFIX,
      type: DEFAULT_ENTITY_TYPE,
      startIndex: 0,
    });
  }, [createEntitiesBatch]);

  const handleExtendedSeedEntities = useCallback(() => {
    createEntitiesBatch(EXTENDED_SEED_COUNT, {
      mode: "replace",
      idPrefix: DEFAULT_ENTITY_ID_PREFIX,
      namePrefix: DEFAULT_ENTITY_NAME_PREFIX,
      type: DEFAULT_ENTITY_TYPE,
      startIndex: 0,
    });
  }, [createEntitiesBatch]);

  const handleClearEntities = useCallback(() => {
    clearEntitiesBatch();
  }, [clearEntitiesBatch]);

  const scrollVirtualList = useCallback(
    (position: "top" | "bottom" | number) => {
      const container = virtualListRef.current ?? nonVirtualScrollRef.current;
      if (!container) {
        return false;
      }

      let target: number;
      if (position === "top") {
        target = 0;
      } else if (position === "bottom") {
        target = container.scrollHeight;
      } else if (typeof position === "number" && Number.isFinite(position)) {
        target = position;
      } else {
        return false;
      }

      container.scrollTop = target;
      return true;
    },
    [nonVirtualScrollRef, virtualListRef]
  );

  const waitForRenderSignal = useCallback((expectedCount: number, timeoutMs = 5000) => {
    const targetCount = Math.max(0, expectedCount);
    const timeout = Math.max(timeoutMs, 100);

    return new Promise<EntityRenderSignal>((resolve, reject) => {
      const startTime = Date.now();
      let frame = 0;

      const check = () => {
        const current = renderSignalRef.current;
        if (current.count >= targetCount) {
          if (frame) {
            globalThis.cancelAnimationFrame(frame);
          }
          resolve(current);
          return;
        }

        if (Date.now() - startTime > timeout) {
          if (frame) {
            globalThis.cancelAnimationFrame(frame);
          }
          reject(new Error(`Timed out waiting for ${targetCount} entities to render`));
          return;
        }

        frame = globalThis.requestAnimationFrame(check);
      };

      check();
    });
  }, []);

  const waitForScrollSignal = useCallback((timeoutMs = 5000) => {
    const timeout = Math.max(timeoutMs, 100);
    const targetIteration = scrollSignalRef.current.iteration + 1;

    return new Promise<EntityScrollSignal>((resolve, reject) => {
      const startTime = Date.now();
      let frame = 0;

      const poll = () => {
        const current = scrollSignalRef.current;
        if (current.iteration >= targetIteration) {
          if (frame) {
            globalThis.cancelAnimationFrame(frame);
          }
          resolve(current);
          return;
        }

        if (Date.now() - startTime > timeout) {
          if (frame) {
            globalThis.cancelAnimationFrame(frame);
          }
          reject(new Error("Timed out waiting for scroll signal update"));
          return;
        }

        frame = globalThis.requestAnimationFrame(poll);
      };

      poll();
    });
  }, []);

  const handleRendererMenuToggle = useCallback(() => {
    setRendererMenuOpen((previous) => !previous);
  }, []);

  const handleRendererSelection = useCallback(
    (target: RendererType) => {
      if (!rendererSupport[target]) {
        setRendererStatus((previous) => ({
          ...previous,
          state: "unsupported",
          lastUpdated: Date.now(),
        }));
        return;
      }

      setRenderer(target);
      setRendererMenuOpen(false);

      const switchTimestamp = Date.now();
      setRendererStatus((previous) => {
        const nextHistory = [...previous.history, { renderer: target, timestamp: switchTimestamp }];
        return {
          active: target,
          state: "switching",
          lastUpdated: switchTimestamp,
          history: nextHistory.slice(-20),
        };
      });

      if (rendererReadyTimer.current) {
        globalThis.clearTimeout(rendererReadyTimer.current);
      }

      rendererReadyTimer.current = globalThis.setTimeout(() => {
        setRendererStatus((previous) => {
          if (previous.active !== target) {
            return previous;
          }
          const readyTimestamp = Date.now();
          const nextHistory = [...previous.history];
          const lastEntry = nextHistory.at(-1);
          if (lastEntry?.renderer !== target) {
            nextHistory.push({ renderer: target, timestamp: readyTimestamp });
          } else {
            nextHistory[nextHistory.length - 1] = {
              renderer: target,
              timestamp: readyTimestamp,
            };
          }

          return {
            active: target,
            state: "ready",
            lastUpdated: readyTimestamp,
            history: nextHistory.slice(-20),
          };
        });
        rendererReadyTimer.current = null;
      }, 120);
    },
    [rendererSupport]
  );

  useEffect(() => {
    const harnessWindow = globalThis.window as HarnessWindow | undefined;
    if (!harnessWindow) {
      return undefined;
    }

    const bridge: EntityHarnessBridge = {
      createEntities: createEntitiesBatch,
      clearEntities: clearEntitiesBatch,
      setEntities: setEntitiesBatch,
      getEntityCount: () => entitiesRef.current.length,
      getRenderSignal: () => renderSignalRef.current,
      getScrollSignal: () => scrollSignalRef.current,
      waitForRender: waitForRenderSignal,
      waitForScroll: waitForScrollSignal,
      scrollVirtualList,
      refreshView: handleRefreshView,
      getRefreshSignal: () => refreshSignalRef.current,
      getWebSocketStatus: () => websocketStatusRef.current,
      simulateWebSocketStatus,
      getErrorSnapshot: () => errorSnapshotRef.current,
      resetErrorSnapshot: resetErrorState,
      recordError: recordErrorEntry,
      getStabilitySettings: () => stabilitySettingsRef.current,
      setStabilityMode: updateStabilityMode,
      configureStability: configureStabilitySettings,
      getActiveTenant: getActiveTenantId,
      listTenants: listAvailableTenants,
      switchTenant: switchActiveTenant,
    };

    harnessWindow.__entityHarnessBridge = bridge;

    return () => {
      if (harnessWindow.__entityHarnessBridge === bridge) {
        delete harnessWindow.__entityHarnessBridge;
      }
    };
  }, [
    clearEntitiesBatch,
    createEntitiesBatch,
    entitiesRef,
    configureStabilitySettings,
    handleRefreshView,
    getActiveTenantId,
    listAvailableTenants,
    recordErrorEntry,
    resetErrorState,
    scrollVirtualList,
    setEntitiesBatch,
    simulateWebSocketStatus,
    switchActiveTenant,
    updateStabilityMode,
    waitForRenderSignal,
    waitForScrollSignal,
  ]);

  const renderEntityRow = useCallback(
    (entity: EntityRecord, index: number) => {
      return (
        <div
          key={entity.id}
          data-testid={`entity-${entity.id}`}
          data-renderer={renderer}
          data-entity-index={index}
          style={{
            border: "1px solid #cbd5f5",
            borderRadius: 8,
            padding: 12,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "#ffffff",
            minHeight: ENTITY_ROW_HEIGHT - 16,
          }}
        >
          <div>
            <div data-testid="entity-name" style={{ fontWeight: 600 }}>
              {entity.name || entity.id}
            </div>
            <div style={{ fontSize: 12, color: "#555" }}>{entity.type}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              data-testid={`edit-entity-${entity.id}`}
              onClick={() => {
                setEditingEntityId(entity.id);
                setEditNameValue(entity.name || "");
              }}
            >
              Edit
            </button>
            <button
              data-testid={`delete-entity-${entity.id}`}
              onClick={() => setEntityPendingDelete(entity.id)}
            >
              Delete
            </button>
          </div>
        </div>
      );
    },
    [renderer]
  );

  const entityListContent = useMemo(() => {
    if (entities.length === 0) {
      return (
        <div data-testid="entity-empty-state" style={{ color: "#475569" }}>
          No entities available. Create one or seed a batch to begin testing.
        </div>
      );
    }

    if (shouldVirtualize) {
      const virtualContainerProps: HTMLAttributes<HTMLDivElement> = {
        style: {
          border: "1px solid #e2e8f0",
          borderRadius: 6,
          padding: 8,
          backgroundColor: "#f8fafc",
        },
      };
      (virtualContainerProps as Record<string, unknown>)["data-testid"] =
        "entity-virtual-container";

      return (
        <VirtualList
          items={entities}
          itemHeight={ENTITY_ROW_HEIGHT}
          containerHeight={ENTITY_VIRTUAL_CONTAINER_HEIGHT}
          renderItem={(item, index) => renderEntityRow(item, index)}
          getItemKey={(item) => item.id}
          onScroll={handleVirtualRangeUpdate}
          containerRef={virtualListRef}
          containerProps={virtualContainerProps}
        />
      );
    }

    const rows = entities.map((entity, index) => renderEntityRow(entity, index));

    if (entities.length > 50) {
      return (
        <div
          ref={nonVirtualScrollRef}
          data-testid="entity-scroll-container"
          style={{
            overflowY: "auto",
            maxHeight: 400,
            border: "1px solid #eee",
            borderRadius: 4,
            padding: 8,
          }}
        >
          {rows}
        </div>
      );
    }

    return rows;
  }, [
    entities,
    handleVirtualRangeUpdate,
    nonVirtualScrollRef,
    renderEntityRow,
    shouldVirtualize,
    virtualListRef,
  ]);

  const handleCreateEntity = () => {
    if (!entityForm.id.trim() || !entityForm.type.trim()) {
      return;
    }
    updateEntitiesForActiveTenant((previous) => {
      const filtered = previous.filter((item) => item.id !== entityForm.id);
      return [
        ...filtered,
        {
          id: entityForm.id.trim(),
          type: entityForm.type.trim(),
          name: entityForm.name.trim(),
        },
      ];
    });
    setEntityForm(createEmptyEntityForm());
  };

  const handleConfirmDelete = () => {
    if (!entityPendingDelete) return;
    updateEntitiesForActiveTenant((previous) =>
      previous.filter((entity) => entity.id !== entityPendingDelete)
    );
    setEntityPendingDelete(null);
  };

  const handleSaveEntity = () => {
    if (!editingEntityId) return;
    updateEntitiesForActiveTenant((previous) =>
      previous.map((entity) =>
        entity.id === editingEntityId
          ? {
              ...entity,
              name: editNameValue,
            }
          : entity
      )
    );
    setEditingEntityId(null);
    setEditNameValue("");
  };

  const createNode = () => {
    if (!nodeForm.id.trim() || !nodeForm.type.trim()) return;
    const x = Number(nodeForm.x);
    const y = Number(nodeForm.y);
    setNodes((prev) => [
      ...prev.filter((node) => node.id !== nodeForm.id.trim()),
      {
        id: nodeForm.id.trim(),
        type: nodeForm.type.trim(),
        position: {
          x: Number.isFinite(x) ? x : 0,
          y: Number.isFinite(y) ? y : 0,
        },
      },
    ]);
    setNodeForm(createEmptyNodeForm());
  };

  const handleNodeClick = (nodeId: string) => {
    setConnectionDraft((draft) => {
      if (!draft) {
        return { from: nodeId, to: "" };
      }
      if (draft.from && !draft.to) {
        return { ...draft, to: nodeId };
      }
      return {
        from: nodeId,
        to: "",
        ...(draft.condition ? { condition: draft.condition } : {}),
      };
    });
  };

  const confirmConnection = () => {
    if (!connectionDraft?.from || !connectionDraft?.to) return;
    const nextConnection: FlowConnection = {
      from: connectionDraft.from,
      to: connectionDraft.to,
      ...(connectionDraft.condition ? { condition: connectionDraft.condition } : {}),
    };
    setConnections((prev) => [...prev, nextConnection]);
    setConnectionDraft(null);
  };

  const resetFlowBuilder = () => {
    setFlowForm(createEmptyFlowForm());
    setNodes([]);
    setConnections([]);
    setConnectionDraft(null);
  };

  const saveFlow = () => {
    if (!flowForm.id.trim()) return;
    const newFlow: FlowRecord = {
      id: flowForm.id.trim(),
      name: flowForm.name.trim() || flowForm.id.trim(),
      nodes,
      connections,
    };
    updateFlowsForActiveTenant((previous) => {
      return [...previous.filter((flow) => flow.id !== newFlow.id), newFlow];
    });
    resetFlowBuilder();
  };

  const executeFlow = (flowId: string) => {
    const flowToExecute = flows.find((flow) => flow.id === flowId);
    if (!flowToExecute) return;
    setIsExecuting(true);
    globalThis.setTimeout(() => {
      const executedNodes = flowToExecute.nodes.length;
      const result: ExecutionResult = {
        flowId: flowToExecute.id,
        status: "completed",
        nodesExecuted: executedNodes,
        timestamp: Date.now(),
      };
      setExecutionResult(result);
      setIsExecuting(false);
    }, 300);
  };

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div
        data-testid="runtime-ready"
        style={{
          display: isReady ? "inline-block" : "none",
          width: 1,
          height: 1,
          overflow: "hidden",
          position: "absolute",
          top: 0,
          left: 0,
          opacity: 0,
        }}
      >
        ready
      </div>

      <div data-testid="entity-render-signal" style={hiddenSignalStyle}>
        {JSON.stringify(renderSignal)}
      </div>
      <div data-testid="entity-scroll-signal" style={hiddenSignalStyle}>
        {JSON.stringify(scrollSignal)}
      </div>
      {lastBatchResult && (
        <div data-testid="entity-last-batch" style={hiddenSignalStyle}>
          {JSON.stringify(lastBatchResult)}
        </div>
      )}
      {refreshSignal && (
        <div data-testid="refresh-view-signal" style={hiddenSignalStyle}>
          {JSON.stringify(refreshSignal)}
        </div>
      )}
      {renderCompletionSignal && (
        <div data-testid="render-complete" style={hiddenSignalStyle}>
          {JSON.stringify(renderCompletionSignal)}
        </div>
      )}
      <div data-testid="websocket-status" style={hiddenSignalStyle}>
        {JSON.stringify(websocketStatus)}
      </div>
      <div data-testid="runtime-error-count" style={hiddenSignalStyle}>
        {errorSnapshot.total}
      </div>
      <div data-testid="runtime-error-log" style={hiddenSignalStyle}>
        {JSON.stringify(errorSnapshot.recent)}
      </div>
      <div data-testid="stability-settings" style={hiddenSignalStyle}>
        {JSON.stringify(stabilitySettings)}
      </div>

      <section style={{ border: "1px solid #ccc", borderRadius: 12, padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Tenant Context</h2>
        <div style={{ display: "grid", gap: 12 }}>
          <div
            data-testid="tenant-selector"
            style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
          >
            <span style={{ fontWeight: 600 }}>Active Tenant</span>
            {TENANT_OPTIONS.map((tenant) => {
              const isActive = tenant.id === activeTenantId;
              return (
                <button
                  key={tenant.id}
                  type="button"
                  data-testid={`tenant-option-${tenant.id}`}
                  onClick={() => switchActiveTenant(tenant.id)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    border: isActive ? "2px solid #2563eb" : "1px solid #cbd5f5",
                    backgroundColor: isActive ? "#dbeafe" : "#ffffff",
                    cursor: "pointer",
                  }}
                >
                  <span style={{ display: "block", fontWeight: 600 }}>{tenant.name}</span>
                  <span style={{ fontSize: 10, color: "#475569" }}>{tenant.id}</span>
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <span
              data-testid="current-tenant-display"
              style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}
            >
              {activeTenantId}
            </span>
            {TENANT_OPTIONS.map((tenant) => (
              <span
                key={tenant.id}
                data-testid={`tenant-${tenant.id}-active`}
                style={{
                  display: tenant.id === activeTenantId ? "inline" : "none",
                  fontSize: 12,
                  color: "#1f2937",
                }}
              >
                {tenant.id === activeTenantId ? "active" : "inactive"}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
          <span
            data-testid="theme-indicator"
            data-theme={activeTenant?.theme ?? "unknown"}
            style={{ fontWeight: 500 }}
          >
            Theme: {activeTenant?.theme ?? "Unknown"}
          </span>
          <span
            data-testid="advanced-feature"
            data-feature-state={activeTenant?.features.advanced ? "enabled" : "disabled"}
            style={{
              display: activeTenant?.features.advanced ? "inline" : "none",
              color: "#1f2937",
            }}
          >
            Advanced features enabled
          </span>
          <span
            data-testid="basic-feature"
            data-feature-state={activeTenant?.features.basic ? "enabled" : "disabled"}
            style={{
              display: activeTenant?.features.basic ? "inline" : "none",
              color: "#1f2937",
            }}
          >
            Basic features enabled
          </span>
        </div>
      </section>

      <section
        style={{ border: "1px solid #ccc", borderRadius: 12, padding: 16 }}
        data-testid="stability-diagnostics"
      >
        <h2 style={{ marginTop: 0 }}>Stability Diagnostics</h2>
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <button data-testid="refresh-view" onClick={() => handleRefreshView("ui-refresh")}>
            Refresh View
          </button>
          <span data-testid="stability-mode-active">Mode: {stabilitySettings.mode}</span>
          <span data-testid="stability-iterations">
            Iterations: {stabilitySettings.iterations.toLocaleString()}
          </span>
          <span data-testid="stability-interval">
            Interval: {stabilitySettings.intervalMs.toLocaleString()} ms
          </span>
          <span data-testid="stability-expected-duration">
            Expected Duration: {formatDuration(stabilitySettings.expectedDurationMs)}
          </span>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          {(["quick", "standard", "extended"] as StabilityModeSetting[]).map((mode) => (
            <button
              key={mode}
              data-testid={`stability-mode-${mode}`}
              onClick={() => updateStabilityMode(mode)}
              disabled={stabilitySettings.mode === mode}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
          <button
            data-testid="stability-reset-errors"
            onClick={resetErrorState}
            style={{ marginLeft: "auto" }}
          >
            Reset Errors
          </button>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
          <span
            data-testid="websocket-indicator"
            style={{ color: websocketStatus.connected ? "#0f5132" : "#842029" }}
          >
            WebSocket: {websocketStatus.connected ? "Connected" : "Disconnected"}
          </span>
          <span data-testid="websocket-reconnect-attempts">
            Reconnects: {websocketStatus.reconnectAttempts}
          </span>
          <span data-testid="runtime-error-count-display">Errors: {errorSnapshot.total}</span>
          {errorSnapshot.lastError && (
            <span data-testid="runtime-error-last-message">
              Last error: {errorSnapshot.lastError.message}
            </span>
          )}
        </div>
      </section>

      <section style={{ border: "1px solid #ccc", borderRadius: 12, padding: 16 }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Renderer Controls</h2>
          <button
            type="button"
            data-testid="renderer-selector"
            aria-haspopup="menu"
            aria-expanded={rendererMenuOpen ? "true" : "false"}
            aria-controls="renderer-options-panel"
            onClick={handleRendererMenuToggle}
          >
            Select Renderer
          </button>
        </header>
        <div
          id="renderer-options-panel"
          data-testid="renderer-options"
          role="menu"
          style={{
            display: rendererMenuOpen ? "flex" : "none",
            flexDirection: "column",
            gap: 8,
            marginTop: 12,
          }}
        >
          {AVAILABLE_RENDERERS.map((value) => {
            const supported = rendererSupport[value];
            const isActive = rendererStatus.active === value;
            return (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                data-testid={`renderer-${value}`}
                data-supported={supported ? "true" : "false"}
                disabled={!supported}
                onClick={() => handleRendererSelection(value)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: isActive ? "2px solid #2563eb" : "1px solid #94a3b8",
                  backgroundColor: isActive ? "#dbeafe" : "#ffffff",
                  cursor: supported ? "pointer" : "not-allowed",
                  opacity: supported ? 1 : 0.5,
                  textAlign: "left" as const,
                }}
              >
                {value.toUpperCase()}
              </button>
            );
          })}
        </div>
        <div
          style={{
            marginTop: 12,
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {AVAILABLE_RENDERERS.map((value) => (
            <span
              key={value}
              data-testid={`renderer-active-${value}`}
              style={{
                display: rendererStatus.active === value ? "inline-flex" : "none",
                padding: "4px 8px",
                borderRadius: 6,
                backgroundColor: "#d1f7c4",
                border: "1px solid #4caf50",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {`Active: ${value}`}
            </span>
          ))}
          <span
            data-testid="renderer-switch-status"
            data-active={rendererStatus.active}
            data-state={rendererStatus.state}
            data-timestamp={rendererStatus.lastUpdated}
            style={{ fontSize: 12, color: "#1f2937" }}
          >
            Renderer {rendererStatus.active} · {rendererStatus.state}
          </span>
        </div>
        <div data-testid="renderer-switch-complete" style={hiddenSignalStyle}>
          {JSON.stringify({ active: rendererStatus.active, updatedAt: rendererStatus.lastUpdated })}
        </div>
        <div data-testid="renderer-switch-log" style={hiddenSignalStyle}>
          {JSON.stringify(rendererStatus.history)}
        </div>
      </section>

      <section style={{ border: "1px solid #ccc", borderRadius: 12, padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Entity Management</h2>
        <div style={{ display: "grid", gap: 8, maxWidth: 320 }}>
          <button
            data-testid="create-entity-btn"
            onClick={() => setEntityForm(createEmptyEntityForm())}
          >
            New Entity
          </button>
          <input
            data-testid="entity-type"
            placeholder="Entity type"
            value={entityForm.type}
            onChange={(event) =>
              setEntityForm((prev: EntityFormState) => ({ ...prev, type: event.target.value }))
            }
          />
          <input
            data-testid="entity-id"
            placeholder="Entity ID"
            value={entityForm.id}
            onChange={(event) =>
              setEntityForm((prev: EntityFormState) => ({ ...prev, id: event.target.value }))
            }
          />
          <input
            data-testid="entity-create-name"
            placeholder="Entity name"
            value={entityForm.name}
            onChange={(event) =>
              setEntityForm((prev: EntityFormState) => ({ ...prev, name: event.target.value }))
            }
          />
          <button data-testid="confirm-create" onClick={handleCreateEntity}>
            Confirm Create
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <button data-testid="seed-entities-quick" onClick={handleQuickSeedEntities}>
            Seed {QUICK_SEED_COUNT.toLocaleString()} entities
          </button>
          <button data-testid="seed-entities-extended" onClick={handleExtendedSeedEntities}>
            Seed {EXTENDED_SEED_COUNT.toLocaleString()} entities
          </button>
          <button data-testid="clear-entities" onClick={handleClearEntities}>
            Clear entities
          </button>
        </div>

        <div style={{ marginTop: 16, minHeight: 120 }} data-testid="entity-list">
          {entityListContent}
        </div>

        {editingEntityId && (
          <div style={{ marginTop: 16, display: "grid", gap: 8, maxWidth: 320 }}>
            <input
              data-testid="entity-name-input"
              placeholder="Entity name"
              value={editNameValue}
              onChange={(event) => setEditNameValue(event.target.value)}
            />
            <button data-testid="save-entity" onClick={handleSaveEntity}>
              Save
            </button>
          </div>
        )}

        {entityPendingDelete && (
          <button
            data-testid="confirm-delete"
            style={{ backgroundColor: "#ffcccc", marginTop: 12 }}
            onClick={handleConfirmDelete}
          >
            Confirm Delete
          </button>
        )}

        {lastBatchResult && (
          <pre
            data-testid="entity-batch-result"
            style={{
              backgroundColor: "#0f172a",
              color: "#e2e8f0",
              padding: 12,
              borderRadius: 8,
              marginTop: 16,
              fontSize: 12,
              overflowX: "auto",
            }}
          >
            {JSON.stringify(lastBatchResult, null, 2)}
          </pre>
        )}
      </section>

      <section style={{ border: "1px solid #ccc", borderRadius: 12, padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Flow Builder</h2>
        <div style={{ display: "grid", gap: 8, maxWidth: 360 }}>
          <button data-testid="create-flow-btn" onClick={() => setFlowForm(createEmptyFlowForm())}>
            Create Flow
          </button>
          <input
            data-testid="flow-id"
            placeholder="Flow ID"
            value={flowForm.id}
            onChange={(event) =>
              setFlowForm((prev: FlowFormState) => ({ ...prev, id: event.target.value }))
            }
          />
          <input
            data-testid="flow-name"
            placeholder="Flow name"
            value={flowForm.name}
            onChange={(event) =>
              setFlowForm((prev: FlowFormState) => ({ ...prev, name: event.target.value }))
            }
          />
          <button data-testid="add-node-btn" onClick={() => setNodeForm(createEmptyNodeForm())}>
            Add Node
          </button>
          <input
            data-testid="node-id"
            placeholder="Node ID"
            value={nodeForm.id}
            onChange={(event) =>
              setNodeForm((prev: NodeFormState) => ({ ...prev, id: event.target.value }))
            }
          />
          <input
            data-testid="node-type"
            placeholder="Node type"
            value={nodeForm.type}
            onChange={(event) =>
              setNodeForm((prev: NodeFormState) => ({ ...prev, type: event.target.value }))
            }
          />
          <input
            data-testid="node-x"
            placeholder="Node X"
            value={nodeForm.x}
            onChange={(event) =>
              setNodeForm((prev: NodeFormState) => ({ ...prev, x: event.target.value }))
            }
          />
          <input
            data-testid="node-y"
            placeholder="Node Y"
            value={nodeForm.y}
            onChange={(event) =>
              setNodeForm((prev: NodeFormState) => ({ ...prev, y: event.target.value }))
            }
          />
          <button data-testid="confirm-node" onClick={createNode}>
            Confirm Node
          </button>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {nodes.map((node) => (
              <button
                key={node.id}
                data-testid={`node-${node.id}`}
                onClick={() => handleNodeClick(node.id)}
              >
                {node.id}
              </button>
            ))}
          </div>

          <textarea
            data-testid="connection-condition"
            placeholder="Connection condition"
            value={connectionDraft?.condition ?? ""}
            onChange={(event) =>
              setConnectionDraft((prev) =>
                prev
                  ? {
                      ...prev,
                      condition: event.target.value,
                    }
                  : { from: "", to: "", condition: event.target.value }
              )
            }
            rows={3}
          />
          <button data-testid="confirm-connection" onClick={confirmConnection}>
            Confirm Connection
          </button>
          <button data-testid="save-flow" onClick={saveFlow}>
            Save Flow
          </button>
        </div>

        <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
          {flows.map((flow) => (
            <div
              key={flow.id}
              data-testid={`flow-${flow.id}`}
              style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}
            >
              <div style={{ fontWeight: 600 }}>{flow.name}</div>
              <div style={{ fontSize: 12, color: "#555" }}>{flow.nodes.length} nodes</div>
              <button data-testid={`execute-flow-${flow.id}`} onClick={() => executeFlow(flow.id)}>
                Execute Flow
              </button>
            </div>
          ))}
        </div>
      </section>

      <section style={{ border: "1px solid #ccc", borderRadius: 12, padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Execution Status</h2>
        {isExecuting && <div>Executing...</div>}
        {executionResult && !isExecuting && (
          <div>
            <div data-testid="execution-complete">Execution Complete</div>
            {executionResult.status === "failed" && (
              <div data-testid="execution-error" style={{ color: "red", marginTop: 12 }}>
                <div data-testid="error-details">
                  Flow execution failed with status: {executionResult.status}
                </div>
              </div>
            )}
            {executionResult.status === "completed" && (
              <div data-testid="execution-time">
                Execution completed in approximately {Math.random() * 1000}ms
              </div>
            )}
            <pre data-testid="execution-result" style={{ background: "#f5f5f5", padding: 12 }}>
              {JSON.stringify(executionResult, null, 2)}
            </pre>
          </div>
        )}
      </section>
    </div>
  );
};

export default E2ERuntimeHarness;
