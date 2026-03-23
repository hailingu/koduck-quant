import { create } from 'zustand'
import type { StompSubscription } from '@stomp/stompjs'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import type { WebSocketConnectionState, StockPriceUpdate } from '../types'

interface WebSocketState {
  // Connection state
  connectionState: WebSocketConnectionState
  client: Client | null

  // Single queue subscription for all symbols
  priceSubscription: StompSubscription | null

  // Subscription management (ref-counted by symbol)
  symbolRefCounts: Map<string, number>
  subscribedSymbols: Set<string>

  // Stock price data
  stockPrices: Map<string, StockPriceUpdate>

  // Actions
  connect: () => void
  disconnect: () => void
  subscribe: (symbols: string[]) => void
  unsubscribe: (symbols: string[]) => void
  updatePrice: (update: StockPriceUpdate) => void
  clearPrices: () => void
}

const normalizeSymbol = (symbol: string): string => {
  const digits = symbol.replaceAll(/\D/g, '')
  if (digits.length >= 1 && digits.length <= 6) {
    return digits.padStart(6, '0')
  }
  return symbol.trim().toUpperCase()
}

const parsePriceMessage = (body: string): StockPriceUpdate | null => {
  const parsed = JSON.parse(body)
  const payload = parsed?.data ?? parsed
  const symbol = typeof payload?.symbol === 'string' ? normalizeSymbol(payload.symbol) : ''

  if (!symbol) {
    return null
  }

  return {
    symbol,
    name: payload?.name ?? symbol,
    price: Number(payload?.price ?? 0),
    change: Number(payload?.change ?? 0),
    changePercent: Number(payload?.changePercent ?? 0),
    volume: Number(payload?.volume ?? 0),
    amount: Number(payload?.amount ?? 0),
    timestamp: Date.now(),
  }
}

// WebSocket configuration
const WS_CONFIG = {
  webSocketFactory: () => new SockJS('/ws', null, { 
    transports: ['websocket', 'xhr-streaming', 'xhr-polling'] //  iframe
  }),
  reconnectDelay: 5000,
  heartbeatIncoming: 4000,
  heartbeatOutgoing: 4000,
  connectionTimeout: 10000,
}

const getAuthToken = (): string | null => {
  const authStorage = localStorage.getItem('auth-storage')
  if (!authStorage) {
    return null
  }

  try {
    const authState = JSON.parse(authStorage)
    const accessToken = authState?.state?.accessToken
    return typeof accessToken === 'string' && accessToken.trim().length > 0
      ? accessToken
      : null
  } catch {
    return null
  }
}

