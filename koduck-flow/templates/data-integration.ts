import {
  type JsonValue,
  type WorkflowAdapter,
  type WorkflowExecutionContext,
  type WorkflowExecutionResult,
  type WorkflowSimulationResult,
} from "../src/business/workflow/types";
import { type TemplateScenario, type WorkflowTemplate } from "./types";

type JsonObject = Record<string, JsonValue>;

interface DataIntegrationSource {
  readonly name: string;
  readonly systemType: string;
  readonly records?: number;
  readonly lastSyncedAt?: string;
}

interface DataIntegrationSchedule {
  readonly window: string;
  readonly timezone: string;
}

interface DataIntegrationPayload {
  readonly sourceSystems: DataIntegrationSource[];
  readonly targetSystem: {
    readonly name: string;
    readonly systemType: string;
  };
  readonly schedule: DataIntegrationSchedule;
  readonly transformations: string[];
  readonly notifyEmails: string[];
  readonly incremental: boolean;
}

interface SimulationStep {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly expectedDurationMs: number;
  readonly risk: "low" | "medium" | "high";
}

function serializeSchedule(schedule: DataIntegrationSchedule): JsonObject {
  return {
    window: schedule.window,
    timezone: schedule.timezone,
  };
}

function emitNote(
  workflowId: string,
  ctx: WorkflowExecutionContext,
  summary: string,
  data?: JsonValue
): void {
  if (!ctx.emitAudit) {
    return;
  }

  const payload: Parameters<NonNullable<typeof ctx.emitAudit>>[0] = {
    workflowId,
    runId: ctx.runId,
    type: "audit.note",
    summary,
  };

  if (data !== undefined) {
    payload.data = data;
  }

  ctx.emitAudit(payload);
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function ensureJsonObject(value: JsonValue, context: string): JsonObject {
  if (!isJsonObject(value)) {
    throw new Error(`${context} must be an object`);
  }
  return value;
}

function ensureJsonArray(value: JsonValue, context: string): JsonValue[] {
  if (!Array.isArray(value)) {
    throw new Error(`${context} must be an array`);
  }
  return value;
}

function asString(value: JsonValue | undefined, context: string): string {
  if (typeof value === "string") {
    return value;
  }
  throw new Error(`${context} must be a string`);
}

function asBoolean(value: JsonValue | undefined, context: string, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value === "boolean") {
    return value;
  }
  throw new Error(`${context} must be a boolean`);
}

function asNumber(value: JsonValue | undefined, context: string): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === "number") {
    return value;
  }
  throw new Error(`${context} must be a number`);
}

function parseStringArray(value: JsonValue | undefined, context: string): string[] {
  if (value === undefined) {
    return [];
  }
  const array = ensureJsonArray(value, context);
  const results: string[] = [];
  for (const entry of array) {
    results.push(asString(entry, `${context} item`));
  }
  return results;
}

function parseSourceSystems(value: JsonValue | undefined): DataIntegrationSource[] {
  if (value === undefined) {
    throw new Error("sourceSystems is required");
  }
  const array = ensureJsonArray(value, "sourceSystems");
  const sources: DataIntegrationSource[] = [];
  for (let index = 0; index < array.length; index += 1) {
    const entry = array[index];
    const obj = ensureJsonObject(entry, `sourceSystems[${index}]`);
    const name = asString(obj.name, `sourceSystems[${index}].name`);
    const systemType = asString(obj.systemType, `sourceSystems[${index}].systemType`);
    const records = asNumber(obj.records, `sourceSystems[${index}].records`);
    const lastSyncedAt =
      obj.lastSyncedAt === undefined
        ? undefined
        : asString(obj.lastSyncedAt, `sourceSystems[${index}].lastSyncedAt`);
    const source: DataIntegrationSource = {
      name,
      systemType,
      ...(records !== undefined ? { records } : {}),
      ...(lastSyncedAt !== undefined ? { lastSyncedAt } : {}),
    };
    sources.push(source);
  }
  return sources;
}

function parseSchedule(value: JsonValue | undefined): DataIntegrationSchedule {
  const obj = ensureJsonObject(value ?? {}, "schedule");
  const window = asString(obj.window, "schedule.window");
  const timezone = asString(obj.timezone, "schedule.timezone");
  return { window, timezone };
}

function parseTargetSystem(value: JsonValue | undefined): DataIntegrationPayload["targetSystem"] {
  const obj = ensureJsonObject(value ?? {}, "targetSystem");
  const name = asString(obj.name, "targetSystem.name");
  const systemType = asString(obj.systemType, "targetSystem.systemType");
  return { name, systemType };
}

