import { apiClient } from './client';

// ============================================================================
// Types
// ============================================================================

export interface FearGreedIndex {
  value: number;
  label: string;
  prevValue: number;
  change: number;
  timestamp: string;
  components: {
    volatility: number;
    momentum: number;
    volume: number;
    breadth: number;
    northbound: number;
  };
}

export interface SectorFlowItem {
  name: string;
  code: string;
  inflow: number;
  outflow: number;
  netFlow: number;
  change: number;
  marketCap: number;
  leadingStocks: string[];
}

export interface SectorFlowResponse {
  totalInflow: number;
  totalOutflow: number;
  netFlow: number;
  industry: SectorFlowItem[];
  concept: SectorFlowItem[];
  region: SectorFlowItem[];
  timestamp: string;
}

export interface SectorNetFlowItem {
  sectorType: 'industry' | 'concept' | 'region' | string;
  sectorName: string;
  mainForceNet: number;
  retailNet: number;
  superBigNet?: number | null;
  bigNet?: number | null;
  mediumNet?: number | null;
  smallNet?: number | null;
  changePct?: number | null;
  snapshotTime?: string | null;
}

export interface SectorNetFlowResponse {
  market: string;
  indicator: string;
  tradeDate: string;
  totalMainForceNet: number;
  totalRetailNet: number;
  industry: SectorNetFlowItem[];
  concept: SectorNetFlowItem[];
  region: SectorNetFlowItem[];
  source: string;
  quality: string;
}

export interface DailyNetFlow {
  market: string;
  flowType: string;
  tradeDate: string;
  netInflow: number;
  totalInflow?: number | null;
  totalOutflow?: number | null;
  currency: string;
  source: string;
  quality: string;
  snapshotTime: string;
  updatedAt: string;
}

export interface DailyBreadth {
  market: string;
  breadthType: string;
  tradeDate: string;
  gainers: number;
  losers: number;
  unchanged: number;
  suspended?: number | null;
  totalStocks: number;
  advanceDeclineLine: number;
  source: string;
  quality: string;
  snapshotTime: string;
  updatedAt: string;
}

export interface PriceRangeDistribution {
  range: string;
  count: number;
  percentage: number;
}

export interface MarketBreadth {
  totalStocks: number;
  gainers: number;
  losers: number;
  unchanged: number;
  gainersPercentage: number;
  losersPercentage: number;
  distribution: PriceRangeDistribution[];
  advanceDeclineLine: number;
  newHighs: number;
  newLows: number;
  timestamp: string;
}

export interface BigOrderAlert {
  id: string;
  symbol: string;
  name: string;
  type: 'buy' | 'sell';
  amount: number;
  amountFormatted: string;
  price: number;
  volume: number;
  time: string;
  typeLabel: string;
  exchange: string;
  urgency: string;
}

