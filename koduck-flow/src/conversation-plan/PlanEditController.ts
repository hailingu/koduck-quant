import type {
  PlanEditEventRequest,
  PlanEditEventResponse,
  PlanEventType,
} from "./types";

export interface PlanEditControllerOptions {
  readonly baseUrl?: string;
  readonly sessionId: string;
  readonly planId: string;
  readonly fetch?: typeof fetch;
  readonly headers?: HeadersInit;
}

export class PlanEditController {
  private readonly baseUrl: string;
  private readonly sessionId: string;
  private readonly planId: string;
  private readonly fetchImpl: typeof fetch;
  private readonly headers: HeadersInit | undefined;

  constructor(options: PlanEditControllerOptions) {
    this.baseUrl = options.baseUrl ?? "";
    this.sessionId = options.sessionId;
    this.planId = options.planId;
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.headers = options.headers;
  }

  async appendEvent(request: PlanEditEventRequest): Promise<PlanEditEventResponse> {
    const response = await this.fetchImpl(this.eventUrl(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...this.headers,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Plan edit event failed with status ${response.status}`);
    }

    return (await response.json()) as PlanEditEventResponse;
  }

  updateNode(
    nodeId: string,
    patch: Record<string, unknown>,
    idempotencyKey?: string
  ): Promise<PlanEditEventResponse> {
    return this.appendPlanEvent(
      "plan.node.updated",
      {
        nodeId,
        ...patch,
      },
      idempotencyKey
    );
  }

  retryNode(nodeId: string, idempotencyKey?: string): Promise<PlanEditEventResponse> {
    return this.appendPlanEvent("plan.node.started", { nodeId, action: "retry" }, idempotencyKey);
  }

  skipNode(nodeId: string, reason?: string, idempotencyKey?: string): Promise<PlanEditEventResponse> {
    return this.appendPlanEvent(
      "plan.node.skipped",
      {
        nodeId,
        ...(reason ? { reason } : {}),
      },
      idempotencyKey
    );
  }

  pausePlan(idempotencyKey?: string): Promise<PlanEditEventResponse> {
    return this.appendPlanEvent("plan.paused", {}, idempotencyKey);
  }

  resumePlan(idempotencyKey?: string): Promise<PlanEditEventResponse> {
    return this.appendPlanEvent("plan.resumed", {}, idempotencyKey);
  }

  cancelPlan(reason?: string, idempotencyKey?: string): Promise<PlanEditEventResponse> {
    return this.appendPlanEvent(
      "plan.cancelled",
      {
        ...(reason ? { reason } : {}),
      },
      idempotencyKey
    );
  }

  approveProposal(proposalId: string, idempotencyKey?: string): Promise<PlanEditEventResponse> {
    return this.appendPlanEvent("proposal.approved", { proposalId }, idempotencyKey);
  }

  rejectProposal(
    proposalId: string,
    reason?: string,
    idempotencyKey?: string
  ): Promise<PlanEditEventResponse> {
    return this.appendPlanEvent(
      "proposal.rejected",
      {
        proposalId,
        ...(reason ? { reason } : {}),
      },
      idempotencyKey
    );
  }

  editAndApproveProposal(
    proposalId: string,
    afterJson: unknown,
    idempotencyKey?: string
  ): Promise<PlanEditEventResponse> {
    return this.appendPlanEvent(
      "proposal.edit_and_approve",
      {
        proposalId,
        afterJson,
      },
      idempotencyKey
    );
  }

  private appendPlanEvent(
    eventType: PlanEventType,
    payload: Record<string, unknown>,
    idempotencyKey?: string
  ): Promise<PlanEditEventResponse> {
    return this.appendEvent({
      event_type: eventType,
      payload,
      ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
    });
  }

  private eventUrl(): string {
    const path = `/api/v1/ai/sessions/${encodeURIComponent(
      this.sessionId
    )}/plans/${encodeURIComponent(this.planId)}/events`;
    return this.baseUrl ? `${this.baseUrl.replace(/\/$/, "")}${path}` : path;
  }
}
