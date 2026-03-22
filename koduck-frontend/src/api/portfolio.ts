import { apiClient } from './client';

// ============================================================================
// Legacy Types (for backward compatibility with existing Portfolio page)
// ============================================================================

export interface PortfolioItem {
  id: string;
  symbol: string;
  name: string;
  sector: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  pnl: number;
  pnlPercent: number;
  weight: number;
}

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalPnl: number;
  totalPnlPercent: number;
  dailyPnl: number;
  dailyPnlPercent: number;
  availableCash: number;
  totalEquity: number;
}

export interface TradeRecord {
  id: string;
  symbol: string;
  name: string;
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  amount: number;
  time: string;
  date: string;
}

export interface SectorDistribution {
  name: string;
  value: number;
  percent: number;
  color?: string;
}

// Legacy API object for backward compatibility
export const portfolioApi = {
  async getPortfolio(): Promise<PortfolioItem[]> {
    const response = await apiClient.get('/portfolio/positions');
    return response || [];
  },

  async getPortfolioSummary(): Promise<PortfolioSummary> {
    const response = await apiClient.get('/portfolio/summary');
    return response || {
      totalValue: 0,
      totalCost: 0,
      totalPnl: 0,
      totalPnlPercent: 0,
      dailyPnl: 0,
      dailyPnlPercent: 0,
      availableCash: 0,
      totalEquity: 0,
    };
  },

  async getTradeRecords(): Promise<TradeRecord[]> {
    const response = await apiClient.get('/portfolio/trades');
    return response || [];
  },

  async getSectorDistribution(positions?: PortfolioItem[]): Promise<SectorDistribution[]> {
    // If positions provided, calculate distribution client-side
    if (positions && positions.length > 0) {
      const sectorMap = new Map<string, number>();
      const totalValue = positions.reduce((sum, p) => sum + p.marketValue, 0);

      positions.forEach((position) => {
        const current = sectorMap.get(position.sector) || 0;
        sectorMap.set(position.sector, current + position.marketValue);
      });

      const colors = ['#00F2FF', '#DE0541', '#FFB3B5', '#FFD81D', '#00DBE7', '#7D7D7D'];

      return Array.from(sectorMap.entries()).map(([name, value], index) => ({
        name,
        value,
        percent: totalValue > 0 ? (value / totalValue) * 100 : 0,
        color: colors[index % colors.length],
      }));
    }

    // Otherwise fetch from API
    const response = await apiClient.get('/portfolio/sector-distribution');
    return response || [];
  },
};

// ============================================================================
// Types - Issue #203: Northbound Flow
// ============================================================================

export interface PeriodFlow {
  name: string;
  inflow: number;
  inflow_formatted: string;
  start_time: string;
  end_time: string;
}

export interface StockFlow {
  symbol: string;
  name: string;
  net_flow: number;
  buy_amount: number;
  sell_amount: number;
  holding_change: number;
}

export interface NorthboundFlowResponse {
  date: string;
  total_inflow: number;
  total_inflow_formatted: string;
  shanghai_inflow: number;
  shenzhen_inflow: number;
  periods: PeriodFlow[];
  top_buys: StockFlow[];
  top_sells: StockFlow[];
  cumulative_inflow_5d: number;
  cumulative_inflow_20d: number;
  timestamp: string;
}

export interface NorthboundHistoryItem {
  date: string;
  inflow: number;
  inflow_formatted: string;
  shanghai_inflow: number;
  shenzhen_inflow: number;
}

export interface NorthboundHistoryResponse {
  data: NorthboundHistoryItem[];
  total_days: number;
}

// ============================================================================
// Types - Issue #208: PnL History
// ============================================================================

export interface PnLDataPoint {
  date: string;
  timestamp: number;
  pnl: number;
  pnl_formatted: string;
  pnl_percent: number;
  total_cost: number;
  total_market_value: number;
  cumulative_pnl: number;
}

export interface PnLSummary {
  total_pnl: number;
  total_pnl_formatted: string;
  total_pnl_percent: number;
  best_day?: PnLDataPoint;
  worst_day?: PnLDataPoint;
  volatility: number;
  sharpe_ratio: number;
}

export interface PnLHistoryResponse {
  period: string;
  start_date: string;
  end_date: string;
  data: PnLDataPoint[];
  summary: PnLSummary;
  benchmark_comparison: {
    portfolio_return: number;
    benchmark_return: number;
    alpha: number;
    beta: number;
  };
}

export type PeriodType = '1d' | '1w' | '1m' | '3m' | '1y' | 'ytd';

// ============================================================================
// Types - Issue #209: Sector Allocation
// ============================================================================

