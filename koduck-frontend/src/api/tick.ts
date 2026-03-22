import apiClient from './client';

export interface Tick {
  time: string;  // HH:mm:ss
  price: number;
  size: number;
  amount: number;
  type: 'buy' | 'sell';
  flag: 'NORMAL' | 'BLOCK_ORDER' | 'ICEBERG';
}

export interface TickSummary {
  symbol: string;
  market: string;
  totalTrades: number;
  totalVolume: number;
  totalAmount: number;
  buyVolume: number;
  sellVolume: number;
  blockOrderCount: number;
  avgTradeSize: number;
  lastUpdated: string;
}

export interface MarketStats {
  symbol: string;
  market: string;
  timestamp: string;
  depthConcentration: number;
  bidAskSpread: number;
  bidAskSpreadPercent: number;
  liquidFlowIndex: number;
  liquidityScore: 'High' | 'Medium' | 'Low';
  volumeVelocity: number;
  avgTradeSize: number;
  networkLatency: number;
  dataSource: 'Level-1' | 'Level-2' | 'Simulated';
}

export interface MarketDepth {
  symbol: string;
  market: string;
  timestamp: string;
  bids: Array<{
    price: number;
    volume: number;
    orders: number;
  }>;
  asks: Array<{
    price: number;
    volume: number;
    orders: number;
  }>;
}

/**
 * Get tick-by-tick transaction data
 * Note: A-share Level-1 only provides 3-5s snapshots
 */
export async function getTickData(
  market: string,
  symbol: string,
  limit: number = 50
): Promise<Tick[]> {
  return apiClient.get<Tick[]>(`/market/ticks`, {
    params: { market, symbol, limit }
  });
}

/**
 * Get today's tick summary statistics
 */
export async function getTickSummary(market: string, symbol: string): Promise<TickSummary> {
  return apiClient.get<TickSummary>(`/market/ticks/summary`, {
    params: { market, symbol }
  });
}

/**
 * Get market statistics and liquidity indicators
 */
export async function getMarketStats(market: string, symbol: string): Promise<MarketStats> {
  return apiClient.get<MarketStats>(`/market/stats`, {
    params: { market, symbol }
  });
}

/**
 * Get detailed order book depth
 */
export async function getMarketDepth(
  market: string,
  symbol: string,
  levels: number = 10
): Promise<MarketDepth> {
  return apiClient.get<MarketDepth>(`/market/stats/depth`, {
    params: { market, symbol, levels }
  });
}
