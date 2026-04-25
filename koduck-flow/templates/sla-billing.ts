import {
  type JsonValue,
  type WorkflowAdapter,
  type WorkflowExecutionContext,
  type WorkflowExecutionResult,
  type WorkflowSimulationResult,
} from "../src/business/workflow/types";
import { type TemplateScenario, type WorkflowTemplate } from "./types";

type JsonObject = Record<string, JsonValue>;

type IncidentSeverity = "sev0" | "sev1" | "sev2" | "sev3" | "sev4" | "sev5";
type ServiceTier = "critical" | "standard" | "experimental";

type CurrencyCode = string;

type JsonRecord = Record<string, JsonValue>;

interface PeriodWindow {
  readonly start: string;
  readonly end: string;
  readonly timezone?: string;
}

interface OrganizationInfo {
  readonly id: string;
  readonly name: string;
  readonly segment?: string;
}

interface SlaEntryPayload {
  readonly serviceId: string;
  readonly serviceName: string;
  readonly tier: ServiceTier;
  readonly targetAvailability: number;
  readonly actualAvailability: number;
  readonly downtimeMinutes?: number;
  readonly incidents: number;
  readonly highestSeverity: IncidentSeverity;
  readonly maintenanceMinutes?: number;
  readonly penaltyRatePerMinute?: number;
  readonly weight?: number;
  readonly notes?: string[];
}

interface BillingLinePayload {
  readonly serviceId: string;
  readonly usageType: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly currency: CurrencyCode;
  readonly credits?: number;
  readonly discountRate?: number;
  readonly amortizedCost?: number;
  readonly metadata?: JsonRecord;
}

interface ThresholdConfigurationPayload {
  readonly availability?: number;
  readonly downtimeMinutes?: number;
  readonly penaltyBudget?: number;
  readonly totalCost?: number;
  readonly unitCost?: number;
  readonly tolerance?: number;
}

interface AlertingPayload {
  readonly thresholds?: ThresholdConfigurationPayload;
  readonly notificationChannels?: string[];
  readonly runbookUrl?: string;
}

interface NormalizedThresholds {
  readonly availability: number;
  readonly downtimeMinutes: number;
  readonly penaltyBudget: number;
  readonly totalCost: number;
  readonly unitCost: number;
  readonly tolerance: number;
}

type NormalizedSlaEntry = Omit<
  SlaEntryPayload,
  "downtimeMinutes" | "maintenanceMinutes" | "penaltyRatePerMinute" | "weight" | "notes"
> & {
  readonly downtimeMinutes: number;
  readonly maintenanceMinutes: number;
  readonly penaltyRatePerMinute: number;
  readonly weight: number;
  readonly notes: string[];
};

type NormalizedBillingLine = Omit<
  BillingLinePayload,
  "credits" | "discountRate" | "amortizedCost"
> & {
  readonly credits: number;
  readonly discountRate: number;
  readonly amortizedCost: number;
  readonly effectiveCost: number;
  readonly netCost: number;
  readonly unitCost: number;
};

interface ParsedPayload {
  readonly period: PeriodWindow;
  readonly organization: OrganizationInfo;
  readonly slaEntries: NormalizedSlaEntry[];
  readonly billingItems: NormalizedBillingLine[];
  readonly alerts: AlertingPayload | undefined;
  readonly thresholds: NormalizedThresholds;
  readonly currency: CurrencyCode;
}

type AlertFinding = JsonObject & {
  readonly id: string;
  readonly severity: "critical" | "high" | "moderate" | "low";
  readonly metric: string;
  readonly message: string;
  readonly suggestedAction?: string;
};

type ServiceInsightRow = JsonObject & {
  readonly serviceId: string;
  readonly serviceName: string;
  readonly tier: ServiceTier;
  readonly targetAvailability: number;
  readonly actualAvailability: number;
  readonly availabilityGap: number;
  readonly downtimeMinutes: number;
  readonly maintenanceMinutes: number;
  readonly incidents: number;
  readonly highestSeverity: IncidentSeverity;
  readonly penaltyExposure: number;
  readonly notes?: string[];
};

type BillingInsightRow = JsonObject & {
  readonly serviceId: string;
  readonly usageType: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly currency: CurrencyCode;
  readonly discountsApplied: number;
  readonly creditsApplied: number;
  readonly effectiveCost: number;
  readonly netCost: number;
  readonly unitCost: number;
  readonly metadata?: JsonRecord;
};

