import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Sparkles, TrendingUp, BarChart3, Lightbulb } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  type?: 'analysis' | 'suggestion' | 'general'
}

interface AIChatProps {
  symbol: string
  stockName: string
  stockInfo: {
    price: number
    change: number
    changePercent: number
    open: number
    high: number
    low: number
    prevClose: number
    volume: number
  }
}

// 快捷分析问题
const QUICK_QUESTIONS = [
  { icon: TrendingUp, label: '趋势分析', question: '分析一下这只股票的近期趋势如何？' },
  { icon: BarChart3, label: '技术指标', question: '这只股票的技术指标显示什么信号？' },
  { icon: Lightbulb, label: '投资建议', question: '基于当前行情，有什么投资建议？' },
]

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
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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

    // 模拟AI响应
    setTimeout(() => {
      const aiResponse = generateAIResponse(content, stockName, symbol, stockInfo)
      setMessages((prev) => [...prev, aiResponse])
      setIsLoading(false)
    }, 1500)
  }

  const handleQuickQuestion = (question: string) => {
    handleSend(question)
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20">
        <div className="p-1.5 bg-primary-500 rounded-lg">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">AI 智能分析</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">基于 {stockName} 实时数据</p>
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
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
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
            placeholder="询问AI关于这只股票的分析..."
            className="flex-1 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 border-0 rounded-lg focus:ring-2 focus:ring-primary-500 focus:bg-white dark:focus:bg-gray-800 transition-all placeholder:text-gray-400"
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

// 模拟AI响应生成
function generateAIResponse(
  question: string,
  stockName: string,
  symbol: string,
  stockInfo: AIChatProps['stockInfo']
): Message {
  const { price, changePercent, high, low, volume } = stockInfo
  
  if (question.includes('趋势')) {
    const trend = changePercent > 0 ? '上涨' : changePercent < 0 ? '下跌' : '横盘'
    return {
      id: Date.now().toString(),
      role: 'assistant',
      content: `📊 **${stockName} (${symbol}) 趋势分析**

当前股价 **${price.toFixed(2)}** 元，今日${trend} **${Math.abs(changePercent).toFixed(2)}%**。

• 今日最高：${high.toFixed(2)} 元
• 今日最低：${low.toFixed(2)} 元
• 成交量：${(volume / 10000).toFixed(2)} 万手

从技术面看，该股${changePercent > 0 ? '表现出较强的上涨动能，短期可关注能否突破前期高点' : '近期有所回调，建议关注支撑位能否守住'}。建议结合大盘走势和板块热点综合判断。`,
      timestamp: new Date(),
      type: 'analysis',
    }
  }

  if (question.includes('技术') || question.includes('指标')) {
    return {
      id: Date.now().toString(),
      role: 'assistant',
      content: `📈 **技术指标分析**

基于当前行情数据：

• **均线系统**：股价${price > stockInfo.prevClose ? '站上' : '位于'}均线之上
• **波动区间**：今日振幅 ${((high - low) / stockInfo.prevClose * 100).toFixed(2)}%
• **量能分析**：成交量${volume > 1000000 ? '放大' : '正常'}，${volume > 1000000 ? '资金关注度较高' : '交投相对清淡'}

**操作建议**：${changePercent > 1 ? '短期强势，可考虑逢低布局' : changePercent < -1 ? '短期偏弱，建议观望或减仓' : '震荡整理，宜观望等待方向选择'}`,
      timestamp: new Date(),
      type: 'analysis',
    }
  }

  if (question.includes('建议') || question.includes('投资')) {
    return {
      id: Date.now().toString(),
      role: 'assistant',
      content: `💡 **投资建议**

针对 ${stockName} (${symbol})：

**短期策略**：
${changePercent > 0 ? '• 当前处于上涨趋势中，可适当参与\n• 建议设置止盈止损，控制风险' : '• 当前走势偏弱，建议谨慎操作\n• 等待企稳信号后再考虑介入'}

**风险提示**：
• 以上分析仅供参考，不构成投资建议
• 股市有风险，投资需谨慎
• 建议结合自身风险承受能力决策

需要更详细的基本面或技术面分析吗？`,
      timestamp: new Date(),
      type: 'suggestion',
    }
  }

  return {
    id: Date.now().toString(),
    role: 'assistant',
    content: `关于 ${stockName} (${symbol})，当前股价 ${price.toFixed(2)} 元，今日涨跌幅 ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%。

您想了解哪方面的分析？我可以帮您分析：
• 技术面走势
• 关键价位（支撑/阻力）
• 量价关系
• 投资建议

请告诉我您的具体问题。`,
    timestamp: new Date(),
    type: 'general',
  }
}

export default AIChat
