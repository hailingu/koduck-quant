import request from './request'
import { marketApi } from './market'

// 
export interface PortfolioItem {
  id: number
  market: string
  symbol: string
  name: string
  quantity: number
  avgCost: number
  currentPrice: number
  marketValue: number
  pnl: number
  pnlPercent: number
}

// 
export interface PortfolioSummary {
  totalCost: number
  totalMarketValue: number
  totalPnl: number
  totalPnlPercent: number
  dailyPnl: number
  dailyPnlPercent: number
}

// 
export interface AssetAllocation {
  type: string
  value: number
  percent: number
}

// 
export interface SectorDistribution {
  sector: string
  value: number
  percent: number
}

// 
export interface PnLPoint {
  date: string
  value: number
  pnl: number
}

// 
export interface TradeRecord {
  id: number
  symbol: string
  name: string
  market: string
  type: 'BUY' | 'SELL'
  quantity: number
  price: number
  amount: number
  tradeTime: string
}

// 
export interface AddPortfolioRequest {
  market: string
  symbol: string
  name: string
  quantity: number
  avgCost: number
}

// 
export interface UpdatePortfolioRequest {
  quantity?: number
  avgCost?: number
}

// 
export interface AddTradeRequest {
  market: string
  symbol: string
  name: string
  type: 'BUY' | 'SELL'
  quantity: number
  price: number
  tradeTime?: string
}

export const portfolioApi = {
  // 
  getPortfolio: (): Promise<PortfolioItem[]> => {
    return request.get<PortfolioItem[]>('/api/v1/portfolio')
  },

  // 
  getPortfolioSummary: (): Promise<PortfolioSummary> => {
    return request.get<PortfolioSummary>('/api/v1/portfolio/summary')
  },

  // （）
  getAssetAllocation: (): Promise<AssetAllocation[]> => {
    // 
    return portfolioApi.getPortfolio().then((items) => {
      const totalValue = items.reduce((sum, item) => sum + item.marketValue, 0)
      if (totalValue === 0) return []
      return [
        {
          type: '股票',
          value: totalValue,
          percent: 100,
        },
      ]
    })
  },

  // （）
  getSectorDistribution: async (items: PortfolioItem[]): Promise<SectorDistribution[]> => {
    const totalValue = items.reduce((sum, item) => sum + item.marketValue, 0)
    if (totalValue === 0) return []

    const symbolSet = new Set(items.map((item) => item.symbol).filter((symbol) => symbol.trim().length > 0))
    let industryMap: Record<string, Awaited<ReturnType<typeof marketApi.getStockIndustry>>> = {}

    try {
      industryMap = await marketApi.getStockIndustries(Array.from(symbolSet))
    } catch {
      industryMap = {}
    }

    const industryResults = items.map((item) => {
      const industryInfo = industryMap[item.symbol]
      return {
        item,
        industry:
          industryInfo?.industry ||
          industryInfo?.sector ||
          industryInfo?.subIndustry ||
          '未知行业',
      }
    })

    const industryValueMap = new Map<string, number>()
    industryResults.forEach(({ item, industry }) => {
      industryValueMap.set(industry, (industryValueMap.get(industry) ?? 0) + item.marketValue)
    })

    return Array.from(industryValueMap.entries())
      .map(([sector, value]) => ({
        sector,
        value,
        percent: totalValue > 0 ? (value / totalValue) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value)
  },

  // （ Mock，）
  getPnLHistory: (summary: PortfolioSummary, activeDays: number = 30): Promise<PnLPoint[]> => {
    if (summary.totalCost <= 0 && summary.totalMarketValue <= 0) {
      return Promise.resolve([])
    }

    // ：
    // - <30: 
    // - >=30: 30
    const clampedDays = Math.max(1, Math.min(activeDays, 30))
    const points: PnLPoint[] = []
    const baseValue = summary.totalCost
    const currentValue = summary.totalMarketValue
    const dailyChange = clampedDays > 1 ? (currentValue - baseValue) / (clampedDays - 1) : 0

    for (let i = clampedDays - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const value = baseValue + dailyChange * (clampedDays - 1 - i)
      points.push({
        date: date.toISOString().split('T')[0],
        value: Math.round(value * 100) / 100,
        pnl: Math.round((value - baseValue) * 100) / 100,
      })
    }
    return Promise.resolve(points)
  },

  // 
  getTradeRecords: (): Promise<TradeRecord[]> => {
    return request.get<TradeRecord[]>('/api/v1/portfolio/trades')
  },

  // 
  addPortfolio: (data: AddPortfolioRequest): Promise<PortfolioItem> => {
    return request.post<PortfolioItem>('/api/v1/portfolio', data)
  },

  // 
  updatePortfolio: (id: number, data: UpdatePortfolioRequest): Promise<PortfolioItem> => {
    return request.put<PortfolioItem>(`/api/v1/portfolio/${id}`, data)
  },

  // 
  deletePortfolio: (id: number): Promise<void> => {
    return request.delete<void>(`/api/v1/portfolio/${id}`)
  },

  // 
  addTrade: (data: AddTradeRequest): Promise<TradeRecord> => {
    return request.post<TradeRecord>('/api/v1/portfolio/trades', data)
  },
}
