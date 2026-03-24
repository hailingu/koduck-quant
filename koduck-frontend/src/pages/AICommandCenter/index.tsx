// Aura AI Command Center Page
import { memo, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Types
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface FlowItem {
  source: string
  asset: string
  amount: string
  time: string
}

type ProviderId = 'minimax' | 'deepseek' | 'openai'
type AgentRoleId = 'general' | 'architect' | 'coder' | 'reviewer' | 'analyst'

// Mock data
const MOCK_FLOWS: FlowItem[] = [
  { source: 'Pool_X92', asset: '$WETH', amount: '1,240.00', time: 'Just Now' },
  { source: 'Vault_Gamma', asset: '$USDC', amount: '500,000.00', time: '2m ago' },
  { source: 'Liquid_Alpha', asset: '$ARB', amount: '12,500.00', time: '5m ago' },
  { source: 'Pool_Beta', asset: '$BTC', amount: '2.450', time: '8m ago' },
  { source: 'Vault_Delta', asset: '$USDT', amount: '1,200,000.00', time: '12m ago' },
]

const INITIAL_MESSAGES: Message[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content: '您好，我是 Aura。现在会走真实 Agent 与工具链路，您可以直接提问比如“今日新闻”。',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  },
]

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

const createTimestamp = (): string =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const CHART_BARS: ReadonlyArray<{ readonly id: string; readonly height: number }> = [
  { id: 'bar-01', height: 40 },
  { id: 'bar-02', height: 55 },
  { id: 'bar-03', height: 45 },
  { id: 'bar-04', height: 70 },
  { id: 'bar-05', height: 60 },
  { id: 'bar-06', height: 85 },
  { id: 'bar-07', height: 95 },
  { id: 'bar-08', height: 75 },
  { id: 'bar-09', height: 60 },
  { id: 'bar-10', height: 80 },
  { id: 'bar-11', height: 50 },
  { id: 'bar-12', height: 65 },
  { id: 'bar-13', height: 40 },
  { id: 'bar-14', height: 55 },
  { id: 'bar-15', height: 70 },
  { id: 'bar-16', height: 85 },
  { id: 'bar-17', height: 60 },
  { id: 'bar-18', height: 75 },
  { id: 'bar-19', height: 50 },
  { id: 'bar-20', height: 40 },
]

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

type FlowTableProps = {
  readonly flows: FlowItem[]
}

