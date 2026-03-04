import request from './request'

// 回测结果
export interface BacktestResult {
  id: number
  strategyId: number
  strategyName: string
  strategyVersion: number
  market: string
  symbol: string
  startDate: string
  endDate: string
  timeframe: string
  initialCapital: number
  commissionRate: number
  slippage: number
  finalCapital?: number
  totalReturn?: number
  annualizedReturn?: number
  maxDrawdown?: number
  sharpeRatio?: number
  totalTrades?: number
  winningTrades?: number
  losingTrades?: number
  winRate?: number
  avgProfit?: number
  avgLoss?: number
  profitFactor?: number
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'
  errorMessage?: string
  createdAt: string
  completedAt?: string
}

// 回测交易记录
export interface BacktestTrade {
  id: number
  tradeType: 'BUY' | 'SELL'
  tradeTime: string
  symbol: string
  price: number
  quantity: number
  amount: number
  commission: number
  slippageCost: number
  totalCost: number
  cashAfter: number
  positionAfter: number
  pnl?: number
  pnlPercent?: number
  signalReason?: string
}

// 运行回测请求
export interface RunBacktestRequest {
  strategyId: number
  market: string
  symbol: string
  startDate: string
  endDate: string
  timeframe?: string
  initialCapital: number
  commissionRate?: number
  slippage?: number
}

export const backtestApi = {
  // 获取回测结果列表
  getBacktestResults: (): Promise<BacktestResult[]> => {
    return request.get<BacktestResult[]>('/api/v1/backtest')
  },

  // 获取回测结果详情
  getBacktestResult: (id: number): Promise<BacktestResult> => {
    return request.get<BacktestResult>(`/api/v1/backtest/${id}`)
  },

  // 运行回测
  runBacktest: (data: RunBacktestRequest): Promise<BacktestResult> => {
    return request.post<BacktestResult>('/api/v1/backtest/run', data)
  },

  // 获取回测交易记录
  getBacktestTrades: (id: number): Promise<BacktestTrade[]> => {
    return request.get<BacktestTrade[]>(`/api/v1/backtest/${id}/trades`)
  },

  // 删除回测结果
  deleteBacktestResult: (id: number): Promise<void> => {
    return request.delete<void>(`/api/v1/backtest/${id}`)
  },
}