export interface SectorAllocationItem {
  name: string;
  code: string;
  value: number;
  value_formatted: string;
  percent: number;
  color: string;
  stock_count: number;
  stocks: Array<{
    symbol: string;
    name: string;
    value: number;
  }>;
}

export interface SectorAllocationResponse {
  total_value: number;
  total_value_formatted: string;
  cash_value: number;
  cash_percent: number;
  sectors: SectorAllocationItem[];
  diversification_score: number;
  top_heavy_risk: 'low' | 'medium' | 'high';
}

// ============================================================================
// API Functions - Issue #203: Northbound Flow
// ============================================================================

export async function getNorthboundFlow(tradeDate?: string): Promise<NorthboundFlowResponse> {
  const response = await apiClient.get('/market/northbound-flow', {
    params: { trade_date: tradeDate }
  });
  return response;
}

export async function getNorthboundHistory(days: number = 30): Promise<NorthboundHistoryResponse> {
  const response = await apiClient.get('/market/northbound-flow/history', {
    params: { days }
  });
  return response;
}

export async function getNorthboundStats(): Promise<any> {
  const response = await apiClient.get('/market/northbound-flow/stats');
  return response;
}

// ============================================================================
// API Functions - Issue #208: PnL History
// ============================================================================

export async function getPnLHistory(period: PeriodType = '1w'): Promise<PnLHistoryResponse> {
  const response = await apiClient.get('/portfolio/pnl-history', {
    params: { period }
  });
  return response;
}

export async function getDailyPnL(startDate?: string, endDate?: string): Promise<PnLDataPoint[]> {
  const response = await apiClient.get('/portfolio/pnl-history/daily', {
    params: { start_date: startDate, end_date: endDate }
  });
  return response;
}

// ============================================================================
// API Functions - Issue #209: Sector Allocation
// ============================================================================

export async function getSectorAllocation(minPercent: number = 0.5): Promise<SectorAllocationResponse> {
  const response = await apiClient.get('/portfolio/sector-allocation', {
    params: { min_percent: minPercent }
  });
  return response;
}

export async function getSectorAllocationTrend(months: number = 6): Promise<any[]> {
  const response = await apiClient.get('/portfolio/sector-allocation/trend', {
    params: { months }
  });
  return response;
}

export async function getPortfolioHoldings(sortBy: string = 'value', limit: number = 50): Promise<any[]> {
  const response = await apiClient.get('/portfolio/holdings', {
    params: { sort_by: sortBy, limit }
  });
  return response;
}

// ============================================================================
// Mock Data
// ============================================================================

export const mockNorthboundFlow: NorthboundFlowResponse = {
  date: '2024-01-15',
  total_inflow: 2400000000,
  total_inflow_formatted: '+¥24.0亿',
  shanghai_inflow: 1440000000,
  shenzhen_inflow: 960000000,
  periods: [
    { name: 'OPEN', inflow: 800000000, inflow_formatted: '+¥8.0亿', start_time: '09:30', end_time: '10:30' },
    { name: 'MID-DAY', inflow: 1200000000, inflow_formatted: '+¥12.0亿', start_time: '10:30', end_time: '14:00' },
    { name: 'CLOSE', inflow: 400000000, inflow_formatted: '+¥4.0亿', start_time: '14:00', end_time: '15:00' },
  ],
  top_buys: [
    { symbol: '600519', name: '贵州茅台', net_flow: 523000000, buy_amount: 892000000, sell_amount: 369000000, holding_change: 0.12 },
    { symbol: '000858', name: '五粮液', net_flow: 312000000, buy_amount: 456000000, sell_amount: 144000000, holding_change: 0.18 },
  ],
  top_sells: [
    { symbol: '002594', name: '比亚迪', net_flow: -234000000, buy_amount: 123000000, sell_amount: 357000000, holding_change: -0.14 },
  ],
  cumulative_inflow_5d: 8910000000,
  cumulative_inflow_20d: 34500000000,
  timestamp: new Date().toISOString()
};