interface ReportTemplateSection {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly columns: Array<{
    readonly key: string;
    readonly label: string;
    readonly format?: "percentage" | "currency" | "number" | "text";
  }>;
  readonly dataPath: string;
}

type ReportTemplateDefinition = JsonObject & {
  readonly name: string;
  readonly version: string;
  readonly sections: ReportTemplateSection[];
};

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function ensureJsonObject(value: JsonValue | undefined, context: string): JsonObject {
  if (!isJsonObject(value ?? {})) {
    throw new Error(`${context} must be an object`);
  }
  return (value as JsonObject) ?? {};
}

function ensureJsonArray(value: JsonValue | undefined, context: string): JsonValue[] {
  if (!Array.isArray(value)) {
    throw new Error(`${context} must be an array`);
  }
  return value;
}

function asString(value: JsonValue | undefined, context: string): string {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  throw new Error(`${context} must be a non-empty string`);
}

function asNumber(value: JsonValue | undefined, context: string): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  throw new Error(`${context} must be a finite number`);
}

function asOptionalNumber(value: JsonValue | undefined, fallback: number, context: string): number {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  throw new Error(`${context} must be a finite number`);
}

function asServiceTier(value: JsonValue | undefined, context: string): ServiceTier {
  const tier = asString(value, context) as ServiceTier;
  if (tier === "critical" || tier === "standard" || tier === "experimental") {
    return tier;
  }
  throw new Error(`${context} must be one of critical | standard | experimental`);
}

function asSeverity(value: JsonValue | undefined, context: string): IncidentSeverity {
  const severity = asString(value, context) as IncidentSeverity;
  if (["sev0", "sev1", "sev2", "sev3", "sev4", "sev5"].includes(severity)) {
    return severity;
  }
  throw new Error(`${context} must be a valid incident severity`);
}

function parseStringArray(value: JsonValue | undefined, context: string): string[] {
  if (value === undefined) {
    return [];
  }
  const array = ensureJsonArray(value, context);
  const values: string[] = [];
  for (const entry of array) {
    values.push(asString(entry, `${context} item`));
  }
  return values;
}

function parseMetadata(value: JsonValue | undefined): JsonRecord | undefined {
  if (value === undefined) {
    return undefined;
  }
  const obj = ensureJsonObject(value, "metadata");
  const record: JsonRecord = {};
  for (const [key, entry] of Object.entries(obj)) {
    record[key] = entry;
  }
  return record;
}

function normalizeSlaEntry(entry: JsonValue, index: number): NormalizedSlaEntry {
  const obj = ensureJsonObject(entry, `slaEntries[${index}]`);
  const serviceId = asString(obj.serviceId, `slaEntries[${index}].serviceId`);
  const serviceName = asString(obj.serviceName, `slaEntries[${index}].serviceName`);
  const tier = asServiceTier(obj.tier, `slaEntries[${index}].tier`);
  const targetAvailability = asNumber(
    obj.targetAvailability,
    `slaEntries[${index}].targetAvailability`
  );
  const actualAvailability = asNumber(
    obj.actualAvailability,
    `slaEntries[${index}].actualAvailability`
  );
  const downtimeMinutes = asOptionalNumber(
    obj.downtimeMinutes,
    Math.max(0, (1 - actualAvailability) * 60 * 24 * 30),
    `slaEntries[${index}].downtimeMinutes`
  );
  const incidents = asNumber(obj.incidents, `slaEntries[${index}].incidents`);
  const highestSeverity = asSeverity(obj.highestSeverity, `slaEntries[${index}].highestSeverity`);
  const maintenanceMinutes = asOptionalNumber(
    obj.maintenanceMinutes,
    0,
    `slaEntries[${index}].maintenanceMinutes`
  );
  const penaltyRatePerMinute = asOptionalNumber(
    obj.penaltyRatePerMinute,
    0,
    `slaEntries[${index}].penaltyRatePerMinute`
  );
  const weight = asOptionalNumber(obj.weight, 1, `slaEntries[${index}].weight`);
  const notes = parseStringArray(obj.notes, `slaEntries[${index}].notes`);

  return {
    serviceId,
    serviceName,
    tier,
    targetAvailability,
    actualAvailability,
    downtimeMinutes,
    incidents,
    highestSeverity,
    maintenanceMinutes,
    penaltyRatePerMinute,
    weight,
    notes,
  };
}

