import { WorkflowService } from "../src/business/workflow/workflow-service";
import {
  registerTemplate,
  registerTemplates,
  type TemplateRegistrationResult,
  type WorkflowTemplate,
} from "./types";
import { dataIntegrationTemplate } from "./data-integration";
import { orderProcessingTemplate } from "./order-processing";
import { slaBillingTemplate } from "./sla-billing";

export type { TemplateScenario, WorkflowTemplate, TemplateRegistrationResult } from "./types";
export { registerTemplate, registerTemplates } from "./types";
export { dataIntegrationTemplate, createDataIntegrationAdapter } from "./data-integration";
export { orderProcessingTemplate, createOrderProcessingAdapter } from "./order-processing";
export { slaBillingTemplate, createSlaBillingAdapter } from "./sla-billing";

export const workflowTemplates: readonly WorkflowTemplate[] = [
  dataIntegrationTemplate,
  orderProcessingTemplate,
  slaBillingTemplate,
];

export async function registerDefaultWorkflowTemplates(
  service: WorkflowService
): Promise<TemplateRegistrationResult[]> {
  return registerTemplates(service, [...workflowTemplates]);
}

export async function registerTemplateById(
  service: WorkflowService,
  templateId: string
): Promise<TemplateRegistrationResult> {
  const template = workflowTemplates.find((entry) => entry.id === templateId);
  if (!template) {
    throw new Error(`Unknown workflow template '${templateId}'`);
  }
  return registerTemplate(service, template);
}
