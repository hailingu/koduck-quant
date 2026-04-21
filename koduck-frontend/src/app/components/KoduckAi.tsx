import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  FileText,
  Mic,
  Paperclip,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MessageType = "text" | "card";

interface Message {
  id: string;
  memoryEntryId?: string;
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

interface UploadedFile {
  id: string;
  name: string;
  type: string;
  preview?: string;
}

interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

type LlmProvider = "minimax" | "kimi";

const PROVIDER_OPTIONS: Array<{ value: LlmProvider; label: string }> = [
  { value: "minimax", label: "MiniMax" },
  { value: "kimi", label: "Kimi" },
];

const MODEL_OPTIONS_BY_PROVIDER: Record<
  LlmProvider,
  Array<{ value: string; label: string }>
> = {
  minimax: [
    { value: "MiniMax-M2.7", label: "MiniMax-M2.7" },
    { value: "MiniMax-M2.5", label: "MiniMax-M2.5" },
  ],
  kimi: [{ value: "kimi-for-coding", label: "kimi-for-coding" }],
};

interface StreamEventPayload {
  text?: string;
  finish_reason?: string;
  code?: string;
  message?: string;
  retryable?: boolean;
  degraded?: boolean;
  retry_after_ms?: number;
}

interface StreamEventData {
  event_id?: string;
  sequence_num?: number;
  event_type?: string;
  payload?: StreamEventPayload;
  request_id?: string;
}

interface ApiErrorBody {
  code?: string;
  message?: string;
  request_id?: string;
  retryable?: boolean;
  degraded?: boolean;
  upstream?: string;
}

interface ApiErrorEnvelope {
  success?: boolean;
  code?: string;
  message?: string;
  error?: ApiErrorBody;
}

interface SessionLookupData {
  exists?: boolean;
}

interface SessionLookupEnvelope {
  success?: boolean;
  data?: SessionLookupData;
}

interface SessionTranscriptEntry {
  entry_id?: string;
  role?: "user" | "assistant";
  content?: string;
  timestamp?: number;
}

interface SessionTranscriptData {
  session_id?: string;
  entries?: SessionTranscriptEntry[];
}

interface SessionTranscriptEnvelope {
  success?: boolean;
  data?: SessionTranscriptData;
}

const STREAM_INITIAL_IDLE_TIMEOUT_MS = 20000;
const STREAM_POST_CONTENT_IDLE_TIMEOUT_MS = 8000;
const STREAM_REQUEST_TIMEOUT_MS = 300000;
const SESSION_LOOKUP_RETRY_DELAYS_MS = [150, 400];
const MAX_HISTORY_MESSAGES = 5;
const MAX_PROMPT_HISTORY_ENTRIES = 100;
const ACTIVE_SESSION_STORAGE_KEY = "koduck.ai.activeSessionId";
const SESSION_MESSAGES_STORAGE_PREFIX = "koduck.ai.sessionMessages";
const PROMPT_HISTORY_STORAGE_KEY = "koduck.ai.promptHistory";
const URL_SESSION_PARAM = "session_id";

function buildSessionMessagesStorageKey(sessionId: string): string {
  return `${SESSION_MESSAGES_STORAGE_PREFIX}.${sessionId}`;
}

function readActiveSessionId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY)?.trim();
  return stored || null;
}

function readSessionIdFromUrl(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = new URLSearchParams(window.location.search)
    .get(URL_SESSION_PARAM)
    ?.trim();
  return value || null;
}

function persistSessionIdToUrl(sessionId: string | null) {
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

function persistActiveSessionId(sessionId: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (sessionId) {
    window.localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, sessionId);
    return;
  }

  window.localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
}

function clearStoredMessages(sessionId: string | null) {
  if (typeof window === "undefined" || !sessionId) {
    return;
  }

  window.localStorage.removeItem(buildSessionMessagesStorageKey(sessionId));
}

function readStoredMessages(sessionId: string | null): Message[] {
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

function persistSessionMessages(sessionId: string | null, messages: Message[]) {
  if (typeof window === "undefined" || !sessionId) {
    return;
  }

  const persistedMessages = messages.filter((message) => !message.streaming);
  window.localStorage.setItem(
    buildSessionMessagesStorageKey(sessionId),
    JSON.stringify(persistedMessages),
  );
}

function readPromptHistory(): string[] {
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

function persistPromptHistory(history: string[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    PROMPT_HISTORY_STORAGE_KEY,
    JSON.stringify(history.slice(0, MAX_PROMPT_HISTORY_ENTRIES)),
  );
}

function pushPromptHistoryEntry(history: string[], content: string): string[] {
  const normalizedContent = content.trim();
  if (!normalizedContent) {
    return history;
  }

  return [normalizedContent, ...history.filter((item) => item !== normalizedContent)].slice(
    0,
    MAX_PROMPT_HISTORY_ENTRIES,
  );
}

function isCursorOnFirstLine(target: HTMLTextAreaElement): boolean {
  if (target.selectionStart !== target.selectionEnd) {
    return false;
  }

  return !target.value.slice(0, target.selectionStart).includes("\n");
}

function isCursorOnLastLine(target: HTMLTextAreaElement): boolean {
  if (target.selectionStart !== target.selectionEnd) {
    return false;
  }

  return !target.value.slice(target.selectionEnd).includes("\n");
}

function mapTranscriptEntriesToMessages(entries: SessionTranscriptEntry[]): Message[] {
  return entries
    .filter(
      (entry): entry is Required<Pick<SessionTranscriptEntry, "entry_id" | "role" | "content" | "timestamp">> =>
        typeof entry.entry_id === "string" &&
        (entry.role === "user" || entry.role === "assistant") &&
        typeof entry.content === "string" &&
        typeof entry.timestamp === "number",
    )
    .map((entry) => ({
      id: entry.entry_id,
      memoryEntryId: entry.entry_id,
      role: entry.role,
      content: entry.content,
      type: "text",
      timestamp: entry.timestamp,
    }));
}

async function fetchSessionExists(
  sessionId: string,
  signal: AbortSignal,
): Promise<boolean | null> {
  const token = window.localStorage.getItem("koduck.auth.token");

  for (let attempt = 0; attempt <= SESSION_LOOKUP_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const response = await fetch(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal,
      });

      if (response.ok) {
        const body = (await response.json()) as SessionLookupEnvelope;
        if (!body.success) {
          return null;
        }

        return body.data?.exists === true;
      }

      if (
        response.status !== 502 &&
        response.status !== 503 &&
        response.status !== 504
      ) {
        return null;
      }
    } catch {
      return null;
    }

    const delay = SESSION_LOOKUP_RETRY_DELAYS_MS[attempt];
    if (delay == null) {
      return null;
    }

    await new Promise<void>((resolve) => {
      const timer = window.setTimeout(() => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      }, delay);
      const onAbort = () => {
        window.clearTimeout(timer);
        signal.removeEventListener("abort", onAbort);
        resolve();
      };
      signal.addEventListener("abort", onAbort, { once: true });
    });

    if (signal.aborted) {
      return null;
    }
  }

  return null;
}

