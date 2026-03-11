import request from './request'

export interface KlineData {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  amount?: number
}

export interface StockInfo {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  open: number
  high: number
  low: number
  prevClose: number
  volume: number
  amount: number
}

export interface LatestPriceResponse {
  symbol: string
  price: number
  timestamp: number
}

export interface SearchResult {
  symbol: string
  name: string
  market: string
}

export const klineApi = {
  getKline: (params: {
    symbol: string
    timeframe: string
    limit?: number
    beforeTime?: number
  }) =>
    request.get<KlineData[]>(`/api/v1/market/stocks/${params.symbol}/kline`, {
      params: {
        timeframe: params.timeframe,
        limit: params.limit,
        beforeTime: params.beforeTime,
      },
      timeout: 30000, // K 线数据可能需要更长时间
    }),

  getLatestPrice: (params: { symbol: string; timeframe?: string; market?: string }) =>
    request.get<LatestPriceResponse>('/api/v1/kline/price', {
      params: {
        market: params.market ?? 'AShare',
        symbol: params.symbol,
        timeframe: params.timeframe,
      },
      timeout: 10000,
    }),

  searchStocks: (keyword: string, limit: number = 20) =>
    request.get<SearchResult[]>('/api/v1/market/search', {
      params: { keyword, limit },
      timeout: 10000,
    }),
}
