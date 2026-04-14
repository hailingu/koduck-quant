import { useState, useRef, useEffect } from "react";
import {
  ArrowUp,
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

const STREAM_INITIAL_IDLE_TIMEOUT_MS = 20000;
const STREAM_POST_CONTENT_IDLE_TIMEOUT_MS = 8000;
const STREAM_REQUEST_TIMEOUT_MS = 90000;
const ACTIVE_SESSION_STORAGE_KEY = "koduck.ai.activeSessionId";
const SESSION_MESSAGES_STORAGE_PREFIX = "koduck.ai.sessionMessages";

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
    <div className="max-w-none text-base leading-8 text-gray-800 break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mt-4 mb-3 text-2xl font-semibold text-gray-900 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-4 mb-3 text-xl font-semibold text-gray-900 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-4 mb-2 text-lg font-semibold text-gray-900 first:mt-0">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="mb-3 last:mb-0 whitespace-pre-wrap">{children}</p>,
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
      <span>正在生成</span>
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
  const initialSessionId = readActiveSessionId();
  const [chatMessage, setChatMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>(() => readStoredMessages(initialSessionId));
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(initialSessionId);
  const [selectedProvider] = useState("OpenAI");
  const [selectedModel] = useState("GPT-4");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const currentSessionIdRef = useRef<string | null>(currentSessionId);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
    persistActiveSessionId(currentSessionId);
  }, [currentSessionId]);

  useEffect(() => {
    setMessages(readStoredMessages(currentSessionId));
  }, [currentSessionId]);

  useEffect(() => {
    persistSessionMessages(currentSessionId, messages);
  }, [currentSessionId, messages]);

  const updateAssistantMessage = (messageId: string, updater: (prev: Message) => Message) => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === messageId ? updater(message) : message,
      ),
    );
  };

  const createSessionId = () => crypto.randomUUID();

  const activateSession = (sessionId: string | null) => {
    currentSessionIdRef.current = sessionId;
    setCurrentSessionId(sessionId);
  };

  const buildHistoryMessages = (): ChatHistoryMessage[] =>
    messages
      .filter((message) => !message.streaming && message.content.trim())
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

  const handleCreateSession = () => {
    activateSession(createSessionId());
    setMessages([]);
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

  const copyMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch (error) {
      console.error("failed to copy message:", error);
    }
  };

  const deleteMessage = (messageId: string) => {
    setMessages((prev) => prev.filter((message) => message.id !== messageId));
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
      activateSession(sessionId);
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
    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setChatMessage("");
    setSending(true);
    const abortController = new AbortController();
    let shouldAbortRequest = true;
    const requestTimeoutId = window.setTimeout(() => {
      abortController.abort("chat stream request timeout");
    }, STREAM_REQUEST_TIMEOUT_MS);
    let streamedText = "";
    let streamErrorMessage = "";

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
          history: buildHistoryMessages(),
        }),
      });

      if (!response.ok || !response.body) {
        window.clearTimeout(requestTimeoutId);
        throw new Error(await extractApiErrorMessage(response));
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamCompleted = false;
      let streamEstablished = false;

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
            continue;
          }

          let eventData: StreamEventData | null = null;
          try {
            eventData = JSON.parse(block.data) as StreamEventData;
          } catch {
            continue;
          }

          if (block.event === "message" && eventData.payload?.text) {
            streamedText += eventData.payload.text;
            const nextText = streamedText;
            updateAssistantMessage(assistantMessageId, (prev) => ({
              ...prev,
              content: nextText,
              timestamp: prev.timestamp || Date.now(),
              streaming: true,
              type: "text",
            }));
          }

          if (block.event === "done") {
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
        if (streamEstablished) {
          throw new Error("chat stream ended before any visible content was returned");
        }
        throw new Error("chat stream returned empty content");
      }

      shouldAbortRequest = false;
    } catch (error) {
      if (streamedText.trim()) {
        const userVisibleMessage = toUserVisibleStreamErrorMessage(
          error instanceof Error ? error.message : undefined,
        );
        updateAssistantMessage(assistantMessageId, (prev) => ({
          ...prev,
          content:
            streamedText + `\n\n回答提前结束：${userVisibleMessage}`,
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

  const renderInputBar = () => (
    <div className="bg-white border border-gray-200 rounded-[32px] shadow-sm transition-shadow hover:shadow-md">
      {uploadedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 px-5 pt-4 pb-2">
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
          placeholder="询问问题,尽管问..."
          value={chatMessage}
          onChange={(e) => setChatMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSendMessage();
            }
          }}
          rows={1}
          className="w-full resize-none border-0 bg-transparent text-base text-gray-800 outline-none placeholder:text-gray-400"
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
          <button
            className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
            type="button"
          >
            <span>{selectedProvider}</span>
            <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
          </button>
          <button
            className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
            type="button"
          >
            <span>{selectedModel}</span>
            <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
          </button>
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

      <button
        onClick={handleCreateSession}
        className="fixed top-3 left-4 z-10 flex h-8 w-8 items-center justify-center text-gray-500 transition-colors hover:text-gray-700"
        type="button"
        title="新建会话"
      >
        <Plus className="h-6 w-6" strokeWidth={1.5} />
      </button>
      <div className="flex-1 overflow-y-auto">
        <div
          className={`min-h-full flex flex-col ${
            messages.length === 0
              ? "items-center justify-start pt-[28vh]"
              : "justify-start pt-8"
          } px-4`}
        >
          {messages.length === 0 ? (
            <div className="w-full max-w-3xl mx-auto">
              <h1 className="text-3xl font-normal text-gray-800 text-center mb-8">
                {currentSessionId ? "新会话已创建" : "开始对话"}
              </h1>
              {!currentSessionId && (
                <p className="mb-8 text-center text-sm text-gray-500">
                  输入第一条消息时会自动创建 session，也可以点击左上角 + 先创建。
                </p>
              )}
              <div className="w-full max-w-4xl px-4">{renderInputBar()}</div>
            </div>
          ) : (
            <div className="w-full max-w-3xl mx-auto space-y-6 mb-32">
              {messages.map((message) => (
                <div key={message.id} className="group space-y-2">
                  <div
                    className={`flex ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div className="max-w-[80%]">
                      {message.type === "text" ? (
                        message.role === "assistant" ? (
                          !message.content ? (
                            <StreamingPlaceholder />
                          ) : message.streaming ? (
                            <p className="text-base whitespace-pre-wrap text-gray-800">
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
                          <p className="text-base text-gray-800 mb-4">
                            {message.content}
                          </p>
                          {message.cardData && (
                            <div className="bg-white rounded-2xl p-5 hover:bg-gray-50 transition-colors cursor-pointer">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <h3 className="text-lg font-medium text-gray-900">
                                    {message.cardData.title}
                                  </h3>
                                  <p className="text-sm text-gray-500">
                                    {message.cardData.description}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-baseline gap-2 mt-3">
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
                      <div
                        className={`flex items-center gap-2 mt-2 ${
                          message.role === "user" ? "justify-end" : "justify-start"
                        }`}
                      >
                        {Boolean(message.timestamp) && (
                          <div className="text-xs text-gray-500">
                            {formatTimestamp(message.timestamp)}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            className="p-1 text-gray-400 transition-colors hover:text-gray-600"
                            onClick={() => void copyMessage(message.content)}
                            title="复制"
                            type="button"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            className="p-1 text-gray-400 transition-colors hover:text-red-600"
                            onClick={() => deleteMessage(message.id)}
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

      {messages.length > 0 && (
        <div className="bg-white">
          <div className="w-full max-w-4xl mx-auto px-4 py-4">{renderInputBar()}</div>
        </div>
      )}
    </main>
  );
}