async function fetchSessionTranscript(
  sessionId: string,
  signal?: AbortSignal,
): Promise<Message[] | null> {
  const token = window.localStorage.getItem("koduck.auth.token");
  const response = await fetch(
    `/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/transcript`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal,
    },
  );

  if (!response.ok) {
    return null;
  }

  const body = (await response.json()) as SessionTranscriptEnvelope;
  if (!body.success) {
    return null;
  }

  return mapTranscriptEntriesToMessages(body.data?.entries ?? []);
}

function logStreamTrace(
  localRequestId: string,
  stage: string,
  detail: Record<string, unknown> = {},
) {
  console.info("[koduck-ai][stream]", {
    localRequestId,
    stage,
    ...detail,
  });
}

function toUserVisibleStreamErrorMessage(rawMessage: string | null | undefined): string {
  const normalized = rawMessage?.trim().toLowerCase() || "";

  if (!normalized) {
    return "连接中断，请重试一次。";
  }

  if (
    normalized.includes("chat stream idle timeout") ||
    normalized.includes("request timeout") ||
    normalized.includes("stream timeout") ||
    normalized.includes("timed out")
  ) {
    return "响应超时，请重试一次。";
  }

  if (
    normalized.includes("networkerror") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("load failed") ||
    normalized.includes("network request failed")
  ) {
    return "网络连接异常，请重试一次。";
  }

  if (
    normalized.includes("aborted") ||
    normalized.includes("interrupted") ||
    normalized.includes("ended before any visible content")
  ) {
    return "响应中断，请重试一次。";
  }

  return "连接中断，请重试一次。";
}

