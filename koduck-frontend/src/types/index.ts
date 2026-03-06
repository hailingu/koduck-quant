// Global type definitions

export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

export interface User {
  id: number
  username: string
  email?: string
  avatar?: string
}

// WebSocket connection states
export type WebSocketConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

// WebSocket message types
export interface WebSocketMessage<T = unknown> {
  type: string
  payload: T
}

// Stock price update message
export interface StockPriceUpdate {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  volume: number
  amount: number
  timestamp: number
}

// Subscription request
export interface SubscribeRequest {
  type: 'SUBSCRIBE' | 'UNSUBSCRIBE'
  symbols: string[]
}

// Subscription response
export interface SubscribeResponse {
  success: boolean
  message?: string
  subscribedSymbols?: string[]
}
