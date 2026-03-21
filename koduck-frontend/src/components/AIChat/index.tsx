import { useEffect, useRef, useState } from 'react'
import { Bot, ChevronDown, Send, Sparkles, User } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { settingsApi } from '@/api/settings'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface StockInfo {
  price: number
  change: number
  changePercent: number
  open: number
  high: number
  low: number
  prevClose: number
  volume: number
  amount?: number
}

interface AIChatProps {
  symbol: string
  stockName: string
  stockInfo: StockInfo
}

type ProviderId = 'minimax' | 'deepseek' | 'openai'

type AgentRoleId = 'general' | 'architect' | 'coder' | 'reviewer' | 'analyst'

interface Provider {
  id: ProviderId
  name: string
}

const PROVIDERS: Provider[] = [
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

const SUB_AGENT_PRESETS: { id: AgentRoleId; name: string }[] = [
  { id: 'architect', name: 'Architect' },
  { id: 'coder', name: 'Coder' },
  { id: 'reviewer', name: 'Reviewer' },
]

const getAuthToken = (): string => {
  const authStorage = localStorage.getItem('auth-storage')
  if (!authStorage) {
    return ''
  }
  try {
    const authState = JSON.parse(authStorage)
    return authState?.state?.token || ''
  } catch {
    return ''
  }
}

function TypingIndicator() {
  const dotStyle = {
    animationDuration: '1.5s',
  } as const

  return (
    <div className="flex gap-2">
      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-blue-500">
        <Bot className="h-4 w-4 text-white" />
      </div>
      <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-gray-100 px-3 py-2 text-sm text-gray-800 dark:bg-gray-700 dark:text-gray-200">
        <div className="inline-flex items-center gap-2 rounded-xl border border-gray-200/60 bg-white/50 px-3 py-2 dark:border-gray-600/60 dark:bg-gray-800/50">
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
            className="ml-2 animate-pulse text-[10px] font-mono uppercase tracking-[0.2em] text-[#00F2FF]"
            style={{ animationDuration: '2s' }}
          >
            Aura is calculating...
          </span>
        </div>
      </div>
    </div>
  )
}

export function AIChat({ symbol, stockName, stockInfo }: AIChatProps) {
  const storageKey = `ai_chat_session_${symbol}`
  const createSessionId = () => `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  const [sessionId, setSessionId] = useState<string>(() => {
    const existing = localStorage.getItem(storageKey)
    if (existing) {
      return existing
    }
    const created = createSessionId()
    localStorage.setItem(storageKey, created)
    return created
  })
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `您好！我是 AI 助手，可以帮您分析 ${stockName} (${symbol})。`,
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>('minimax')
  const [selectedRole, setSelectedRole] = useState<AgentRoleId>('general')
  const [enableTools, setEnableTools] = useState(true)
  const [allowRestrictedTools, setAllowRestrictedTools] = useState(false)
  const [selectedSubAgents, setSelectedSubAgents] = useState<AgentRoleId[]>([])
  const [showProviderDropdown, setShowProviderDropdown] = useState(false)
  const [showRoleDropdown, setShowRoleDropdown] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  useEffect(() => {
    const loadPreferredProvider = async () => {
      try {
        const settings = await settingsApi.getSettings()
        const provider = (settings.llmConfig?.provider || '').toLowerCase()
        if (provider === 'minimax' || provider === 'deepseek' || provider === 'openai') {
          setSelectedProvider(provider)
        }
      } catch {
        // noop
      }
    }
    loadPreferredProvider()
  }, [])

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
          content: `你正在与用户讨论 ${stockName}(${symbol})，当前价格约 ${stockInfo.price}，涨跌幅 ${stockInfo.changePercent}% ，请结合行情回答。`,
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

    const parseField = (line: string, field: 'event' | 'data') => {
      const prefix = `${field}:`
      if (!line.startsWith(prefix)) {
        return null
      }
      return line.slice(prefix.length).trimStart()
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const chunks = buffer.split('\n\n')
      buffer = chunks.pop() || ''

      for (const raw of chunks) {
        if (!raw.trim()) {
          continue
        }

        const lines = raw.split('\n')
        let eventType = 'message'
        const dataParts: string[] = []

        for (const line of lines) {
          const e = parseField(line, 'event')
          if (e !== null) {
            eventType = e || 'message'
            continue
          }
          const d = parseField(line, 'data')
          if (d !== null) {
            dataParts.push(d)
          }
        }

        const dataRaw = dataParts.join('\n').trim()
        if (!dataRaw) {
          continue
        }

        try {
          const payload = JSON.parse(dataRaw)
          if (eventType === 'delta' && payload.content) {
            updateAssistantMessage(assistantMessageId, payload.content)
            continue
          }
          if (eventType === 'error') {
            throw new Error(payload.message || 'AI 服务异常')
          }
        } catch (err) {
          if (err instanceof Error && eventType === 'error') {
            throw err
          }
        }
      }
    }
  }

  const resetSessionMemory = async () => {
    const token = getAuthToken()
    const response = await fetch(`/api/v1/ai/memory/session/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
    if (!response.ok) {
      throw new Error(`清空记忆失败（HTTP ${response.status}）`)
    }
    const nextSessionId = createSessionId()
    setSessionId(nextSessionId)
    localStorage.setItem(storageKey, nextSessionId)
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: `您好！我是 AI 助手，可以帮您分析 ${stockName} (${symbol})。`,
      },
    ])
  }

  const handleSend = async () => {
    const content = input.trim()
    if (!content || isLoading) {
      return
    }

    setInput('')
    setIsLoading(true)

    const userMessage: Message = {
      id: `u_${Date.now()}`,
      role: 'user',
      content,
    }
    const assistantMessageId = `a_${Date.now()}`

    setMessages((prev) => [...prev, userMessage])
    try {
      await callChatStream(content, assistantMessageId)
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'AI 服务暂不可用'
      setMessages((prev) => {
        const existing = prev.some((m) => m.id === assistantMessageId)
        if (existing) {
          return prev.map((m) => (m.id === assistantMessageId ? { ...m, content: `❌ ${msg}` } : m))
        }
        return [
          ...prev,
          {
            id: assistantMessageId,
            role: 'assistant',
            content: `❌ ${msg}`,
          },
        ]
      })
    } finally {
      setIsLoading(false)
    }
  }

  const toggleSubAgent = (role: AgentRoleId) => {
    setSelectedSubAgents((prev) =>
      prev.includes(role) ? prev.filter((item) => item !== role) : [...prev, role],
    )
  }

  const currentProvider = PROVIDERS.find((p) => p.id === selectedProvider)
  const currentRole = AGENT_ROLES.find((r) => r.id === selectedRole)

  return (
    <div className="flex h-full min-h-[560px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-gray-200 bg-gradient-to-r from-primary-50 to-blue-50 px-4 py-3 dark:border-gray-700 dark:from-primary-900/20 dark:to-blue-900/20">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary-500 p-1.5">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">AI 智能分析</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{stockName} ({symbol})</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500">session: {sessionId}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              disabled={isLoading}
              onClick={async () => {
                try {
                  await resetSessionMemory()
                } catch (e) {
                  // noop
                }
              }}
            >
              清空记忆
            </button>
            <div className="relative">
              <button
                className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700"
                onClick={() => setShowProviderDropdown((v) => !v)}
                disabled={isLoading}
              >
                {currentProvider?.name}
                <ChevronDown className="h-3 w-3" />
              </button>
              {showProviderDropdown && (
                <div className="absolute right-0 top-full z-20 mt-1 w-28 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800">
                  {PROVIDERS.map((provider) => (
                    <button
                      key={provider.id}
                      className="block w-full px-3 py-2 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => {
                        setSelectedProvider(provider.id)
                        setShowProviderDropdown(false)
                      }}
                    >
                      {provider.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <button
                className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700"
                onClick={() => setShowRoleDropdown((v) => !v)}
                disabled={isLoading}
              >
                {currentRole?.name}
                <ChevronDown className="h-3 w-3" />
              </button>
              {showRoleDropdown && (
                <div className="absolute right-0 top-full z-20 mt-1 w-32 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800">
                  {AGENT_ROLES.map((role) => (
                    <button
                      key={role.id}
                      className="block w-full px-3 py-2 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => {
                        setSelectedRole(role.id)
                        setShowRoleDropdown(false)
                      }}
                    >
                      {role.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="border-b border-gray-200 px-3 py-2 text-xs dark:border-gray-700">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={enableTools} onChange={(e) => setEnableTools(e.target.checked)} />
              启用工具调用
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={allowRestrictedTools}
                onChange={(e) => setAllowRestrictedTools(e.target.checked)}
              />
              允许受限工具
            </label>
            <div className="flex items-center gap-1">
              <span className="text-gray-500 dark:text-gray-400">Sub-Agent:</span>
              {SUB_AGENT_PRESETS.map((item) => (
                <label key={item.id} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={selectedSubAgents.includes(item.id)}
                    onChange={() => toggleSubAgent(item.id)}
                  />
                  {item.name}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex gap-2 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div
                className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${
                  message.role === 'user' ? 'bg-primary-500' : 'bg-gradient-to-br from-primary-500 to-blue-500'
                }`}
              >
                {message.role === 'user' ? (
                  <User className="h-4 w-4 text-white" />
                ) : (
                  <Bot className="h-4 w-4 text-white" />
                )}
              </div>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  message.role === 'user'
                    ? 'rounded-br-md bg-primary-500 text-white'
                    : 'rounded-bl-md bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                }`}
              >
                {message.role === 'assistant' ? (
                  <div className="leading-relaxed">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({ children }) => <h1 className="mb-2 text-base font-semibold">{children}</h1>,
                        h2: ({ children }) => <h2 className="mb-2 text-[15px] font-semibold">{children}</h2>,
                        h3: ({ children }) => <h3 className="mb-1 text-sm font-semibold">{children}</h3>,
                        p: ({ children }) => <p className="mb-2 last:mb-0 whitespace-pre-wrap">{children}</p>,
                        ul: ({ children }) => <ul className="mb-2 list-disc pl-5 space-y-1">{children}</ul>,
                        ol: ({ children }) => <ol className="mb-2 list-decimal pl-5 space-y-1">{children}</ol>,
                        li: ({ children }) => <li>{children}</li>,
                        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                        a: ({ href, children }) => (
                          <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                            {children}
                          </a>
                        ),
                        code: ({ children }) => (
                          <code className="rounded bg-gray-200 px-1 py-0.5 text-[12px] dark:bg-gray-600">
                            {children}
                          </code>
                        ),
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                )}
              </div>
            </div>
          ))}
          {isLoading && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-gray-200 p-3 dark:border-gray-700">
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-lg bg-gray-100 px-3 py-2 text-sm outline-none ring-primary-500 focus:ring-2 dark:bg-gray-700"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={`向 ${currentProvider?.name}(${currentRole?.name}) 提问...`}
              disabled={isLoading}
            />
            <button
              className="rounded-lg bg-primary-500 p-2 text-white disabled:opacity-50"
              disabled={isLoading || !input.trim()}
              onClick={handleSend}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}

export default AIChat
