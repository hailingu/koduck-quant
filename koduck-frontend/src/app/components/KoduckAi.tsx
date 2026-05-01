import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import { isAuthExpiredError, throwAuthExpired } from "../auth";
import { FALLBACK_LLM_OPTIONS, RUNTIME_CONFIG_URL, normalizeLlmOptions } from "./koduck-ai/llm-config";
import { KoduckAiComposer } from "./koduck-ai/KoduckAiComposer";
import { MessageList } from "./koduck-ai/MessageList";
import {
  MAX_HISTORY_MESSAGES,
  clearPendingChatStream,
  clearStoredMessages,
  isCursorOnFirstLine,
  isCursorOnLastLine,
  persistActiveSessionId,
  persistPendingChatStream,
  persistPromptHistory,
  persistSessionIdToUrl,
  persistSessionMessages,
  pushPromptHistoryEntry,
  readActiveSessionId,
  readPendingChatStream,
  readPromptHistory,
  readSessionIdFromUrl,
  readStoredMessages,
} from "./koduck-ai/storage";
import { fetchSessionExists, fetchSessionTranscript } from "./koduck-ai/session-api";
import {
  STREAM_INITIAL_IDLE_TIMEOUT_MS,
  STREAM_POST_CONTENT_IDLE_TIMEOUT_MS,
  STREAM_REQUEST_TIMEOUT_MS,
  logStreamTrace,
  parseSseBlocks,
  toUserVisibleStreamErrorMessage,
} from "./koduck-ai/streaming";
import type {
  ApiErrorEnvelope,
  ChatHistoryMessage,
  ConversationFlowStep,
  LlmOptionsConfig,
  LlmProvider,
  Message,
  PendingChatStream,
  StreamEventData,
  UploadedFile,
} from "./koduck-ai/types";

