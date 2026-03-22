import request from './request'
import type { MarketType } from './market'

export interface TickData {
  timestamp: number
  price: number
  volume: number
  amount?: number
  change?: number
  changePercent?: number
  bidPrice?: number
  askPrice?: number
  open?: number
  high?: number
  low?: number
  prevClose?: number
}

export interface TickQueryResult {
  data: TickData[]
  total: number
  page: number
  hasMore: boolean
}

export interface TickStatistics {
  symbol: string
  startTime: string
  endTime: string
  count: number
  avgPrice: number | null
  maxPrice: number | null
  minPrice: number | null
  totalVolume: number | null
  totalAmount: number | null
  priceChange: number | null
  priceChangePercent: number | null
}

export interface TickExportResult {
  data: Array<{
    symbol: string
    ticks: TickData[]
    count: number
  }>
  metadata: {
    exportedAt: string
    startTime: string
    endTime: string
    totalSymbols: number
    successful: number
    failed: number
    format: string
  }
}

export interface TickHealthStatus {
  status: string
  timestamp: string
  database: string
  cache: string
  scheduler: string
  monitor: string
}

export interface TickMetrics {
  system: {
    totalSymbols: number
    activeSymbols: number
    totalTicks1h: number
    totalTicks24h: number
    avgLatencyMs: number
    dbStatus: string
    alertsActive: number
    updatedAt: string
  }
  alerts: {
    active: number
    critical: number
    error: number
    warning: number
  }
  collection: {
    lastCollectionTime: string | null
    monitoredSymbols: number
  }
}

export interface SymbolTickMetrics {
  symbol: string
  lastTickTime: string | null
  lastTickPrice: number | null
  tickCount1h: number
  tickCount24h: number
  avgLatencyMs: number
  maxLatencyMs: number
  dataGaps1h: number
  updatedAt: string
}

export const tickApi = {
  // Get tick history for a symbol
  getTickHistory: (
    symbol: string,
    params: {
      market?: MarketType
      hours?: number
      limit?: number
      offset?: number
    } = {}
  ) =>
    request.get<TickQueryResult>(`/api/v1/tick/symbols/${symbol}/ticks`, {
      params: {
        market: params.market ?? 'AShare',
        hours: params.hours ?? 1,
        limit: params.limit ?? 1000,
        offset: params.offset ?? 0,
      },
      timeout: 30000,
    }),

  // Get latest ticks for a symbol
  getLatestTicks: (symbol: string, limit: number = 100) =>
    request.get<TickData[]>(`/api/v1/market/stocks/${symbol}/ticks/latest`, {
      params: { limit },
      timeout: 10000,
    }),

  // Get tick statistics
  getTickStatistics: (
    symbol: string,
    params: {
      market?: MarketType
      startTime?: string
      endTime?: string
    } = {}
  ) =>
    request.get<TickStatistics>(`/api/v1/market/stocks/${symbol}/tick-statistics`, {
      params: {
        market: params.market ?? 'AShare',
        startTime: params.startTime,
        endTime: params.endTime,
      },
      timeout: 15000,
    }),

  // Export ticks for multiple symbols
  exportTicks: (symbols: string[], hours: number = 1) =>
    request.post<TickExportResult>('/api/v1/tick/export', {
      symbols,
      hours,
    }, {
      timeout: 60000,
    }),

  // Get tick system health
  getHealthStatus: () =>
    request.get<TickHealthStatus>('/api/v1/tick/health', {
      timeout: 5000,
    }),

  // Get system metrics
  getSystemMetrics: () =>
    request.get<TickMetrics>('/api/v1/tick/metrics', {
      timeout: 10000,
    }),

  // Get symbol-specific metrics
  getSymbolMetrics: (symbol: string) =>
    request.get<SymbolTickMetrics>(`/api/v1/tick/metrics/symbol/${symbol}`, {
      timeout: 10000,
    }),

  // Get volume summary
  getVolumeSummary: (symbol: string, days: number = 7) =>
    request.get<{
      symbol: string
      daysAnalyzed: number
      dailyData: Array<{
        date: string
        tickCount: number
        totalVolume: number
        totalAmount: number
        avgPrice: number
        minPrice: number
        maxPrice: number
      }>
      summary: {
        totalTicks: number
        totalVolume: number
        totalAmount: number
        avgDailyTicks: number
      }
    }>(`/api/v1/tick/symbols/${symbol}/volume-summary`, {
      params: { days },
      timeout: 15000,
    }),

  // Search ticks by price range
  searchByPriceRange: (
    symbol: string,
    minPrice: number,
    maxPrice: number,
    hours: number = 24
  ) =>
    request.get<{
      symbol: string
      minPrice: number
      maxPrice: number
      count: number
      ticks: TickData[]
    }>('/api/v1/tick/search/price-range', {
      params: {
        symbol,
        min_price: minPrice,
        max_price: maxPrice,
        hours,
      },
      timeout: 15000,
    }),
}
