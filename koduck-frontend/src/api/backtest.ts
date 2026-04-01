import request from './request'

// 
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

// 
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

// 
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
  // 
  getBacktestResults: (): Promise<BacktestResult[]> => {
    return request.get<BacktestResult[]>('/api/v1/backtest')
  },

  // 
  getBacktestResult: (id: number): Promise<BacktestResult> => {
    return request.get<BacktestResult>(`/api/v1/backtest/${id}`)
  },

  // 
  runBacktest: (data: RunBacktestRequest): Promise<BacktestResult> => {
    return request.post<BacktestResult>('/api/v1/backtest/run', data)
  },

  // 
  getBacktestTrades: (id: number): Promise<BacktestTrade[]> => {
    return request.get<BacktestTrade[]>(`/api/v1/backtest/${id}/trades`)
  },

  // 
  deleteBacktestResult: (id: number): Promise<void> => {
    return request.delete<void>(`/api/v1/backtest/${id}`)
  },
}
