import apiClient from './client';

// Tick data types
export interface Tick {
  time: string;  // HH:mm:ss
  price: number;
  size: number;
  amount: number;
  type: 'buy' | 'sell';
  flag: 'NORMAL' | 'BLOCK_ORDER' | 'ICEBERG';
}

// For Kline page compatibility
export interface TickData {
  id?: string;
  symbol?: string;
  timestamp: number;
  price: number;
  size?: number;
  amount?: number;
  type?: 'buy' | 'sell' | 'unknown';
  side?: 'buy' | 'sell';
  flag?: 'NORMAL' | 'BLOCK_ORDER' | 'ICEBERG';
  volume: number;
  count?: number;
  change?: number;
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

// For Kline page compatibility
export interface TickStatistics {
  symbol: string;
  totalTrades: number;
  buyVolume: number;
  sellVolume: number;
  blockOrderCount: number;
  avgTradeSize: number;
  buySellRatio: number;
  count: number;
  totalVolume: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
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

// Volume summary for Kline page
export interface VolumeSummary {
  symbol: string;
  totalVolume: number;
  avgVolume: number;
  dailyData: Array<{
    date: string;
    tickCount: number;
    totalVolume: number;
    avgPrice: number;
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
  return apiClient.get<Tick[]>(`/api/v1/market/ticks`, {
    params: { market, symbol, limit }
  });
}

/**
 * Get today's tick summary statistics
 */
export async function getTickSummary(market: string, symbol: string): Promise<TickSummary> {
  return apiClient.get<TickSummary>(`/api/v1/market/ticks/summary`, {
    params: { market, symbol }
  });
}

/**
 * Get market statistics and liquidity indicators
 */
export async function getMarketStats(market: string, symbol: string): Promise<MarketStats> {
  return apiClient.get<MarketStats>(`/api/v1/market/stats`, {
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
  return apiClient.get<MarketDepth>(`/api/v1/market/stats/depth`, {
    params: { market, symbol, levels }
  });
}

// API object for backward compatibility with existing code
export const tickApi = {
  /**
   * Get tick history for a symbol
   */
  async getTickHistory(
    symbol: string,
    params: { market: string; hours?: number; limit?: number }
  ): Promise<{ data: TickData[] }> {
    const ticks = await getTickData(params.market, symbol, params.limit || 50);
    
    // Transform to TickData format
    const data: TickData[] = ticks.map((tick, index) => ({
      id: `${symbol}-${tick.time}-${index}`,
      symbol,
      timestamp: new Date(`1970-01-01T${tick.time}`).getTime() || Date.now(),
      price: tick.price,
      size: tick.size,
      amount: tick.amount,
      type: tick.type,
      side: tick.type,
      flag: tick.flag,
      volume: tick.size,
    }));
    
    return { data };
  },

  /**
   * Get tick statistics for a symbol
   * Returns default values if no tick data available
   */
  async getTickStatistics(
    symbol: string,
    params: { market: string }
  ): Promise<TickStatistics | null> {
    const summary = await getTickSummary(params.market, symbol);
    
    // Return null if no tick data available
    if (!summary) {
      return null;
    }
    
    return {
      symbol: summary.symbol,
      totalTrades: summary.totalTrades,
      buyVolume: summary.buyVolume,
      sellVolume: summary.sellVolume,
      blockOrderCount: summary.blockOrderCount,
      avgTradeSize: summary.avgTradeSize,
      buySellRatio: summary.buyVolume / (summary.sellVolume || 1),
      count: summary.totalTrades,
      totalVolume: summary.totalVolume,
      avgPrice: summary.totalAmount / (summary.totalVolume || 1),
      minPrice: 0,
      maxPrice: 0,
    };
  },

  /**
   * Get volume summary for a symbol
   */
  async getVolumeSummary(
    symbol: string,
    days: number = 7
  ): Promise<VolumeSummary> {
    // This is a mock implementation - in production this would call a real API
    const dailyData = Array.from({ length: days }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const tickCount = Math.floor(Math.random() * 50000) + 10000;
      const totalVolume = Math.floor(Math.random() * 1000000) + 500000;
      return {
        date: date.toISOString().split('T')[0],
        tickCount,
        totalVolume,
        avgPrice: Math.random() * 100 + 50,
      };
    });

    const totalVolume = dailyData.reduce((sum, d) => sum + d.totalVolume, 0);
    
    return {
      symbol,
      totalVolume,
      avgVolume: Math.floor(totalVolume / days),
      dailyData,
    };
  },
};

export default tickApi;
