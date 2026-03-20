// Aura AI Command Center Page
import { useState, useRef, useEffect } from 'react'
import { flushSync } from 'react-dom'
import ReactMarkdown from 'react-markdown'
import { chatStream, AI_MODELS, type ChatMessage } from '@/api/ai'
import { useToast } from '@/hooks/useToast'

// Types
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  isStreaming?: boolean
}

interface FlowItem {
  source: string
  asset: string
  amount: string
  time: string
}

// Mock data for market display
const MOCK_FLOWS: FlowItem[] = [
  { source: 'Pool_X92', asset: '$WETH', amount: '1,240.00', time: 'Just Now' },
  { source: 'Vault_Gamma', asset: '$USDC', amount: '500,000.00', time: '2m ago' },
  { source: 'Liquid_Alpha', asset: '$ARB', amount: '12,500.00', time: '5m ago' },
  { source: 'Pool_Beta', asset: '$BTC', amount: '2.450', time: '8m ago' },
  { source: 'Vault_Delta', asset: '$USDT', amount: '1,200,000.00', time: '12m ago' },
]

const INITIAL_MESSAGES: Message[] = [
  {
    id: '1',
    role: 'assistant',
    content: 'Welcome back. I am Aura, your AI trading assistant. I can help you analyze stocks, assess risks, recommend strategies, and interpret market data. How can I assist you today?',
    timestamp: '10:24 AM'
  }
]

const QUICK_ACTIONS = [
  'Analyze Sector',
  'Risk Assessment', 
  'Execute Trade',
  'Market Pulse',
  'Portfolio Check'
]

// Components
function ChartBars() {
  const heights = [40, 55, 45, 70, 60, 85, 95, 75, 60, 80, 50, 65, 40, 55, 70, 85, 60, 75, 50, 40]
  
  return (
    <div className="h-64 flex items-end gap-1 relative">
      {heights.map((h, i) => (
        <div 
          key={i} 
          className="flex-1 bg-fluid-primary/30 hover:bg-fluid-primary/50 rounded-t-sm transition-all duration-300"
          style={{ height: `${h}%` }}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-fluid-surface via-transparent to-transparent pointer-events-none" />
    </div>
  )
}

function FlowTable({ flows }: { flows: FlowItem[] }) {
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
          {flows.map((flow, idx) => (
            <div 
              key={idx} 
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

function ChatMessage({ message }: { message: Message }) {
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
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
          {message.isStreaming && (
            <span className="inline-flex ml-1">
              <span className="w-1.5 h-1.5 bg-fluid-primary rounded-full animate-bounce" />
              <span className="w-1.5 h-1.5 bg-fluid-primary rounded-full animate-bounce ml-0.5" style={{ animationDelay: '0.2s' }} />
              <span className="w-1.5 h-1.5 bg-fluid-primary rounded-full animate-bounce ml-0.5" style={{ animationDelay: '0.4s' }} />
            </span>
          )}
        </div>
        <span className={`text-[10px] font-mono-data text-fluid-text-dim mt-2 block uppercase ${isUser ? 'text-right' : ''}`}>
          {isUser ? 'You' : 'Aura'} • {message.timestamp}
        </span>
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex gap-4">
      <div className="flex-1">
        <div className="bg-fluid-surface-container px-4 py-3 rounded-xl rounded-tl-none inline-flex items-center gap-2">
          <span className="flex gap-1">
            <span className="w-1 h-1 bg-fluid-primary rounded-full animate-bounce" />
            <span className="w-1 h-1 bg-fluid-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
            <span className="w-1 h-1 bg-fluid-primary rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
          </span>
          <span className="text-[10px] font-mono-data text-fluid-primary uppercase tracking-widest">Aura is calculating...</span>
        </div>
      </div>
    </div>
  )
}

export default function AICommandCenter() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { showToast } = useToast()
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }
  
  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])
  
  const handleSend = async () => {
    if (!input.trim()) return
    
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp
    }
    
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsTyping(true)
    
    // Prepare chat history for API
    const chatHistory: ChatMessage[] = messages.map(m => ({
      role: m.role,
      content: m.content
    }))
    chatHistory.push({ role: 'user', content: input })
    
    try {
      // Create assistant message placeholder
      const assistantMessageId = (Date.now() + 1).toString()
      setMessages(prev => [...prev, {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isStreaming: true
      }])
      
      // Call SSE streaming API - use local ref for immediate updates
      const contentRef = { current: '' }
      const messageIdRef = { current: assistantMessageId }
      
      // Update every 16ms (60fps) for smooth typing effect
      let lastUpdate = 0
      const updateMessage = (content: string, isDone: boolean = false) => {
        const now = Date.now()
        if (isDone || now - lastUpdate > 16) {
          lastUpdate = now
          // Use flushSync for immediate DOM update
          flushSync(() => {
            setMessages(prev => prev.map(m => 
              m.id === messageIdRef.current 
                ? { ...m, content, isStreaming: !isDone }
                : m
            ))
          })
        }
      }
      
      for await (const chunk of chatStream({ 
        provider: 'minimax',
        model: AI_MODELS.MINIMAX_M2_7,
        messages: chatHistory 
      })) {
        if (chunk.type === 'delta') {
          contentRef.current += (chunk.data as { content: string }).content
          updateMessage(contentRef.current)
        } else if (chunk.type === 'done') {
          // Final update with complete content
          flushSync(() => {
            setMessages(prev => prev.map(m => 
              m.id === messageIdRef.current 
                ? { ...m, content: contentRef.current, isStreaming: false }
                : m
            ))
          })
        } else if (chunk.type === 'error') {
          showToast(`AI Error: ${(chunk.data as { message: string }).message}`, 'error')
          setMessages(prev => prev.filter(m => m.id !== messageIdRef.current))
        }
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to get AI response', 'error')
      // Remove the placeholder message on error
      setMessages(prev => prev.filter(m => m.id !== (Date.now() + 1).toString()))
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
            </div>
          </div>
          <button className="material-symbols-outlined text-fluid-text-muted hover:text-fluid-text transition-colors">
            history
          </button>
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
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              disabled={isTyping}
            />
            <button 
              onClick={handleSend}
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