function normalizeBillingItem(entry: JsonValue, index: number): NormalizedBillingLine {
  const obj = ensureJsonObject(entry, `billingItems[${index}]`);
  const serviceId = asString(obj.serviceId, `billingItems[${index}].serviceId`);
  const usageType = asString(obj.usageType, `billingItems[${index}].usageType`);
  const quantity = asNumber(obj.quantity, `billingItems[${index}].quantity`);
  const unitPrice = asNumber(obj.unitPrice, `billingItems[${index}].unitPrice`);
  const currency = asString(obj.currency, `billingItems[${index}].currency`);
  const credits = asOptionalNumber(obj.credits, 0, `billingItems[${index}].credits`);
  const discountRate = asOptionalNumber(obj.discountRate, 0, `billingItems[${index}].discountRate`);
  const amortizedCost = asOptionalNumber(
    obj.amortizedCost,
    quantity * unitPrice,
    `billingItems[${index}].amortizedCost`
  );
  const metadata = parseMetadata(obj.metadata);

  const discountsApplied = amortizedCost * discountRate;
  const effectiveCost = amortizedCost - discountsApplied;
  const netCost = effectiveCost - credits;
  const unitCost = quantity > 0 ? netCost / quantity : netCost;

  return {
    serviceId,
    usageType,
    quantity,
    unitPrice,
    currency,
    credits,
    discountRate,
    amortizedCost,
    effectiveCost,
    netCost,
    unitCost,
    ...(metadata ? { metadata } : {}),
  };
}

function normalizeThresholds(payload: JsonValue | undefined): NormalizedThresholds {
  const defaults: NormalizedThresholds = {
    availability: 0.995,
    downtimeMinutes: 60,
    penaltyBudget: 50_000,
    totalCost: 120_000,
    unitCost: 10,
    tolerance: 0.0005,
  };
  if (payload === undefined) {
    return defaults;
  }
  const obj = ensureJsonObject(payload, "thresholds");
  return {
    availability: asOptionalNumber(
      obj.availability,
      defaults.availability,
      "thresholds.availability"
    ),
    downtimeMinutes: asOptionalNumber(
      obj.downtimeMinutes,
      defaults.downtimeMinutes,
      "thresholds.downtimeMinutes"
    ),
    penaltyBudget: asOptionalNumber(
      obj.penaltyBudget,
      defaults.penaltyBudget,
      "thresholds.penaltyBudget"
    ),
    totalCost: asOptionalNumber(obj.totalCost, defaults.totalCost, "thresholds.totalCost"),
    unitCost: asOptionalNumber(obj.unitCost, defaults.unitCost, "thresholds.unitCost"),
    tolerance: Math.max(
      0,
      asOptionalNumber(obj.tolerance, defaults.tolerance, "thresholds.tolerance")
    ),
  };
}

function parsePeriod(value: JsonValue | undefined): PeriodWindow {
  const obj = ensureJsonObject(value, "period");
  const start = asString(obj.start, "period.start");
  const end = asString(obj.end, "period.end");
  const timezone =
    obj.timezone === undefined ? undefined : asString(obj.timezone, "period.timezone");
  return timezone === undefined ? { start, end } : { start, end, timezone };
}

function parseOrganization(value: JsonValue | undefined): OrganizationInfo {
  const obj = ensureJsonObject(value, "organization");
  const id = asString(obj.id, "organization.id");
  const name = asString(obj.name, "organization.name");
  const segment =
    obj.segment === undefined ? undefined : asString(obj.segment, "organization.segment");
  return segment === undefined ? { id, name } : { id, name, segment };
}

function parsePayload(payload: JsonValue): ParsedPayload {
  const root = ensureJsonObject(payload, "SLA & Billing payload");
  const period = parsePeriod(root.period);
  const organization = parseOrganization(root.organization);

  const slaEntriesRaw = ensureJsonArray(root.slaEntries, "slaEntries");
  const slaEntries = slaEntriesRaw.map((entry, index) => normalizeSlaEntry(entry, index));

  const billingItemsRaw = ensureJsonArray(root.billingItems, "billingItems");
  const billingItems = billingItemsRaw.map((entry, index) => normalizeBillingItem(entry, index));

  const alerts = root.alerts === undefined ? undefined : ensureJsonObject(root.alerts, "alerts");
  const thresholds = normalizeThresholds(alerts?.thresholds);

  const currency =
    root.currency === undefined
      ? (billingItems[0]?.currency ?? "USD")
      : asString(root.currency, "currency");

  return {
    period,
    organization,
    slaEntries,
    billingItems,
    alerts,
    thresholds,
    currency,
  };
}

