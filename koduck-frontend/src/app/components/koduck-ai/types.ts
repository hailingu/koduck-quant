export type MessageType = "text" | "card";

export interface Message {
  id: string;
  memoryEntryId?: string;
  sequenceNum?: number;
  requestId?: string;
  traceId?: string;
  quote?: {
    messageId?: string;
    memoryEntryId?: string;
    role: "user" | "assistant";
    content: string;
  };
  role: "user" | "assistant";
  content: string;
  type: MessageType;
  timestamp: number;
  streaming?: boolean;
  cardData?: {
    title: string;
    description: string;
    value?: string;
    change?: string;
  };
}

export interface UploadedFile {
  id: string;
  name: string;
  type: string;
  preview?: string;
}

export interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
  memoryEntryId?: string;
}

export interface PendingChatStream {
  sessionId: string;
  assistantMessageId: string;
  userMessage: Message;
  assistantMessage: Message;
  prompt: string;
  provider: string;
  model: string;
  history: ChatHistoryMessage[];
  metadata: Record<string, unknown>;
  lastSequenceNum: number;
  streamedText: string;
  updatedAt: number;
}

export type LlmProvider = string;

export interface LlmModelOption {
  value: string;
  label: string;
}

export interface LlmProviderOption {
  value: LlmProvider;
  label: string;
}

export interface LlmOptionsConfig {
  defaultProvider: LlmProvider;
  providerOptions: LlmProviderOption[];
  modelOptionsByProvider: Record<LlmProvider, LlmModelOption[]>;
}

export interface RuntimeLlmProviderConfig {
  value?: unknown;
  label?: unknown;
  defaultModel?: unknown;
  models?: unknown;
}

export interface RuntimeConfig {
  llm?: {
    defaultProvider?: unknown;
    providers?: unknown;
  };
}

export interface StreamEventPayload {
  text?: string;
  finish_reason?: string;
  code?: string;
  message?: string;
  retryable?: boolean;
  degraded?: boolean;
  retry_after_ms?: number;
}

export interface StreamEventData {
  event_id?: string;
  sequence_num?: number;
  event_type?: string;
  payload?: StreamEventPayload & Record<string, unknown>;
  request_id?: string;
  session_id?: string;
}

export type PlanNodeStatus = "pending" | "running" | "waiting_approval" | "completed" | "failed" | "skipped";

export interface ApiErrorBody {
  code?: string;
  message?: string;
  request_id?: string;
  retryable?: boolean;
  degraded?: boolean;
  upstream?: string;
}

export interface ApiErrorEnvelope {
  success?: boolean;
  code?: string;
  message?: string;
  error?: ApiErrorBody;
}

export interface SessionLookupData {
  exists?: boolean;
  title?: string;
}

export interface SessionLookupEnvelope {
  success?: boolean;
  data?: SessionLookupData;
}

export interface SessionTranscriptEntry {
  entry_id?: string;
  role?: "user" | "assistant";
  content?: string;
  timestamp?: number;
  sequence_num?: number;
  metadata?: Record<string, string>;
}

export interface SessionTranscriptData {
  session_id?: string;
  entries?: SessionTranscriptEntry[];
}

export interface SessionTranscriptEnvelope {
  success?: boolean;
  data?: SessionTranscriptData;
}

export interface ConversationFlowStep {
  id: string;
  name: string;
  input: string[];
  output?: string;
  status: PlanNodeStatus;
  editable: boolean;
  dependsOn: string[];
}

export interface ConversationFlowSpec {
  title: string;
  version?: string;
  steps: ConversationFlowStep[];
}
