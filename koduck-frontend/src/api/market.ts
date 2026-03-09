import request from './request'

/**
 * 股票基本信息
 */
export interface SymbolInfo {
  symbol: string
  name: string
  market: string
  price: number
  changePercent: number
  volume: number
  amount: number
}

/**
 * 股票实时行情
 */
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

/**
 * 市场指数
 */
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

/**
 * 市场行情 API
 */
export const marketApi = {
  /**
   * 股票搜索
   * @param keyword 搜索关键词
   * @param page 页码（从 1 开始）
   * @param size 每页数量
   */
  searchSymbols: (keyword: string, page: number = 1, size: number = 20) =>
    request.get<SymbolInfo[]>('/api/v1/market/search', {
      params: { keyword, page, size },
    }),

  /**
   * 获取股票详情
   * @param symbol 股票代码
   */
  getStockDetail: (symbol: string) =>
    request.get<PriceQuote>(`/api/v1/market/stocks/${symbol}`, { timeout: 15000 }),

  /**
   * 获取市场指数（上证、深证、创业板）
   */
  getMarketIndices: () =>
    request.get<MarketIndex[]>('/api/v1/market/indices'),
}
