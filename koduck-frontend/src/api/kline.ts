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
    market: string
    symbol: string
    timeframe: string
    limit?: number
    beforeTime?: number
  }) => request.get<KlineData[]>('/api/v1/kline', { params }),

  getLatestPrice: (params: { market: string; symbol: string; timeframe?: string }) =>
    request.get<LatestPriceResponse>('/api/v1/kline/price', { params }),

  searchStocks: (keyword: string, limit: number = 20) =>
    request.get<SearchResult[]>('/api/v1/a-share/search', { params: { keyword, limit } }),
}
