// import request from './request'

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

// Mock 数据 - 开发时使用，后端实现后替换
const mockPortfolioItems: PortfolioItem[] = [
  {
    id: 1,
    market: 'SZ',
    symbol: '000001',
    name: '平安银行',
    quantity: 1000,
    avgCost: 10.5,
    currentPrice: 12.8,
    marketValue: 12800,
    pnl: 2300,
    pnlPercent: 21.9,
  },
  {
    id: 2,
    market: 'SH',
    symbol: '600519',
    name: '贵州茅台',
    quantity: 100,
    avgCost: 1650,
    currentPrice: 1580,
    marketValue: 158000,
    pnl: -7000,
    pnlPercent: -4.24,
  },
  {
    id: 3,
    market: 'SZ',
    symbol: '002326',
    name: '永太科技',
    quantity: 500,
    avgCost: 8.2,
    currentPrice: 9.5,
    marketValue: 4750,
    pnl: 650,
    pnlPercent: 15.85,
  },
]

const mockSummary: PortfolioSummary = {
  totalCost: 175700,
  totalMarketValue: 175550,
  totalPnl: -4050,
  totalPnlPercent: -2.3,
  dailyPnl: 1250,
  dailyPnlPercent: 0.72,
}

const mockAssetAllocation: AssetAllocation[] = [
  { type: '股票', value: 175550, percent: 85.5 },
  { type: '现金', value: 29800, percent: 14.5 },
]

const mockSectorDistribution: SectorDistribution[] = [
  { sector: '银行', value: 12800, percent: 7.3 },
  { sector: '白酒', value: 158000, percent: 90.0 },
  { sector: '化工', value: 4750, percent: 2.7 },
]

const mockPnLHistory: PnLPoint[] = [
  { date: '2024-01-01', value: 100000, pnl: 0 },
  { date: '2024-01-15', value: 102500, pnl: 2500 },
  { date: '2024-02-01', value: 98000, pnl: -2000 },
  { date: '2024-02-15', value: 105000, pnl: 5000 },
  { date: '2024-03-01', value: 108000, pnl: 8000 },
  { date: '2024-03-15', value: 103000, pnl: 3000 },
  { date: '2024-04-01', value: 110000, pnl: 10000 },
  { date: '2024-04-15', value: 112000, pnl: 12000 },
  { date: '2024-05-01', value: 108000, pnl: 8000 },
  { date: '2024-05-15', value: 115000, pnl: 15000 },
  { date: '2024-06-01', value: 118000, pnl: 18000 },
  { date: '2024-06-15', value: 114000, pnl: 14000 },
  { date: '2024-07-01', value: 120000, pnl: 20000 },
  { date: '2024-07-15', value: 122000, pnl: 22000 },
  { date: '2024-08-01', value: 119000, pnl: 19000 },
  { date: '2024-08-15', value: 125000, pnl: 25000 },
  { date: '2024-09-01', value: 128000, pnl: 28000 },
  { date: '2024-09-15', value: 124000, pnl: 24000 },
  { date: '2024-10-01', value: 130000, pnl: 30000 },
  { date: '2024-10-15', value: 132000, pnl: 32000 },
  { date: '2024-11-01', value: 129000, pnl: 29000 },
  { date: '2024-11-15', value: 135000, pnl: 35000 },
  { date: '2024-12-01', value: 138000, pnl: 38000 },
  { date: '2024-12-15', value: 134000, pnl: 34000 },
  { date: '2025-01-01', value: 140000, pnl: 40000 },
  { date: '2025-01-15', value: 142000, pnl: 42000 },
  { date: '2025-02-01', value: 139000, pnl: 39000 },
  { date: '2025-02-15', value: 145000, pnl: 45000 },
  { date: '2025-03-01', value: 148000, pnl: 48000 },
  { date: '2025-03-15', value: 175550, pnl: -4050 },
]

const mockTradeRecords: TradeRecord[] = [
  {
    id: 1,
    symbol: '000001',
    name: '平安银行',
    market: 'SZ',
    type: 'BUY',
    quantity: 1000,
    price: 10.5,
    amount: 10500,
    tradeTime: '2025-02-01T10:30:00',
  },
  {
    id: 2,
    symbol: '600519',
    name: '贵州茅台',
    market: 'SH',
    type: 'BUY',
    quantity: 100,
    price: 1650,
    amount: 165000,
    tradeTime: '2025-01-15T14:20:00',
  },
  {
    id: 3,
    symbol: '002326',
    name: '永太科技',
    market: 'SZ',
    type: 'BUY',
    quantity: 500,
    price: 8.2,
    amount: 4100,
    tradeTime: '2025-03-01T09:45:00',
  },
]

