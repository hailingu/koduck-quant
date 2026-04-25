import {
  type JsonValue,
  type WorkflowAdapter,
  type WorkflowDefinition,
  type WorkflowTriggerOptions,
} from "../src/business/workflow/types";
import { WorkflowService } from "../src/business/workflow/workflow-service";

export interface TemplateScenario {
  readonly key: string;
  readonly description: string;
  readonly payload: JsonValue;
  readonly triggerOptions?: WorkflowTriggerOptions;
}

export interface WorkflowTemplate {
  readonly id: string;
  readonly label: string;
  readonly category: string;
  readonly definition: WorkflowDefinition;
  readonly createAdapter: () => WorkflowAdapter;
  readonly scenarios: TemplateScenario[];
  readonly description: string;
  readonly successMetrics: string[];
  readonly risks: string[];
  readonly tags?: string[];
}

export interface TemplateRegistrationResult {
  readonly template: WorkflowTemplate;
  readonly adapterKey: string;
}

export async function registerTemplate(
  service: WorkflowService,
  template: WorkflowTemplate
): Promise<TemplateRegistrationResult> {
  const adapterKey = template.definition.adapterKey;
  if (!adapterKey) {
    throw new Error(`Template '${template.id}' is missing adapterKey on definition`);
  }

  service.attachAdapter(adapterKey, template.createAdapter());
  await service.registerWorkflow(template.definition);

  return { template, adapterKey };
}

export async function registerTemplates(
  service: WorkflowService,
  templates: WorkflowTemplate[]
): Promise<TemplateRegistrationResult[]> {
  const results: TemplateRegistrationResult[] = [];
  for (const template of templates) {
    results.push(await registerTemplate(service, template));
  }
  return results;
}