function parsePayload(payload: JsonValue): DataIntegrationPayload {
  const root = ensureJsonObject(payload, "Data integration payload");
  const sourceSystems = parseSourceSystems(root.sourceSystems);
  const targetSystem = parseTargetSystem(root.targetSystem);
  const schedule = parseSchedule(root.schedule);
  const transformations = parseStringArray(root.transformations, "transformations");
  const notifyEmails = parseStringArray(root.notifyEmails, "notifyEmails");
  const incremental = asBoolean(root.incremental, "incremental", true);
  return {
    sourceSystems,
    targetSystem,
    schedule,
    transformations,
    notifyEmails,
    incremental,
  };
}

function createSimulationSteps(payload: DataIntegrationPayload): SimulationStep[] {
  const steps: SimulationStep[] = [];
  steps.push({
    id: "validate-input",
    name: "Validate Source and Target",
    description: `Validate ${payload.sourceSystems.length} sources and target ${payload.targetSystem.name}`,
    expectedDurationMs: 500,
    risk: "low",
  });
  steps.push({
    id: "profile-sources",
    name: "Profile Source Systems",
    description: "Assess source schemas, latency, and last sync time",
    expectedDurationMs: 1200,
    risk: "medium",
  });
  steps.push({
    id: "plan-transformations",
    name: "Plan Transformations",
    description: `Evaluate ${payload.transformations.length} transformation rules`,
    expectedDurationMs: 900,
    risk: payload.transformations.length > 3 ? "medium" : "low",
  });
  steps.push({
    id: "schedule-window",
    name: "Align Schedule",
    description: `Validate schedule window ${payload.schedule.window} (${payload.schedule.timezone})`,
    expectedDurationMs: 400,
    risk: "low",
  });
  steps.push({
    id: "notify-stakeholders",
    name: "Notify Stakeholders",
    description: `Confirm notification list (${payload.notifyEmails.length} recipients)`,
    expectedDurationMs: 200,
    risk: "low",
  });
  return steps;
}

function summarizeSources(sources: DataIntegrationSource[]): JsonValue {
  const summary: JsonObject = {};
  for (const source of sources) {
    const recordCount = source.records ?? 0;
    summary[source.name] = {
      systemType: source.systemType,
      records: recordCount,
      lastSyncedAt: source.lastSyncedAt ?? null,
    };
  }
  return summary;
}

function aggregateRecords(sources: DataIntegrationSource[]): number {
  let total = 0;
  for (const source of sources) {
    if (typeof source.records === "number") {
      total += source.records;
    }
  }
  return total;
}

function buildDataIntegrationAdapter(): WorkflowAdapter {
  return {
    async execute(definition, payload, ctx): Promise<WorkflowExecutionResult> {
      const parsed = parsePayload(payload);
      const logs: string[] = [];
      const start = Date.now();

      logs.push(
        `[${new Date().toISOString()}] Starting ${definition.name} for target ${parsed.targetSystem.name}`
      );

      const validationData: JsonObject = {
        sources: parsed.sourceSystems.length,
        transformations: parsed.transformations,
      };
      emitNote(definition.id, ctx, "Validated payload", validationData);

      for (const source of parsed.sourceSystems) {
        logs.push(
          `Preparing source ${source.name} (${source.systemType})${source.records ? ` with ${source.records} records` : ""}`
        );
      }

      if (parsed.incremental) {
        logs.push("Incremental mode enabled: detecting delta window");
      } else {
        logs.push("Full load mode enabled: performing baseline refresh");
      }

      logs.push(`Applying ${parsed.transformations.length} transformation rules`);

      const planningData: JsonObject = {
        rules: parsed.transformations,
        incremental: parsed.incremental,
      };
      emitNote(definition.id, ctx, "Transformation planning complete", planningData);

      const totalRecords = aggregateRecords(parsed.sourceSystems);
      logs.push(`Estimated ${totalRecords} rows to ingest`);

      const finish = Date.now();
      const diagnostics: JsonObject = {
        schedule: serializeSchedule(parsed.schedule),
        notifications: parsed.notifyEmails,
        summary: summarizeSources(parsed.sourceSystems),
      };

      const result: WorkflowExecutionResult = {
        output: {
          status: "completed",
          sourcesProcessed: parsed.sourceSystems.map((source) => source.name),
          target: parsed.targetSystem.name,
          incremental: parsed.incremental,
          estimatedRows: totalRecords,
          startedAt: new Date(start).toISOString(),
          finishedAt: new Date(finish).toISOString(),
        },
        logs,
        diagnostics,
      };

      emitNote(definition.id, ctx, "Data integration completed", result.output);

      return result;
    },

    async simulate(definition, payload, ctx): Promise<WorkflowSimulationResult> {
      const parsed = parsePayload(payload);
      const steps = createSimulationSteps(parsed);
      const logs = steps.map((step) => step.description);
      const totalDuration = steps.reduce((acc, step) => acc + step.expectedDurationMs, 0);

      const simulationData: JsonObject = { steps: steps.length };
      emitNote(definition.id, ctx, "Simulation generated", simulationData);

      return {
        logs,
        steps,
        output: {
          status: "simulated",
          estimatedDurationMs: totalDuration,
          sources: parsed.sourceSystems.length,
          transformations: parsed.transformations,
        },
      };
    },
  };
}