export function KoduckAi() {
  const initialSessionIdRef = useRef<string | null>(readSessionIdFromUrl() ?? readActiveSessionId());
  const initialSessionId = initialSessionIdRef.current;
  const [chatMessage, setChatMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [promptHistory, setPromptHistory] = useState<string[]>(() => readPromptHistory());
  const [promptHistoryIndex, setPromptHistoryIndex] = useState<number | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(initialSessionId);
  const [llmOptions, setLlmOptions] = useState<LlmOptionsConfig>(FALLBACK_LLM_OPTIONS);
  const [selectedProvider, setSelectedProvider] = useState<LlmProvider>(
    FALLBACK_LLM_OPTIONS.defaultProvider,
  );
  const [selectedModel, setSelectedModel] = useState(
    FALLBACK_LLM_OPTIONS.modelOptionsByProvider[FALLBACK_LLM_OPTIONS.defaultProvider][0].value,
  );
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
  const activeChatAbortControllerRef = useRef<AbortController | null>(null);
  const resumedPendingSessionIdsRef = useRef<Set<string>>(new Set());
  const skipNextSessionRestoreRef = useRef(false);
  const draftBeforePromptHistoryRef = useRef("");
  const pendingQuoteRef = useRef<Message["quote"] | null>(null);
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
    if (messages.length === 0) {
      setComposerHeight(0);
      return;
    }

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
  }, [messages.length]);

  useEffect(() => {
    if (composerHeight > 0) {
      scrollToBottom("auto");
    }
  }, [composerHeight]);

  useEffect(() => {
    persistPromptHistory(promptHistory);
  }, [promptHistory]);

  useEffect(() => {
    const controller = new AbortController();

    const loadRuntimeConfig = async () => {
      try {
        const response = await fetch(RUNTIME_CONFIG_URL, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`runtime config request failed: ${response.status}`);
        }
        const config = await response.json();
        if (!controller.signal.aborted) {
          setLlmOptions(normalizeLlmOptions(config));
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.warn("Failed to load runtime config; using bundled LLM defaults.", error);
        }
      }
    };

    void loadRuntimeConfig();

    return () => {
      controller.abort();
    };
  }, []);

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
        const pendingStream = readPendingChatStream(initialSessionId);
        if (pendingStream) {
          skipNextSessionRestoreRef.current = true;
          restorePendingStreamMessages(pendingStream);
        } else {
          clearStoredMessages(initialSessionId);
          if (readActiveSessionId() === initialSessionId) {
            persistActiveSessionId(null);
          }
          if (currentSessionIdRef.current === initialSessionId) {
            activateSession(null);
            setMessages([]);
          }
        }
      } else {
        const transcriptMessages = await fetchSessionTranscript(
          initialSessionId,
          controller.signal,
        );
        if (controller.signal.aborted) {
          return;
        }
        skipNextSessionRestoreRef.current = true;
        if (transcriptMessages) {
          setMessages(transcriptMessages);
        } else {
          clearStoredMessages(initialSessionId);
          setMessages([]);
        }
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
    if (!sessionHydrated || !currentSessionId) {
      return;
    }

    if (resumedPendingSessionIdsRef.current.has(currentSessionId)) {
      return;
    }

    const pendingStream = readPendingChatStream(currentSessionId);
    if (!pendingStream) {
      return;
    }

    resumedPendingSessionIdsRef.current.add(currentSessionId);
    void resumePendingChatStream(pendingStream);
  }, [currentSessionId, sessionHydrated]);

  useEffect(() => {
    if (!llmOptions.providerOptions.some((provider) => provider.value === selectedProvider)) {
      setSelectedProvider(llmOptions.defaultProvider);
      return;
    }

    const availableModels = llmOptions.modelOptionsByProvider[selectedProvider] ?? [];
    if (
      availableModels.length > 0 &&
      !availableModels.some((model) => model.value === selectedModel)
    ) {
      setSelectedModel(availableModels[0].value);
    }
  }, [llmOptions, selectedProvider, selectedModel]);

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

  const restorePendingStreamMessages = (pendingStream: PendingChatStream) => {
    setMessages((prev) => {
      const withoutPending = prev.filter(
        (message) =>
          message.id !== pendingStream.userMessage.id &&
          message.id !== pendingStream.assistantMessageId,
      );
      return [
        ...withoutPending,
        pendingStream.userMessage,
        {
          ...pendingStream.assistantMessage,
          content: pendingStream.streamedText || pendingStream.assistantMessage.content,
          streaming: true,
        },
      ];
    });
  };

  const deleteMemoryEntryById = async (sessionId: string, entryId: string) => {
    const token = window.localStorage.getItem("koduck.auth.token");
    console.info("[koduck-ai][memory-delete][api-request]", { sessionId, entryId });
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

    console.info("[koduck-ai][memory-delete][api-response]", {
      sessionId,
      entryId,
      status: response.status,
      ok: response.ok,
    });

    if (response.status === 404) {
      console.warn("[koduck-ai][memory-delete][api-not-found]", { sessionId, entryId });
      return;
    }

    if (!response.ok) {
      throw new Error(await extractApiErrorMessage(response));
    }
  };

  const resolveLegacyFlowNodeEntryId = (
    step: ConversationFlowStep | undefined,
    transcriptMessages: Message[],
  ): string | null => {
    if (!step) {
      return null;
    }

    const legacyNodeMatch = /^msg_(\d+)$/.exec(step.id);
    if (!legacyNodeMatch) {
      return null;
    }

    const legacySequenceNum = Number.parseInt(legacyNodeMatch[1], 10);
    const transcriptIndex = legacySequenceNum - 1;
    const resolvedMessage =
      transcriptMessages.find((message) => message.sequenceNum === legacySequenceNum) ??
      transcriptMessages[transcriptIndex];
    const resolvedEntryId = resolvedMessage?.memoryEntryId ?? null;
    console.info("[koduck-ai][memory-delete][resolve-legacy-flow-node]", {
      nodeId: step.id,
      stepName: step.name,
      legacySequenceNum,
      transcriptIndex,
      transcriptCount: transcriptMessages.length,
      resolvedEntryId,
      resolvedMessage: resolvedMessage
        ? {
            id: resolvedMessage.id,
            role: resolvedMessage.role,
            sequenceNum: resolvedMessage.sequenceNum,
            timestamp: resolvedMessage.timestamp,
            requestId: resolvedMessage.requestId,
            traceId: resolvedMessage.traceId,
            contentPreview: resolvedMessage.content.slice(0, 160),
          }
        : null,
    });

    return resolvedEntryId;
  };

  const handleMemoryEntryDeleted = async (
    entryId: string | null,
    flowStep?: ConversationFlowStep,
  ) => {
    const sessionId = currentSessionIdRef.current;
    if (!sessionId) {
      if (entryId) {
        setMessages((prev) => prev.filter((message) => message.memoryEntryId !== entryId));
      }
      return;
    }

    const latestMessages = (await fetchSessionTranscript(sessionId)) ?? messages;
    const resolvedEntryId = entryId ?? resolveLegacyFlowNodeEntryId(flowStep, latestMessages);
    if (!resolvedEntryId) {
      console.info("[koduck-ai][memory-delete][local-flow-node-only]", {
        sessionId,
        entryId,
        flowStepId: flowStep?.id,
        stepName: flowStep?.name,
        transcriptCount: latestMessages.length,
      });
      return;
    }

    const targetMessage = latestMessages.find((message) => message.memoryEntryId === resolvedEntryId);
    console.info("[koduck-ai][memory-delete][resolve-group]", {
      sessionId,
      entryId: resolvedEntryId,
      originalEntryId: entryId,
      flowStepId: flowStep?.id,
      transcriptCount: latestMessages.length,
      target: targetMessage
        ? {
            id: targetMessage.id,
            role: targetMessage.role,
            timestamp: targetMessage.timestamp,
            requestId: targetMessage.requestId,
            traceId: targetMessage.traceId,
            contentPreview: targetMessage.content.slice(0, 120),
        }
        : null,
    });

    const relatedEntryIds = new Set<string>([resolvedEntryId]);
    if (targetMessage?.requestId || targetMessage?.traceId) {
      latestMessages.forEach((message) => {
        if (
          message.memoryEntryId &&
          ((targetMessage.requestId && message.requestId === targetMessage.requestId) ||
            (targetMessage.traceId && message.traceId === targetMessage.traceId))
        ) {
          relatedEntryIds.add(message.memoryEntryId);
        }
      });
    }
    console.info("[koduck-ai][memory-delete][delete-group]", {
      sessionId,
      entryId: resolvedEntryId,
      originalEntryId: entryId,
      relatedEntryIds: [...relatedEntryIds],
      relatedMessages: latestMessages
        .filter((message) => relatedEntryIds.has(message.memoryEntryId ?? ""))
        .map((message) => ({
          entryId: message.memoryEntryId,
          role: message.role,
          requestId: message.requestId,
          traceId: message.traceId,
          contentPreview: message.content.slice(0, 120),
        })),
    });

    clearStoredMessages(sessionId);
    setMessages((prev) => prev.filter((message) => !relatedEntryIds.has(message.memoryEntryId ?? "")));
    for (const relatedEntryId of relatedEntryIds) {
      await deleteMemoryEntryById(sessionId, relatedEntryId);
    }
    void syncSessionMessagesFromMemory(sessionId);
  };

  const buildHistoryMessages = (): ChatHistoryMessage[] =>
    messages
      .filter((message) => !message.streaming && message.content.trim())
      .slice(-MAX_HISTORY_MESSAGES)
      .map((message) => ({
        role: message.role,
        content: message.content,
        ...(message.memoryEntryId ? { memoryEntryId: message.memoryEntryId } : {}),
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
        const response = await fetch(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}`, {
          method: "DELETE",
          headers: {
            Accept: "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (response.status === 401) {
          throwAuthExpired();
        }
      } catch {
        // Best-effort: still clear local state even if backend delete fails
      }
    }
    clearStoredMessages(sessionId);
    clearPendingChatStream(sessionId);
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
    if (response.status === 401) {
      throwAuthExpired();
    }

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

  const quoteMessage = (message: Message) => {
    const normalizedContent = normalizeCopyContent(message.content);
    if (!normalizedContent) {
      return;
    }

    const quotedText = normalizedContent
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
    const nextMessage = chatMessage.trim()
      ? `${chatMessage.trimEnd()}\n\n${quotedText}\n\n`
      : `${quotedText}\n\n`;

    setPromptHistoryIndex(null);
    draftBeforePromptHistoryRef.current = "";
    pendingQuoteRef.current = {
      messageId: message.id,
      memoryEntryId: message.memoryEntryId,
      role: message.role,
      content: normalizedContent,
    };
    setChatMessage(nextMessage);

    window.requestAnimationFrame(() => {
      const target = chatInputRef.current;
      if (!target) {
        return;
      }
      target.focus();
      resizeChatInput(target);
      const cursorPosition = target.value.length;
      target.setSelectionRange(cursorPosition, cursorPosition);
    });
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

  const resumePendingChatStream = async (pendingStream: PendingChatStream) => {
    if (sending || activeChatAbortControllerRef.current) {
      return;
    }

    restorePendingStreamMessages(pendingStream);
    setSending(true);

    const localRequestId = `web-resume-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const abortController = new AbortController();
    activeChatAbortControllerRef.current = abortController;
    let shouldAbortRequest = true;
    const requestTimeoutId = window.setTimeout(() => {
      abortController.abort("chat stream request timeout");
    }, STREAM_REQUEST_TIMEOUT_MS);
    let streamedText = pendingStream.streamedText;
    let streamErrorMessage = "";
    let upstreamRequestId: string | null = null;
    let lastSequenceNum = pendingStream.lastSequenceNum;
    let streamEstablished = false;

    logStreamTrace(localRequestId, "resume_start", {
      sessionId: pendingStream.sessionId,
      assistantMessageId: pendingStream.assistantMessageId,
      fromSequenceNum: pendingStream.lastSequenceNum,
      restoredLength: streamedText.length,
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
          message: pendingStream.prompt,
          session_id: pendingStream.sessionId,
          provider: pendingStream.provider,
          model: pendingStream.model,
          history: pendingStream.history,
          metadata: pendingStream.metadata,
          from_sequence_num: pendingStream.lastSequenceNum,
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

      while (!streamCompleted) {
        const idleTimeoutMs = streamedText.trim()
          ? STREAM_POST_CONTENT_IDLE_TIMEOUT_MS
          : STREAM_INITIAL_IDLE_TIMEOUT_MS;
        const { done, value } = await readStreamChunkWithTimeout(reader, idleTimeoutMs);
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

          upstreamRequestId = eventData.request_id ?? upstreamRequestId;
          lastSequenceNum =
            typeof eventData.sequence_num === "number"
              ? eventData.sequence_num
              : lastSequenceNum;

          if (block.event === "message" && eventData.payload?.text) {
            streamedText += eventData.payload.text;
            const nextAssistantMessage: Message = {
              ...pendingStream.assistantMessage,
              content: streamedText,
              timestamp: pendingStream.assistantMessage.timestamp || Date.now(),
              streaming: true,
              type: "text",
            };
            updateAssistantMessage(pendingStream.assistantMessageId, () => nextAssistantMessage);
            persistPendingChatStream({
              ...pendingStream,
              assistantMessage: nextAssistantMessage,
              lastSequenceNum,
              streamedText,
              updatedAt: Date.now(),
            });
          }

          if (block.event === "done") {
            updateAssistantMessage(pendingStream.assistantMessageId, (prev) => ({
              ...prev,
              content: streamedText || prev.content || "回答已完成。",
              timestamp: prev.timestamp || Date.now(),
              streaming: false,
            }));
            streamCompleted = true;
            clearPendingChatStream(pendingStream.sessionId);
            await reader.cancel();
            break;
          }

          if (block.event === "error") {
            streamErrorMessage =
              eventData.payload?.message?.trim() || "生成过程中发生异常，请稍后重试。";
            updateAssistantMessage(pendingStream.assistantMessageId, (prev) => ({
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
            clearPendingChatStream(pendingStream.sessionId);
            await reader.cancel();
            break;
          }
        }
      }

      window.clearTimeout(requestTimeoutId);

      if (!streamCompleted && streamedText.trim()) {
        updateAssistantMessage(pendingStream.assistantMessageId, (prev) => ({
          ...prev,
          content:
            streamedText +
            (streamErrorMessage
              ? `\n\n回答提前结束：${streamErrorMessage}`
              : "\n\n回答提前结束：刷新后重连中断，请重试一次。"),
          timestamp: prev.timestamp || Date.now(),
          streaming: false,
          type: "text",
        }));
        clearPendingChatStream(pendingStream.sessionId);
      }

      if (streamCompleted) {
        await syncSessionMessagesFromMemory(pendingStream.sessionId);
      }
      shouldAbortRequest = false;
    } catch (error) {
      if (abortController.signal.aborted) {
        const stoppedByUser = abortController.signal.reason === "chat stream user stopped";
        updateAssistantMessage(pendingStream.assistantMessageId, (prev) => ({
          ...prev,
          content: streamedText.trim()
            ? `${streamedText}\n\n${stoppedByUser ? "已终止生成。" : "刷新后生成连接已中断，请重试一次。"}`
            : stoppedByUser
              ? "已终止本轮请求。"
              : "刷新后生成连接已中断，请重试一次。",
          timestamp: prev.timestamp || Date.now(),
          streaming: false,
          type: "text",
        }));
        clearPendingChatStream(pendingStream.sessionId);
        shouldAbortRequest = false;
        return;
      }

      logStreamTrace(localRequestId, "resume_error", {
        sessionId: pendingStream.sessionId,
        upstreamRequestId,
        sequenceNum: lastSequenceNum,
        streamEstablished,
        totalLength: streamedText.length,
        message: error instanceof Error ? error.message : String(error),
      });
      updateAssistantMessage(pendingStream.assistantMessageId, (prev) => ({
        ...prev,
        content: streamedText.trim()
          ? `${streamedText}\n\n刷新后未能继续连接生成流，请重试一次。`
          : "刷新后未能继续连接生成流，请重试一次。",
        timestamp: prev.timestamp || Date.now(),
        streaming: false,
        type: "text",
      }));
      clearPendingChatStream(pendingStream.sessionId);
      shouldAbortRequest = false;
    } finally {
      window.clearTimeout(requestTimeoutId);
      if (shouldAbortRequest && !abortController.signal.aborted) {
        abortController.abort("chat stream resume cleanup");
      }
      if (activeChatAbortControllerRef.current === abortController) {
        activeChatAbortControllerRef.current = null;
      }
      setSending(false);
    }
  };

  const handleSendMessage = async () => {
    const content = chatMessage.trim();
    if (!content || sending) {
      return;
    }
    const quotedMessage = pendingQuoteRef.current;

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
      quote: quotedMessage ?? undefined,
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
    const historyMessages = buildHistoryMessages();
    const requestMetadata = {
      enablePlanCanvas: true,
      planMode: "collaborative",
      ...(quotedMessage?.messageId
        ? { quoted_message_id: quotedMessage.messageId }
        : {}),
      ...(quotedMessage?.memoryEntryId
        ? { quoted_memory_entry_id: quotedMessage.memoryEntryId }
        : {}),
      ...(quotedMessage
        ? {
            quoted_role: quotedMessage.role,
            quoted_content: quotedMessage.content,
          }
        : {}),
    };
    setPromptHistory((prev) => pushPromptHistoryEntry(prev, content));
    setPromptHistoryIndex(null);
    draftBeforePromptHistoryRef.current = "";
    pendingQuoteRef.current = null;
    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    persistPendingChatStream({
      sessionId,
      assistantMessageId,
      userMessage,
      assistantMessage: assistantPlaceholder,
      prompt: content,
      provider: selectedProvider,
      model: selectedModel,
      history: historyMessages,
      metadata: requestMetadata,
      lastSequenceNum: 0,
      streamedText: "",
      updatedAt: Date.now(),
    });
    setChatMessage("");
    setSending(true);
    const localRequestId = `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const abortController = new AbortController();
    activeChatAbortControllerRef.current = abortController;
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
          history: historyMessages,
          metadata: requestMetadata,
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
            persistPendingChatStream({
              sessionId,
              assistantMessageId,
              userMessage,
              assistantMessage: {
                ...assistantPlaceholder,
                content: nextText,
                timestamp: Date.now(),
                streaming: true,
              },
              prompt: content,
              provider: selectedProvider,
              model: selectedModel,
              history: historyMessages,
              metadata: requestMetadata,
              lastSequenceNum: lastSequenceNum ?? 0,
              streamedText: nextText,
              updatedAt: Date.now(),
            });
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
            clearPendingChatStream(sessionId);
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
            clearPendingChatStream(sessionId);
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
        clearPendingChatStream(sessionId);
        streamCompleted = true;
      }

      if (streamCompleted && !streamedText.trim()) {
        logStreamTrace(localRequestId, "request_complete", {
          sessionId,
          upstreamRequestId,
          sequenceNum: lastSequenceNum,
          totalLength: streamedText.length,
          streamCompleted,
        });
        shouldAbortRequest = false;
        return;
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
      if (
        abortController.signal.aborted &&
        abortController.signal.reason === "chat stream user stopped"
      ) {
        logStreamTrace(localRequestId, "request_stopped_by_user", {
          sessionId,
          upstreamRequestId,
          sequenceNum: lastSequenceNum,
          totalLength: streamedText.length,
        });
        updateAssistantMessage(assistantMessageId, (prev) => ({
          ...prev,
          content: streamedText.trim()
            ? `${streamedText}\n\n已终止生成。`
            : "已终止本轮请求。",
          timestamp: prev.timestamp || Date.now(),
          streaming: false,
          type: "text",
        }));
        clearPendingChatStream(sessionId);
        shouldAbortRequest = false;
        return;
      }

      if (isAuthExpiredError(error)) {
        updateAssistantMessage(assistantMessageId, (prev) => ({
          ...prev,
          content: error.message,
          timestamp: prev.timestamp || Date.now(),
          streaming: false,
          type: "text",
        }));
        clearPendingChatStream(sessionId);
        shouldAbortRequest = false;
        return;
      }

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
        clearPendingChatStream(sessionId);
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
        clearPendingChatStream(sessionId);
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
      clearPendingChatStream(sessionId);
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
      if (activeChatAbortControllerRef.current === abortController) {
        activeChatAbortControllerRef.current = null;
      }
      setSending(false);
    }
  };

  const handleStopMessage = () => {
    activeChatAbortControllerRef.current?.abort("chat stream user stopped");
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

    if (!value.includes(">")) {
      pendingQuoteRef.current = null;
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
    <KoduckAiComposer
      chatInputRef={chatInputRef}
      chatMessage={chatMessage}
      llmOptions={llmOptions}
      selectedProvider={selectedProvider}
      selectedModel={selectedModel}
      uploadedFiles={uploadedFiles}
      sending={sending}
      onFilePickerClick={() => fileInputRef.current?.click()}
      onMessageChange={handleChatInputChange}
      onKeyDown={handleChatInputKeyDown}
      onProviderChange={setSelectedProvider}
      onModelChange={setSelectedModel}
      onRemoveFile={removeFile}
      onSend={() => void handleSendMessage()}
      onStop={handleStopMessage}
    />
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
              ? "items-center justify-start pt-[28vh]"
              : "justify-start pt-8"
          }`}
          style={
            messages.length === 0 && composerHeight > 0
              ? { minHeight: `calc(100% - ${composerHeight}px)` }
              : undefined
          }
        >
          {messages.length === 0 ? (
            <div className="mx-auto w-full max-w-3xl">
              <h1 className="mb-8 text-center text-3xl font-normal text-gray-800">
                {currentSessionId ? "新会话已创建" : "开始对话"}
              </h1>
              <div className="w-full max-w-4xl px-4">{renderInputBar()}</div>
            </div>
          ) : (
            <MessageList
              messages={messages}
              currentSessionId={currentSessionId}
              copiedMessageId={copiedMessageId}
              deletingMessageId={deletingMessageId}
              messagesEndRef={messagesEndRef}
              onQuote={quoteMessage}
              onCopy={(trigger, messageId, content) => {
                void copyMessage(trigger, messageId, content);
              }}
              onDelete={(message) => {
                void deleteMessage(message);
              }}
              onMemoryEntryDeleted={handleMemoryEntryDeleted}
            />
          )}
        </div>
      </div>

      {messages.length > 0 && (
        <div
          ref={composerDockRef}
          className="pointer-events-none fixed inset-x-0 bottom-0 z-20 bg-transparent"
        >
          <div className="pointer-events-auto mx-auto w-full max-w-4xl px-4 pb-4 pt-3">
            {renderInputBar()}
          </div>
        </div>
      )}
    </main>
  );
}
