import { Check, Copy, MessageSquareQuote, Trash2 } from "lucide-react";
import { MarkdownMessage } from "./MarkdownMessage";
import { StreamingPlaceholder } from "./StreamingPlaceholder";
import type { Message } from "./types";

interface MessageListProps {
  messages: Message[];
  currentSessionId: string | null;
  copiedMessageId: string | null;
  deletingMessageId: string | null;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  onQuote: (message: Message) => void;
  onCopy: (trigger: HTMLButtonElement, messageId: string, fallbackContent: string) => void;
  onDelete: (message: Message) => void;
  onMemoryEntryDeleted: (entryId: string) => void;
}

function formatTimestamp(timestamp: number): string {
  const date = timestamp ? new Date(timestamp) : new Date();
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
}

function userRequestedFlowVisualization(content: string): boolean {
  const normalized = content.toLowerCase();
  return /(?:以|用|按).{0,12}flow.{0,12}(?:展示|显示|模式|视图|图)|flow.{0,12}(?:展示|显示|模式|视图|图)|(?:流程图|可视化流程|图形化流程)/i.test(
    normalized,
  );
}

function MessageBody({
  message,
  currentSessionId,
  allowImplicitFlow,
  onMemoryEntryDeleted,
}: {
  message: Message;
  currentSessionId: string | null;
  allowImplicitFlow: boolean;
  onMemoryEntryDeleted: (entryId: string) => void;
}) {
  if (message.type !== "text") {
    return (
      <div>
        <p className="mb-4 text-base text-gray-800">{message.content}</p>
        {message.cardData && (
          <div className="cursor-pointer rounded-2xl bg-white p-5 transition-colors hover:bg-gray-50">
            <div className="mb-2 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">{message.cardData.title}</h3>
                <p className="text-sm text-gray-500">{message.cardData.description}</p>
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-medium text-gray-900">
                {message.cardData.value}
              </span>
              <span
                className={`text-sm font-medium ${
                  message.cardData.change?.startsWith("+") ? "text-[#10a37f]" : "text-red-500"
                }`}
              >
                {message.cardData.change}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (message.role !== "assistant") {
    return <p className="text-base whitespace-pre-wrap text-gray-900">{message.content}</p>;
  }

  if (!message.content) {
    return <StreamingPlaceholder />;
  }

  if (message.streaming) {
    return <p className="whitespace-pre-wrap text-base text-gray-800">{message.content}</p>;
  }

  return (
    <MarkdownMessage
      content={message.content}
      messageId={message.id}
      sessionId={currentSessionId}
      onMemoryEntryDeleted={onMemoryEntryDeleted}
      allowImplicitFlow={allowImplicitFlow}
    />
  );
}

export function MessageList({
  messages,
  currentSessionId,
  copiedMessageId,
  deletingMessageId,
  messagesEndRef,
  onQuote,
  onCopy,
  onDelete,
  onMemoryEntryDeleted,
}: MessageListProps) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-8">
      {messages.map((message, index) => {
        const previousUserMessage = messages
          .slice(0, index)
          .reverse()
          .find((item) => item.role === "user");
        const allowImplicitFlow =
          message.role === "assistant" &&
          Boolean(previousUserMessage?.content) &&
          userRequestedFlowVisualization(previousUserMessage?.content ?? "");

        return (
          <div key={message.id} data-copy-scope="message" className="group space-y-2">
            <div className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`inline-flex max-w-[80%] flex-col ${
                  message.role === "user" ? "ml-auto items-start" : "items-start"
                }`}
              >
                <div data-message-content="true">
                  <MessageBody
                    message={message}
                    currentSessionId={currentSessionId}
                    allowImplicitFlow={allowImplicitFlow}
                    onMemoryEntryDeleted={onMemoryEntryDeleted}
                  />
                </div>
                <div data-copy-row="true" className="mt-2 flex items-center gap-2">
                  {Boolean(message.timestamp) && (
                    <div className="text-xs text-gray-500">{formatTimestamp(message.timestamp)}</div>
                  )}
                  <div
                    data-copy-actions="true"
                    className="flex shrink-0 items-center gap-1.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                  >
                    <button
                      aria-label="引用消息"
                      className="p-1 text-gray-400 transition-colors hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={!message.content.trim()}
                      onClick={() => onQuote(message)}
                      title="引用"
                      type="button"
                    >
                      <MessageSquareQuote className="h-3.5 w-3.5" />
                    </button>
                    <button
                      aria-label="复制消息"
                      className="p-1 text-gray-400 transition-colors hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={!message.content.trim()}
                      onClick={(event) => onCopy(event.currentTarget, message.id, message.content)}
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
                      onClick={() => onDelete(message)}
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
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}