function computeServiceInsights(entries: NormalizedSlaEntry[]): ServiceInsightRow[] {
  return entries.map((entry) => {
    const availabilityGap = entry.targetAvailability - entry.actualAvailability;
    const penaltyExposure = entry.penaltyRatePerMinute * entry.downtimeMinutes;
    const notes = entry.notes.length > 0 ? entry.notes : undefined;
    return {
      serviceId: entry.serviceId,
      serviceName: entry.serviceName,
      tier: entry.tier,
      targetAvailability: entry.targetAvailability,
      actualAvailability: entry.actualAvailability,
      availabilityGap,
      downtimeMinutes: entry.downtimeMinutes,
      maintenanceMinutes: entry.maintenanceMinutes,
      incidents: entry.incidents,
      highestSeverity: entry.highestSeverity,
      penaltyExposure,
      ...(notes ? { notes } : {}),
    } satisfies ServiceInsightRow;
  });
}

function computeBillingInsights(lines: NormalizedBillingLine[]): BillingInsightRow[] {
  return lines.map(
    (line) =>
      ({
        serviceId: line.serviceId,
        usageType: line.usageType,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        currency: line.currency,
        discountsApplied: line.amortizedCost * line.discountRate,
        creditsApplied: line.credits,
        effectiveCost: line.effectiveCost,
        netCost: line.netCost,
        unitCost: line.unitCost,
        ...(line.metadata ? { metadata: line.metadata } : {}),
      }) satisfies BillingInsightRow
  );
}

function computeOverallAvailability(entries: NormalizedSlaEntry[]): number {
  const totalWeight = entries.reduce((acc, entry) => acc + entry.weight, 0) || 1;
  const weightedAvailability = entries.reduce(
    (acc, entry) => acc + entry.actualAvailability * entry.weight,
    0
  );
  return weightedAvailability / totalWeight;
}

function computeDowntime(entries: NormalizedSlaEntry[]): number {
  return entries.reduce((acc, entry) => acc + entry.downtimeMinutes, 0);
}

function computePenaltyExposure(entries: NormalizedSlaEntry[]): number {
  return entries.reduce(
    (acc, entry) => acc + entry.penaltyRatePerMinute * entry.downtimeMinutes,
    0
  );
}

function computeCost(lines: NormalizedBillingLine[]): number {
  return lines.reduce((acc, line) => acc + line.netCost, 0);
}

function computeAlerts(
  overviewAvailability: number,
  totalDowntime: number,
  totalPenaltyExposure: number,
  totalCost: number,
  serviceRows: ServiceInsightRow[],
  billingRows: BillingInsightRow[],
  thresholds: NormalizedThresholds
): AlertFinding[] {
  const findings: AlertFinding[] = [];

  if (overviewAvailability + thresholds.tolerance < thresholds.availability) {
    findings.push({
      id: "overall-availability-breach",
      severity: "critical",
      metric: "availability",
      message: `Overall availability ${overviewAvailability.toFixed(4)} is below target ${thresholds.availability.toFixed(4)}`,
      suggestedAction: "Review top offending services and initiate incident review runbook.",
    });
  }

  if (totalDowntime > thresholds.downtimeMinutes) {
    findings.push({
      id: "excess-downtime",
      severity: "high",
      metric: "downtime",
      message: `Total downtime ${totalDowntime.toFixed(1)} minutes exceeded threshold ${thresholds.downtimeMinutes} minutes`,
      suggestedAction: "Escalate to reliability engineering for root cause analysis.",
    });
  }

  if (totalPenaltyExposure > thresholds.penaltyBudget) {
    findings.push({
      id: "penalty-budget-risk",
      severity: "high",
      metric: "penaltyExposure",
      message: `Projected penalty exposure ${totalPenaltyExposure.toFixed(2)} exceeds budget ${thresholds.penaltyBudget.toFixed(2)}`,
      suggestedAction:
        "Trigger contract renegotiation workflow or initiate temporary service credits.",
    });
  }

  if (totalCost > thresholds.totalCost) {
    findings.push({
      id: "cost-budget-breach",
      severity: "moderate",
      metric: "totalCost",
      message: `Billing total ${totalCost.toFixed(2)} exceeded cost ceiling ${thresholds.totalCost.toFixed(2)}`,
      suggestedAction: "Notify finance and check usage anomalies for premium SKUs.",
    });
  }

  serviceRows.forEach((row) => {
    if (row.actualAvailability + thresholds.tolerance < row.targetAvailability) {
      findings.push({
        id: `service-availability-${row.serviceId}`,
        severity: row.tier === "critical" ? "critical" : "high",
        metric: "serviceAvailability",
        message: `${row.serviceName} availability ${row.actualAvailability.toFixed(4)} below target ${row.targetAvailability.toFixed(4)}`,
        suggestedAction: `Open post-incident review for ${row.serviceName}.`,
      });
    }
    if (row.downtimeMinutes > thresholds.downtimeMinutes) {
      findings.push({
        id: `service-downtime-${row.serviceId}`,
        severity: "moderate",
        metric: "serviceDowntime",
        message: `${row.serviceName} downtime ${row.downtimeMinutes.toFixed(1)}m exceeded limit ${thresholds.downtimeMinutes}m`,
        suggestedAction: `Schedule capacity review for ${row.serviceName}.`,
      });
    }
  });

  billingRows.forEach((row) => {
    if (row.unitCost > thresholds.unitCost) {
      findings.push({
        id: `unit-cost-${row.serviceId}-${row.usageType}`,
        severity: "moderate",
        metric: "unitCost",
        message: `${row.serviceId} ${row.usageType} unit cost ${row.unitCost.toFixed(2)} ${row.currency} exceeded threshold ${thresholds.unitCost.toFixed(2)}`,
        suggestedAction: "Analyze reserved capacity or commit discounts.",
      });
    }
  });

  return findings;
}

