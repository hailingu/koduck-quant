import request from './request'

// 
export interface IndicatorResponse {
  symbol: string
  market: string
  indicator: string
  period: number
  values: Record<string, number>
  trend: string
  timestamp: string
}

// 
export interface IndicatorInfo {
  code: string
  name: string
  description: string
  defaultPeriods: number[]
  category: string
}

// 
export interface IndicatorListResponse {
  indicators: IndicatorInfo[]
}

export const indicatorApi = {
  // 
  getAvailableIndicators: (): Promise<IndicatorListResponse> => {
    return request.get<IndicatorListResponse>('/api/v1/indicators')
  },

  // 
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

  //  MA ()
  calculateMA: (symbol: string, market: string, period: number = 20): Promise<IndicatorResponse> => {
    return indicatorApi.calculateIndicator(symbol, market, 'MA', period)
  },

  //  EMA ()
  calculateEMA: (symbol: string, market: string, period: number = 20): Promise<IndicatorResponse> => {
    return indicatorApi.calculateIndicator(symbol, market, 'EMA', period)
  },

  //  MACD
  calculateMACD: (symbol: string, market: string): Promise<IndicatorResponse> => {
    return indicatorApi.calculateIndicator(symbol, market, 'MACD')
  },

  //  RSI
  calculateRSI: (symbol: string, market: string, period: number = 14): Promise<IndicatorResponse> => {
    return indicatorApi.calculateIndicator(symbol, market, 'RSI', period)
  },

  // 
  calculateBOLL: (symbol: string, market: string, period: number = 20): Promise<IndicatorResponse> => {
    return indicatorApi.calculateIndicator(symbol, market, 'BOLL', period)
  },

  // 
  calculateVOL: (symbol: string, market: string, period: number = 5): Promise<IndicatorResponse> => {
    return indicatorApi.calculateIndicator(symbol, market, 'VOL', period)
  },
}
