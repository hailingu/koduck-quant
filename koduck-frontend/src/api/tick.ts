import apiClient from './client';

// Tick data types
export interface Tick {
  time: string;  // HH:mm:ss
  price: number;
  size: number;
  amount: number;
  type: 'buy' | 'sell';
  flag: 'NORMAL' | 'BLOCK_ORDER' | 'ICEBERG';
  epochMillis?: number | null;
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
      timestamp: typeof tick.epochMillis === 'number' && Number.isFinite(tick.epochMillis)
        ? tick.epochMillis
        : Date.now(),
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
    
    const tickHistory = await tickApi.getTickHistory(symbol, {
      market: params.market,
      limit: 200,
    });
    const prices = tickHistory.data
      .map((tick) => tick.price)
      .filter((value) => typeof value === 'number' && Number.isFinite(value));
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

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
      minPrice,
      maxPrice,
    };
  },

  /**
   * Get volume summary for a symbol
   */
  async getVolumeSummary(
    symbol: string,
    days: number = 7,
    market: string = 'AShare'
  ): Promise<VolumeSummary> {
    const history = await tickApi.getTickHistory(symbol, {
      market,
      limit: 500,
    });
    if (history.data.length === 0) {
      return {
        symbol,
        totalVolume: 0,
        avgVolume: 0,
        dailyData: [],
      };
    }
    const grouped = new Map<string, { tickCount: number; totalVolume: number; totalPrice: number }>();
    history.data.forEach((tick) => {
      const date = new Date(tick.timestamp).toISOString().slice(0, 10);
      const current = grouped.get(date) ?? { tickCount: 0, totalVolume: 0, totalPrice: 0 };
      current.tickCount += 1;
      current.totalVolume += tick.volume || 0;
      current.totalPrice += tick.price || 0;
      grouped.set(date, current);
    });
    const dailyData = Array.from(grouped.entries())
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .slice(0, days)
      .map(([date, value]) => ({
        date,
        tickCount: value.tickCount,
        totalVolume: value.totalVolume,
        avgPrice: value.tickCount > 0 ? value.totalPrice / value.tickCount : 0,
      }));

    const totalVolume = dailyData.reduce((sum, d) => sum + d.totalVolume, 0);
    
    return {
      symbol,
      totalVolume,
      avgVolume: dailyData.length > 0 ? Math.floor(totalVolume / dailyData.length) : 0,
      dailyData,
    };
  },
};

export default tickApi;
