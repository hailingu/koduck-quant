import {
  type JsonValue,
  type WorkflowAdapter,
  type WorkflowExecutionContext,
  type WorkflowExecutionResult,
  type WorkflowSimulationResult,
} from "../src/business/workflow/types";
import { type TemplateScenario, type WorkflowTemplate } from "./types";

type JsonObject = Record<string, JsonValue>;

type PaymentStatus = "authorized" | "pending" | "failed";

type ServiceLevel = "standard" | "express";

type RiskLevel = "low" | "medium" | "high";

const PAYMENT_STATUSES: readonly PaymentStatus[] = ["authorized", "pending", "failed"] as const;
const SERVICE_LEVELS: readonly ServiceLevel[] = ["standard", "express"] as const;

interface OrderItemPayload {
  readonly sku: string;
  readonly name: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly availableInventory?: number;
}

interface PaymentPayload {
  readonly status: PaymentStatus;
  readonly method: string;
  readonly riskScore: number;
  readonly authorizedAmount: number;
  readonly currency: string;
}

interface ShippingPayload {
  readonly serviceLevel: ServiceLevel;
  readonly warehouse: string;
  readonly promisedDate: string;
}

interface CustomerPayload {
  readonly id: string;
  readonly loyaltyTier: string;
  readonly lifetimeValue: number;
}

interface OrderProcessingPayload {
  readonly orderId: string;
  readonly channel: string;
  readonly items: OrderItemPayload[];
  readonly payment: PaymentPayload;
  readonly shipping: ShippingPayload;
  readonly customer: CustomerPayload;
  readonly expedite: boolean;
  readonly manualReview: boolean;
  readonly notes: string[];
}

