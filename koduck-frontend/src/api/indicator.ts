import request from './request'

// 技术指标响应
export interface IndicatorResponse {
  symbol: string
  market: string
  indicator: string
  period: number
  values: Record<string, number>
  trend: string
  timestamp: string
}

// 可用指标信息
export interface IndicatorInfo {
  code: string
  name: string
  description: string
  defaultPeriods: number[]
  category: string
}

// 指标列表响应
export interface IndicatorListResponse {
  indicators: IndicatorInfo[]
}

export const indicatorApi = {
  // 获取可用指标列表
  getAvailableIndicators: (): Promise<IndicatorListResponse> => {
    return request.get<IndicatorListResponse>('/api/v1/indicators')
  },

  // 计算技术指标
  calculateIndicator: (
    symbol: string,
    market: string,
    indicator: string,
    period?: number
  ): Promise<IndicatorResponse> => {
    const params = new URLSearchParams()
    params.append('market', market)
    params.append('indicator', indicator)
    if (period !== undefined) {
      params.append('period', period.toString())
    }
    return request.get<IndicatorResponse>(`/api/v1/indicators/${symbol}?${params.toString()}`)
  },

  // 计算 MA (移动平均线)
  calculateMA: (symbol: string, market: string, period: number = 20): Promise<IndicatorResponse> => {
    return indicatorApi.calculateIndicator(symbol, market, 'MA', period)
  },

  // 计算 EMA (指数移动平均线)
  calculateEMA: (symbol: string, market: string, period: number = 20): Promise<IndicatorResponse> => {
    return indicatorApi.calculateIndicator(symbol, market, 'EMA', period)
  },

  // 计算 MACD
  calculateMACD: (symbol: string, market: string): Promise<IndicatorResponse> => {
    return indicatorApi.calculateIndicator(symbol, market, 'MACD')
  },

  // 计算 RSI
  calculateRSI: (symbol: string, market: string, period: number = 14): Promise<IndicatorResponse> => {
    return indicatorApi.calculateIndicator(symbol, market, 'RSI', period)
  },

  // 计算布林带
  calculateBOLL: (symbol: string, market: string, period: number = 20): Promise<IndicatorResponse> => {
    return indicatorApi.calculateIndicator(symbol, market, 'BOLL', period)
  },

  // 计算成交量
  calculateVOL: (symbol: string, market: string, period: number = 5): Promise<IndicatorResponse> => {
    return indicatorApi.calculateIndicator(symbol, market, 'VOL', period)
  },
}