export const mockPnLHistory: PnLHistoryResponse = {
  period: '1w',
  start_date: '2024-01-08',
  end_date: '2024-01-15',
  data: [
    { date: '2024-01-08', timestamp: 1704672000, pnl: 120000, pnl_formatted: '+12.0万', pnl_percent: 2.4, total_cost: 5000000, total_market_value: 5120000, cumulative_pnl: 120000 },
    { date: '2024-01-09', timestamp: 1704758400, pnl: 50000, pnl_formatted: '+5.0万', pnl_percent: 2.5, total_cost: 5000000, total_market_value: 5170000, cumulative_pnl: 170000 },
    { date: '2024-01-10', timestamp: 1704844800, pnl: -30000, pnl_formatted: '-3.0万', pnl_percent: 2.44, total_cost: 5000000, total_market_value: 5140000, cumulative_pnl: 140000 },
    { date: '2024-01-11', timestamp: 1704931200, pnl: 80000, pnl_formatted: '+8.0万', pnl_percent: 2.6, total_cost: 5000000, total_market_value: 5220000, cumulative_pnl: 220000 },
    { date: '2024-01-12', timestamp: 1705017600, pnl: 45000, pnl_formatted: '+4.5万', pnl_percent: 2.69, total_cost: 5000000, total_market_value: 5265000, cumulative_pnl: 265000 },
    { date: '2024-01-15', timestamp: 1705276800, pnl: 65000, pnl_formatted: '+6.5万', pnl_percent: 2.82, total_cost: 5000000, total_market_value: 5330000, cumulative_pnl: 330000 },
  ],
  summary: {
    total_pnl: 330000,
    total_pnl_formatted: '+33.0万',
    total_pnl_percent: 6.6,
    best_day: { date: '2024-01-08', timestamp: 1704672000, pnl: 120000, pnl_formatted: '+12.0万', pnl_percent: 2.4, total_cost: 5000000, total_market_value: 5120000, cumulative_pnl: 120000 },
    worst_day: { date: '2024-01-10', timestamp: 1704844800, pnl: -30000, pnl_formatted: '-3.0万', pnl_percent: 2.44, total_cost: 5000000, total_market_value: 5140000, cumulative_pnl: 140000 },
    volatility: 5.2,
    sharpe_ratio: 1.27
  },
  benchmark_comparison: {
    portfolio_return: 6.6,
    benchmark_return: 5.1,
    alpha: 1.5,
    beta: 0.95
  }
};

export const mockSectorAllocation: SectorAllocationResponse = {
  total_value: 2841902,
  total_value_formatted: '284.2万',
  cash_value: 500000,
  cash_percent: 17.6,
  sectors: [
    { name: '食品饮料', code: '食品饮料', value: 850000, value_formatted: '85.0万', percent: 29.9, color: '#00F2FF', stock_count: 2, stocks: [{ symbol: '600519', name: '贵州茅台', value: 500000 }, { symbol: '000858', name: '五粮液', value: 350000 }] },
    { name: '医药生物', code: '医药生物', value: 620000, value_formatted: '62.0万', percent: 21.8, color: '#DE0541', stock_count: 2, stocks: [{ symbol: '600276', name: '恒瑞医药', value: 320000 }, { symbol: '300760', name: '迈瑞医疗', value: 300000 }] },
    { name: '电子', code: '电子', value: 480000, value_formatted: '48.0万', percent: 16.9, color: '#7D7D7D', stock_count: 2, stocks: [{ symbol: '002594', name: '比亚迪', value: 280000 }, { symbol: '300750', name: '宁德时代', value: 200000 }] },
    { name: '银行', code: '银行', value: 320000, value_formatted: '32.0万', percent: 11.3, color: '#00DBE7', stock_count: 2, stocks: [{ symbol: '600036', name: '招商银行', value: 200000 }] },
    { name: '电力设备', code: '电力设备', value: 210000, value_formatted: '21.0万', percent: 7.4, color: '#FFD81D', stock_count: 2, stocks: [{ symbol: '601012', name: '隆基绿能', value: 150000 }] },
    { name: '现金', code: 'CASH', value: 500000, value_formatted: '50.0万', percent: 17.6, color: '#64748B', stock_count: 0, stocks: [] },
  ],
  diversification_score: 72.5,
  top_heavy_risk: 'medium'
};

// Legacy mock data for Portfolio API
export const mockPortfolioItems: PortfolioItem[] = [
  { id: '1', symbol: '600519', name: '贵州茅台', sector: '食品饮料', quantity: 100, avgCost: 1500, currentPrice: 1650, marketValue: 165000, pnl: 15000, pnlPercent: 10, weight: 25 },
  { id: '2', symbol: '000858', name: '五粮液', sector: '食品饮料', quantity: 200, avgCost: 140, currentPrice: 155, marketValue: 31000, pnl: 3000, pnlPercent: 10.7, weight: 15 },
];

export const mockPortfolioSummary: PortfolioSummary = {
  totalValue: 500000,
  totalCost: 450000,
  totalPnl: 50000,
  totalPnlPercent: 11.1,
  dailyPnl: 5000,
  dailyPnlPercent: 1.0,
  availableCash: 100000,
  totalEquity: 600000,
};

export const mockTradeRecords: TradeRecord[] = [
  { id: '1', symbol: '600519', name: '贵州茅台', type: 'buy', quantity: 100, price: 1500, amount: 150000, time: '09:30:00', date: '2024-01-15' },
  { id: '2', symbol: '000858', name: '五粮液', type: 'buy', quantity: 200, price: 140, amount: 28000, time: '10:15:00', date: '2024-01-15' },
];
