import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Sparkles, TrendingUp, BarChart3, Lightbulb, ChevronDown } from 'lucide-react'
import request from '@/api/request'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  type?: 'analysis' | 'suggestion' | 'general'
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

interface Provider {
  id: string
  name: string
  models: string[]
}

// 可用的 LLM 提供商
const PROVIDERS: Provider[] = [
  { id: 'minimax', name: 'MiniMax', models: ['MiniMax-M2.5'] },
]

// 快捷分析问题
const QUICK_QUESTIONS = [
  { icon: TrendingUp, label: '趋势分析', question: '请分析这只股票的近期趋势如何？' },
  { icon: BarChart3, label: '技术指标', question: '这只股票的技术指标显示什么信号？' },
  { icon: Lightbulb, label: '投资建议', question: '基于当前行情，有什么投资建议？' },
]

// AI 分析 API 响应类型
interface AIAnalysisResponse {
  analysis: string
  provider: string
  model?: string
}

// 普通对话 API 响应类型
interface ChatResponse {
  content: string
  provider: string
  model?: string
}

export function AIChat({ symbol, stockName, stockInfo }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `您好！我是您的AI股票分析助手。我可以帮您分析 ${stockName} (${symbol}) 的行情数据、技术指标和投资建议。请问有什么可以帮您的？`,
      timestamp: new Date(),
      type: 'general',
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<string>('minimax')
  const [showProviderDropdown, setShowProviderDropdown] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProviderDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 股票分析 API 调用
  const callAIAnalysis = async (question: string): Promise<string> => {
    try {
      const response = await request.post<AIAnalysisResponse>('/api/v1/ai/analyze', {
        symbol,
        name: stockName,
        price: stockInfo.price,
        change_percent: stockInfo.changePercent,
        open_price: stockInfo.open,
        high: stockInfo.high,
        low: stockInfo.low,
        prev_close: stockInfo.prevClose,
        volume: stockInfo.volume,
        amount: stockInfo.amount || 0,
        question,
        provider: selectedProvider,
      }, {
        timeout: 60000, // AI 请求需要更长的超时时间（60秒）
      })
      return response.analysis
    } catch (error: any) {
      console.error('AI analysis failed:', error)
      // 提取后端返回的详细错误信息
      const backendError = error?.response?.data?.detail || error?.response?.data?.message
      if (backendError) {
        throw new Error(backendError)
      }
      if (error.code === 'ECONNABORTED') {
        throw new Error('AI 响应超时，请稍后重试')
      }
      throw new Error('AI 分析服务暂时不可用，请稍后重试')
    }
  }

  // 普通对话 API 调用（流式）
  const callChatStream = async (
    userContent: string,
    onDelta: (delta: string) => void,
    onDone: (fullContent: string) => void,
    onError: (error: string) => void
  ) => {
    try {
      // 构建对话历史
      const chatMessages = messages
        .filter(m => m.id !== 'welcome') // 排除欢迎消息
        .map(m => ({
          role: m.role,
          content: m.content
        }))
      
      // 添加系统提示
      const systemPrompt = `你是一位AI助手，正在与用户讨论股票 ${stockName} (${symbol}) 的相关话题。用户可以自由询问任何问题，包括但不限于：
- 一般性问题（如时间、日期、常识等）
- 股票相关的问题
- 投资知识
- 其他话题

请自然、友好地回答用户的问题。如果用户询问与当前股票无关的话题，也请正常回答。`

      const requestBody = {
        messages: [
          { role: 'system', content: systemPrompt },
          ...chatMessages,
          { role: 'user', content: userContent }
        ],
        provider: selectedProvider,
      }

      // 使用 SSE 流式请求
      const response = await fetch('/api/v1/ai/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: '请求失败' }))
        throw new Error(errorData.message || `HTTP ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''

      if (!reader) {
        throw new Error('无法读取响应流')
      }

      // 读取流
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const eventType = line.slice(7)
            continue
          }
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6)
            try {
              const data = JSON.parse(dataStr)
              
              if (data.content !== undefined) {
                // delta 事件
                fullContent += data.content
                onDelta(data.content)
              } else if (data.code) {
                // error 事件
                onError(data.message || '请求失败')
                return
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }

      onDone(fullContent)
    } catch (error: any) {
      console.error('Chat stream failed:', error)
      onError(error.message || 'AI 服务暂时不可用，请稍后重试')
    }
  }

  // 处理用户输入（普通对话 - 流式）
  const handleSend = async (content: string) => {
    if (!content.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    // 先创建一个空的 AI 消息
    const aiMessageId = (Date.now() + 1).toString()
    setMessages((prev) => [
      ...prev,
      {
        id: aiMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        type: 'general',
      }
    ])

    // 流式接收
    await callChatStream(
      content,
      // onDelta - 收到内容块
      (delta) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessageId
              ? { ...msg, content: msg.content + delta }
              : msg
          )
        )
      },
      // onDone - 完成
      () => {
        setIsLoading(false)
      },
      // onError - 错误
      (error) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessageId
              ? { ...msg, content: `❌ ${error}` }
              : msg
          )
        )
        setIsLoading(false)
      }
    )
  }

  // 处理快捷问题（股票分析）
  const handleQuickQuestion = async (question: string) => {
    if (!question.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: question,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    try {
      // 股票分析使用 /analyze 接口
      const analysis = await callAIAnalysis(question)
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: analysis,
        timestamp: new Date(),
        type: 'analysis',
      }
      
      setMessages((prev) => [...prev, aiMessage])
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '分析失败，请稍后重试'
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `❌ ${errorMessage}`,
        timestamp: new Date(),
        type: 'general',
      }
      
      setMessages((prev) => [...prev, aiMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const currentProvider = PROVIDERS.find(p => p.id === selectedProvider)

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary-500 rounded-lg">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">AI 智能分析</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">基于 {stockName} 实时数据</p>
          </div>
        </div>
        
        {/* Provider Selector */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowProviderDropdown(!showProviderDropdown)}
            disabled={isLoading}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            <span className="text-gray-700 dark:text-gray-300">{currentProvider?.name}</span>
            <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform ${showProviderDropdown ? 'rotate-180' : ''}`} />
          </button>
          
          {showProviderDropdown && (
            <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
              {PROVIDERS.map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => {
                    setSelectedProvider(provider.id)
                    setShowProviderDropdown(false)
                  }}
                  className={`w-full px-3 py-2 text-left text-xs transition-colors first:rounded-t-lg last:rounded-b-lg ${
                    selectedProvider === provider.id
                      ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="font-medium">{provider.name}</div>
                  <div className="text-gray-400 text-[10px] truncate">{provider.models[0]}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Questions */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">快捷分析：</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_QUESTIONS.map((item) => (
            <button
              key={item.label}
              onClick={() => handleQuickQuestion(item.question)}
              disabled={isLoading}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:text-primary-600 dark:hover:text-primary-400 transition-colors disabled:opacity-50"
            >
              <item.icon className="w-3 h-3" />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-2 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                message.role === 'user'
                  ? 'bg-primary-500'
                  : 'bg-gradient-to-br from-primary-500 to-purple-500'
              }`}
            >
              {message.role === 'user' ? (
                <User className="w-4 h-4 text-white" />
              ) : (
                <Bot className="w-4 h-4 text-white" />
              )}
            </div>
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                message.role === 'user'
                  ? 'bg-primary-500 text-white rounded-br-md'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-md'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-2">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend(input)}
            placeholder={`询问${currentProvider?.name}关于这只股票的分析...`}
            disabled={isLoading}
            className="flex-1 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 border-0 rounded-lg focus:ring-2 focus:ring-primary-500 focus:bg-white dark:focus:bg-gray-800 transition-all placeholder:text-gray-400 disabled:opacity-50"
          />
          <button
            onClick={() => handleSend(input)}
            disabled={!input.trim() || isLoading}
            className="p-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default AIChat
