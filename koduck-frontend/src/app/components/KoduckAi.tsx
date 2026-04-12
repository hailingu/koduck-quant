import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Input } from "./ui/input";

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

interface StreamEventPayload {
  text?: string;
  finish_reason?: string;
}

interface StreamEventData {
  event_id?: string;
  sequence_num?: number;
  event_type?: string;
  payload?: StreamEventPayload;
  request_id?: string;
  session_id?: string;
}

interface ChatHistoryItem {
  role: "user" | "assistant";
  content: string;
}

const SESSION_STORAGE_KEY = "koduck.ai.sessionId";
const MAX_HISTORY_MESSAGES = 12;

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
  const [chatMessage, setChatMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string>(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return window.sessionStorage.getItem(SESSION_STORAGE_KEY) ?? "";
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (sessionId) {
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
      return;
    }

    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }, [sessionId]);

  const updateAssistantMessage = (messageId: string, updater: (prev: Message) => Message) => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === messageId ? updater(message) : message,
      ),
    );
  };

  const buildHistoryPayload = (): ChatHistoryItem[] =>
    messages
      .filter(
        (message) =>
          (message.role === "user" || message.role === "assistant") &&
          message.type === "text" &&
          !message.streaming &&
          message.content.trim().length > 0,
      )
      .slice(-MAX_HISTORY_MESSAGES)
      .map((message) => ({
        role: message.role,
        content: message.content.trim(),
      }));

  const handleSendMessage = async () => {
    const content = chatMessage.trim();
    if (!content || sending) {
      return;
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

    const history = buildHistoryPayload();

    try {
      const token = localStorage.getItem("koduck.auth.token");
      const response = await fetch("/api/v1/ai/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          session_id: sessionId || undefined,
          message: content,
          history,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`chat api failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamedText = "";
      let streamCompleted = false;

      while (!streamCompleted) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const parsed = parseSseBlocks(buffer);
        buffer = parsed.remainder;

        for (const block of parsed.blocks) {
          if (block.data === "heartbeat") {
            continue;
          }

          let eventData: StreamEventData | null = null;
          try {
            eventData = JSON.parse(block.data) as StreamEventData;
          } catch {
            continue;
          }

          if (eventData?.session_id) {
            setSessionId(eventData.session_id);
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
        }
      }

      if (!streamedText.trim()) {
        throw new Error("chat stream returned empty content");
      }
    } catch (error) {
      console.error("koduck-ai chat api failed, fallback to local mock:", error);
      updateAssistantMessage(assistantMessageId, (prev) => ({
        ...prev,
        content: `后端接口调用失败，当前为本地兜底回复。\n${getAIResponse(content)}`,
        timestamp: prev.timestamp || Date.now(),
        streaming: false,
        type: shouldReturnCard(content) ? "card" : "text",
        cardData: shouldReturnCard(content) ? generateCardData(content) : undefined,
      }));
    } finally {
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
    <div className="relative">
      <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-3xl shadow-sm hover:shadow-md transition-shadow focus-within:shadow-md">
        <button className="p-2.5 text-gray-400 hover:text-gray-600">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <Input
          type="text"
          placeholder="询问问题，尽管问..."
          value={chatMessage}
          onChange={(e) => setChatMessage(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
          className="flex-1 border-0 bg-transparent focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:border-0 text-base py-2.5 px-0"
        />
        <button className="p-2.5 text-gray-400 hover:text-gray-600">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          </svg>
        </button>
        <button
          onClick={handleSendMessage}
          disabled={!chatMessage.trim() || sending}
          className={`m-1.5 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
            chatMessage.trim() && !sending
              ? "bg-[#10a37f] text-white hover:bg-[#0d8b6d]"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return (
    <main className="flex-1 flex flex-col bg-white overflow-hidden">
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
                Hi!
              </h1>
              {renderInputBar()}
            </div>
          ) : (
            <div className="w-full max-w-3xl mx-auto space-y-6 mb-32">
              {messages.map((message) => (
                <div key={message.id} className="space-y-2">
                  <div
                    className={`flex ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] ${
                        message.role === "user"
                          ? "bg-gray-100 rounded-3xl px-5 py-3"
                          : ""
                      }`}
                    >
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
                    </div>
                  </div>
                  <div
                    className={`flex ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {Boolean(message.timestamp) && (
                      <div className="px-1 text-sm text-[#667085]">
                        {formatTimestamp(message.timestamp)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      <div className={`bg-white ${messages.length === 0 ? "hidden" : ""}`}>
        <div className="w-full max-w-3xl mx-auto px-4 py-4">{renderInputBar()}</div>
      </div>
    </main>
  );
}
