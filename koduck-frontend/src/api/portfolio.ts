import request from './request'
import { marketApi } from './market'

// 持仓项
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

// 投资组合汇总
export interface PortfolioSummary {
  totalCost: number
  totalMarketValue: number
  totalPnl: number
  totalPnlPercent: number
  dailyPnl: number
  dailyPnlPercent: number
}

// 资产配置
export interface AssetAllocation {
  type: string
  value: number
  percent: number
}

// 行业分布
export interface SectorDistribution {
  sector: string
  value: number
  percent: number
}

// 收益曲线数据点
export interface PnLPoint {
  date: string
  value: number
  pnl: number
}

// 交易记录
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

// 添加持仓请求
export interface AddPortfolioRequest {
  market: string
  symbol: string
  name: string
  quantity: number
  avgCost: number
}

// 编辑持仓请求
export interface UpdatePortfolioRequest {
  quantity?: number
  avgCost?: number
}

// 添加交易记录请求
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
  // 获取持仓列表
  getPortfolio: (): Promise<PortfolioItem[]> => {
    return request.get<PortfolioItem[]>('/api/v1/portfolio')
  },

  // 获取投资组合汇总
  getPortfolioSummary: (): Promise<PortfolioSummary> => {
    return request.get<PortfolioSummary>('/api/v1/portfolio/summary')
  },

  // 获取资产配置（前端计算）
  getAssetAllocation: (): Promise<AssetAllocation[]> => {
    // 从持仓数据计算资产配置
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

  // 获取行业分布（按行业聚合）
  getSectorDistribution: (): Promise<SectorDistribution[]> => {
    return portfolioApi.getPortfolio().then(async (items) => {
      const totalValue = items.reduce((sum, item) => sum + item.marketValue, 0)
      if (totalValue === 0) return []

      const industryResults = await Promise.all(
        items.map(async (item) => {
          try {
            const industryInfo = await marketApi.getStockIndustry(item.symbol)
            return {
              item,
              industry:
                industryInfo.industry ||
                industryInfo.sector ||
                industryInfo.subIndustry ||
                '未知行业',
            }
          } catch {
            return {
              item,
              industry: '未知行业',
            }
          }
        })
      )

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
    })
  },

  // 获取收益曲线（前端 Mock，需要后端支持历史数据）
  getPnLHistory: (): Promise<PnLPoint[]> => {
    return portfolioApi.getPortfolioSummary().then((summary) => {
      // 生成简单的模拟历史数据
      const points: PnLPoint[] = []
      const days = 30
      const baseValue = summary.totalCost
      const currentValue = summary.totalMarketValue
      const dailyChange = (currentValue - baseValue) / days

      for (let i = days; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        const value = baseValue + dailyChange * (days - i)
        points.push({
          date: date.toISOString().split('T')[0],
          value: Math.round(value * 100) / 100,
          pnl: Math.round((value - baseValue) * 100) / 100,
        })
      }
      return points
    })
  },

  // 获取交易记录
  getTradeRecords: (): Promise<TradeRecord[]> => {
    return request.get<TradeRecord[]>('/api/v1/portfolio/trades')
  },

  // 添加持仓
  addPortfolio: (data: AddPortfolioRequest): Promise<PortfolioItem> => {
    return request.post<PortfolioItem>('/api/v1/portfolio', data)
  },

  // 更新持仓
  updatePortfolio: (id: number, data: UpdatePortfolioRequest): Promise<PortfolioItem> => {
    return request.put<PortfolioItem>(`/api/v1/portfolio/${id}`, data)
  },

  // 删除持仓
  deletePortfolio: (id: number): Promise<void> => {
    return request.delete<void>(`/api/v1/portfolio/${id}`)
  },

  // 添加交易记录
  addTrade: (data: AddTradeRequest): Promise<TradeRecord> => {
    return request.post<TradeRecord>('/api/v1/portfolio/trades', data)
  },
}