export const portfolioApi = {
  // 获取持仓列表
  getPortfolio: (): Promise<PortfolioItem[]> => {
    // TODO: 替换为真实 API
    // return request.get<PortfolioItem[]>('/api/v1/portfolio')
    return Promise.resolve(mockPortfolioItems)
  },

  // 获取投资组合汇总
  getPortfolioSummary: (): Promise<PortfolioSummary> => {
    // TODO: 替换为真实 API
    // return request.get<PortfolioSummary>('/api/v1/portfolio/summary')
    return Promise.resolve(mockSummary)
  },

  // 获取资产配置
  getAssetAllocation: (): Promise<AssetAllocation[]> => {
    // TODO: 替换为真实 API
    // return request.get<AssetAllocation[]>('/api/v1/portfolio/allocation')
    return Promise.resolve(mockAssetAllocation)
  },

  // 获取行业分布
  getSectorDistribution: (): Promise<SectorDistribution[]> => {
    // TODO: 替换为真实 API
    // return request.get<SectorDistribution[]>('/api/v1/portfolio/sectors')
    return Promise.resolve(mockSectorDistribution)
  },

  // 获取收益曲线
  getPnLHistory: (): Promise<PnLPoint[]> => {
    // TODO: 替换为真实 API
    // return request.get<PnLPoint[]>('/api/v1/portfolio/pnl-history')
    return Promise.resolve(mockPnLHistory)
  },

  // 获取交易记录
  getTradeRecords: (): Promise<TradeRecord[]> => {
    // TODO: 替换为真实 API
    // return request.get<TradeRecord[]>('/api/v1/portfolio/trades')
    return Promise.resolve(mockTradeRecords)
  },

  // 添加持仓
  addPortfolio: (data: AddPortfolioRequest): Promise<PortfolioItem> => {
    // TODO: 替换为真实 API
    // return request.post<PortfolioItem>('/api/v1/portfolio', data)
    const newItem: PortfolioItem = {
      id: Date.now(),
      ...data,
      currentPrice: data.avgCost,
      marketValue: data.quantity * data.avgCost,
      pnl: 0,
      pnlPercent: 0,
    }
    mockPortfolioItems.push(newItem)
    return Promise.resolve(newItem)
  },

  // 更新持仓
  updatePortfolio: (id: number, data: UpdatePortfolioRequest): Promise<PortfolioItem> => {
    // TODO: 替换为真实 API
    // return request.patch<PortfolioItem>(`/api/v1/portfolio/${id}`, data)
    const item = mockPortfolioItems.find((i) => i.id === id)
    if (!item) throw new Error('Item not found')
    if (data.quantity !== undefined) item.quantity = data.quantity
    if (data.avgCost !== undefined) item.avgCost = data.avgCost
    item.marketValue = item.quantity * item.currentPrice
    item.pnl = (item.currentPrice - item.avgCost) * item.quantity
    item.pnlPercent = ((item.currentPrice - item.avgCost) / item.avgCost) * 100
    return Promise.resolve(item)
  },

  // 删除持仓
  deletePortfolio: (id: number): Promise<void> => {
    // TODO: 替换为真实 API
    // return request.delete<void>(`/api/v1/portfolio/${id}`)
    const index = mockPortfolioItems.findIndex((i) => i.id === id)
    if (index > -1) mockPortfolioItems.splice(index, 1)
    return Promise.resolve()
  },

  // 添加交易记录
  addTrade: (data: AddTradeRequest): Promise<TradeRecord> => {
    // TODO: 替换为真实 API
    // return request.post<TradeRecord>('/api/v1/portfolio/trades', data)
    const newTrade: TradeRecord = {
      id: Date.now(),
      ...data,
      amount: data.quantity * data.price,
      tradeTime: data.tradeTime || new Date().toISOString(),
    }
    mockTradeRecords.unshift(newTrade)
    return Promise.resolve(newTrade)
  },
}
