export interface MarketIndex {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
}

export interface MarketOverview {
  upCount: number
  downCount: number
  flatCount: number
  volume: number
  amount: number
}

// 热门股票
export interface HotStock {
  symbol: string
  name: string
  market: string
  price: number
  change: number
  changePercent: number
  volume: number
}

export const dashboardApi = {
  // 获取主要市场指数（上证、深证、创业板）
  getMarketIndices: (): Promise<MarketIndex[]> => {
    // 由于后端暂时没有聚合接口，这里返回模拟数据
    // 后续可以替换为真实 API
    return Promise.resolve([
      { symbol: '000001', name: '上证指数', price: 0, change: 0, changePercent: 0 },
      { symbol: '399001', name: '深证成指', price: 0, change: 0, changePercent: 0 },
      { symbol: '399006', name: '创业板指', price: 0, change: 0, changePercent: 0 },
    ])
  },

  // 获取热门股票（按成交量）
  getHotStocks: (_limit: number = 10): Promise<HotStock[]> => {
    // 由于后端暂时没有该接口，返回空数组
    return Promise.resolve([])
  },
}