const liveScenarioPayload: JsonValue = {
  sourceSystems: [
    {
      name: "CRM",
      systemType: "Salesforce",
      records: 120000,
      lastSyncedAt: "2025-10-03T12:00:00Z",
    },
    {
      name: "ERP",
      systemType: "SAP ECC",
      records: 85000,
      lastSyncedAt: "2025-10-03T08:30:00Z",
    },
  ],
  targetSystem: {
    name: "Snowflake",
    systemType: "Data Warehouse",
  },
  schedule: {
    window: "0 */2 * * *",
    timezone: "UTC",
  },
  transformations: ["dedupe", "currencyNormalization", "maskPII"],
  notifyEmails: ["dataops@example.com", "analytics@example.com"],
  incremental: true,
};

const dryRunScenarioPayload: JsonValue = {
  sourceSystems: [
    {
      name: "CRM",
      systemType: "Salesforce",
      records: 120000,
      lastSyncedAt: "2025-10-03T12:00:00Z",
    },
    {
      name: "ERP",
      systemType: "SAP ECC",
      records: 85000,
      lastSyncedAt: "2025-10-03T08:30:00Z",
    },
  ],
  targetSystem: {
    name: "Snowflake",
    systemType: "Data Warehouse",
  },
  schedule: {
    window: "0 */2 * * *",
    timezone: "UTC",
  },
  transformations: ["dedupe", "currencyNormalization", "maskPII"],
  notifyEmails: ["dataops@example.com", "analytics@example.com"],
  incremental: false,
};

const scenarios: TemplateScenario[] = [
  {
    key: "live-ingestion",
    description: "Runs a full ingestion in incremental mode for CRM and ERP systems",
    payload: liveScenarioPayload,
    triggerOptions: {
      metadata: {
        ticket: "INC-8245",
        environment: "production",
      },
      actor: "dataops-bot",
    },
  },
  {
    key: "dry-run",
    description: "Performs a dry-run validation without touching target systems",
    payload: dryRunScenarioPayload,
    triggerOptions: {
      dryRun: true,
      metadata: {
        ticket: "CHG-331",
        environment: "staging",
      },
      actor: "qa-analyst",
    },
  },
];

export const dataIntegrationTemplate: WorkflowTemplate = {
  id: "data-integration.pipeline",
  label: "企业数据集成流水线",
  category: "Data Integration",
  definition: {
    id: "data-integration.pipeline",
    name: "Enterprise Data Integration Pipeline",
    version: "2025.10",
    description: "Orchestrates multi-source data ingestion into a central warehouse",
    metadata: {
      industry: "data-integration",
      owner: "data-platform",
      slaMinutes: 30,
    },
    adapterKey: "adapter.data-integration",
    contract: {
      type: "object",
      required: ["sourceSystems", "targetSystem", "schedule"],
      properties: {
        sourceSystems: {
          type: "array",
          items: {
            type: "object",
            required: ["name", "systemType"],
            properties: {
              name: { type: "string" },
              systemType: { type: "string" },
              records: { type: "number" },
              lastSyncedAt: { type: "string" },
            },
          },
        },
        targetSystem: {
          type: "object",
          required: ["name", "systemType"],
          properties: {
            name: { type: "string" },
            systemType: { type: "string" },
          },
        },
        schedule: {
          type: "object",
          required: ["window", "timezone"],
          properties: {
            window: { type: "string" },
            timezone: { type: "string" },
          },
        },
        transformations: {
          type: "array",
          items: { type: "string" },
        },
        notifyEmails: {
          type: "array",
          items: { type: "string" },
        },
        incremental: {
          type: "boolean",
        },
      },
    },
    retryPolicy: {
      maxAttempts: 3,
      backoffMs: 30_000,
    },
  },
  createAdapter: () => buildDataIntegrationAdapter(),
  scenarios,
  description:
    "Best-practice pipeline for consolidating CRM and ERP data into a Snowflake warehouse with validation, transformation, and notification hooks.",
  successMetrics: [
    "End-to-end latency under 30 minutes",
    ">99% successful ingestion ratio over rolling 14 days",
    "Schema drift auto-detection with notification",
  ],
  risks: [
    "Source schema drift causing transformation failures",
    "Network saturation during full loads",
    "Notification routing failures delaying incident response",
  ],
  tags: ["data", "integration", "etl", "warehouse"],
};

export function createDataIntegrationAdapter(): WorkflowAdapter {
  return buildDataIntegrationAdapter();
}
