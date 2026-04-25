import {
  type JsonValue,
  type TriggerWorkflowResponse,
  type WorkflowMode,
  type WorkflowRunStatus,
  type WorkflowServiceOptions,
  type WorkflowTriggerOptions,
} from "../src/business/workflow/types";
import { WorkflowService } from "../src/business/workflow/workflow-service";
import {
  workflowTemplates,
  registerTemplates,
  type WorkflowTemplate,
  type TemplateScenario,
  type TemplateRegistrationResult,
} from "./index";

export interface DemoLogEntry {
  readonly templateId: string;
  readonly scenarioKey: string;
  readonly mode: WorkflowMode;
  readonly runId: string;
  readonly status: WorkflowRunStatus;
  readonly summary: string;
}

export type DemoLogger = (entry: DemoLogEntry) => void;

export interface DemoRunOptions {
  readonly service?: WorkflowService;
  readonly serviceOptions?: WorkflowServiceOptions;
  readonly templateIds?: string[];
  readonly includeAdditionalDryRun?: boolean;
  readonly logger?: DemoLogger;
}

export interface TemplateScenarioRun {
  readonly scenario: TemplateScenario;
  readonly mode: WorkflowMode;
  readonly response: TriggerWorkflowResponse;
}

export interface WorkflowTemplateDemoResult {
  readonly template: WorkflowTemplate;
  readonly runs: TemplateScenarioRun[];
  readonly registration: TemplateRegistrationResult;
}

export async function createDemoService(
  options?: WorkflowServiceOptions
): Promise<{ service: WorkflowService; registrations: TemplateRegistrationResult[] }> {
  const service = new WorkflowService(options);
  const registrations = await registerTemplates(service, [...workflowTemplates]);
  return { service, registrations };
}

export async function runWorkflowTemplatesDemo(
  options?: DemoRunOptions
): Promise<WorkflowTemplateDemoResult[]> {
  let service = options?.service;
  let registrations: TemplateRegistrationResult[] = [];
  if (!service) {
    const result = await createDemoService(options?.serviceOptions);
    service = result.service;
    registrations = result.registrations;
  } else {
    registrations = await registerTemplates(service, [...workflowTemplates]);
  }

  const templateFilter = options?.templateIds;
  const templatesToRun = templateFilter
    ? workflowTemplates.filter((template) => templateFilter.includes(template.id))
    : workflowTemplates;

  const results: WorkflowTemplateDemoResult[] = [];
  for (const template of templatesToRun) {
    const templateRuns: TemplateScenarioRun[] = [];
    for (const scenario of template.scenarios) {
      const triggerOptions = cloneTriggerOptions(scenario.triggerOptions);
      const response = await service.triggerWorkflow(
        template.definition.id,
        scenario.payload,
        triggerOptions
      );
      templateRuns.push({ scenario, mode: response.run.mode, response });
      options?.logger?.(
        createLogEntry(
          template.definition.id,
          scenario.key,
          response,
          `Scenario run (${response.run.mode})`
        )
      );

      if (options?.includeAdditionalDryRun && response.run.mode !== "dry-run") {
        const dryRunOptions = mergeDryRunOptions(triggerOptions);
        const dryRunResponse = await service.triggerWorkflow(
          template.definition.id,
          scenario.payload,
          dryRunOptions
        );
        templateRuns.push({ scenario, mode: dryRunResponse.run.mode, response: dryRunResponse });
        options?.logger?.(
          createLogEntry(
            template.definition.id,
            scenario.key,
            dryRunResponse,
            "Supplemental dry-run"
          )
        );
      }
    }

    const registration = registrations.find((entry) => entry.template.id === template.id);
    results.push({
      template,
      runs: templateRuns,
      registration: registration ?? {
        template,
        adapterKey: template.definition.adapterKey ?? "",
      },
    });
  }

  return results;
}

export function summarizeDemoResults(results: WorkflowTemplateDemoResult[]): JsonValue {
  return results.map((result) => ({
    templateId: result.template.id,
    templateName: result.template.definition.name,
    runs: result.runs.map((run) => ({
      scenario: run.scenario.key,
      mode: run.mode,
      status: run.response.run.status,
      attempt: run.response.run.attempt,
      runId: run.response.run.id,
      metadata: run.response.run.metadata ?? null,
    })),
  }));
}

export async function printDemoSummary(options?: DemoRunOptions): Promise<void> {
  const logger: DemoLogger = options?.logger ?? defaultConsoleLogger;
  const results = await runWorkflowTemplatesDemo({ ...options, logger });
  const summary = summarizeDemoResults(results);
  logger({
    templateId: "summary",
    scenarioKey: "all",
    mode: "live",
    runId: "summary",
    status: "success",
    summary: JSON.stringify(summary, null, 2),
  });
}

function cloneTriggerOptions(options?: WorkflowTriggerOptions): WorkflowTriggerOptions | undefined {
  if (!options) {
    return undefined;
  }
  const cloned: WorkflowTriggerOptions = {};
  if (options.dryRun !== undefined) {
    cloned.dryRun = options.dryRun;
  }
  if (options.metadata) {
    cloned.metadata = cloneMetadata(options.metadata);
  }
  if (options.traceId) {
    cloned.traceId = options.traceId;
  }
  if (options.actor) {
    cloned.actor = options.actor;
  }
  return cloned;
}

function mergeDryRunOptions(options?: WorkflowTriggerOptions): WorkflowTriggerOptions {
  const dryRunOptions = cloneTriggerOptions(options) ?? {};
  dryRunOptions.dryRun = true;
  return dryRunOptions;
}

function cloneMetadata(metadata: Record<string, JsonValue>): Record<string, JsonValue> {
  const result: Record<string, JsonValue> = {};
  for (const [key, value] of Object.entries(metadata)) {
    result[key] = cloneJsonValue(value);
  }
  return result;
}

function cloneJsonValue(value: JsonValue): JsonValue {
  if (value === null) {
    return null;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => cloneJsonValue(item));
  }
  const result: Record<string, JsonValue> = {};
  for (const [key, entry] of Object.entries(value)) {
    result[key] = cloneJsonValue(entry);
  }
  return result;
}

function createLogEntry(
  templateId: string,
  scenarioKey: string,
  response: TriggerWorkflowResponse,
  summary: string
): DemoLogEntry {
  return {
    templateId,
    scenarioKey,
    mode: response.run.mode,
    runId: response.run.id,
    status: response.run.status,
    summary,
  };
}

const defaultConsoleLogger: DemoLogger = (entry) => {
  if (entry.templateId === "summary") {
    console.info("[workflow-demo] summary", entry.summary);
    return;
  }
  console.info(
    "[workflow-demo]",
    entry.templateId,
    entry.scenarioKey,
    entry.mode,
    entry.status,
    entry.summary
  );
};

const maybeProcess = globalThis as {
  process?: {
    argv?: string[];
    exit?: (code?: number) => void;
  };
};

if (maybeProcess.process?.argv?.[1]) {
  const entryPath = maybeProcess.process.argv[1];
  let invokedDirectly = false;
  try {
    invokedDirectly = import.meta.url === new URL(`file://${entryPath}`).href;
  } catch {
    invokedDirectly = false;
  }
  if (invokedDirectly) {
    void printDemoSummary().catch((error) => {
      console.error("[workflow-demo] failed", error);
      maybeProcess.process?.exit?.(1);
    });
  }
}
