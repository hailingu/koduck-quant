import { useEffect, useCallback } from 'react'
import { useWebSocketStore } from '../stores/websocket'
import type { StockPriceUpdate } from '../types'

/**
 * WebSocket Hook
 * 
 * 提供 WebSocket 连接的 React Hook 接口，自动处理连接生命周期。
 * 
 * @example
 * const { connectionState, subscribe, unsubscribe, stockPrices } = useWebSocket()
 */
export function useWebSocket() {
  const {
    connectionState,
    stockPrices,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
  } = useWebSocketStore()

  // Auto-connect on mount, auto-disconnect on unmount
  useEffect(() => {
    connect()
  }, [connect])

  // Subscribe to symbols
  const subscribeSymbols = useCallback((symbols: string[]) => {
    subscribe(symbols)
  }, [subscribe])

  // Unsubscribe from symbols
  const unsubscribeSymbols = useCallback((symbols: string[]) => {
    unsubscribe(symbols)
  }, [unsubscribe])

  // Get price for a specific symbol
  const getPrice = useCallback((symbol: string): StockPriceUpdate | undefined => {
    return stockPrices.get(symbol)
  }, [stockPrices])

  // Get all prices as array
  const getAllPrices = useCallback((): StockPriceUpdate[] => {
    return Array.from(stockPrices.values())
  }, [stockPrices])

  return {
    // Connection state
    connectionState,
    isConnected: connectionState === 'connected',
    isConnecting: connectionState === 'connecting',
    isDisconnected: connectionState === 'disconnected',
    isReconnecting: connectionState === 'reconnecting',
    
    // Subscription methods
    subscribe: subscribeSymbols,
    unsubscribe: unsubscribeSymbols,
    
    // Price data
    stockPrices,
    getPrice,
    getAllPrices,
    
    // Manual connect/disconnect (for special cases)
    connect,
    disconnect,
  }
}

/**
 * Hook for managing WebSocket subscriptions based on watchlist items
 * Automatically subscribes when watchlist changes
 */
export function useWebSocketSubscription(
  symbols: string[],
  enabled: boolean = true
) {
  const { connect, subscribe, unsubscribe, connectionState, stockPrices } = useWebSocketStore()

  useEffect(() => {
    if (!enabled || symbols.length === 0) {
      return
    }

    connect()
  }, [enabled, symbols, connect])

  useEffect(() => {
    if (!enabled || symbols.length === 0 || connectionState !== 'connected') {
      return
    }

    // Subscribe to all symbols
    subscribe(symbols)

    // Cleanup: unsubscribe when component unmounts or symbols change
    return () => {
      unsubscribe(symbols)
    }
  }, [symbols, enabled, connectionState, subscribe, unsubscribe])

  // Return stock prices for the subscribed symbols
  const subscribedPrices = symbols
    .map((symbol) => stockPrices.get(symbol))
    .filter((price): price is StockPriceUpdate => price !== undefined)

  return {
    prices: subscribedPrices,
    isConnected: connectionState === 'connected',
  }
}
