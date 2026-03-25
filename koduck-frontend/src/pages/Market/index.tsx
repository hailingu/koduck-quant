import { useEffect, useState } from 'react';
import { getMarketOverview, getHotStocks } from '@/api/market';
import { 
  EmptyState, 
  ErrorEmptyState, 
  NoDataState,
  TableSkeleton,
  CardSkeleton 
} from '@/components/EmptyState';

// Types
interface MarketIndex {
  symbol: string;
  name: string;
  type: 'STOCK' | 'INDEX';
  price: number | null;
  change: number | null;
  changePercent: number | null;
}

interface HotStock {
  symbol: string;
  name: string;
  price: number | null;
  changePercent: number | null;
  volume: number | null;
}

function formatFixed(value: number | null | undefined, digits = 2): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '--';
}

function formatSignedPercent(value: number | null | undefined, digits = 2): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '--';
  }
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`;
}

function formatVolume(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '--';
  }
  // 大于等于1亿显示为亿，否则显示为万
  if (value >= 100000000) {
    return `${(value / 100000000).toFixed(1)}亿`;
  }
  return `${(value / 10000).toFixed(0)}万`;
}

export default function Market() {
  // State
  const [indices, setIndices] = useState<MarketIndex[]>([]);
  const [hotStocks, setHotStocks] = useState<HotStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch market data
  const fetchMarketData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [indicesData, hotData] = await Promise.all([
        getMarketOverview(),
        getHotStocks()
      ]);
      
      setIndices(indicesData || []);
      setHotStocks(hotData || []);
    } catch (err) {
      setError('无法获取市场数据');
      console.error('Market data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchMarketData();
  }, []);

  // Render market indices section
  const renderIndices = () => {
    if (loading) {
      return <CardSkeleton count={4} />;
    }
    
    if (error) {
      return (
        <ErrorEmptyState 
          message={error} 
          onRetry={fetchMarketData} 
        />
      );
    }
    
    if (indices.length === 0) {
      return (
        <NoDataState 
          message="暂无市场指数数据" 
          onRefresh={fetchMarketData} 
        />
      );
    }
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {indices.map((index) => (
          <div key={index.symbol} className="glass-panel p-4 rounded-xl">
            <div className="text-sm text-slate-400">{index.name}</div>
            <div className="text-2xl font-bold text-slate-200">{formatFixed(index.price, 2)}</div>
            <div className={`text-sm ${(index.changePercent ?? 0) >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
              {formatSignedPercent(index.changePercent, 2)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Render hot stocks section
  const renderHotStocks = () => {
    if (loading) {
      return <TableSkeleton rows={5} columns={5} />;
    }
    
    if (error) {
      return (
        <EmptyState
          type="error"
          title="无法加载热门股票"
          description={error}
          action={{ label: '重试', onClick: fetchMarketData }}
        />
      );
    }
    
    if (hotStocks.length === 0) {
      return (
        <EmptyState
          type="data"
          title="暂无热门股票"
          description="市场可能已收盘或数据更新中"
          action={{ label: '刷新', onClick: fetchMarketData }}
        />
      );
    }
    
    return (
      <table className="w-full">
        <thead className="text-xs text-slate-500 border-b border-slate-700">
          <tr>
            <th className="py-3 text-left">代码</th>
            <th className="py-3 text-left">名称</th>
            <th className="py-3 text-right">价格</th>
            <th className="py-3 text-right">涨跌幅</th>
            <th className="py-3 text-right">成交量</th>
          </tr>
        </thead>
        <tbody>
          {hotStocks.map((stock) => (
            <tr key={stock.symbol} className="border-b border-slate-800/50 hover:bg-slate-800/30">
              <td className="py-3 text-slate-300">{stock.symbol}</td>
              <td className="py-3 text-slate-300">{stock.name}</td>
              <td className="py-3 text-right text-slate-300">{formatFixed(stock.price, 2)}</td>
              <td className={`py-3 text-right ${(stock.changePercent ?? 0) >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                {formatSignedPercent(stock.changePercent, 2)}
              </td>
              <td className="py-3 text-right text-slate-400">{formatVolume(stock.volume)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center">
        <h1 className="text-2xl font-bold text-slate-200">市场行情</h1>
      </div>

      {/* Market Indices */}
      <section>
        <h2 className="text-lg font-semibold text-slate-300 mb-4">市场指数</h2>
        {renderIndices()}
      </section>

      {/* Hot Stocks */}
      <section>
        <h2 className="text-lg font-semibold text-slate-300 mb-4">热门股票</h2>
        <div className="glass-panel rounded-xl overflow-hidden">
          {renderHotStocks()}
        </div>
      </section>
    </div>
  );
}
