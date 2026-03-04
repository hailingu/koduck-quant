import { marketApi } from './market'
import type { MarketIndex, SymbolInfo } from './market'

export interface MarketOverview {
  upCount: number
  downCount: number
  flatCount: number
  volume: number
  amount: number
}

// 导出类型别名以保持兼容性
export type HotStock = SymbolInfo

/**
 * 仪表盘 API
 * 复用 marketApi 的实现
 */
export const dashboardApi = {
  /**
   * 获取主要市场指数（上证、深证、创业板）
   */
  getMarketIndices: (): Promise<MarketIndex[]> => {
    return marketApi.getMarketIndices()
  },
}

// 为了向后兼容，保留原有的类型导出
export type { MarketIndex, SymbolInfo }