// Components
function ChartBars() {
  return (
    <div className="h-64 flex items-end gap-1 relative">
      {CHART_BARS.map((bar) => (
        <div 
          key={bar.id}
          className="flex-1 bg-fluid-primary/30 hover:bg-fluid-primary/50 rounded-t-sm transition-all duration-300"
          style={{ height: `${bar.height}%` }}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-fluid-surface via-transparent to-transparent pointer-events-none" />
    </div>
  )
}

function FlowTable({ flows }: Readonly<FlowTableProps>) {
  return (
    <div className="glass-panel rounded-xl overflow-hidden">
      <div className="p-4 border-b border-fluid-outline-variant/10 flex justify-between items-center">
        <span className="font-mono-data text-xs uppercase tracking-widest text-fluid-text-muted">Recent Flows</span>
        <span className="material-symbols-outlined text-fluid-text-muted text-sm">filter_list</span>
      </div>
      <div className="p-2">
        <div className="grid grid-cols-4 p-4 text-[10px] font-mono-data text-fluid-text-muted uppercase tracking-widest border-b border-fluid-outline-variant/5">
          <span>Source</span>
          <span>Asset</span>
          <span>Amount</span>
          <span className="text-right">Time</span>
        </div>
        <div className="space-y-1 mt-2">
          {flows.map((flow) => (
            <div 
              key={`${flow.source}-${flow.asset}-${flow.time}`}
              className="grid grid-cols-4 p-4 text-xs font-mono-data items-center hover:bg-fluid-surface-container transition-colors rounded-lg cursor-pointer"
            >
              <span className="text-fluid-primary">{flow.source}</span>
              <span className="text-fluid-text">{flow.asset}</span>
              <span className="text-fluid-text">{flow.amount}</span>
              <span className="text-right text-fluid-text-dim">{flow.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MarketSentiment() {
  return (
    <div className="glass-panel rounded-xl p-6 flex flex-col justify-between h-full">
      <span className="font-mono-data text-xs uppercase tracking-widest text-fluid-text-muted">Market Sentiment</span>
      <div className="py-4">
        <h3 className="font-headline text-4xl font-bold text-fluid-tertiary tracking-tight">Greed</h3>
        <p className="font-body text-sm text-fluid-text-muted mt-1">Capital inflow increasing across L2 sectors.</p>
      </div>
      <div className="w-full bg-fluid-outline-variant/20 h-1 rounded-full overflow-hidden">
        <div className="bg-fluid-tertiary h-full w-[72%] transition-all duration-1000" />
      </div>
    </div>
  )
}

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
  const storageKey = 'ai_chat_session_command_center'
  const createSessionId = () => `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  const [sessionId] = useState<string>(() => {
    const existing = localStorage.getItem(storageKey)
    if (existing) {
      return existing
    }
    const created = createSessionId()
    localStorage.setItem(storageKey, created)
    return created
  })
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [selectedProvider] = useState<ProviderId>('minimax')
  const [selectedRole] = useState<AgentRoleId>('general')
  const [enableTools] = useState(true)
  const [allowRestrictedTools] = useState(false)
  const [selectedSubAgents] = useState<AgentRoleId[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }
  
  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])
  
  const updateAssistantMessage = (messageId: string, appendText: string) => {
    setMessages((prev) => {
      const existingIndex = prev.findIndex((msg) => msg.id === messageId)
      if (existingIndex === -1) {
        return [
          ...prev,
          {
            id: messageId,
            role: 'assistant',
            content: appendText,
            timestamp: createTimestamp(),
          },
        ]
      }
      return prev.map((msg) => (msg.id === messageId ? { ...msg, content: msg.content + appendText } : msg))
    })
  }

  const callChatStream = async (userContent: string, assistantMessageId: string) => {
    const token = getAuthToken()
    const chatMessages = messages
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({ role: m.role, content: m.content }))

    const body = {
      provider: selectedProvider,
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
          content:
            '你是 Aura，回答要准确、简洁。若可调用工具请优先使用工具获取事实，尤其是新闻与实时信息场景。',
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
  }

  const handleSend = async () => {
    if (!input.trim()) return
    if (isTyping) return
    const content = input.trim()
    
    setInput('')
    setIsTyping(true)

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: createTimestamp(),
    }

    const assistantId = `a_${Date.now()}`
    setMessages(prev => [...prev, userMessage])
    try {
      await callChatStream(content, assistantId)
    } catch (error) {
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
            timestamp: createTimestamp(),
          },
        ]
      })
    } finally {
      setIsTyping(false)
    }
  }
  
  const handleQuickAction = (action: string) => {
    setInput(action + ': ')
  }

  return (
    <div className="h-[calc(100vh-100px)] flex -m-6">
      {/* Left Column: Market Context */}
      <section className="flex-1 p-8 overflow-y-auto border-r border-fluid-outline-variant/10">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Hero Metrics Header */}
          <div className="flex justify-between items-end">
            <div>
              <h1 className="font-headline text-4xl font-bold tracking-tighter text-fluid-text">
                Command Center
              </h1>
              <p className="text-fluid-text-muted font-body mt-2">Aggregated Liquidity Pulse & Market Flux</p>
            </div>
            <div className="text-right">
              <span className="font-mono-data text-xs uppercase tracking-widest text-fluid-text-muted">System Latency</span>
              <p className="font-mono-data text-xl text-fluid-primary">14ms</p>
            </div>
          </div>
          
          {/* Bento Grid Data Viz */}
          <div className="grid grid-cols-12 gap-5">
            {/* Major Pair Chart */}
            <div className="col-span-8 glass-panel rounded-xl p-6 relative overflow-hidden">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-fluid-primary">monitoring</span>
                  <span className="font-mono-data text-sm uppercase tracking-widest text-fluid-text">ETH / USDC Flux</span>
                </div>
                <span className="font-mono-data text-xs text-fluid-secondary bg-fluid-secondary/10 px-2 py-1 rounded">
                  Volatile
                </span>
              </div>
              <ChartBars />
            </div>
            
            {/* Market Sentiment Square */}
            <div className="col-span-4">
              <MarketSentiment />
            </div>
            
            {/* Real-time Flows Table */}
            <div className="col-span-12">
              <FlowTable flows={MOCK_FLOWS} />
            </div>
          </div>
        </div>
      </section>
      
      {/* Right Column: AI Chat Interface */}
      <section className="w-[420px] bg-fluid-surface-container-low flex flex-col">
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
              <div className="text-[10px] font-mono-data text-fluid-text-dim mt-1">
                session: {sessionId}
              </div>
            </div>
          </div>
          <div className="text-right text-[10px] font-mono-data uppercase tracking-widest text-fluid-text-dim">
            <div>{PROVIDERS.find((p) => p.id === selectedProvider)?.name} · {AGENT_ROLES.find((r) => r.id === selectedRole)?.name}</div>
            <div>Tools: {enableTools ? 'On' : 'Off'}</div>
          </div>
        </div>
        
        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          {isTyping && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Chat Input & Quick Actions */}
        <div className="p-6 bg-fluid-surface-container-lowest/50 backdrop-blur-md">
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
              className="w-full bg-fluid-surface-container-lowest border border-fluid-outline-variant/30 focus:border-fluid-primary focus:ring-1 focus:ring-fluid-primary/30 rounded-lg px-4 py-4 text-sm font-body text-fluid-text placeholder:text-fluid-text-dim/50 outline-none transition-all"
              placeholder="Command Aura AI..."
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleSend()}
              disabled={isTyping}
            />
            <button 
              onClick={() => void handleSend()}
              disabled={isTyping || !input.trim()}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-fluid-primary text-fluid-surface-container-lowest rounded-lg flex items-center justify-center shadow-lg shadow-fluid-primary/20 hover:shadow-glow-primary active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined">send</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
