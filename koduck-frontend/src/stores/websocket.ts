import { create } from 'zustand'
import type { StompSubscription } from '@stomp/stompjs'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import type { WebSocketConnectionState, StockPriceUpdate } from '../types'

interface WebSocketState {
  // Connection state
  connectionState: WebSocketConnectionState
  client: Client | null
  
  // Subscription management
  subscriptions: Map<string, StompSubscription>
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

// WebSocket configuration
const WS_CONFIG = {
  webSocketFactory: () => new SockJS('/ws'),
  reconnectDelay: 5000,
  heartbeatIncoming: 4000,
  heartbeatOutgoing: 4000,
  connectionTimeout: 10000,
}

export const useWebSocketStore = create<WebSocketState>((set, get) => ({
  connectionState: 'disconnected',
  client: null,
  subscriptions: new Map(),
  subscribedSymbols: new Set(),
  stockPrices: new Map(),

  connect: () => {
    const { client, connectionState } = get()
    
    // Don't reconnect if already connected or connecting
    if (client && (connectionState === 'connected' || connectionState === 'connecting')) {
      return
    }

    set({ connectionState: 'connecting' })

    const stompClient = new Client({
      ...WS_CONFIG,
      onConnect: () => {
        set({ connectionState: 'connected' })
        console.log('WebSocket connected')
        
        // Re-subscribe to previous symbols if any
        const { subscribedSymbols } = get()
        if (subscribedSymbols.size > 0) {
          get().subscribe(Array.from(subscribedSymbols))
        }
      },
      onDisconnect: () => {
        set({ connectionState: 'disconnected' })
        console.log('WebSocket disconnected')
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
    const { client, subscriptions } = get()
    
    // Unsubscribe from all
    subscriptions.forEach((sub) => sub.unsubscribe())
    subscriptions.clear()
    
    // Deactivate client
    if (client) {
      client.deactivate()
    }
    
    set({
      connectionState: 'disconnected',
      client: null,
      subscriptions: new Map(),
      subscribedSymbols: new Set(),
    })
  },

  subscribe: (symbols: string[]) => {
    const { client, subscriptions, subscribedSymbols } = get()
    
    if (!client || !client.connected) {
      console.warn('Cannot subscribe: WebSocket not connected')
      return
    }

    const newSymbols = symbols.filter((symbol) => !subscribedSymbols.has(symbol))
    
    if (newSymbols.length === 0) {
      return
    }

    newSymbols.forEach((symbol) => {
      // Subscribe to price updates for this symbol
      const subscription = client.subscribe(`/topic/price.${symbol}`, (message) => {
        try {
          const update = JSON.parse(message.body) as StockPriceUpdate
          get().updatePrice(update)
        } catch (error) {
          console.error('Failed to parse price update:', error)
        }
      })
      
      subscriptions.set(symbol, subscription)
      subscribedSymbols.add(symbol)
    })

    // Send subscription request to server
    client.publish({
      destination: '/app/subscribe',
      body: JSON.stringify({ type: 'SUBSCRIBE', symbols: newSymbols }),
    })

    set({ subscriptions: new Map(subscriptions), subscribedSymbols: new Set(subscribedSymbols) })
  },

  unsubscribe: (symbols: string[]) => {
    const { client, subscriptions, subscribedSymbols } = get()
    
    if (!client || !client.connected) {
      return
    }

    symbols.forEach((symbol) => {
      const subscription = subscriptions.get(symbol)
      if (subscription) {
        subscription.unsubscribe()
        subscriptions.delete(symbol)
        subscribedSymbols.delete(symbol)
      }
    })

    // Send unsubscription request to server
    client.publish({
      destination: '/app/subscribe',
      body: JSON.stringify({ type: 'UNSUBSCRIBE', symbols }),
    })

    set({ subscriptions: new Map(subscriptions), subscribedSymbols: new Set(subscribedSymbols) })
  },

  updatePrice: (update: StockPriceUpdate) => {
    const { stockPrices } = get()
    stockPrices.set(update.symbol, update)
    set({ stockPrices: new Map(stockPrices) })
  },

  clearPrices: () => {
    set({ stockPrices: new Map() })
  },
}))
