// Aura AI Command Center Page
import { memo, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import VisualModalTemplate from '@/components/VisualModalTemplate'

// Types
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface PersistedChatState {
  sessionId: string
  messages: Message[]
}

interface MemorySummaryItem {
  role?: string
  content?: string
  createdAt?: string
}

interface MemorySummaryResponse {
  code?: number
  message?: string
  data?: {
    sessionId?: string
    messageCount?: number
    messages?: MemorySummaryItem[]
  }
}

interface Session {
  sessionId: string
  title: string
  status: string
  lastMessageAt: string
  createdAt: string
}

interface SessionsResponse {
  code?: number
  message?: string
  data?: {
    sessions?: Session[]
  }
}

type ProviderId = 'minimax' | 'deepseek' | 'openai'
type AgentRoleId = 'general' | 'architect' | 'coder' | 'reviewer' | 'analyst'
type ModelId =
  | 'MiniMax-M2.7'
  | 'deepseek-chat'
  | 'deepseek-reasoner'
  | 'gpt-5.4'
  | 'gpt-4o-mini'

// Helper to get Beijing time (UTC+8)
const getBeijingTimestamp = (): string => {
  const now = new Date()
  const beijingTime = new Date(now.getTime() + (8 * 60 * 60 * 1000))
  const hours = beijingTime.getUTCHours().toString().padStart(2, '0')
  const minutes = beijingTime.getUTCMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content: '您好，我是 Aura。现在会走真实 Agent 与工具链路，您可以直接提问比如"今日新闻"。',
    timestamp: getBeijingTimestamp(),
  },
]

const SESSION_STORAGE_KEY = 'ai_chat_session_command_center'
const MESSAGES_STORAGE_KEY_PREFIX = 'ai_chat_messages_command_center'

const QUICK_ACTIONS = [
  'Analyze Sector',
  'Risk Assessment', 
  'Execute Trade',
  'Market Pulse',
  'Portfolio Check'
]

const PROVIDERS: { id: ProviderId; name: string }[] = [
  { id: 'minimax', name: 'MiniMax' },
  { id: 'deepseek', name: 'DeepSeek' },
  { id: 'openai', name: 'OpenAI' },
]

