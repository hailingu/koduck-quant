import request from './request'

export interface SymbolInfo {
  symbol: string
  name: string
  market: string
  price: number
  changePercent: number
  volume: number
  amount: number
}

export interface PriceQuote {
  symbol: string
  name: string
  price: number
  open: number
  high: number
  low: number
  prevClose: number
  volume: number
  amount: number
  change: number
  changePercent: number
  bidPrice: number
  bidVolume: number
  askPrice: number
  askVolume: number
  timestamp: string
}

export interface StockValuation {
  symbol: string
  name: string
  peTtm: number | null
  pb: number | null
  psTtm: number | null
  marketCap: number | null
  floatMarketCap: number | null
  totalShares: number | null
  floatShares: number | null
  floatRatio: number | null
  turnoverRate: number | null
}

export interface StockIndustry {
  symbol: string
  name: string
  industry: string | null
  sector: string | null
  subIndustry: string | null
  board: string | null
}

export interface MarketIndex {
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
  timestamp: string
}

export type MarketType = 'AShare' | 'HK' | 'US' | 'Forex' | 'Futures'

export const marketApi = {
  searchSymbols: (keyword: string, market?: MarketType, page: number = 1, size: number = 20) =>
    request.get<SymbolInfo[]>('/api/v1/market/search', {
      params: { keyword, market, page, size },
    }),

  getStockDetail: (symbol: string, market: MarketType = 'AShare') =>
    request.get<PriceQuote>(`/api/v1/market/stocks/${symbol}`, { 
      params: { market },
      timeout: 15000 
    }),

  getMarketIndices: () =>
    request.get<MarketIndex[]>('/api/v1/market/indices'),

  getStockValuation: (symbol: string) =>
    request.get<StockValuation>(`/api/v1/market/stocks/${symbol}/valuation`, { timeout: 15000 }),

  getStockIndustry: async (symbol: string): Promise<StockIndustry | null> => {
    try {
      return await request.get<StockIndustry>(`/api/v1/market/stocks/${symbol}/industry`, { timeout: 10000 })
    } catch {
      return null
    }
  },

  getStockIndustries: (symbols: string[]) =>
    request.post<Record<string, StockIndustry>>('/api/v1/market/stocks/industry/batch', symbols, {
      timeout: 10000,
    }),
}