function buildReportTemplate(): ReportTemplateDefinition {
  return {
    name: "SLA & Billing Unified Report",
    version: "2025.10",
    sections: [
      {
        id: "summary",
        title: "Executive Summary",
        description:
          "Overall SLA compliance, financial posture, and key findings for the selected window.",
        columns: [
          { key: "overallAvailability", label: "Overall Availability", format: "percentage" },
          { key: "totalDowntimeMinutes", label: "Total Downtime (m)", format: "number" },
          { key: "totalPenaltyExposure", label: "Penalty Exposure", format: "currency" },
          { key: "totalCost", label: "Total Cost", format: "currency" },
          { key: "activeAlerts", label: "Active Alerts", format: "number" },
        ],
        dataPath: "summary",
      },
      {
        id: "service-insights",
        title: "Service SLA Insights",
        description: "Per-service compliance, downtime, and penalty projections.",
        columns: [
          { key: "serviceName", label: "Service", format: "text" },
          { key: "tier", label: "Tier", format: "text" },
          { key: "targetAvailability", label: "Target", format: "percentage" },
          { key: "actualAvailability", label: "Actual", format: "percentage" },
          { key: "availabilityGap", label: "Gap", format: "percentage" },
          { key: "downtimeMinutes", label: "Downtime (m)", format: "number" },
          { key: "penaltyExposure", label: "Penalty", format: "currency" },
        ],
        dataPath: "serviceInsights",
      },
      {
        id: "billing-insights",
        title: "Billing Detail",
        description: "Usage-based billing records aligned to SLA impact.",
        columns: [
          { key: "serviceId", label: "Service", format: "text" },
          { key: "usageType", label: "Usage Type", format: "text" },
          { key: "quantity", label: "Quantity", format: "number" },
          { key: "unitCost", label: "Unit Cost", format: "currency" },
          { key: "netCost", label: "Net Cost", format: "currency" },
        ],
        dataPath: "billingInsights",
      },
      {
        id: "alert-register",
        title: "Alert Register",
        description: "Threshold-driven alert findings and recommended follow-ups.",
        columns: [
          { key: "severity", label: "Severity", format: "text" },
          { key: "metric", label: "Metric", format: "text" },
          { key: "message", label: "Message", format: "text" },
          { key: "suggestedAction", label: "Action", format: "text" },
        ],
        dataPath: "alerts",
      },
    ],
  } satisfies ReportTemplateDefinition;
}

