import { useEffect, useState, useMemo } from 'react';
import { 
  getFearGreedIndex, 
  getSectorFlow, 
  getMarketBreadth, 
  getBigOrders,
  type FearGreedIndex,
  type SectorFlowResponse,
  type MarketBreadth,
  type BigOrderAlert 
} from '@/api/dashboard';
import { getMarketOverview, type MarketIndex } from '@/api/market';
import { FearGreedIndex as FearGreedIndexComponent } from './components/FearGreedIndex';
import { CapitalRiver, type FundFlowData } from './components/CapitalRiver';
import { BigOrderAlert as BigOrderAlertComponent } from './components/BigOrderAlert';
import { MarketBreadth as MarketBreadthComponent } from './components/MarketBreadth';
import SentimentRadar from '@/components/SentimentRadar';
import { EmptyState } from '@/components/EmptyState';

// Dashboard 数据接口
interface DashboardData {
  indices: MarketIndex[];
  fearGreed: FearGreedIndex | null;
  sectorFlow: SectorFlowResponse | null;
  marketBreadth: MarketBreadth | null;
  bigOrders: BigOrderAlert[];
}

// Transform sector flow data for Capital River
function transformSectorFlowToFundData(sectorFlow: SectorFlowResponse): FundFlowData[] {
  const result: FundFlowData[] = [];
  
  // Transform industry sectors
  sectorFlow.industry?.forEach((sector) => {
    result.push({
      layer: 'industry',
      sector: sector.name,
      inflow: sector.inflow,
      outflow: sector.outflow,
      netFlow: sector.net_flow,
    });
  });
  
  // Transform concept sectors
  sectorFlow.concept?.forEach((sector) => {
    result.push({
      layer: 'concept',
      sector: sector.name,
      inflow: sector.inflow,
      outflow: sector.outflow,
      netFlow: sector.net_flow,
    });
  });
  
  // Transform region sectors
  sectorFlow.region?.forEach((sector) => {
    result.push({
      layer: 'region',
      sector: sector.name,
      inflow: sector.inflow,
      outflow: sector.outflow,
      netFlow: sector.net_flow,
    });
  });
  
  return result;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData>({
    indices: [],
    fearGreed: null,
    sectorFlow: null,
    marketBreadth: null,
    bigOrders: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [
        indicesData,
        fearGreedData,
        sectorFlowData,
        marketBreadthData,
        bigOrdersData
      ] = await Promise.all([
        getMarketOverview().catch(() => []),
        getFearGreedIndex().catch(() => null),
        getSectorFlow().catch(() => null),
        getMarketBreadth().catch(() => null),
        getBigOrders(5).catch(() => [])
      ]);

      setData({
        indices: indicesData || [],
        fearGreed: fearGreedData,
        sectorFlow: sectorFlowData,
        marketBreadth: marketBreadthData,
        bigOrders: bigOrdersData
      });
    } catch (err) {
      console.error('Dashboard data fetch error:', err);
      setError('无法获取市场数据');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    
    // 每30秒自动刷新
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Transform sector flow data for Capital River
  const capitalRiverData = useMemo(() => {
    if (!data.sectorFlow) return [];
    return transformSectorFlowToFundData(data.sectorFlow);
  }, [data.sectorFlow]);

  if (loading) {
    return (
      <div className="h-full p-4 space-y-4">
        <div className="grid grid-cols-12 gap-4">
          {/* Left Column - Loading Skeleton */}
          <div className="col-span-12 lg:col-span-3 space-y-4">
            <div className="glass-panel p-4 rounded-xl animate-pulse h-64" />
            <div className="glass-panel p-4 rounded-xl animate-pulse h-40" />
          </div>
          
          {/* Center Column - Loading Skeleton */}
          <div className="col-span-12 lg:col-span-6">
            <div className="glass-panel p-4 rounded-xl animate-pulse h-80" />
          </div>
          
          {/* Right Column - Loading Skeleton */}
          <div className="col-span-12 lg:col-span-3 space-y-4">
            <div className="glass-panel p-4 rounded-xl animate-pulse h-48" />
            <div className="glass-panel p-4 rounded-xl animate-pulse h-48" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full p-4">
        <EmptyState
          type="error"
          title="数据加载失败"
          description={error}
          action={{ label: '重试', onClick: fetchDashboardData }}
        />
      </div>
    );
  }

  // 计算市场统计
  const totalInflow = data.sectorFlow?.total_inflow || 0;
  const totalOutflow = data.sectorFlow?.total_outflow || 0;
  const netFlow = totalInflow - totalOutflow;

  return (
    <div className="h-full px-4 pt-3 pb-2 space-y-3 overflow-hidden">
      {/* Header Stats - 更紧凑 */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="glass-panel p-3 rounded-lg">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider">市场净流入</div>
          <div className={`text-lg font-mono font-bold ${netFlow >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
            {netFlow >= 0 ? '+' : ''}{(netFlow / 100000000).toFixed(1)}亿
          </div>
        </div>
        <div className="glass-panel p-3 rounded-lg">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider">总流入</div>
          <div className="text-lg font-mono font-bold text-cyan-400">
            {(totalInflow / 100000000).toFixed(1)}亿
          </div>
        </div>
        <div className="glass-panel p-3 rounded-lg">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider">总流出</div>
          <div className="text-lg font-mono font-bold text-amber-400">
            {(totalOutflow / 100000000).toFixed(1)}亿
          </div>
        </div>
        <div className="glass-panel p-3 rounded-lg">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider">涨跌比</div>
          <div className="text-lg font-mono font-bold text-slate-200">
            {data.marketBreadth ? 
              `${data.marketBreadth.gainers}:${data.marketBreadth.losers}` : 
              '--'
            }
          </div>
        </div>
      </div>

      {/* Main Grid - 更紧凑的布局 */}
      <div className="grid grid-cols-12 gap-4 items-stretch">
        {/* Row 1 */}
        <div className="col-span-12 xl:col-span-3 2xl:col-span-2 h-full [&>*]:h-full">
          <SentimentRadar />
        </div>

        <div className="col-span-12 xl:col-span-6 2xl:col-span-7 h-full [&>*]:h-full">
          <CapitalRiver data={capitalRiverData} loading={loading} />
        </div>

        <div className="col-span-12 xl:col-span-3 xl:row-span-2 h-full [&>*]:h-full">
          <BigOrderAlertComponent limit={5} />
        </div>

        {/* Row 2 */}
        <div className="col-span-12 xl:col-span-3 2xl:col-span-2 h-full [&>*]:h-full">
          <FearGreedIndexComponent />
        </div>

        <div className="col-span-12 xl:col-span-6 2xl:col-span-7 h-full [&>*]:h-full">
          <MarketBreadthComponent />
        </div>
      </div>
    </div>
  );
}