export interface BigOrderStats {
  totalCount24h: number;
  totalVolume24h: number;
  buySellRatio: number;
  topSectors: { name: string; volume: number }[];
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get Fear/Greed Index for market sentiment
 * Issue #199
 */
export async function getFearGreedIndex(): Promise<FearGreedIndex> {
  return apiClient.get<FearGreedIndex>('/api/v1/market/fear-greed-index', {
    timeout: 1500,
  });
}

/**
 * Get sector capital flow data
 * Issue #200
 */
export async function getSectorFlow(
  sortBy: string = 'net_flow',
  limit: number = 10
): Promise<SectorFlowResponse> {
  return apiClient.get<SectorFlowResponse>('/api/v1/market/sector-flow', {
    params: { sort_by: sortBy, limit },
    timeout: 1200,
  });
}

/**
 * Get sector net-flow snapshot data (DB-backed).
 */
export async function getSectorNetFlow(
  market: string = 'AShare',
  indicator: string = 'TODAY',
  limit: number = 10
): Promise<SectorNetFlowResponse> {
  return apiClient.get<SectorNetFlowResponse>('/api/v1/market/sector-net-flow', {
    params: { market, indicator, limit },
    timeout: 4000,
  });
}

/**
 * Get daily market net flow (latest trading day by default)
 */
export async function getDailyNetFlow(
  market: string = 'AShare',
  flowType: string = 'MAIN_FORCE'
): Promise<DailyNetFlow> {
  return apiClient.get<DailyNetFlow>('/api/v1/market/net-flow/daily', {
    params: { market, flowType }
  });
}

/**
 * Get daily market net-flow history
 */
export async function getDailyNetFlowHistory(
  from: string,
  to: string,
  market: string = 'AShare',
  flowType: string = 'MAIN_FORCE'
): Promise<DailyNetFlow[]> {
  const response = await apiClient.get<DailyNetFlow[]>('/api/v1/market/net-flow/daily/history', {
    params: { from, to, market, flowType }
  });
  return response || [];
}

/**
 * Get daily market breadth (latest trading day by default)
 */
export async function getDailyBreadth(
  market: string = 'AShare',
  breadthType: string = 'ALL_A'
): Promise<DailyBreadth> {
  return apiClient.get<DailyBreadth>('/api/v1/market/breadth/daily', {
    params: { market, breadthType }
  });
}

/**
 * Get daily market breadth history
 */
export async function getDailyBreadthHistory(
  from: string,
  to: string,
  market: string = 'AShare',
  breadthType: string = 'ALL_A'
): Promise<DailyBreadth[]> {
  const response = await apiClient.get<DailyBreadth[]>('/api/v1/market/breadth/daily/history', {
    params: { from, to, market, breadthType }
  });
  return response || [];
}

/**
 * Get market breadth statistics
 * Issue #201
 */
export async function getMarketBreadth(): Promise<MarketBreadth> {
  return apiClient.get<MarketBreadth>('/api/v1/market/breadth', {
    timeout: 1500,
  });
}

/**
 * Get big order alerts
 * Issue #202
 */
export async function getBigOrders(
  limit: number = 10,
  orderType?: 'buy' | 'sell',
  minAmount: number = 500000
): Promise<BigOrderAlert[]> {
  const response = await apiClient.get<BigOrderAlert[]>('/api/v1/market/big-orders', {
    params: { limit, order_type: orderType, min_amount: minAmount },
    timeout: 1500,
  });
  return response || [];
}

/**
 * Get big order statistics
 * Issue #202
 */
export async function getBigOrderStats(): Promise<BigOrderStats> {
  return apiClient.get<BigOrderStats>('/api/v1/market/big-orders/stats');
}

// ============================================================================
// Mock Data (for development)
// ============================================================================

export const mockFearGreedIndex: FearGreedIndex = {
  value: 64,
  label: "Greed",
  prevValue: 61,
  change: 3,
  timestamp: new Date().toISOString(),
  components: {
    volatility: 65,
    momentum: 72,
    volume: 58,
    breadth: 61,
    northbound: 55
  }
};

export const mockSectorFlow: SectorFlowResponse = {
  totalInflow: 4200000000,
  totalOutflow: 2100000000,
  netFlow: 2100000000,
  industry: [
    { name: "半导体", code: "", inflow: 1520000000, outflow: 320000000, netFlow: 1200000000, change: 0.028, marketCap: 2500000000000, leadingStocks: ["中芯国际", "韦尔股份"] },
    { name: "银行", code: "", inflow: 2830000000, outflow: 510000000, netFlow: 2320000000, change: 0.045, marketCap: 1800000000000, leadingStocks: ["招商银行", "平安银行"] },
    { name: "电力", code: "", inflow: 820000000, outflow: 250000000, netFlow: 570000000, change: 0.022, marketCap: 800000000000, leadingStocks: ["长江电力", "华能水电"] },
  ],
  concept: [
    { name: "人工智能", code: "", inflow: 2250000000, outflow: 420000000, netFlow: 1830000000, change: 0.035, marketCap: 2200000000000, leadingStocks: ["科大讯飞", "寒武纪"] },
    { name: "芯片", code: "", inflow: 1830000000, outflow: 310000000, netFlow: 1520000000, change: 0.028, marketCap: 1900000000000, leadingStocks: ["中芯国际", "兆易创新"] },
    { name: "新能源", code: "", inflow: 1250000000, outflow: 520000000, netFlow: 730000000, change: 0.018, marketCap: 1500000000000, leadingStocks: ["宁德时代", "比亚迪"] },
  ],
  region: [
    { name: "浙江", code: "", inflow: 2550000000, outflow: 820000000, netFlow: 1730000000, change: 0.032, marketCap: 2500000000000, leadingStocks: ["海康威视", "宁波银行"] },
    { name: "广东", code: "", inflow: 3230000000, outflow: 910000000, netFlow: 2320000000, change: 0.042, marketCap: 3000000000000, leadingStocks: ["中国平安", "美的集团"] },
    { name: "上海", code: "", inflow: 1880000000, outflow: 650000000, netFlow: 1230000000, change: 0.025, marketCap: 1800000000000, leadingStocks: ["浦发银行", "上汽集团"] },
  ],
  timestamp: new Date().toISOString()
};

export const mockMarketBreadth: MarketBreadth = {
  totalStocks: 4657,
  gainers: 2856,
  losers: 1567,
  unchanged: 234,
  gainersPercentage: 61.33,
  losersPercentage: 33.65,
  distribution: [
    { range: ">+10%", count: 45, percentage: 0.97 },
    { range: "+7%~+10%", count: 123, percentage: 2.64 },
    { range: "+5%~+7%", count: 234, percentage: 5.02 },
    { range: "+3%~+5%", count: 456, percentage: 9.79 },
    { range: "+1%~+3%", count: 1123, percentage: 24.11 },
    { range: "-1%~+1%", count: 1234, percentage: 26.50 },
    { range: "-3%~-1%", count: 678, percentage: 14.56 },
    { range: "-5%~-3%", count: 345, percentage: 7.41 },
    { range: "-7%~-5%", count: 234, percentage: 5.02 },
    { range: "-10%~-7%", count: 123, percentage: 2.64 },
    { range: "<-10%", count: 62, percentage: 1.33 },
  ],
  advanceDeclineLine: 1289,
  newHighs: 45,
  newLows: 23,
  timestamp: new Date().toISOString()
};

export const mockBigOrders: BigOrderAlert[] = [
  { id: "1", symbol: "NVDA.US", name: "NVIDIA Corp", type: "buy", amount: 2400000, amountFormatted: "$2.4M", price: 485.50, volume: 4943, time: "14:23:45", typeLabel: "BLOCK ORDER", exchange: "NYSE", urgency: "high" },
  { id: "2", symbol: "TSLA.US", name: "Tesla Inc", type: "sell", amount: 1800000, amountFormatted: "$1.8M", price: 245.30, volume: 7338, time: "14:23:12", typeLabel: "DARK POOL", exchange: "NASDAQ", urgency: "medium" },
  { id: "3", symbol: "AAPL.US", name: "Apple Inc", type: "buy", amount: 3200000, amountFormatted: "$3.2M", price: 178.90, volume: 17887, time: "14:22:08", typeLabel: "ICEBERG", exchange: "NASDAQ", urgency: "high" },
  { id: "4", symbol: "MSFT.US", name: "Microsoft Corp", type: "buy", amount: 1500000, amountFormatted: "$1.5M", price: 378.20, volume: 3966, time: "14:21:45", typeLabel: "BLOCK ORDER", exchange: "NASDAQ", urgency: "medium" },
  { id: "5", symbol: "AMZN.US", name: "Amazon.com Inc", type: "sell", amount: 2100000, amountFormatted: "$2.1M", price: 145.80, volume: 14403, time: "14:21:12", typeLabel: "SWEEPER", exchange: "NASDAQ", urgency: "high" },
];