function normalizeMarkdownContent(content: string): string {
  const source = content.replace(/\r\n/g, "\n").trim();
  const rawLines = source.split("\n");

  const isTableLike = (line: string): boolean => {
    const trimmed = line.trim();
    const pipeCount = (trimmed.match(/\|/g) || []).length;
    return pipeCount >= 2;
  };

  const sanitizeTableLine = (line: string): string | null => {
    const trimmed = line.trim();
    if (!trimmed || /^(\|\s*)+$/.test(trimmed)) {
      return null;
    }

    let tableLine = trimmed;
    if (!tableLine.startsWith("|")) {
      tableLine = `| ${tableLine}`;
    }
    if (!tableLine.endsWith("|")) {
      tableLine = `${tableLine} |`;
    }

    return tableLine
      .replace(/\|\s+/g, "| ")
      .replace(/\s+\|/g, " |")
      .replace(/\|{2,}/g, "|");
  };

  const appendExpandedText = (bucket: string[], line: string) => {
    const expanded = line
      .replace(/([^\n])\s*(#{1,6}\s+)/g, "$1\n\n$2")
      .replace(/([^\n])\s*(>\s)/g, "$1\n$2")
      .replace(/([^\n])\s*(\d+\.\s+)/g, "$1\n$2")
      .replace(/([^\n])\s*(---+)\s*/g, "$1\n\n$2\n\n");

    bucket.push(...expanded.split("\n"));
  };

  const mergedLines: string[] = [];
  for (let i = 0; i < rawLines.length; i += 1) {
    const current = rawLines[i].trim();
    const next = rawLines[i + 1]?.trim() ?? "";
    const nextNext = rawLines[i + 2]?.trim() ?? "";

    if (/^\|\*+\s*$/.test(current) && next && nextNext.startsWith("|")) {
      mergedLines.push(`${current}${next}${nextNext}`);
      i += 2;
      continue;
    }

    if (/^(\|\s*)+$/.test(current)) {
      continue;
    }

    mergedLines.push(rawLines[i]);
  }

  const normalizedLines: string[] = [];
  let inTableBlock = false;
  let tableHeaderColumns = 0;
  let separatorInserted = false;

  for (const rawLine of mergedLines) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      normalizedLines.push("");
      inTableBlock = false;
      tableHeaderColumns = 0;
      separatorInserted = false;
      continue;
    }

    if (isTableLike(trimmed)) {
      const tableLine = sanitizeTableLine(trimmed);
      if (!tableLine) {
        continue;
      }

      const isSeparatorLike = /^[\s|:-]+$/.test(tableLine);
      const cellCount = tableLine
        .split("|")
        .map((part) => part.trim())
        .filter(Boolean).length;

      if (!inTableBlock) {
        inTableBlock = true;
        tableHeaderColumns = cellCount;
        separatorInserted = false;
        normalizedLines.push(tableLine);
        continue;
      }

      if (!separatorInserted && !isSeparatorLike && tableHeaderColumns > 0) {
        normalizedLines.push(
          `| ${Array.from({ length: tableHeaderColumns }, () => "---").join(" | ")} |`,
        );
        separatorInserted = true;
      }

      if (isSeparatorLike) {
        separatorInserted = true;
      }

      normalizedLines.push(tableLine);
      continue;
    }

    inTableBlock = false;
    tableHeaderColumns = 0;
    separatorInserted = false;
    appendExpandedText(normalizedLines, rawLine);
  }

  return normalizedLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="max-w-none break-words text-base leading-8 text-gray-800">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-3 mt-4 text-2xl font-semibold text-gray-900 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-3 mt-4 text-xl font-semibold text-gray-900 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-4 text-lg font-semibold text-gray-900 first:mt-0">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="mb-3 whitespace-pre-wrap last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-3 list-disc pl-6">{children}</ul>,
          ol: ({ children }) => <ol className="mb-3 list-decimal pl-6">{children}</ol>,
          li: ({ children }) => <li className="mb-1">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="mb-3 border-l-4 border-gray-300 pl-4 text-gray-600">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-[#0d8b6d] underline underline-offset-2"
            >
              {children}
            </a>
          ),
          code: ({ className, children }) => {
            const isBlock = Boolean(className);
            if (isBlock) {
              return (
                <code className="block overflow-x-auto rounded-xl bg-gray-100 px-4 py-3 font-mono text-sm leading-6 text-gray-900">
                  {children}
                </code>
              );
            }
            return (
              <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-sm text-gray-900">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="mb-3 overflow-x-auto">{children}</pre>,
          table: ({ children }) => (
            <div className="mb-3 overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-gray-100">{children}</thead>,
          th: ({ children }) => (
            <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-900">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-gray-200 px-3 py-2 align-top">{children}</td>
          ),
          hr: () => <hr className="my-4 border-gray-200" />,
          strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
        }}
      >
        {normalizeMarkdownContent(content)}
      </ReactMarkdown>
    </div>
  );
}