export const useWebSocketStore = create<WebSocketState>((set, get) => ({
  connectionState: 'disconnected',
  client: null,
  priceSubscription: null,
  symbolRefCounts: new Map(),
  subscribedSymbols: new Set(),
  stockPrices: new Map(),

  connect: () => {
    const { client, connectionState } = get()
    
    // Don't reconnect if already connected or in-flight.
    if (connectionState === 'connected' || connectionState === 'connecting') {
      return
    }

    // Clean up stale client instance before creating a new connection.
    if (client) {
      void client.deactivate()
      set({ client: null, priceSubscription: null })
    }

    set({ connectionState: 'connecting' })

    const token = getAuthToken()
    const connectHeaders: Record<string, string> = token
      ? { Authorization: `Bearer ${token}` }
      : {}

    const stompClient = new Client({
      ...WS_CONFIG,
      connectHeaders,
      onConnect: () => {
        const queueSubscription = stompClient.subscribe('/user/queue/price', (message) => {
          try {
            const update = parsePriceMessage(message.body)
            if (update) {
              get().updatePrice(update)
            }
          } catch (error) {
            console.error('Failed to parse price update:', error)
          }
        })

        set({ connectionState: 'connected', priceSubscription: queueSubscription })

        // Re-subscribe all active symbols after reconnect.
        const activeSymbols = Array.from(get().symbolRefCounts.entries())
          .filter(([, count]) => count > 0)
          .map(([symbol]) => symbol)

        if (activeSymbols.length > 0) {
          stompClient.publish({
            destination: '/app/subscribe',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ type: 'SUBSCRIBE', symbols: activeSymbols }),
          })
          set({ subscribedSymbols: new Set(activeSymbols) })
        }
      },
      onDisconnect: () => {
        set({ connectionState: 'disconnected', priceSubscription: null, subscribedSymbols: new Set() })
      },
      onStompError: (frame) => {
        console.error('STOMP error:', frame)
        set({ connectionState: 'disconnected' })
      },
      onWebSocketClose: () => {
        const { connectionState } = get()
        if (connectionState === 'connected') {
          set({ connectionState: 'reconnecting' })
        }
      },
      onWebSocketError: (error) => {
        console.error('WebSocket error:', error)
      },
    })

    stompClient.activate()
    set({ client: stompClient })
  },

  disconnect: () => {
    const { client, priceSubscription } = get()

    if (priceSubscription) {
      priceSubscription.unsubscribe()
    }
    
    // Deactivate client
    if (client) {
      client.deactivate()
    }
    
    set({
      connectionState: 'disconnected',
      client: null,
      priceSubscription: null,
      symbolRefCounts: new Map(),
      subscribedSymbols: new Set(),
    })
  },

  subscribe: (symbols: string[]) => {
    const { client, symbolRefCounts, subscribedSymbols, connectionState } = get()

    const normalizedSymbols = Array.from(new Set(symbols.map((symbol) => normalizeSymbol(symbol))))
    if (normalizedSymbols.length === 0) {
      return
    }

    const toSubscribe: string[] = []
    normalizedSymbols.forEach((symbol) => {
      const count = symbolRefCounts.get(symbol) ?? 0
      symbolRefCounts.set(symbol, count + 1)
      if (count === 0) {
        toSubscribe.push(symbol)
      }
    })

    if (toSubscribe.length === 0) {
      set({ symbolRefCounts: new Map(symbolRefCounts) })
      return
    }

    if (!client || connectionState === 'disconnected') {
      // Auto-connect to ensure queued symbols are flushed after refresh/page entry.
      get().connect()
    }

    if (client?.connected) {
      client.publish({
        destination: '/app/subscribe',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'SUBSCRIBE', symbols: toSubscribe }),
      })
      toSubscribe.forEach((symbol) => {
        subscribedSymbols.add(symbol)
      })
    } else {
      console.warn('WebSocket not connected yet, symbols queued for subscribe on connect')
    }

    set({
      symbolRefCounts: new Map(symbolRefCounts),
      subscribedSymbols: new Set(subscribedSymbols),
    })
  },

  unsubscribe: (symbols: string[]) => {
    const { client, symbolRefCounts, subscribedSymbols } = get()

    const normalizedSymbols = Array.from(new Set(symbols.map((symbol) => normalizeSymbol(symbol))))
    if (normalizedSymbols.length === 0) {
      return
    }

    const toUnsubscribe: string[] = []
    normalizedSymbols.forEach((symbol) => {
      const count = symbolRefCounts.get(symbol) ?? 0
      if (count <= 1) {
        symbolRefCounts.delete(symbol)
        toUnsubscribe.push(symbol)
      } else {
        symbolRefCounts.set(symbol, count - 1)
      }
    })

    if (toUnsubscribe.length > 0 && client?.connected) {
      client.publish({
        destination: '/app/unsubscribe',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'UNSUBSCRIBE', symbols: toUnsubscribe }),
      })
      toUnsubscribe.forEach((symbol) => {
        subscribedSymbols.delete(symbol)
      })
    }

    set({
      symbolRefCounts: new Map(symbolRefCounts),
      subscribedSymbols: new Set(subscribedSymbols),
    })
  },

  updatePrice: (update: StockPriceUpdate) => {
    const { stockPrices } = get()
    const normalized = normalizeSymbol(update.symbol)
    stockPrices.set(normalized, { ...update, symbol: normalized })
    set({ stockPrices: new Map(stockPrices) })
  },

  clearPrices: () => {
    set({ stockPrices: new Map() })
  },
}))
