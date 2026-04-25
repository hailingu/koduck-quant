import type { EntityResult } from "./engine-types";

export interface FlowEngineWorkerTaskSuccessEvent {
  entityId: string;
  entityType: string;
  durationMs: number;
}

export interface FlowEngineWorkerTaskFallbackEvent {
  entityId: string;
  entityType: string;
  workerDurationMs: number;
  fallbackDurationMs: number;
  reason: unknown;
}

export interface FlowEngineWorkerObserver {
  onWorkerTaskSuccess(event: FlowEngineWorkerTaskSuccessEvent): void;
  onWorkerTaskFallback?(event: FlowEngineWorkerTaskFallbackEvent): void;
}

export type SerializedError = {
  name?: string | undefined;
  message: string;
  stack?: string | undefined;
};

export interface FlowEngineWorkerTaskPayload {
  engineId: string;
  flowId: string;
  entityId: string;
  entityType: string;
  sharedStateId: string;
}

export interface FlowEngineWorkerTaskResult {
  status: EntityResult["status"];
  output?: unknown;
  error?: SerializedError | undefined;
}