const PROVIDER_MODELS: Record<ProviderId, { id: ModelId; name: string }[]> = {
  minimax: [
    { id: 'MiniMax-M2.7', name: 'MiniMax M2.7' },
  ],
  deepseek: [
    { id: 'deepseek-chat', name: 'DeepSeek Chat' },
    { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner' },
  ],
  openai: [
    { id: 'gpt-5.4', name: 'GPT-5.4' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
  ],
}

const AGENT_ROLES: { id: AgentRoleId; name: string }[] = [
  { id: 'general', name: 'General' },
  { id: 'architect', name: 'Architect' },
  { id: 'coder', name: 'Coder' },
  { id: 'reviewer', name: 'Reviewer' },
  { id: 'analyst', name: 'Analyst' },
]

const getAuthToken = (): string => {
  const authStorage = localStorage.getItem('auth-storage')
  if (!authStorage) {
    return ''
  }
  try {
    const authState = JSON.parse(authStorage)
    const accessToken = authState?.state?.accessToken
    return typeof accessToken === 'string' ? accessToken : ''
  } catch {
    return ''
  }
}


const toMessageTimestamp = (value?: string): string => {
  if (!value) {
    return getBeijingTimestamp()
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return getBeijingTimestamp()
  }

  // Convert to Beijing time (UTC+8)
  const beijingTime = new Date(parsed.getTime() + (8 * 60 * 60 * 1000))
  const hours = beijingTime.getUTCHours().toString().padStart(2, '0')
  const minutes = beijingTime.getUTCMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

const normalizeRole = (role?: string): Message['role'] =>
  role === 'user' ? 'user' : 'assistant'

const parsePersistedMessages = (raw: string | null, sessionId: string): Message[] | null => {
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedChatState>
    if (parsed.sessionId !== sessionId || !Array.isArray(parsed.messages)) {
      return null
    }

    const restored = parsed.messages.filter(
      (item): item is Message =>
        Boolean(
          item &&
            typeof item.id === 'string' &&
            (item.role === 'user' || item.role === 'assistant') &&
            typeof item.content === 'string' &&
            typeof item.timestamp === 'string',
        ),
    )

    return restored.length > 0 ? restored : null
  } catch {
    return null
  }
}

const MARKDOWN_COMPONENTS: Components = {
  h1: ({ children }) => (
    <h1 className="mb-2 text-base font-semibold">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 text-[15px] font-semibold">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1 text-sm font-semibold">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="mb-2 last:mb-0 whitespace-pre-wrap">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mb-2 list-disc pl-5 space-y-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 list-decimal pl-5 space-y-1">{children}</ol>
  ),
  li: ({ children }) => <li>{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2">
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded bg-fluid-surface-container-lowest px-1 py-0.5 text-[12px]">
      {children}
    </code>
  ),
}

type SseEvent = {
  readonly eventType: string
  readonly dataRaw: string
}

const parseSseField = (line: string, field: 'event' | 'data'): string | null => {
  const prefix = `${field}:`
  if (!line.startsWith(prefix)) {
    return null
  }
  return line.slice(prefix.length).trimStart()
}

const parseSseEvent = (raw: string): SseEvent | null => {
  if (!raw.trim()) {
    return null
  }

  const lines = raw.split('\n')
  let eventType = 'message'
  const dataParts: string[] = []

  for (const line of lines) {
    const parsedEvent = parseSseField(line, 'event')
    if (parsedEvent !== null) {
      eventType = parsedEvent || 'message'
      continue
    }

    const parsedData = parseSseField(line, 'data')
    if (parsedData !== null) {
      dataParts.push(parsedData)
    }
  }

  const dataRaw = dataParts.join('\n').trim()
  if (!dataRaw) {
    return null
  }

  return { eventType, dataRaw }
}

const decodeSseChunk = (buffer: string, decodedChunk: string): {
  readonly nextBuffer: string
  readonly events: SseEvent[]
} => {
  const combined = buffer + decodedChunk
  const rawChunks = combined.split('\n\n')
  const nextBuffer = rawChunks.pop() || ''
  const events = rawChunks
    .map(parseSseEvent)
    .filter((event): event is SseEvent => event !== null)

  return { nextBuffer, events }
}

const processSseEvent = (
  event: SseEvent,
  assistantMessageId: string,
  updateAssistantMessage: (messageId: string, appendText: string) => void,
): void => {
  try {
    const payload = JSON.parse(event.dataRaw) as { content?: string; message?: string }
    if (event.eventType === 'delta' && payload.content) {
      updateAssistantMessage(assistantMessageId, payload.content)
      return
    }

    if (event.eventType === 'error') {
      throw new Error(payload.message || 'AI 服务异常')
    }
  } catch (err) {
    if (err instanceof Error && event.eventType === 'error') {
      throw err
    }
  }
}

// Components
type ChatMessageProps = {
  readonly message: Message
}

const ChatMessage = memo(function ChatMessage({ message }: Readonly<ChatMessageProps>) {
  const isUser = message.role === 'user'
  
  return (
    <div className={`flex gap-4 ${isUser ? 'justify-end' : ''}`}>
      <div className={`${isUser ? 'max-w-[80%]' : 'flex-1'}`}>
        <div 
          className={`p-4 rounded-xl text-sm leading-relaxed ${
            isUser 
              ? 'bg-fluid-primary/10 rounded-tr-none border border-fluid-primary/20 text-fluid-primary' 
              : 'bg-fluid-surface-container rounded-tl-none border border-fluid-outline-variant/5 text-fluid-text'
          }`}
        >
          {isUser ? (
            message.content
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={MARKDOWN_COMPONENTS}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>
        <span className={`text-[10px] font-mono-data text-fluid-text-dim mt-2 block uppercase ${isUser ? 'text-right' : ''}`}>
          {isUser ? 'You' : 'Aura'} • {message.timestamp}
        </span>
      </div>
    </div>
  )
})

function TypingIndicator() {
  const dotStyle = {
    animationDuration: '1.5s',
  } as const

  return (
    <div className="flex gap-4">
      <div className="flex-1">
        <div className="bg-fluid-surface-container px-4 py-3 rounded-xl rounded-tl-none inline-flex items-center gap-2 border border-fluid-outline-variant/5">
          <span className="flex gap-1.5">
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00F2FF] shadow-[0_0_8px_#00F2FF]"
              style={dotStyle}
            />
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00F2FF] shadow-[0_0_8px_#00F2FF]"
              style={{ ...dotStyle, animationDelay: '0.2s' }}
            />
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00F2FF] shadow-[0_0_8px_#00F2FF]"
              style={{ ...dotStyle, animationDelay: '0.4s' }}
            />
          </span>
          <span
            className="ml-2 animate-pulse text-[10px] font-mono-data uppercase tracking-[0.2em] text-[#00F2FF]"
            style={{ animationDuration: '2s' }}
          >
            Aura is calculating...
          </span>
        </div>
      </div>
    </div>
  )
}

export default function AICommandCenter() {
  const createSessionId = () => `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  const getDefaultModel = (provider: ProviderId): ModelId => PROVIDER_MODELS[provider][0].id
  const [sessionId, setSessionId] = useState<string>(() => {
    const existing = localStorage.getItem(SESSION_STORAGE_KEY)
    if (existing) {
      return existing
    }
    const created = createSessionId()
    localStorage.setItem(SESSION_STORAGE_KEY, created)
    return created
  })
  const messagesStorageKey = `${MESSAGES_STORAGE_KEY_PREFIX}_${sessionId}`
  const [messages, setMessages] = useState<Message[]>(() => {
    const restored = parsePersistedMessages(localStorage.getItem(messagesStorageKey), sessionId)
    return restored ?? INITIAL_MESSAGES
  })
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>('minimax')
  const [selectedModel, setSelectedModel] = useState<ModelId>(() => getDefaultModel('minimax'))
  const [selectedRole] = useState<AgentRoleId>('general')
  const [enableTools] = useState(true)
  const [allowRestrictedTools] = useState(false)
  const [selectedSubAgents] = useState<AgentRoleId[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [showSessionList, setShowSessionList] = useState(false)
  const [deletingSession, setDeletingSession] = useState<Session | null>(null)
  const [deleting, setDeleting] = useState(false)
  const activeRequestRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // Stream control states
  const [streamStatus, setStreamStatus] = useState<'idle' | 'streaming' | 'paused'>('idle')
  const streamStatusRef = useRef(streamStatus)
  const pauseBufferRef = useRef<string>('')
  const currentAssistantIdRef = useRef<string>('')
  
  // Sync streamStatusRef with streamStatus state
  useEffect(() => {
    streamStatusRef.current = streamStatus
  }, [streamStatus])
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }
  
  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])

  useEffect(() => {
    return () => {
      activeRequestRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    const payload: PersistedChatState = {
      sessionId,
      messages,
    }
    localStorage.setItem(messagesStorageKey, JSON.stringify(payload))
  }, [messages, messagesStorageKey, sessionId])

  // Restore messages from server only if localStorage is empty
  // This prevents overwriting local messages when user switches tabs during streaming
  useEffect(() => {
    let cancelled = false

    const hydrateFromMemory = async () => {
      // Check if we already have messages in localStorage
      const localData = localStorage.getItem(messagesStorageKey)
      const parsedLocal = localData ? parsePersistedMessages(localData, sessionId) : null
      
      // If local messages exist and have content, don't overwrite from server
      if (parsedLocal && parsedLocal.length > 0) {
        return
      }

      const token = getAuthToken()
      if (!token) {
        return
      }

      try {
        const response = await fetch(`/api/v1/ai/memory/session/${encodeURIComponent(sessionId)}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          return
        }

        const payload = (await response.json()) as MemorySummaryResponse
        const summaryMessages = payload.data?.messages ?? []
        if (summaryMessages.length === 0) {
          return
        }

        const restoredMessages: Message[] = summaryMessages.map((item, index) => {
          const createdAt = item.createdAt ?? ''
          const sortable = Date.parse(createdAt)
          const suffix = Number.isNaN(sortable) ? index : sortable
          return {
            id: `mem_${suffix}_${index}`,
            role: normalizeRole(item.role),
            content: typeof item.content === 'string' ? item.content : '',
            timestamp: toMessageTimestamp(createdAt),
          }
        })

        if (!cancelled && restoredMessages.length > 0) {
          setMessages(restoredMessages)
        }
      } catch {
        // Keep local messages when memory restore fails.
      }
    }

    void hydrateFromMemory()

    return () => {
      cancelled = true
    }
  }, [sessionId, messagesStorageKey])
  
  const updateAssistantMessage = (messageId: string, appendText: string) => {
    // If paused, buffer the content instead of updating UI
    // Use ref to get latest value since this may be called from async callbacks
    if (streamStatusRef.current === 'paused') {
      pauseBufferRef.current += appendText
      return
    }
    
    setMessages((prev) => {
      const existingIndex = prev.findIndex((msg) => msg.id === messageId)
      if (existingIndex === -1) {
        return [
          ...prev,
          {
            id: messageId,
            role: 'assistant',
            content: appendText,
            timestamp: getBeijingTimestamp(),
          },
        ]
      }
      return prev.map((msg) => {
        if (msg.id !== messageId) {
          return msg
        }

        if (!msg.content) {
          return { ...msg, content: appendText }
        }

        return { ...msg, content: msg.content + appendText }
      })
    })
  }

  const callChatStream = async (userContent: string, assistantMessageId: string) => {
    activeRequestRef.current?.abort()
    const controller = new AbortController()
    activeRequestRef.current = controller

    const now = new Date()
    const localToday = now.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })

    const token = getAuthToken()
    const chatMessages = messages
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({ role: m.role, content: m.content }))

    const body = {
      provider: selectedProvider,
      model: selectedModel,
      sessionId,
      role: selectedRole,
      runtime: {
        enableTools,
        emitEvents: false,
        allowRestrictedTools,
        subAgents: selectedSubAgents.map((role) => ({ role, name: role })),
        mergeStrategy: 'lead-agent-summary',
      },
      messages: [
        {
          role: 'system',
          content: `你是 Aura，回答要准确、简洁。当前本地日期是 ${localToday}。
若可调用工具请优先使用工具获取事实，尤其是新闻与实时信息场景。
当用户询问“今天”时，必须以上述当前日期为准；不得把历史新闻发布日期当作今天。`,
        },
        ...chatMessages,
        { role: 'user', content: userContent },
      ],
    }

    const response = await fetch('/api/v1/ai/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法读取响应流')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }

        const { nextBuffer, events } = decodeSseChunk(buffer, decoder.decode(value, { stream: true }))
        buffer = nextBuffer
        for (const event of events) {
          processSseEvent(event, assistantMessageId, updateAssistantMessage)
        }
      }
    } finally {
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null
      }
    }
  }

  const handleNewSession = () => {
    activeRequestRef.current?.abort()
    const nextSessionId = createSessionId()
    localStorage.setItem(SESSION_STORAGE_KEY, nextSessionId)
    setSessionId(nextSessionId)
    setMessages(INITIAL_MESSAGES)
    setInput('')
    setIsTyping(false)
  }

  const fetchSessions = async () => {
    try {
      const token = getAuthToken()
      const response = await fetch('/api/v1/ai/memory/sessions', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
      const result = (await response.json()) as SessionsResponse
      const fetchedSessions = result.data?.sessions ?? []
      
      // If current session is not in the list, add it as a temporary entry
      const currentSessionExists = fetchedSessions.some(s => s.sessionId === sessionId)
      if (!currentSessionExists) {
        const currentSession: Session = {
          sessionId,
          title: 'Current Session',
          status: 'active',
          lastMessageAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        }
        setSessions([currentSession, ...fetchedSessions])
      } else {
        setSessions(fetchedSessions)
      }
    } catch {
      // If API fails, still show current session
      setSessions([{
        sessionId,
        title: 'Current Session',
        status: 'active',
        lastMessageAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      }])
    }
  }

  const switchSession = (newSessionId: string) => {
    if (newSessionId === sessionId) {
      setShowSessionList(false)
      return
    }
    activeRequestRef.current?.abort()
    localStorage.setItem(SESSION_STORAGE_KEY, newSessionId)
    setSessionId(newSessionId)
    setMessages(INITIAL_MESSAGES)
    setInput('')
    setIsTyping(false)
    setShowSessionList(false)
  }

  const handleDeleteClick = (s: Session, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeletingSession(s)
  }

  const confirmDeleteSession = async () => {
    if (!deletingSession || deleting) return
    setDeleting(true)
    try {
      const token = getAuthToken()
      const response = await fetch(`/api/v1/ai/memory/session/${encodeURIComponent(deletingSession.sessionId)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
      if (response.ok) {
        setSessions((prev) => prev.filter((s) => s.sessionId !== deletingSession.sessionId))
        if (deletingSession.sessionId === sessionId) {
          handleNewSession()
        }
      }
    } catch {
      // Ignore error
    } finally {
      setDeleting(false)
      setDeletingSession(null)
    }
  }

  const handleSend = async () => {
    if (!input.trim()) return
    if (isTyping) return
    const content = input.trim()
    
    setInput('')
    setIsTyping(true)
    setStreamStatus('streaming')

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: getBeijingTimestamp(),
    }

    const assistantId = `a_${Date.now()}`
    currentAssistantIdRef.current = assistantId
    setMessages(prev => [...prev, userMessage])
    try {
      await callChatStream(content, assistantId)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }

      const msg = error instanceof Error ? error.message : 'AI 服务暂不可用'
      setMessages((prev) => {
        const existing = prev.some((m) => m.id === assistantId)
        if (existing) {
          return prev.map((m) => (m.id === assistantId ? { ...m, content: `❌ ${msg}` } : m))
        }
        return [
          ...prev,
          {
            id: assistantId,
            role: 'assistant',
            content: `❌ ${msg}`,
            timestamp: getBeijingTimestamp(),
          },
        ]
      })
    } finally {
      setIsTyping(false)
      setStreamStatus('idle')
      pauseBufferRef.current = ''
      currentAssistantIdRef.current = ''
    }
  }
  
  const handlePause = () => {
    setStreamStatus('paused')
  }
  
  const handleResume = () => {
    setStreamStatus('streaming')
    // Flush buffered content
    if (pauseBufferRef.current && currentAssistantIdRef.current) {
      const buffered = pauseBufferRef.current
      pauseBufferRef.current = ''
      updateAssistantMessage(currentAssistantIdRef.current, buffered)
    }
  }
  
  const handleStop = () => {
    activeRequestRef.current?.abort()
    setStreamStatus('idle')
    setIsTyping(false)
    pauseBufferRef.current = ''
    currentAssistantIdRef.current = ''
  }
  
  const handleQuickAction = (action: string) => {
    setInput(action + ': ')
  }

  return (
    <div className="h-[calc(100vh-100px)] -m-6">
      <section className="h-full w-full bg-fluid-surface-container-low flex flex-col">
        {/* Aura AI Header */}
        <div className="p-6 border-b border-fluid-outline-variant/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-fluid-primary to-fluid-primary-dim flex items-center justify-center glow-primary">
              <span className="material-symbols-outlined text-fluid-surface-container-lowest">auto_awesome</span>
            </div>
            <div>
              <h2 className="font-headline font-bold text-fluid-text tracking-tight">Aura AI</h2>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-fluid-primary rounded-full animate-pulse" />
                <span className="text-[10px] font-mono-data text-fluid-primary uppercase tracking-widest">Active Intelligence</span>
              </div>

            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right text-[10px] font-mono-data uppercase tracking-widest text-fluid-text-dim">
              <div className="inline-flex items-center gap-1">
                <select
                  value={selectedProvider}
                  onChange={(e) => {
                    const nextProvider = e.target.value as ProviderId
                    setSelectedProvider(nextProvider)
                    setSelectedModel(getDefaultModel(nextProvider))
                  }}
                  className="max-w-[86px] cursor-pointer appearance-none border-none bg-transparent p-0 text-[10px] font-mono-data uppercase tracking-widest text-fluid-text-dim outline-none"
                  aria-label="Select provider"
                >
                  {PROVIDERS.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
                <span>·</span>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value as ModelId)}
                  className="max-w-[120px] cursor-pointer appearance-none border-none bg-transparent p-0 text-[10px] font-mono-data uppercase tracking-widest text-fluid-text-dim outline-none"
                  aria-label="Select model"
                >
                  {PROVIDER_MODELS[selectedProvider].map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.id}
                    </option>
                  ))}
                </select>
                <span>· {AGENT_ROLES.find((r) => r.id === selectedRole)?.name}</span>
              </div>
              <div>Tools: {enableTools ? 'On' : 'Off'}</div>
            </div>
            {/* Session History Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  if (!showSessionList) {
                    void fetchSessions()
                  }
                  setShowSessionList(!showSessionList)
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-fluid-outline-variant/30 px-2 py-2 text-[10px] font-mono-data uppercase tracking-widest text-fluid-text-muted transition-colors hover:border-fluid-primary hover:text-fluid-primary"
                title="Session History"
              >
                <span className="material-symbols-outlined text-sm">history</span>
              </button>
              {showSessionList && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowSessionList(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-72 max-h-[210px] overflow-y-auto bg-fluid-surface-container-lowest border border-fluid-outline-variant/30 rounded-lg shadow-lg z-50">
                    <div className="p-2 border-b border-fluid-outline-variant/20">
                      <span className="text-[10px] font-mono-data uppercase tracking-widest text-fluid-text-dim">Recent Sessions</span>
                    </div>
                    {sessions.length === 0 ? (
                      <div className="p-3 text-[11px] text-fluid-text-dim text-center">No sessions found</div>
                    ) : (
                      sessions.map((s) => (
                        <div
                          key={s.sessionId}
                          onClick={() => switchSession(s.sessionId)}
                          className={`flex items-center justify-between px-3 py-2 hover:bg-fluid-primary/10 transition-colors cursor-pointer ${
                            s.sessionId === sessionId ? 'bg-fluid-primary/20' : ''
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] font-medium text-fluid-text truncate">
                              {s.title || s.sessionId}
                            </div>
                            <div className="text-[9px] text-fluid-text-dim mt-0.5">
                              {s.lastMessageAt
                                ? new Date(s.lastMessageAt).toLocaleString('zh-CN', {
                                    month: 'numeric',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                  }).replace(',', '')
                                : 'No messages'}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteClick(s, e)}
                            className="ml-2 p-1 rounded hover:bg-fluid-error/20 text-fluid-text-dim hover:text-fluid-error transition-colors"
                            title="Delete session"
                          >
                            <span className="material-symbols-outlined text-xs">delete</span>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={handleNewSession}
              className="inline-flex items-center gap-1 rounded-lg border border-fluid-outline-variant/30 px-3 py-2 text-[10px] font-mono-data uppercase tracking-widest text-fluid-text-muted transition-colors hover:border-fluid-primary hover:text-fluid-primary"
            >
              <span className="material-symbols-outlined text-sm">add_comment</span>
              New Session
            </button>
          </div>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 scrollbar-hide">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          {isTyping && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input & Quick Actions */}
        <div className="p-6 md:px-8 bg-fluid-surface-container-lowest/50 backdrop-blur-md border-t border-fluid-outline-variant/10">
          {/* Quick Chips */}
          <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
            {QUICK_ACTIONS.map((action) => (
              <button 
                key={action}
                onClick={() => handleQuickAction(action)}
                className="whitespace-nowrap px-3 py-1.5 rounded-full border border-fluid-outline-variant text-[10px] font-mono-data text-fluid-text-muted uppercase tracking-widest hover:border-fluid-primary hover:text-fluid-primary transition-all"
              >
                {action}
              </button>
            ))}
          </div>
          <div className="relative">
            <input 
              className="w-full bg-fluid-surface-container-lowest border border-fluid-outline-variant/30 focus:border-fluid-primary focus:ring-1 focus:ring-fluid-primary/30 rounded-lg px-4 py-4 text-sm font-body text-fluid-text placeholder:text-fluid-text-dim/50 outline-none transition-all pr-28"
              placeholder={streamStatus === 'paused' ? '已暂停...' : streamStatus === 'streaming' ? '生成中...' : 'Command Aura AI...'}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && streamStatus === 'idle' && void handleSend()}
              disabled={streamStatus !== 'idle'}
            />
            {/* Control Buttons */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {streamStatus === 'streaming' && (
                <>
                  {/* Pause Button */}
                  <button
                    onClick={handlePause}
                    className="w-10 h-10 bg-fluid-tertiary/20 text-fluid-tertiary rounded-lg flex items-center justify-center hover:bg-fluid-tertiary/30 active:scale-95 transition-all"
                    title="暂停生成"
                  >
                    <span className="material-symbols-outlined">pause</span>
                  </button>
                  {/* Stop Button */}
                  <button
                    onClick={handleStop}
                    className="w-10 h-10 bg-fluid-secondary/20 text-fluid-secondary rounded-lg flex items-center justify-center hover:bg-fluid-secondary/30 active:scale-95 transition-all"
                    title="停止生成"
                  >
                    <span className="material-symbols-outlined">stop</span>
                  </button>
                </>
              )}
              
              {streamStatus === 'paused' && (
                <>
                  {/* Resume Button */}
                  <button
                    onClick={handleResume}
                    className="w-10 h-10 bg-fluid-primary/20 text-fluid-primary rounded-lg flex items-center justify-center hover:bg-fluid-primary/30 active:scale-95 transition-all"
                    title="继续生成"
                  >
                    <span className="material-symbols-outlined">play_arrow</span>
                  </button>
                  {/* Stop Button */}
                  <button
                    onClick={handleStop}
                    className="w-10 h-10 bg-fluid-secondary/20 text-fluid-secondary rounded-lg flex items-center justify-center hover:bg-fluid-secondary/30 active:scale-95 transition-all"
                    title="停止生成"
                  >
                    <span className="material-symbols-outlined">stop</span>
                  </button>
                </>
              )}
              
              {streamStatus === 'idle' && (
                <button 
                  onClick={() => void handleSend()}
                  disabled={!input.trim()}
                  className="w-10 h-10 bg-fluid-primary text-fluid-surface-container-lowest rounded-lg flex items-center justify-center shadow-lg shadow-fluid-primary/20 hover:shadow-glow-primary active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined">send</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Delete Session Confirmation Modal */}
      <VisualModalTemplate
        open={!!deletingSession}
        onClose={() => {
          if (!deleting) {
            setDeletingSession(null)
          }
        }}
        closeAriaLabel="关闭删除会话确认弹窗"
        title="确认删除会话？"
        description={`会话 "${deletingSession?.title || deletingSession?.sessionId}" 将被永久删除，该操作不可撤销。`}
        accent="secondary"
        icon={
          <span className="material-symbols-outlined text-3xl">delete_forever</span>
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => setDeletingSession(null)}
              disabled={deleting}
              className="px-6 py-3 font-mono-data text-[10px] uppercase tracking-[0.2em] text-fluid-text-dim transition-all duration-300 hover:bg-fluid-surface-higher disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void confirmDeleteSession()}
              disabled={deleting}
              className="bg-fluid-secondary px-6 py-3 font-mono-data text-[10px] uppercase tracking-[0.2em] text-fluid-surface transition-all duration-300 hover:bg-fluid-secondary-bright disabled:opacity-60"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </>
        }
      />
    </div>
  )
}