function buildSlaBillingAdapter(): WorkflowAdapter {
  return {
    async execute(
      definition,
      payload,
      ctx: WorkflowExecutionContext
    ): Promise<WorkflowExecutionResult> {
      const parsed = parsePayload(payload);
      const serviceInsights = computeServiceInsights(parsed.slaEntries);
      const billingInsights = computeBillingInsights(parsed.billingItems);

      const overallAvailability = computeOverallAvailability(parsed.slaEntries);
      const totalDowntime = computeDowntime(parsed.slaEntries);
      const totalPenaltyExposure = computePenaltyExposure(parsed.slaEntries);
      const totalCost = computeCost(parsed.billingItems);

      const alertFindings = computeAlerts(
        overallAvailability,
        totalDowntime,
        totalPenaltyExposure,
        totalCost,
        serviceInsights,
        billingInsights,
        parsed.thresholds
      );

      const reportTemplate = buildReportTemplate();

      const summary: JsonObject = {
        period: {
          start: parsed.period.start,
          end: parsed.period.end,
          ...(parsed.period.timezone ? { timezone: parsed.period.timezone } : {}),
        },
        organization: {
          id: parsed.organization.id,
          name: parsed.organization.name,
          ...(parsed.organization.segment ? { segment: parsed.organization.segment } : {}),
        },
        currency: parsed.currency,
        totalServices: parsed.slaEntries.length,
        overallAvailability,
        totalDowntimeMinutes: totalDowntime,
        totalPenaltyExposure,
        totalCost,
        activeAlerts: alertFindings.length,
      };

      ctx.emitAudit?.({
        workflowId: definition.id,
        runId: ctx.runId,
        type: "audit.note",
        summary: "SLA & billing aggregation complete",
        data: {
          overallAvailability,
          totalCost,
          alerts: alertFindings.length,
        },
      });

      const recommendations: string[] = [];
      if (alertFindings.length === 0) {
        recommendations.push("All metrics within thresholds. Continue monitoring cadence.");
      } else {
        recommendations.push("Review alert register and assign owners for follow-up actions.");
        const criticalFindings = alertFindings.filter((finding) => finding.severity === "critical");
        if (criticalFindings.length > 0) {
          recommendations.push(
            `${criticalFindings.length} critical findings detected. Initiate incident command within 30 minutes.`
          );
        }
      }
      if (totalPenaltyExposure > 0) {
        recommendations.push(
          "Model projected rebate impact and include in next customer operations review."
        );
      }

      return {
        output: {
          summary,
          serviceInsights: serviceInsights.map((row) => ({ ...row })),
          billingInsights: billingInsights.map((row) => ({ ...row })),
          alerts: alertFindings.map((finding) => ({ ...finding })),
          recommendations,
          reportTemplate,
        },
        logs: [
          `Processed ${parsed.slaEntries.length} SLA entries with overall availability ${(overallAvailability * 100).toFixed(3)}%`,
          `Computed billing total ${totalCost.toFixed(2)} ${parsed.currency}`,
          `Generated ${alertFindings.length} alert findings`,
        ],
        diagnostics: {
          thresholds: {
            availability: parsed.thresholds.availability,
            downtimeMinutes: parsed.thresholds.downtimeMinutes,
            penaltyBudget: parsed.thresholds.penaltyBudget,
            totalCost: parsed.thresholds.totalCost,
            unitCost: parsed.thresholds.unitCost,
            tolerance: parsed.thresholds.tolerance,
          },
          notificationChannels: parsed.alerts?.notificationChannels ?? [],
          runbookUrl: parsed.alerts?.runbookUrl ?? null,
        },
      } satisfies WorkflowExecutionResult;
    },

    async simulate(
      definition,
      payload,
      ctx: WorkflowExecutionContext
    ): Promise<WorkflowSimulationResult> {
      const parsed = parsePayload(payload);
      const steps = [
        {
          id: "ingest",
          name: "Ingest raw metrics",
          description: "Load SLA and billing records for selected window",
          expectedDurationMs: 350,
          risk: "low" as const,
        },
        {
          id: "normalize",
          name: "Normalize series",
          description: "Standardize units and align services",
          expectedDurationMs: 420,
          risk: "medium" as const,
        },
        {
          id: "compute",
          name: "Compute KPIs",
          description: "Calculate availability, downtime, and cost KPIs",
          expectedDurationMs: 510,
          risk: "medium" as const,
        },
        {
          id: "alerting",
          name: "Evaluate thresholds",
          description: "Apply alert rules to aggregated metrics",
          expectedDurationMs: 380,
          risk: "medium" as const,
        },
        {
          id: "publish",
          name: "Publish report",
          description: "Prepare report template sections and alert register",
          expectedDurationMs: 290,
          risk: "low" as const,
        },
      ];
      const totalDuration = steps.reduce((acc, step) => acc + (step.expectedDurationMs ?? 0), 0);

      ctx.emitAudit?.({
        workflowId: definition.id,
        runId: ctx.runId,
        type: "audit.note",
        summary: "SLA & billing simulation",
        data: {
          services: parsed.slaEntries.length,
          billingItems: parsed.billingItems.length,
          simulatedDurationMs: totalDuration,
        },
      });

      return {
        steps,
        logs: steps.map((step) => step.description ?? step.name),
        output: {
          status: "simulated",
          estimatedDurationMs: totalDuration,
          services: parsed.slaEntries.length,
          billingItems: parsed.billingItems.length,
        },
      } satisfies WorkflowSimulationResult;
    },
  } satisfies WorkflowAdapter;
}

