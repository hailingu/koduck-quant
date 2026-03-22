import { useEffect, useState } from 'react';
import { getMarketOverview, getHotStocks } from '@/api/market';
import { SearchBar } from '@/components/SearchBar';
import { 
  EmptyState, 
  SearchEmptyState, 
  ErrorEmptyState, 
  NoDataState,
  SkeletonLoader,
  TableSkeleton,
  CardSkeleton 
} from '@/components/EmptyState';

// Types
interface MarketIndex {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

interface HotStock {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  volume: number;
}

export default function Market() {
  // State
  const [indices, setIndices] = useState<MarketIndex[]>([]);
  const [hotStocks, setHotStocks] = useState<HotStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

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

  // Search handler
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    try {
      setSearchLoading(true);
      setSearchError(null);
      
      // Simulate search API call
      const results = await doSearch(query);
      setSearchResults(results);
    } catch (err) {
      setSearchError('搜索失败');
      console.error('Search error:', err);
    } finally {
      setSearchLoading(false);
    }
  };

  // Local search implementation
  const doSearch = async (query: string): Promise<any[]> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Return empty for certain queries to demonstrate empty state
    if (query === 'xxx' || query === '12345') {
      return [];
    }
    
    // Return mock results
    return [
      { symbol: '600519', name: '贵州茅台', price: 1650.00 },
      { symbol: '000858', name: '五粮液', price: 155.00 },
    ].filter(s => 
      s.name.includes(query) || 
      s.symbol.includes(query)
    );
  };

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
            <div className="text-2xl font-bold text-slate-200">{index.price.toFixed(2)}</div>
            <div className={`text-sm ${index.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {index.changePercent >= 0 ? '+' : ''}{index.changePercent.toFixed(2)}%
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
              <td className="py-3 text-right text-slate-300">{stock.price.toFixed(2)}</td>
              <td className={`py-3 text-right ${stock.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
              </td>
              <td className="py-3 text-right text-slate-400">{(stock.volume / 10000).toFixed(0)}万</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  // Render search results
  const renderSearchResults = () => {
    if (searchLoading) {
      return <SkeletonLoader lines={3} />;
    }
    
    if (searchError) {
      return (
        <div className="mt-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-sm text-red-400">{searchError}</p>
        </div>
      );
    }
    
    if (searchQuery && searchResults.length === 0) {
      return (
        <div className="mt-2">
          <SearchEmptyState 
            keyword={searchQuery}
            onRetry={() => setSearchQuery('')}
          />
        </div>
      );
    }
    
    if (searchResults.length > 0) {
      return (
        <div className="mt-2 bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          {searchResults.map((result) => (
            <div 
              key={result.symbol}
              className="p-3 hover:bg-slate-700 cursor-pointer border-b border-slate-700/50 last:border-0"
            >
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-medium text-slate-200">{result.name}</span>
                  <span className="ml-2 text-xs text-slate-500">{result.symbol}</span>
                </div>
                <span className="text-slate-300">¥{result.price.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      );
    }
    
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-200">市场行情</h1>
        
        {/* Search */}
        <div className="w-full md:w-96 relative">
          <SearchBar 
            placeholder="搜索股票代码或名称..."
            value={searchQuery}
            onChange={handleSearch}
          />
          {renderSearchResults()}
        </div>
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