function StreamingPlaceholder() {
  return (
    <div className="inline-flex items-center gap-2 text-base text-gray-500">
      <span className="inline-flex gap-1">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gray-400 [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gray-400 [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gray-400 [animation-delay:300ms]" />
      </span>
    </div>
  );
}

function parseSseBlocks(
  buffer: string,
): { blocks: Array<{ event: string; data: string }>; remainder: string } {
  const segments = buffer.split("\n\n");
  const remainder = segments.pop() ?? "";
  const blocks = segments
    .map((segment) => {
      const lines = segment.split("\n");
      let event = "message";
      const dataLines: string[] = [];

      for (const rawLine of lines) {
        const line = rawLine.trimEnd();
        if (!line || line.startsWith(":")) {
          continue;
        }
        if (line.startsWith("event:")) {
          event = line.slice("event:".length).trim();
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice("data:".length).trim());
        }
      }

      return {
        event,
        data: dataLines.join("\n"),
      };
    })
    .filter((block) => block.data.length > 0);

  return { blocks, remainder };
}

export function KoduckAi() {
  const initialSessionIdRef = useRef<string | null>(readSessionIdFromUrl() ?? readActiveSessionId());
  const initialSessionId = initialSessionIdRef.current;
  const [chatMessage, setChatMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [promptHistory, setPromptHistory] = useState<string[]>(() => readPromptHistory());
  const [promptHistoryIndex, setPromptHistoryIndex] = useState<number | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(initialSessionId);
  const [selectedProvider, setSelectedProvider] = useState<LlmProvider>("minimax");
  const [selectedModel, setSelectedModel] = useState("MiniMax-M2.7");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [sending, setSending] = useState(false);
  const [sessionHydrated, setSessionHydrated] = useState(initialSessionId === null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [composerHeight, setComposerHeight] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const composerDockRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const dragCounterRef = useRef(0);
  const copyFeedbackTimeoutRef = useRef<number | null>(null);
  const currentSessionIdRef = useRef<string | null>(currentSessionId);
  const skipNextSessionRestoreRef = useRef(false);
  const draftBeforePromptHistoryRef = useRef("");
  const createSessionId = () => crypto.randomUUID();
  const activateSession = (
    sessionId: string | null,
    options?: { skipRestore?: boolean },
  ) => {
    currentSessionIdRef.current = sessionId;
    skipNextSessionRestoreRef.current = options?.skipRestore === true;
    setCurrentSessionId(sessionId);
  };

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior });
      return;
    }

    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom(messages.at(-1)?.streaming ? "auto" : "smooth");
  }, [messages]);

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
    persistActiveSessionId(currentSessionId);
    persistSessionIdToUrl(currentSessionId);
  }, [currentSessionId]);

  const resizeChatInput = (target: HTMLTextAreaElement | null) => {
    if (!target) {
      return;
    }

    const maxHeight = 240;
    const cursorAtEnd =
      target.selectionStart === target.value.length &&
      target.selectionEnd === target.value.length;
    target.style.height = "auto";
    const nextHeight = Math.min(target.scrollHeight, maxHeight);
    target.style.height = `${nextHeight}px`;
    const isOverflowing = target.scrollHeight > maxHeight;
    target.style.overflowY = isOverflowing ? "auto" : "hidden";
    target.scrollTop = isOverflowing && cursorAtEnd ? target.scrollHeight : 0;
  };

  useEffect(
    () => () => {
      if (copyFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(copyFeedbackTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    resizeChatInput(chatInputRef.current);
  }, [chatMessage]);

  useEffect(() => {
    const target = composerDockRef.current;
    if (!target) {
      return;
    }

    const updateComposerHeight = () => {
      setComposerHeight(target.offsetHeight);
    };

    updateComposerHeight();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      updateComposerHeight();
    });
    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (composerHeight > 0) {
      scrollToBottom("auto");
    }
  }, [composerHeight]);

  useEffect(() => {
    persistPromptHistory(promptHistory);
  }, [promptHistory]);

  useEffect(() => {
    if (!currentSessionId) {
      skipNextSessionRestoreRef.current = false;
      setMessages([]);
      return;
    }

    if (currentSessionId === initialSessionId && !sessionHydrated) {
      return;
    }

    if (skipNextSessionRestoreRef.current) {
      skipNextSessionRestoreRef.current = false;
      return;
    }

    setMessages(readStoredMessages(currentSessionId));
  }, [currentSessionId, initialSessionId, sessionHydrated]);

  useEffect(() => {
    if (!initialSessionId) {
      setSessionHydrated(true);
      return;
    }

    const controller = new AbortController();

    const hydrateSession = async () => {
      const exists = await fetchSessionExists(initialSessionId, controller.signal);
      if (controller.signal.aborted) {
        return;
      }

      if (exists === false) {
        clearStoredMessages(initialSessionId);
        if (readActiveSessionId() === initialSessionId) {
          persistActiveSessionId(null);
        }
        if (currentSessionIdRef.current === initialSessionId) {
          activateSession(null);
          setMessages([]);
        }
      } else {
        const transcriptMessages = await fetchSessionTranscript(
          initialSessionId,
          controller.signal,
        );
        if (controller.signal.aborted) {
          return;
        }
        setMessages(transcriptMessages ?? readStoredMessages(initialSessionId));
      }

      setSessionHydrated(true);
    };

    void hydrateSession();

    return () => {
      controller.abort();
    };
  }, [initialSessionId]);

  useEffect(() => {
    if (!sessionHydrated && currentSessionId === initialSessionId) {
      return;
    }

    persistSessionMessages(currentSessionId, messages);
  }, [currentSessionId, initialSessionId, messages, sessionHydrated]);

  useEffect(() => {
    const availableModels = MODEL_OPTIONS_BY_PROVIDER[selectedProvider];
    if (!availableModels.some((model) => model.value === selectedModel)) {
      setSelectedModel(availableModels[0].value);
    }
  }, [selectedProvider, selectedModel]);

  const updateAssistantMessage = (messageId: string, updater: (prev: Message) => Message) => {
    setMessages((prev) =>
      prev.map((message) => (message.id === messageId ? updater(message) : message)),
    );
  };

  const syncSessionMessagesFromMemory = async (
    sessionId: string,
    signal?: AbortSignal,
  ): Promise<Message[] | null> => {
    const transcriptMessages = await fetchSessionTranscript(sessionId, signal);
    if (signal?.aborted) {
      return null;
    }
    if (transcriptMessages) {
      setMessages(transcriptMessages);
    }
    return transcriptMessages;
  };

  const buildHistoryMessages = (): ChatHistoryMessage[] =>
    messages
      .filter((message) => !message.streaming && message.content.trim())
      .slice(-MAX_HISTORY_MESSAGES)
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

  const handleCreateSession = () => {
    activateSession(createSessionId(), { skipRestore: true });
    setMessages([]);
    setPromptHistoryIndex(null);
    draftBeforePromptHistoryRef.current = "";
    setChatMessage("");
    setUploadedFiles([]);
  };

  const handleDeleteCurrentSession = async () => {
    const sessionId = currentSessionIdRef.current;
    if (sessionId) {
      const token = window.localStorage.getItem("koduck.auth.token");
      try {
        await fetch(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}`, {
          method: "DELETE",
          headers: {
            Accept: "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
      } catch {
        // Best-effort: still clear local state even if backend delete fails
      }
    }
    clearStoredMessages(sessionId);
    activateSession(null, { skipRestore: true });
    setMessages([]);
    setPromptHistoryIndex(null);
    draftBeforePromptHistoryRef.current = "";
    setChatMessage("");
    setUploadedFiles([]);
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files) {
      return;
    }

    Array.from(files).forEach((file) => {
      const uploadedFile: UploadedFile = {
        id: `${Date.now()}-${Math.random()}`,
        name: file.name,
        type: file.type,
      };

      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (event) => {
          setUploadedFiles((prev) => [
            ...prev,
            { ...uploadedFile, preview: event.target?.result as string },
          ]);
        };
        reader.readAsDataURL(file);
        return;
      }

      setUploadedFiles((prev) => [...prev, uploadedFile]);
    });
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const removeFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((file) => file.id !== fileId));
  };

  const extractApiErrorMessage = async (response: Response) => {
    const fallback = `chat api failed: ${response.status}`;

    try {
      const data = (await response.json()) as ApiErrorEnvelope;
      const detail = data.error?.message?.trim() || data.message?.trim() || "";
      return detail || fallback;
    } catch {
      return fallback;
    }
  };

  const normalizeCopyContent = (raw: string): string =>
    raw
      .replace(/\u001B\][^\u0007]*(?:\u0007|\u001B\\)/g, "")
      .replace(/\u001B\[[0-9;?]*[ -/]*[@-~]/g, "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

  const copyMessage = async (
    trigger: HTMLButtonElement,
    messageId: string,
    fallbackContent: string,
  ) => {
    try {
      const actionRow = trigger.closest<HTMLElement>("[data-copy-row='true']");
      const messageContentContainer = actionRow?.previousElementSibling as HTMLElement | null;
      const renderedContent = messageContentContainer?.innerText?.trim();
      const normalizedRenderedContent = normalizeCopyContent(renderedContent || "");
      const normalizedFallbackContent = normalizeCopyContent(fallbackContent);
      const contentToCopy = normalizedRenderedContent || normalizedFallbackContent;
      await navigator.clipboard.writeText(contentToCopy);
      setCopiedMessageId(messageId);
      if (copyFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(copyFeedbackTimeoutRef.current);
      }
      copyFeedbackTimeoutRef.current = window.setTimeout(() => {
        setCopiedMessageId((prev) => (prev === messageId ? null : prev));
      }, 1600);
    } catch (error) {
      console.error("failed to copy message:", error);
    }
  };

  const deleteMessage = async (message: Message) => {
    if (message.streaming) {
      return;
    }

    const sessionId = currentSessionIdRef.current;
    if (!sessionId) {
      setMessages((prev) => prev.filter((item) => item.id !== message.id));
      return;
    }

    setDeletingMessageId(message.id);
    try {
      let entryId = message.memoryEntryId;
      if (!entryId) {
        const syncedMessages = await syncSessionMessagesFromMemory(sessionId);
        const matchedMessage = syncedMessages?.find(
          (item) =>
            item.role === message.role &&
            item.content === message.content &&
            item.timestamp === message.timestamp,
        );
        entryId = matchedMessage?.memoryEntryId;
      }

      if (!entryId) {
        console.error("failed to delete memory entry: entry id is unavailable");
        return;
      }

      const token = window.localStorage.getItem("koduck.auth.token");
      const response = await fetch(
        `/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/entries/${encodeURIComponent(entryId)}`,
        {
          method: "DELETE",
          headers: {
            Accept: "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );

      if (!response.ok) {
        throw new Error(await extractApiErrorMessage(response));
      }

      setMessages((prev) => prev.filter((item) => item.memoryEntryId !== entryId));
    } catch (error) {
      console.error("failed to delete message:", error);
    } finally {
      setDeletingMessageId((prev) => (prev === message.id ? null : prev));
    }
  };

  const readStreamChunkWithTimeout = async (
    reader: ReadableStreamDefaultReader<Uint8Array>,
    timeoutMs: number,
  ): Promise<ReadableStreamReadResult<Uint8Array>> =>
    new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        reject(new Error("chat stream idle timeout"));
      }, timeoutMs);

      reader.read().then(
        (result) => {
          window.clearTimeout(timeoutId);
          resolve(result);
        },
        (error) => {
          window.clearTimeout(timeoutId);
          reject(error);
        },
      );
    });

  const handleSendMessage = async () => {
    const content = chatMessage.trim();
    if (!content || sending) {
      return;
    }

    const sessionId = currentSessionIdRef.current ?? createSessionId();
    if (!currentSessionIdRef.current) {
      activateSession(sessionId, { skipRestore: true });
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      type: "text",
      timestamp: Date.now(),
    };
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantPlaceholder: Message = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      type: "text",
      timestamp: 0,
      streaming: true,
    };
    setPromptHistory((prev) => pushPromptHistoryEntry(prev, content));
    setPromptHistoryIndex(null);
    draftBeforePromptHistoryRef.current = "";
    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setChatMessage("");
    setSending(true);
    const localRequestId = `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const abortController = new AbortController();
    let shouldAbortRequest = true;
    const requestTimeoutId = window.setTimeout(() => {
      abortController.abort("chat stream request timeout");
    }, STREAM_REQUEST_TIMEOUT_MS);
    let streamedText = "";
    let streamErrorMessage = "";
    let upstreamRequestId: string | null = null;
    let lastSequenceNum: number | null = null;
    let streamEstablished = false;

    logStreamTrace(localRequestId, "request_start", {
      sessionId,
      assistantMessageId,
      provider: selectedProvider,
      model: selectedModel,
      userMessageLength: content.length,
    });

    try {
      const token = localStorage.getItem("koduck.auth.token");
      const response = await fetch("/api/v1/ai/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: abortController.signal,
        body: JSON.stringify({
          message: content,
          session_id: sessionId,
          provider: selectedProvider,
          model: selectedModel,
          history: buildHistoryMessages(),
        }),
      });

      logStreamTrace(localRequestId, "response_received", {
        sessionId,
        ok: response.ok,
        status: response.status,
        hasBody: Boolean(response.body),
      });

      if (!response.ok || !response.body) {
        window.clearTimeout(requestTimeoutId);
        throw new Error(await extractApiErrorMessage(response));
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamCompleted = false;

      while (!streamCompleted) {
        const idleTimeoutMs = streamedText.trim()
          ? STREAM_POST_CONTENT_IDLE_TIMEOUT_MS
          : STREAM_INITIAL_IDLE_TIMEOUT_MS;
        const { done, value } = await readStreamChunkWithTimeout(
          reader,
          idleTimeoutMs,
        );
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const parsed = parseSseBlocks(buffer);
        buffer = parsed.remainder;

        for (const block of parsed.blocks) {
          streamEstablished = true;

          if (block.data === "heartbeat") {
            logStreamTrace(localRequestId, "heartbeat", {
              sessionId,
              upstreamRequestId,
              lastSequenceNum,
            });
            continue;
          }

          let eventData: StreamEventData | null = null;
          try {
            eventData = JSON.parse(block.data) as StreamEventData;
          } catch {
            logStreamTrace(localRequestId, "parse_error", {
              sessionId,
              rawEvent: block.event,
            });
            continue;
          }

          upstreamRequestId = eventData.request_id ?? upstreamRequestId;
          lastSequenceNum =
            typeof eventData.sequence_num === "number"
              ? eventData.sequence_num
              : lastSequenceNum;

          if (block.event === "message" && eventData.payload?.text) {
            streamedText += eventData.payload.text;
            const nextText = streamedText;
            logStreamTrace(localRequestId, "message", {
              sessionId,
              upstreamRequestId,
              sequenceNum: lastSequenceNum,
              deltaLength: eventData.payload.text.length,
              totalLength: nextText.length,
            });
            updateAssistantMessage(assistantMessageId, (prev) => ({
              ...prev,
              content: nextText,
              timestamp: prev.timestamp || Date.now(),
              streaming: true,
              type: "text",
            }));
          }

          if (block.event === "done") {
            logStreamTrace(localRequestId, "done", {
              sessionId,
              upstreamRequestId,
              sequenceNum: lastSequenceNum,
              finishReason: eventData.payload?.finish_reason ?? "",
              totalLength: streamedText.length,
            });
            updateAssistantMessage(assistantMessageId, (prev) => ({
              ...prev,
              content: streamedText || prev.content || "回答已完成。",
              timestamp: prev.timestamp || Date.now(),
              streaming: false,
            }));
            streamCompleted = true;
            await reader.cancel();
            break;
          }

          if (block.event === "error") {
            streamErrorMessage =
              eventData.payload?.message?.trim() || "生成过程中发生异常，请稍后重试。";
            logStreamTrace(localRequestId, "error_event", {
              sessionId,
              upstreamRequestId,
              sequenceNum: lastSequenceNum,
              code: eventData.payload?.code ?? "",
              message: streamErrorMessage,
              totalLength: streamedText.length,
            });
            updateAssistantMessage(assistantMessageId, (prev) => ({
              ...prev,
              content:
                streamedText ||
                prev.content ||
                `生成过程中断：${streamErrorMessage}`,
              timestamp: prev.timestamp || Date.now(),
              streaming: false,
              type: "text",
            }));
            streamCompleted = true;
            await reader.cancel();
            break;
          }
        }
      }

      window.clearTimeout(requestTimeoutId);

      if (!streamCompleted && streamedText.trim()) {
        logStreamTrace(localRequestId, "stream_closed_without_terminal_event", {
          sessionId,
          upstreamRequestId,
          sequenceNum: lastSequenceNum,
          totalLength: streamedText.length,
          streamErrorMessage,
        });
        updateAssistantMessage(assistantMessageId, (prev) => ({
          ...prev,
          content:
            streamedText +
            (streamErrorMessage
              ? `\n\n回答提前结束：${streamErrorMessage}`
              : "\n\n回答提前结束：连接中断，请重试一次。"),
          timestamp: prev.timestamp || Date.now(),
          streaming: false,
          type: "text",
        }));
        streamCompleted = true;
      }

      if (!streamedText.trim()) {
        logStreamTrace(localRequestId, "empty_stream", {
          sessionId,
          upstreamRequestId,
          sequenceNum: lastSequenceNum,
          streamEstablished,
        });
        if (streamEstablished) {
          throw new Error("chat stream ended before any visible content was returned");
        }
        throw new Error("chat stream returned empty content");
      }

      logStreamTrace(localRequestId, "request_complete", {
        sessionId,
        upstreamRequestId,
        sequenceNum: lastSequenceNum,
        totalLength: streamedText.length,
        streamCompleted,
      });
      await syncSessionMessagesFromMemory(sessionId);
      shouldAbortRequest = false;
    } catch (error) {
      logStreamTrace(localRequestId, "request_error", {
        sessionId,
        upstreamRequestId,
        sequenceNum: lastSequenceNum,
        streamEstablished,
        totalLength: streamedText.length,
        message: error instanceof Error ? error.message : String(error),
      });
      if (streamedText.trim()) {
        const userVisibleMessage = toUserVisibleStreamErrorMessage(
          error instanceof Error ? error.message : undefined,
        );
        updateAssistantMessage(assistantMessageId, (prev) => ({
          ...prev,
          content: streamedText + `\n\n回答提前结束：${userVisibleMessage}`,
          timestamp: prev.timestamp || Date.now(),
          streaming: false,
          type: "text",
        }));
        shouldAbortRequest = false;
        return;
      }

      if (streamEstablished) {
        const message = toUserVisibleStreamErrorMessage(
          error instanceof Error ? error.message : undefined,
        );
        console.error("koduck-ai chat stream interrupted after connection established:", error);
        updateAssistantMessage(assistantMessageId, (prev) => ({
          ...prev,
          content: `回答提前结束：${message}`,
          timestamp: prev.timestamp || Date.now(),
          streaming: false,
          type: "text",
        }));
        shouldAbortRequest = false;
        return;
      }

      console.error("koduck-ai chat api failed, fallback to local mock:", error);
      updateAssistantMessage(assistantMessageId, (prev) => ({
        ...prev,
        content: `后端暂时不可用\n当前为本地兜底回复。\n${getAIResponse(content)}`,
        timestamp: prev.timestamp || Date.now(),
        streaming: false,
        type: shouldReturnCard(content) ? "card" : "text",
        cardData: shouldReturnCard(content) ? generateCardData(content) : undefined,
      }));
    } finally {
      logStreamTrace(localRequestId, "request_finally", {
        sessionId,
        upstreamRequestId,
        sequenceNum: lastSequenceNum,
        shouldAbortRequest,
      });
      window.clearTimeout(requestTimeoutId);
      if (shouldAbortRequest && !abortController.signal.aborted) {
        abortController.abort("chat stream cleanup");
      }
      setSending(false);
    }
  };

  const getAIResponse = (message: string): string => {
    const lower = message.toLowerCase();
    if (lower.includes("分析") || lower.includes("数据")) {
      return "我已经为您生成了相关的数据分析卡片。";
    }
    return "这是一个示例回复。您可以询问关于量化交易、投资组合或市场分析的问题。";
  };

  const shouldReturnCard = (message: string): boolean => {
    const lower = message.toLowerCase();
    return (
      lower.includes("分析") ||
      lower.includes("数据") ||
      lower.includes("portfolio") ||
      lower.includes("股票")
    );
  };

  const generateCardData = (message: string) => {
    return {
      title: "AAPL - Apple Inc.",
      description: "科技板块 · 纳斯达克",
      value: "$175.43",
      change: "+2.34%",
    };
  };

  const formatTimestamp = (timestamp: number): string => {
    if (!timestamp) {
      return (
        new Date().toLocaleString("zh-CN", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }) +
        "." +
        new Date().getMilliseconds().toString().padStart(3, "0")
      );
    }
    const date = new Date(timestamp);
    const dateStr = date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const ms = date.getMilliseconds().toString().padStart(3, "0");
    return `${dateStr}.${ms}`;
  };

  const applyPromptHistoryValue = (nextValue: string) => {
    setChatMessage(nextValue);

    window.requestAnimationFrame(() => {
      const target = chatInputRef.current;
      if (!target) {
        return;
      }

      resizeChatInput(target);
      const cursor = nextValue.length;
      target.focus();
      target.setSelectionRange(cursor, cursor);
    });
  };

  const navigatePromptHistory = (direction: "up" | "down") => {
    if (promptHistory.length === 0) {
      return;
    }

    if (direction === "up") {
      const nextIndex =
        promptHistoryIndex === null
          ? 0
          : Math.min(promptHistoryIndex + 1, promptHistory.length - 1);
      if (promptHistoryIndex === null) {
        draftBeforePromptHistoryRef.current = chatMessage;
      }
      setPromptHistoryIndex(nextIndex);
      applyPromptHistoryValue(promptHistory[nextIndex]);
      return;
    }

    if (promptHistoryIndex === null) {
      return;
    }

    const nextIndex = promptHistoryIndex - 1;
    if (nextIndex >= 0) {
      setPromptHistoryIndex(nextIndex);
      applyPromptHistoryValue(promptHistory[nextIndex]);
      return;
    }

    setPromptHistoryIndex(null);
    applyPromptHistoryValue(draftBeforePromptHistoryRef.current);
  };

  const handleChatInputChange = (value: string, target: HTMLTextAreaElement) => {
    if (promptHistoryIndex !== null) {
      setPromptHistoryIndex(null);
      draftBeforePromptHistoryRef.current = "";
    }

    setChatMessage(value);
    resizeChatInput(target);
  };

  const handleChatInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "ArrowUp" && !e.shiftKey && isCursorOnFirstLine(e.currentTarget)) {
      e.preventDefault();
      navigatePromptHistory("up");
      return;
    }

    if (e.key === "ArrowDown" && !e.shiftKey && isCursorOnLastLine(e.currentTarget)) {
      if (promptHistoryIndex !== null) {
        e.preventDefault();
        navigatePromptHistory("down");
      }
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  const renderInputBar = () => (
    <div className="rounded-[32px] border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      {uploadedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 px-5 pb-2 pt-4">
          {uploadedFiles.map((file) => (
            <div
              key={file.id}
              className="group flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 pr-2 transition-colors hover:bg-gray-50"
            >
              {file.preview ? (
                <img
                  src={file.preview}
                  alt={file.name}
                  className="h-10 w-10 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500">
                  <FileText className="h-5 w-5 text-white" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-gray-900">{file.name}</div>
                <div className="text-xs text-gray-500">File</div>
              </div>
              <button
                className="flex h-6 w-6 items-center justify-center rounded-full bg-black text-white transition-colors hover:bg-gray-800"
                onClick={() => removeFile(file.id)}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="px-5 py-4">
        <textarea
          ref={chatInputRef}
          placeholder="询问问题,尽管问..."
          value={chatMessage}
          onChange={(e) => handleChatInputChange(e.target.value, e.target)}
          onKeyDown={handleChatInputKeyDown}
          rows={1}
          className="w-full resize-none overflow-hidden border-0 bg-transparent text-base text-gray-800 outline-none placeholder:text-gray-400"
        />
      </div>

      <div className="flex items-center gap-2 px-5 pb-3">
        <div className="flex flex-1 items-center gap-1.5">
          <button
            className="p-1.5 text-gray-400 transition-colors hover:text-gray-600"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <div className="relative">
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value as LlmProvider)}
              className="appearance-none rounded-lg px-2.5 py-1 pr-7 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none"
            >
              {PROVIDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          </div>
          <div className="relative">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="appearance-none rounded-lg px-2.5 py-1 pr-7 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none"
            >
              {MODEL_OPTIONS_BY_PROVIDER[selectedProvider].map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            className="p-1.5 text-gray-400 transition-colors hover:text-gray-600"
            type="button"
          >
            <Mic className="h-4 w-4" />
          </button>
          <button
            onClick={() => void handleSendMessage()}
            disabled={!chatMessage.trim() || sending}
            type="button"
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
              chatMessage.trim() && !sending
                ? "bg-gray-700 text-white hover:bg-gray-800"
                : "cursor-not-allowed bg-gray-200 text-gray-400"
            }`}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <main
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-white"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/5 backdrop-blur-md">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500">
              <Upload className="h-8 w-8 text-white" />
            </div>
            <h3 className="mb-2 text-xl font-medium text-gray-800">Add anything</h3>
            <p className="text-sm text-gray-500">Drop any file here to add it to the conversation</p>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        multiple
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
        type="file"
      />

      <div className="fixed top-3 left-4 z-10 flex items-center gap-2">
        <button
          onClick={handleCreateSession}
          className="flex h-8 w-8 items-center justify-center text-gray-500 transition-colors hover:text-gray-700"
          type="button"
          title="新建会话"
        >
          <Plus className="h-6 w-6" strokeWidth={1.5} />
        </button>
        <button
          onClick={handleDeleteCurrentSession}
          className="flex h-8 w-8 items-center justify-center text-gray-500 transition-colors hover:text-red-600"
          type="button"
          title="清除会话"
        >
          <Trash2 className="w-5 h-5" strokeWidth={1.5} />
        </button>
      </div>
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: composerHeight > 0 ? composerHeight + 24 : 240 }}
      >
        <div
          className={`flex min-h-full flex-col px-4 ${
            messages.length === 0
              ? "items-center justify-center py-12"
              : "justify-start pt-8"
          }`}
          style={
            messages.length === 0 && composerHeight > 0
              ? { minHeight: `calc(100% - ${composerHeight}px)` }
              : undefined
          }
        >
          {messages.length === 0 ? (
            <div className="mx-auto w-full max-w-3xl pb-8">
              <h1 className="mb-8 text-center text-3xl font-normal text-gray-800">
                {currentSessionId ? "新会话已创建" : "开始对话"}
              </h1>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-3xl space-y-6 pb-8">
              {messages.map((message) => (
                <div key={message.id} data-copy-scope="message" className="group space-y-2">
                  <div
                    className={`flex ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`inline-flex max-w-[80%] flex-col ${
                        message.role === "user" ? "ml-auto items-start" : "items-start"
                      }`}
                    >
                      <div data-message-content="true">
                        {message.type === "text" ? (
                          message.role === "assistant" ? (
                            !message.content ? (
                              <StreamingPlaceholder />
                            ) : message.streaming ? (
                              <p className="whitespace-pre-wrap text-base text-gray-800">
                                {message.content}
                              </p>
                            ) : (
                              <MarkdownMessage content={message.content} />
                            )
                          ) : (
                            <p className="text-base whitespace-pre-wrap text-gray-900">
                              {message.content}
                            </p>
                          )
                        ) : (
                          <div>
                            <p className="mb-4 text-base text-gray-800">{message.content}</p>
                            {message.cardData && (
                              <div className="cursor-pointer rounded-2xl bg-white p-5 transition-colors hover:bg-gray-50">
                                <div className="mb-2 flex items-start justify-between">
                                  <div>
                                    <h3 className="text-lg font-medium text-gray-900">
                                      {message.cardData.title}
                                    </h3>
                                    <p className="text-sm text-gray-500">
                                      {message.cardData.description}
                                    </p>
                                  </div>
                                </div>
                                <div className="mt-3 flex items-baseline gap-2">
                                  <span className="text-2xl font-medium text-gray-900">
                                    {message.cardData.value}
                                  </span>
                                  <span
                                    className={`text-sm font-medium ${
                                      message.cardData.change?.startsWith("+")
                                        ? "text-[#10a37f]"
                                        : "text-red-500"
                                    }`}
                                  >
                                    {message.cardData.change}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div data-copy-row="true" className="mt-2 flex items-center gap-2">
                        {Boolean(message.timestamp) && (
                          <div className="text-xs text-gray-500">
                            {formatTimestamp(message.timestamp)}
                          </div>
                        )}
                        <div
                          data-copy-actions="true"
                          className="flex shrink-0 items-center gap-1.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                        >
                          <button
                            aria-label="复制消息"
                            className="p-1 text-gray-400 transition-colors hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={!message.content.trim()}
                            onClick={(event) =>
                              void copyMessage(event.currentTarget, message.id, message.content)
                            }
                            title="复制"
                            type="button"
                          >
                            {copiedMessageId === message.id ? (
                              <Check className="h-3.5 w-3.5 text-[#10a37f]" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            aria-label="删除消息"
                            className="p-1 text-gray-400 transition-colors hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={message.streaming || deletingMessageId === message.id}
                            onClick={() => {
                              void deleteMessage(message);
                            }}
                            title="删除"
                            type="button"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      <div
        ref={composerDockRef}
        className="pointer-events-none fixed inset-x-0 bottom-0 z-20 bg-transparent"
      >
        <div className="pointer-events-auto mx-auto w-full max-w-4xl px-4 pb-4 pt-3">
          {renderInputBar()}
        </div>
      </div>
    </main>
  );
}