const enterpriseScenarioPayload: JsonValue = {
  period: {
    start: "2025-09-01T00:00:00Z",
    end: "2025-09-30T23:59:59Z",
    timezone: "UTC",
  },
  organization: {
    id: "acct-enterprise-42",
    name: "Aurora Retail Cloud",
    segment: "enterprise",
  },
  slaEntries: [
    {
      serviceId: "svc-orchestrator",
      serviceName: "Workflow Orchestrator",
      tier: "critical",
      targetAvailability: 0.999,
      actualAvailability: 0.9962,
      downtimeMinutes: 160,
      incidents: 4,
      highestSeverity: "sev1",
      maintenanceMinutes: 45,
      penaltyRatePerMinute: 120,
      weight: 2.5,
      notes: ["Two overlapping regional outages", "Failover rehearsal incomplete"],
    },
    {
      serviceId: "svc-analytics",
      serviceName: "Analytics API",
      tier: "standard",
      targetAvailability: 0.995,
      actualAvailability: 0.9974,
      downtimeMinutes: 40,
      incidents: 2,
      highestSeverity: "sev2",
      maintenanceMinutes: 20,
      penaltyRatePerMinute: 45,
      weight: 1.2,
    },
    {
      serviceId: "svc-reports",
      serviceName: "Scheduled Reports",
      tier: "experimental",
      targetAvailability: 0.98,
      actualAvailability: 0.989,
      downtimeMinutes: 55,
      incidents: 3,
      highestSeverity: "sev3",
      maintenanceMinutes: 15,
      penaltyRatePerMinute: 10,
      weight: 0.7,
    },
  ],
  billingItems: [
    {
      serviceId: "svc-orchestrator",
      usageType: "compute-hours",
      quantity: 4200,
      unitPrice: 0.45,
      currency: "USD",
      discountRate: 0.12,
      credits: 3200,
      metadata: {
        sku: "orch-cpu-premium",
        region: "us-central",
      },
    },
    {
      serviceId: "svc-analytics",
      usageType: "requests-million",
      quantity: 380,
      unitPrice: 12.5,
      currency: "USD",
      discountRate: 0.08,
      credits: 0,
      metadata: {
        sku: "analytics-tier1",
        region: "us-east",
      },
    },
    {
      serviceId: "svc-reports",
      usageType: "scheduler-hours",
      quantity: 980,
      unitPrice: 1.1,
      currency: "USD",
      credits: 180,
      discountRate: 0.05,
      metadata: {
        sku: "reports-flex",
      },
    },
  ],
  alerts: {
    thresholds: {
      availability: 0.997,
      downtimeMinutes: 120,
      totalCost: 95_000,
      penaltyBudget: 60_000,
      unitCost: 15,
      tolerance: 0.0003,
    },
    notificationChannels: ["ops:oncall", "finance:cost-control"],
    runbookUrl: "https://runbooks.aurora.cloud/sla-billing",
  },
  currency: "USD",
};

const midMarketScenarioPayload: JsonValue = {
  period: {
    start: "2025-09-01T00:00:00Z",
    end: "2025-09-30T23:59:59Z",
    timezone: "UTC",
  },
  organization: {
    id: "acct-mm-108",
    name: "Nimbus Productivity",
    segment: "mid-market",
  },
  slaEntries: [
    {
      serviceId: "svc-collab",
      serviceName: "Collaboration Hub",
      tier: "critical",
      targetAvailability: 0.997,
      actualAvailability: 0.9986,
      downtimeMinutes: 60,
      incidents: 1,
      highestSeverity: "sev2",
      maintenanceMinutes: 35,
      penaltyRatePerMinute: 45,
      weight: 1.8,
    },
    {
      serviceId: "svc-automation",
      serviceName: "Automation Runner",
      tier: "standard",
      targetAvailability: 0.992,
      actualAvailability: 0.9912,
      downtimeMinutes: 95,
      incidents: 3,
      highestSeverity: "sev3",
      maintenanceMinutes: 25,
      penaltyRatePerMinute: 30,
      weight: 1.1,
    },
  ],
  billingItems: [
    {
      serviceId: "svc-collab",
      usageType: "active-users",
      quantity: 85_000,
      unitPrice: 0.12,
      currency: "USD",
      discountRate: 0.05,
      credits: 800,
    },
    {
      serviceId: "svc-automation",
      usageType: "workflow-runs",
      quantity: 14_500,
      unitPrice: 0.65,
      currency: "USD",
      discountRate: 0.04,
      credits: 0,
    },
  ],
  alerts: {
    thresholds: {
      availability: 0.996,
      downtimeMinutes: 90,
      totalCost: 45_000,
      penaltyBudget: 25_000,
      unitCost: 12,
    },
    notificationChannels: ["ops:oncall"],
    runbookUrl: "https://runbooks.nimbus.cloud/sla-billing",
  },
  currency: "USD",
};

