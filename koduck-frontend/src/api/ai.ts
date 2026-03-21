// AI Chat API - Uses native fetch for SSE streaming

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  thinking?: string
  tool_call_id?: string
}

// 支持的 AI 模型
export const AI_MODELS = {
  MINIMAX_M2_7: 'MiniMax-M2.7',
  MINIMAX_M2_5: 'MiniMax-M2.5',
  MINIMAX_TEXT_01: 'MiniMax-Text-01',
  DEEPSEEK_CHAT: 'deepseek-chat',
  GPT_4O_MINI: 'gpt-4o-mini',
} as const

export type AIModel = typeof AI_MODELS[keyof typeof AI_MODELS]

export interface ChatStreamRequest {
  provider?: string
  model?: AIModel | string
  messages: ChatMessage[]
  apiKey?: string
  apiBase?: string
}

export interface ChatDelta {
  content: string
}

export interface ChatDone {
  content: string
  model: string
  provider: string
}

export interface ChatError {
  code: number
  message: string
}

// Get auth token from localStorage
function getAuthToken(): string | null {
  const authStorage = localStorage.getItem('auth-storage')
  if (authStorage) {
    try {
      const authState = JSON.parse(authStorage)
      // Keep compatibility with both persisted shapes:
      // - state.token (current)
      // - state.accessToken (legacy)
      return authState?.state?.token || authState?.state?.accessToken || null
    } catch {
      return null
    }
  }
  return null
}

// SSE 流式聊天
export async function* chatStream(
  requestData: ChatStreamRequest
): AsyncGenerator<{ type: 'delta' | 'done' | 'error'; data: ChatDelta | ChatDone | ChatError }> {
  const token = getAuthToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream',
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  const response = await fetch('/api/v1/ai/chat/stream', {
    method: 'POST',
    headers,
    body: JSON.stringify(requestData),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }))
    throw new Error(error.message || `HTTP ${response.status}`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('No response body')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue

        // Parse SSE format: "event: xxx\ndata: yyy" (handle with or without space after colon)
        const eventMatch = trimmed.match(/event:\s*(\w+)/)
        const dataMatch = trimmed.match(/data:\s*(.+)/s)

        if (eventMatch && dataMatch) {
          const eventType = eventMatch[1]
          const data = JSON.parse(dataMatch[1])

          if (eventType === 'delta') {
            yield { type: 'delta', data: data as ChatDelta }
          } else if (eventType === 'done') {
            yield { type: 'done', data: data as ChatDone }
          } else if (eventType === 'error') {
            yield { type: 'error', data: data as ChatError }
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

// 简单聊天（非流式）
export interface SimpleChatResponse {
  code: number
  message: string
  data: {
    content: string
    provider: string
    model: string
  }
}

export async function simpleChat(requestData: ChatStreamRequest): Promise<SimpleChatResponse> {
  const token = getAuthToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  const response = await fetch('/api/v1/ai/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify(requestData),
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }))
    throw new Error(error.message || `HTTP ${response.status}`)
  }
  
  return response.json()
}

// 股票分析
export interface StockAnalysisRequest {
  symbol: string
  market: string
  question?: string
}

export interface StockAnalysisResponse {
  analysis: string
  technical?: string
  fundamental?: string
  sentiment?: string
}

export async function analyzeStock(requestData: StockAnalysisRequest): Promise<StockAnalysisResponse> {
  const token = getAuthToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  const response = await fetch('/api/v1/ai/analyze', {
    method: 'POST',
    headers,
    body: JSON.stringify(requestData),
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }))
    throw new Error(error.message || `HTTP ${response.status}`)
  }
  
  return response.json()
}

// 策略推荐
export interface StrategyRecommendRequest {
  riskPreference: string
  investmentHorizon?: string
}

export interface StrategyRecommendResponse {
  strategies: Array<{
    name: string
    description: string
    allocation: Record<string, number>
  }>
  suggestion: string
}

export async function recommendStrategies(requestData: StrategyRecommendRequest): Promise<StrategyRecommendResponse> {
  const token = getAuthToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  const response = await fetch('/api/v1/ai/strategy-recommend', {
    method: 'POST',
    headers,
    body: JSON.stringify(requestData),
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }))
    throw new Error(error.message || `HTTP ${response.status}`)
  }
  
  return response.json()
}
