import { apiClient } from './client';

// ============================================================================
// Types
// ============================================================================

export interface FearGreedIndex {
  value: number;
  label: string;
  prev_value: number;
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
  net_flow: number;
  change: number;
  market_cap: number;
  leading_stocks: string[];
}

export interface SectorFlowResponse {
  total_inflow: number;
  total_outflow: number;
  net_flow: number;
  sectors: SectorFlowItem[];
  timestamp: string;
}

export interface PriceRangeDistribution {
  range: string;
  count: number;
  percentage: number;
}

export interface MarketBreadth {
  total_stocks: number;
  gainers: number;
  losers: number;
  unchanged: number;
  gainers_percentage: number;
  losers_percentage: number;
  distribution: PriceRangeDistribution[];
  advance_decline_line: number;
  new_highs: number;
  new_lows: number;
  timestamp: string;
}

export interface BigOrderAlert {
  id: string;
  symbol: string;
  name: string;
  type: 'buy' | 'sell';
  amount: number;
  amount_formatted: string;
  price: number;
  volume: number;
  time: string;
  type_label: string;
  exchange: string;
  urgency: string;
}

export interface BigOrderStats {
  total_count_24h: number;
  total_volume_24h: number;
  buy_sell_ratio: number;
  top_sectors: { name: string; volume: number }[];
}

// API Response type
interface ApiResponse<T> {
  data: T;
  code: number;
  message: string;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get Fear/Greed Index for market sentiment
 * Issue #199
 */
export async function getFearGreedIndex(): Promise<FearGreedIndex> {
  const response = await apiClient.get<ApiResponse<FearGreedIndex>>('/market/fear-greed-index');
  return (response as unknown as ApiResponse<FearGreedIndex>).data;
}

/**
 * Get sector capital flow data
 * Issue #200
 */
export async function getSectorFlow(
  sortBy: string = 'net_flow',
  limit: number = 10
): Promise<SectorFlowResponse> {
  const response = await apiClient.get<ApiResponse<SectorFlowResponse>>('/market/sector-flow', {
    params: { sort_by: sortBy, limit }
  });
  return (response as unknown as ApiResponse<SectorFlowResponse>).data;
}

/**
 * Get market breadth statistics
 * Issue #201
 */
export async function getMarketBreadth(): Promise<MarketBreadth> {
  const response = await apiClient.get<ApiResponse<MarketBreadth>>('/market/breadth');
  return (response as unknown as ApiResponse<MarketBreadth>).data;
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
  const response = await apiClient.get<ApiResponse<BigOrderAlert[]>>('/market/big-orders', {
    params: { limit, order_type: orderType, min_amount: minAmount }
  });
  return (response as unknown as ApiResponse<BigOrderAlert[]>).data;
}

/**
 * Get big order statistics
 * Issue #202
 */
export async function getBigOrderStats(): Promise<BigOrderStats> {
  const response = await apiClient.get<ApiResponse<BigOrderStats>>('/market/big-orders/stats');
  return (response as unknown as ApiResponse<BigOrderStats>).data;
}

// ============================================================================
// Mock Data (for development)
// ============================================================================

export const mockFearGreedIndex: FearGreedIndex = {
  value: 64,
  label: "Greed",
  prev_value: 61,
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
  total_inflow: 4200000000,
  total_outflow: 2100000000,
  net_flow: 2100000000,
  sectors: [
    { name: "科技", code: "TECH", inflow: 1200000000, outflow: 320000000, net_flow: 880000000, change: 0.028, market_cap: 2500000000000, leading_stocks: ["NVDA", "AAPL"] },
    { name: "金融", code: "FINANCE", inflow: 2800000000, outflow: 510000000, net_flow: 2290000000, change: 0.045, market_cap: 1800000000000, leading_stocks: ["JPM", "BAC"] },
    { name: "能源", code: "ENERGY", inflow: 420000000, outflow: 850000000, net_flow: -430000000, change: -0.032, market_cap: 800000000000, leading_stocks: ["XOM"] },
  ],
  timestamp: new Date().toISOString()
};

export const mockMarketBreadth: MarketBreadth = {
  total_stocks: 4657,
  gainers: 2856,
  losers: 1567,
  unchanged: 234,
  gainers_percentage: 61.33,
  losers_percentage: 33.65,
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
  advance_decline_line: 1289,
  new_highs: 45,
  new_lows: 23,
  timestamp: new Date().toISOString()
};

export const mockBigOrders: BigOrderAlert[] = [
  { id: "1", symbol: "NVDA.US", name: "NVIDIA Corp", type: "buy", amount: 2400000, amount_formatted: "$2.4M", price: 485.50, volume: 4943, time: "14:23:45", type_label: "BLOCK ORDER", exchange: "NYSE", urgency: "high" },
  { id: "2", symbol: "TSLA.US", name: "Tesla Inc", type: "sell", amount: 1800000, amount_formatted: "$1.8M", price: 245.30, volume: 7338, time: "14:23:12", type_label: "DARK POOL", exchange: "NASDAQ", urgency: "medium" },
  { id: "3", symbol: "AAPL.US", name: "Apple Inc", type: "buy", amount: 3200000, amount_formatted: "$3.2M", price: 178.90, volume: 17887, time: "14:22:08", type_label: "ICEBERG", exchange: "NASDAQ", urgency: "high" },
  { id: "4", symbol: "MSFT.US", name: "Microsoft Corp", type: "buy", amount: 1500000, amount_formatted: "$1.5M", price: 378.20, volume: 3966, time: "14:21:45", type_label: "BLOCK ORDER", exchange: "NASDAQ", urgency: "medium" },
  { id: "5", symbol: "AMZN.US", name: "Amazon.com Inc", type: "sell", amount: 2100000, amount_formatted: "$2.1M", price: 145.80, volume: 14403, time: "14:21:12", type_label: "SWEEPER", exchange: "NASDAQ", urgency: "high" },
];