const scenarios: TemplateScenario[] = [
  {
    key: "enterprise-window",
    description: "Enterprise reporting combining premium SLA penalties with detailed billing",
    payload: enterpriseScenarioPayload,
    triggerOptions: {
      metadata: {
        period: "2025-09",
        audience: "executive",
      },
      actor: "fpna-bot",
    },
  },
  {
    key: "mid-market-monthly",
    description: "Mid-market monthly operations review with cost guardrails",
    payload: midMarketScenarioPayload,
    triggerOptions: {
      dryRun: true,
      metadata: {
        period: "2025-09",
        audience: "sre+finops",
      },
      actor: "finops-analyst",
    },
  },
];

export const slaBillingTemplate: WorkflowTemplate = {
  id: "sla-billing.unified-report",
  label: "SLA & Billing 统一报表",
  category: "Operational Analytics",
  definition: {
    id: "sla-billing.unified-report",
    name: "SLA & Billing Unified Report",
    version: "2025.10",
    description:
      "Aggregates SLA compliance and billing data into a unified executive report with alerting.",
    metadata: {
      owner: "finops",
      industry: "platform",
      reportType: "sla-billing",
    },
    adapterKey: "adapter.sla-billing",
    contract: {
      type: "object",
      required: ["period", "organization", "slaEntries", "billingItems"],
      properties: {
        period: {
          type: "object",
          required: ["start", "end"],
          properties: {
            start: { type: "string" },
            end: { type: "string" },
            timezone: { type: "string" },
          },
        },
        organization: {
          type: "object",
          required: ["id", "name"],
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            segment: { type: "string" },
          },
        },
        slaEntries: {
          type: "array",
          items: {
            type: "object",
            required: [
              "serviceId",
              "serviceName",
              "tier",
              "targetAvailability",
              "actualAvailability",
              "incidents",
              "highestSeverity",
            ],
            properties: {
              serviceId: { type: "string" },
              serviceName: { type: "string" },
              tier: { type: "string" },
              targetAvailability: { type: "number" },
              actualAvailability: { type: "number" },
              downtimeMinutes: { type: "number" },
              incidents: { type: "number" },
              highestSeverity: { type: "string" },
              maintenanceMinutes: { type: "number" },
              penaltyRatePerMinute: { type: "number" },
              weight: { type: "number" },
              notes: { type: "array", items: { type: "string" } },
            },
          },
        },
        billingItems: {
          type: "array",
          items: {
            type: "object",
            required: ["serviceId", "usageType", "quantity", "unitPrice", "currency"],
            properties: {
              serviceId: { type: "string" },
              usageType: { type: "string" },
              quantity: { type: "number" },
              unitPrice: { type: "number" },
              currency: { type: "string" },
              credits: { type: "number" },
              discountRate: { type: "number" },
              amortizedCost: { type: "number" },
              metadata: { type: "object" },
            },
          },
        },
        alerts: {
          type: "object",
          properties: {
            thresholds: { type: "object" },
            notificationChannels: { type: "array", items: { type: "string" } },
            runbookUrl: { type: "string" },
          },
        },
        currency: { type: "string" },
      },
    },
    retryPolicy: {
      maxAttempts: 2,
      backoffMs: 60_000,
    },
  },
  createAdapter: () => buildSlaBillingAdapter(),
  scenarios,
  description:
    "Generates a unified SLA & billing report with actionable alerts and recommendations for FinOps and SRE teams.",
  successMetrics: [
    "< 1% deviation between reported and ledger costs",
    "Critical SLA breaches triaged within 30 minutes",
    "95% accuracy on penalty exposure forecasting",
  ],
  risks: [
    "Inconsistent currency conversion across billing sources",
    "Missing maintenance windows skewing availability gaps",
    "Thresholds misaligned with contractual terms",
  ],
  tags: ["sla", "billing", "finops", "reporting"],
};

export function createSlaBillingAdapter(): WorkflowAdapter {
  return buildSlaBillingAdapter();
}