interface SimulationStep {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly expectedDurationMs: number;
  readonly risk: RiskLevel;
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function ensureJsonObject(value: JsonValue | undefined, context: string): JsonObject {
  if (!isJsonObject(value ?? null)) {
    throw new Error(`${context} must be an object`);
  }
  return value as JsonObject;
}

function ensureJsonArray(value: JsonValue | undefined, context: string): JsonValue[] {
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

function asNumber(value: JsonValue | undefined, context: string): number {
  if (typeof value === "number") {
    return value;
  }
  throw new Error(`${context} must be a number`);
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

function asEnum<T extends string>(
  value: JsonValue | undefined,
  context: string,
  allowed: readonly T[]
): T {
  const str = asString(value, context) as T;
  if (!allowed.includes(str)) {
    throw new Error(`${context} must be one of ${allowed.join(", ")}`);
  }
  return str;
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

function parseOrderItems(value: JsonValue | undefined): OrderItemPayload[] {
  const array = ensureJsonArray(value, "items");
  const items: OrderItemPayload[] = [];
  for (let index = 0; index < array.length; index += 1) {
    const entry = array[index];
    const obj = ensureJsonObject(entry, `items[${index}]`);
    const sku = asString(obj.sku, `items[${index}].sku`);
    const name = asString(obj.name, `items[${index}].name`);
    const quantity = asNumber(obj.quantity, `items[${index}].quantity`);
    const unitPrice = asNumber(obj.unitPrice, `items[${index}].unitPrice`);
    const availableInventory =
      obj.availableInventory === undefined
        ? undefined
        : asNumber(obj.availableInventory, `items[${index}].availableInventory`);
    const item: OrderItemPayload = {
      sku,
      name,
      quantity,
      unitPrice,
      ...(availableInventory !== undefined ? { availableInventory } : {}),
    };
    items.push(item);
  }
  return items;
}

function parsePayment(value: JsonValue | undefined): PaymentPayload {
  const obj = ensureJsonObject(value, "payment");
  const status = asEnum(obj.status, "payment.status", PAYMENT_STATUSES);
  const method = asString(obj.method, "payment.method");
  const riskScore = asNumber(obj.riskScore, "payment.riskScore");
  const authorizedAmount = asNumber(obj.authorizedAmount, "payment.authorizedAmount");
  const currency = asString(obj.currency, "payment.currency");
  return { status, method, riskScore, authorizedAmount, currency };
}

function parseShipping(value: JsonValue | undefined): ShippingPayload {
  const obj = ensureJsonObject(value, "shipping");
  const serviceLevel = asEnum(obj.serviceLevel, "shipping.serviceLevel", SERVICE_LEVELS);
  const warehouse = asString(obj.warehouse, "shipping.warehouse");
  const promisedDate = asString(obj.promisedDate, "shipping.promisedDate");
  return { serviceLevel, warehouse, promisedDate };
}

function parseCustomer(value: JsonValue | undefined): CustomerPayload {
  const obj = ensureJsonObject(value, "customer");
  const id = asString(obj.id, "customer.id");
  const loyaltyTier = asString(obj.loyaltyTier, "customer.loyaltyTier");
  const lifetimeValue = asNumber(obj.lifetimeValue, "customer.lifetimeValue");
  return { id, loyaltyTier, lifetimeValue };
}

function parseOrderPayload(payload: JsonValue): OrderProcessingPayload {
  const obj = ensureJsonObject(payload, "Order payload");
  const orderId = asString(obj.orderId, "orderId");
  const channel = asString(obj.channel, "channel");
  const items = parseOrderItems(obj.items);
  const payment = parsePayment(obj.payment);
  const shipping = parseShipping(obj.shipping);
  const customer = parseCustomer(obj.customer);
  const expedite = asBoolean(
    obj.expedite,
    "expedite",
    payment.status === "authorized" && shipping.serviceLevel === "express"
  );
  const manualReview = asBoolean(
    obj.manualReview,
    "manualReview",
    payment.status !== "authorized" || payment.riskScore > 70
  );
  const notes = parseStringArray(obj.notes, "notes");
  return {
    orderId,
    channel,
    items,
    payment,
    shipping,
    customer,
    expedite,
    manualReview,
    notes,
  };
}

function serializePayment(payment: PaymentPayload): JsonObject {
  return {
    status: payment.status,
    method: payment.method,
    riskScore: payment.riskScore,
    authorizedAmount: payment.authorizedAmount,
    currency: payment.currency,
  };
}

function serializeCustomer(customer: CustomerPayload): JsonObject {
  return {
    id: customer.id,
    loyaltyTier: customer.loyaltyTier,
    lifetimeValue: customer.lifetimeValue,
  };
}

function serializeShipping(shipping: ShippingPayload): JsonObject {
  return {
    serviceLevel: shipping.serviceLevel,
    warehouse: shipping.warehouse,
    promisedDate: shipping.promisedDate,
  };
}

function buildSimulationSteps(payload: OrderProcessingPayload): SimulationStep[] {
  return [
    {
      id: "payment-check",
      name: "Payment Verification",
      description: `Verify ${payload.payment.method} authorization (${payload.payment.status})`,
      expectedDurationMs: 450,
      risk: payload.payment.status === "authorized" ? "low" : "medium",
    },
    {
      id: "fraud-scan",
      name: "Fraud Risk Scoring",
      description: `Risk score ${payload.payment.riskScore}`,
      expectedDurationMs: 600,
      risk: payload.payment.riskScore > 70 ? "high" : "medium",
    },
    {
      id: "inventory-allocate",
      name: "Inventory Allocation",
      description: `Allocate ${payload.items.length} SKUs from ${payload.shipping.warehouse}`,
      expectedDurationMs: 900,
      risk: payload.items.length > 5 ? "medium" : "low",
    },
    {
      id: "packing-plan",
      name: "Packing Plan",
      description: `Plan packing for ${payload.expedite ? "expedited" : "standard"} fulfillment`,
      expectedDurationMs: 500,
      risk: payload.expedite ? "medium" : "low",
    },
    {
      id: "customer-update",
      name: "Customer Notification",
      description: `Notify customer ${payload.customer.id} via preferred channel`,
      expectedDurationMs: 300,
      risk: "low",
    },
  ];
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

function evaluateInventory(items: OrderItemPayload[]): JsonObject {
  const report: JsonObject = {};
  for (const item of items) {
    const shortfall =
      item.availableInventory === undefined
        ? 0
        : Math.max(0, item.quantity - item.availableInventory);
    report[item.sku] = {
      name: item.name,
      requested: item.quantity,
      available: item.availableInventory ?? null,
      shortfall,
    };
  }
  return report;
}

function computeTotals(items: OrderItemPayload[]): { revenue: number; units: number } {
  let revenue = 0;
  let units = 0;
  for (const item of items) {
    revenue += item.unitPrice * item.quantity;
    units += item.quantity;
  }
  return { revenue, units };
}

function buildOrderProcessingAdapter(): WorkflowAdapter {
  return {
    async execute(definition, payload, ctx): Promise<WorkflowExecutionResult> {
      const parsed = parseOrderPayload(payload);
      const logs: string[] = [];
      const now = new Date().toISOString();

      logs.push(
        `[${now}] Processing order ${parsed.orderId} (${parsed.channel}) with ${parsed.items.length} items`
      );

      const { revenue, units } = computeTotals(parsed.items);
      logs.push(
        `Basket summary: ${units} units worth ${parsed.payment.currency} ${revenue.toFixed(2)}`
      );

      const paymentData: JsonObject = serializePayment(parsed.payment);
      emitNote(definition.id, ctx, "Payment evaluated", paymentData);

      if (parsed.payment.status !== "authorized") {
        logs.push(`Payment status ${parsed.payment.status}; routing to manual review`);
      } else {
        logs.push("Payment authorized successfully");
      }

      if (parsed.payment.riskScore > 70) {
        logs.push(`High fraud risk score ${parsed.payment.riskScore}`);
      }

      const inventory = evaluateInventory(parsed.items);
      const shortfalls = Object.values(inventory).some(
        (entry) => isJsonObject(entry) && typeof entry.shortfall === "number" && entry.shortfall > 0
      );

      emitNote(definition.id, ctx, "Inventory assessed", inventory);

      if (parsed.expedite) {
        logs.push("Expedite flag enabled; prioritising express packing");
      }

      const shippingData: JsonObject = serializeShipping(parsed.shipping);
      emitNote(definition.id, ctx, "Shipping plan drafted", shippingData);

      const status =
        parsed.manualReview || parsed.payment.status !== "authorized" || shortfalls
          ? "awaiting-review"
          : "ready-to-ship";

      const result: WorkflowExecutionResult = {
        output: {
          status,
          orderId: parsed.orderId,
          revenue,
          currency: parsed.payment.currency,
          units,
          expedite: parsed.expedite,
          manualReview:
            parsed.manualReview ||
            parsed.payment.status !== "authorized" ||
            parsed.payment.riskScore > 70,
          shortfalls,
          promisedDate: parsed.shipping.promisedDate,
        },
        logs,
        diagnostics: {
          payment: paymentData,
          customer: serializeCustomer(parsed.customer),
          shipping: shippingData,
          inventory,
          notes: parsed.notes,
        },
      };

      emitNote(definition.id, ctx, "Order orchestration completed", result.output);

      return result;
    },

    async simulate(definition, payload, ctx): Promise<WorkflowSimulationResult> {
      const parsed = parseOrderPayload(payload);
      const steps = buildSimulationSteps(parsed);
      const logs = steps.map((step) => step.description);
      const totalDuration = steps.reduce((acc, step) => acc + step.expectedDurationMs, 0);

      const simulationData: JsonObject = {
        steps: steps.length,
        estimatedDurationMs: totalDuration,
        riskProfile: steps.map((step) => ({ id: step.id, risk: step.risk })),
      };

      emitNote(definition.id, ctx, "Simulation blueprint created", simulationData);

      return {
        logs,
        steps,
        output: {
          status: "simulated",
          estimatedDurationMs: totalDuration,
          paymentStatus: parsed.payment.status,
          expedite: parsed.expedite,
          manualReview: parsed.manualReview,
        },
      };
    },
  };
}

const standardOrderPayload: JsonValue = {
  orderId: "ORD-100045",
  channel: "web",
  items: [
    {
      sku: "SKU-001",
      name: "Smart Speaker",
      quantity: 2,
      unitPrice: 149.99,
      availableInventory: 12,
    },
    {
      sku: "SKU-117",
      name: "Smart Plug",
      quantity: 3,
      unitPrice: 24.5,
      availableInventory: 40,
    },
  ],
  payment: {
    status: "authorized",
    method: "credit-card",
    riskScore: 18,
    authorizedAmount: 373.48,
    currency: "USD",
  },
  shipping: {
    serviceLevel: "standard",
    warehouse: "WH-NJ-01",
    promisedDate: "2025-10-07",
  },
  customer: {
    id: "CUST-567",
    loyaltyTier: "gold",
    lifetimeValue: 12890,
  },
  expedite: false,
  manualReview: false,
  notes: ["Gift wrap first item", "Send SMS confirmation"],
};

const paymentRetryPayload: JsonValue = {
  orderId: "ORD-100052",
  channel: "mobile",
  items: [
    {
      sku: "SKU-291",
      name: "Wireless Router",
      quantity: 1,
      unitPrice: 229.0,
      availableInventory: 0,
    },
    {
      sku: "SKU-440",
      name: "Mesh Extender",
      quantity: 2,
      unitPrice: 99.0,
      availableInventory: 1,
    },
  ],
  payment: {
    status: "pending",
    method: "digital-wallet",
    riskScore: 82,
    authorizedAmount: 427.0,
    currency: "USD",
  },
  shipping: {
    serviceLevel: "express",
    warehouse: "WH-CA-02",
    promisedDate: "2025-10-05",
  },
  customer: {
    id: "CUST-902",
    loyaltyTier: "silver",
    lifetimeValue: 3490,
  },
  expedite: true,
  manualReview: true,
  notes: ["Customer requested manual verification", "High-risk digital wallet"],
};

const orderScenarios: TemplateScenario[] = [
  {
    key: "standard-fulfillment",
    description: "Processes an authorized web order with healthy inventory levels",
    payload: standardOrderPayload,
    triggerOptions: {
      metadata: {
        campaign: "Fall-Sale",
        channel: "web",
      },
      actor: "order-bot",
    },
  },
  {
    key: "manual-review",
    description:
      "Simulates a payment pending order requiring manual intervention and express shipping",
    payload: paymentRetryPayload,
    triggerOptions: {
      metadata: {
        campaign: "Flash-Deal",
        channel: "mobile",
      },
      actor: "risk-analyst",
      dryRun: true,
    },
  },
];

export const orderProcessingTemplate: WorkflowTemplate = {
  id: "order-processing.orchestration",
  label: "电商订单处理编排",
  category: "Order Processing",
  definition: {
    id: "order-processing.orchestration",
    name: "Order Processing Orchestration",
    version: "2025.10",
    description:
      "Coordinates payment, fraud, inventory, and shipping steps for digital commerce orders",
    metadata: {
      industry: "retail",
      domain: "order-management",
      owner: "commerce-ops",
    },
    adapterKey: "adapter.order-processing",
    contract: {
      type: "object",
      required: ["orderId", "items", "payment", "shipping", "customer"],
      properties: {
        orderId: { type: "string" },
        channel: { type: "string" },
        items: {
          type: "array",
          items: {
            type: "object",
            required: ["sku", "name", "quantity", "unitPrice"],
            properties: {
              sku: { type: "string" },
              name: { type: "string" },
              quantity: { type: "number" },
              unitPrice: { type: "number" },
              availableInventory: { type: "number" },
            },
          },
        },
        payment: {
          type: "object",
          required: ["status", "method", "riskScore", "authorizedAmount", "currency"],
          properties: {
            status: { type: "string" },
            method: { type: "string" },
            riskScore: { type: "number" },
            authorizedAmount: { type: "number" },
            currency: { type: "string" },
          },
        },
        shipping: {
          type: "object",
          required: ["serviceLevel", "warehouse", "promisedDate"],
          properties: {
            serviceLevel: { type: "string" },
            warehouse: { type: "string" },
            promisedDate: { type: "string" },
          },
        },
        customer: {
          type: "object",
          required: ["id", "loyaltyTier", "lifetimeValue"],
          properties: {
            id: { type: "string" },
            loyaltyTier: { type: "string" },
            lifetimeValue: { type: "number" },
          },
        },
        expedite: { type: "boolean" },
        manualReview: { type: "boolean" },
        notes: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
    retryPolicy: {
      maxAttempts: 2,
      backoffMs: 15_000,
    },
  },
  createAdapter: () => buildOrderProcessingAdapter(),
  scenarios: orderScenarios,
  description:
    "Battle-tested retail order template covering payment, fraud detection, inventory allocation, and shipping orchestration with manual review escalation.",
  successMetrics: [
    "< 2 minutes to confirm 95% of orders",
    "Inventory shortfall rate below 3%",
    "Manual review queue SLA under 10 minutes",
  ],
  risks: [
    "Payment network outages delaying authorization",
    "Inventory misalignment causing partial shipments",
    "Express shipping capacity constraints",
  ],
  tags: ["commerce", "order", "fulfillment", "retail"],
};

export function createOrderProcessingAdapter(): WorkflowAdapter {
  return buildOrderProcessingAdapter();
}
