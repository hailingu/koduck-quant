import request from './request'
import { ApiResponse } from '@/types'

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

export const klineApi = {
  getKline: (params: {
    market: string
    symbol: string
    timeframe: string
    limit?: number
    beforeTime?: number
  }) => request.get<ApiResponse<KlineData[]>>('/api/v1/kline', { params }),

  getLatestPrice: (params: { market: string; symbol: string; timeframe?: string }) =>
    request.get<ApiResponse<{ symbol: string; price: number; timestamp: number }>>(
      '/api/v1/kline/price',
      { params }
    ),

  searchStocks: (keyword: string, limit: number = 20) =>
    request.get<ApiResponse<Array<{ symbol: string; name: string; market: string }>>>(
      '/api/v1/a-share/search',
      { params: { keyword, limit } }
    ),
}
