import type { Message } from "./types";

export const MAX_HISTORY_MESSAGES = 5;
const MAX_PROMPT_HISTORY_ENTRIES = 100;
const ACTIVE_SESSION_STORAGE_KEY = "koduck.ai.activeSessionId";
const SESSION_MESSAGES_STORAGE_PREFIX = "koduck.ai.sessionMessages";
const PROMPT_HISTORY_STORAGE_KEY = "koduck.ai.promptHistory";
const CONVERSATION_FLOW_STATE_STORAGE_PREFIX = "koduck.ai.conversationFlowState.v1";
const URL_SESSION_PARAM = "session_id";

function buildSessionMessagesStorageKey(sessionId: string): string {
  return `${SESSION_MESSAGES_STORAGE_PREFIX}.${sessionId}`;
}

function hashStorageKeyPart(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function buildConversationFlowStateStorageKey(
  sessionId: string | null,
  messageId: string | null,
  sourceSpecSignature: string,
): string {
  const sessionPart = sessionId?.trim() || "local";
  const messagePart = messageId?.trim() || "message";
  return [
    CONVERSATION_FLOW_STATE_STORAGE_PREFIX,
    encodeURIComponent(sessionPart),
    encodeURIComponent(messagePart),
    hashStorageKeyPart(sourceSpecSignature),
  ].join(".");
}

export function readActiveSessionId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY)?.trim();
  return stored || null;
}

export function readSessionIdFromUrl(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = new URLSearchParams(window.location.search)
    .get(URL_SESSION_PARAM)
    ?.trim();
  return value || null;
}

export function persistSessionIdToUrl(sessionId: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  if (sessionId) {
    url.searchParams.set(URL_SESSION_PARAM, sessionId);
  } else {
    url.searchParams.delete(URL_SESSION_PARAM);
  }

  const nextRelativeUrl = `${url.pathname}${url.search}${url.hash}`;
  const currentRelativeUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (nextRelativeUrl !== currentRelativeUrl) {
    window.history.replaceState(window.history.state, "", nextRelativeUrl);
  }
}

export function persistActiveSessionId(sessionId: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (sessionId) {
    window.localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, sessionId);
    return;
  }

  window.localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
}

export function clearStoredMessages(sessionId: string | null) {
  if (typeof window === "undefined" || !sessionId) {
    return;
  }

  window.localStorage.removeItem(buildSessionMessagesStorageKey(sessionId));
}

export function readStoredMessages(sessionId: string | null): Message[] {
  if (typeof window === "undefined" || !sessionId) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(buildSessionMessagesStorageKey(sessionId));
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is Message => {
      if (!item || typeof item !== "object") {
        return false;
      }

      const candidate = item as Partial<Message>;
      return (
        typeof candidate.id === "string" &&
        (candidate.role === "user" || candidate.role === "assistant") &&
        typeof candidate.content === "string" &&
        (candidate.type === "text" || candidate.type === "card") &&
        typeof candidate.timestamp === "number"
      );
    });
  } catch {
    return [];
  }
}

export function persistSessionMessages(sessionId: string | null, messages: Message[]) {
  if (typeof window === "undefined" || !sessionId) {
    return;
  }

  const persistedMessages = messages.filter((message) => !message.streaming);
  window.localStorage.setItem(
    buildSessionMessagesStorageKey(sessionId),
    JSON.stringify(persistedMessages),
  );
}

export function readPromptHistory(): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(PROMPT_HISTORY_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, MAX_PROMPT_HISTORY_ENTRIES);
  } catch {
    return [];
  }
}

export function persistPromptHistory(history: string[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    PROMPT_HISTORY_STORAGE_KEY,
    JSON.stringify(history.slice(0, MAX_PROMPT_HISTORY_ENTRIES)),
  );
}

export function pushPromptHistoryEntry(history: string[], content: string): string[] {
  const normalizedContent = content.trim();
  if (!normalizedContent) {
    return history;
  }

  return [normalizedContent, ...history.filter((item) => item !== normalizedContent)].slice(
    0,
    MAX_PROMPT_HISTORY_ENTRIES,
  );
}

export function isCursorOnFirstLine(target: HTMLTextAreaElement): boolean {
  if (target.selectionStart !== target.selectionEnd) {
    return false;
  }

  return !target.value.slice(0, target.selectionStart).includes("\n");
}

export function isCursorOnLastLine(target: HTMLTextAreaElement): boolean {
  if (target.selectionStart !== target.selectionEnd) {
    return false;
  }

  return !target.value.slice(target.selectionEnd).includes("\n");
}
