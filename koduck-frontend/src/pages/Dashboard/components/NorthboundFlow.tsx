import { useEffect, useState } from 'react';
import { getNorthboundFlow, mockNorthboundFlow, type NorthboundFlowResponse, type PeriodFlow } from '../../../api/portfolio';

interface Props {
  useMock?: boolean;
}

export function NorthboundFlow({ useMock = false }: Props) {
  const [data, setData] = useState<NorthboundFlowResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'top'>('overview');

  useEffect(() => {
    async function fetchData() {
      try {
        if (useMock) {
          setData(mockNorthboundFlow);
        } else {
          const result = await getNorthboundFlow();
          setData(result);
        }
      } catch (error) {
        console.error('Failed to fetch northbound flow:', error);
        setData(mockNorthboundFlow);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    // Refresh every 60 seconds
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [useMock]);

  if (loading || !data) {
    return (
      <div className="glass-panel p-3 rounded-xl animate-pulse">
        <div className="h-36 bg-slate-800/50 rounded"></div>
      </div>
    );
  }

  const isPositive = data.total_inflow >= 0;

  return (
    <div className="glass-panel p-3 rounded-xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <div>
          <h2 className="text-sm font-headline font-semibold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-cyan-400 text-base">trending_up</span>
            北向资金流向
          </h2>
        </div>
        <div className={`text-base font-mono font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
          {data.total_inflow_formatted}
        </div>
      </div>

      {/* Period Bars */}
      <div className="space-y-2 mb-3">
        {data.periods.slice(0, 2).map((period) => (
          <PeriodBar key={period.name} period={period} totalInflow={Math.abs(data.total_inflow)} />
        ))}
      </div>

      {/* Shanghai/Shenzhen Split */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-slate-800/50 p-2 rounded">
          <div className="text-[10px] text-slate-500">沪股通</div>
          <div className={`text-sm font-mono font-bold ${data.shanghai_inflow >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {data.shanghai_inflow >= 0 ? '+' : ''}{(data.shanghai_inflow / 100000000).toFixed(1)}亿
          </div>
        </div>
        <div className="bg-slate-800/50 p-2 rounded">
          <div className="text-[10px] text-slate-500">深股通</div>
          <div className={`text-sm font-mono font-bold ${data.shenzhen_inflow >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {data.shenzhen_inflow >= 0 ? '+' : ''}{(data.shenzhen_inflow / 100000000).toFixed(1)}亿
          </div>
        </div>
      </div>

      {/* Cumulative Stats */}
      <div className="flex justify-between text-[10px] text-slate-500 mb-2">
        <span>5日: <span className={data.cumulative_inflow_5d >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{(data.cumulative_inflow_5d / 100000000).toFixed(0)}亿</span></span>
        <span>20日: <span className={data.cumulative_inflow_20d >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{(data.cumulative_inflow_20d / 100000000).toFixed(0)}亿</span></span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700/50 mb-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors ${
            activeTab === 'overview' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-400'
          }`}
        >
          净买入榜
        </button>
        <button
          onClick={() => setActiveTab('top')}
          className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors ${
            activeTab === 'top' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-400'
          }`}
        >
          净卖出榜
        </button>
      </div>

      {/* Top Buys/Sells */}
      <div className="space-y-1">
        {activeTab === 'overview' ? (
          data.top_buys.slice(0, 3).map((stock, idx) => (
            <StockRow key={stock.symbol} stock={stock} rank={idx + 1} type="buy" />
          ))
        ) : (
          data.top_sells.slice(0, 3).map((stock, idx) => (
            <StockRow key={stock.symbol} stock={stock} rank={idx + 1} type="sell" />
          ))
        )}
      </div>
    </div>
  );
}

function PeriodBar({ period, totalInflow }: { period: PeriodFlow; totalInflow: number }) {
  const isPositive = period.inflow >= 0;
  const percentage = Math.min((Math.abs(period.inflow) / Math.max(totalInflow, 1)) * 100, 100);

  return (
    <div>
      <div className="flex justify-between text-[10px] mb-0.5">
        <span className="text-slate-400">{period.name}</span>
        <span className={`font-mono ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
          {period.inflow_formatted}
        </span>
      </div>
      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${isPositive ? 'bg-emerald-500' : 'bg-rose-500'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function StockRow({ stock, rank, type }: { stock: unknown; rank: number; type: 'buy' | 'sell' }) {
  const isBuy = type === 'buy';
  const s = stock as { name: string; symbol: string; net_flow: number; holding_change: number };
  
  return (
    <div className="flex items-center justify-between py-1 border-b border-slate-800/30 last:border-0">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-slate-500 w-3">{rank}</span>
        <div>
          <div className="font-medium text-slate-200 text-xs">{s.name}</div>
          <div className="text-[10px] text-slate-500">{s.symbol}</div>
        </div>
      </div>
      <div className="text-right">
        <div className={`text-xs font-mono font-bold ${isBuy ? 'text-emerald-400' : 'text-rose-400'}`}>
          {isBuy ? '+' : ''}{(s.net_flow / 100000000).toFixed(2)}亿
        </div>
        <div className={`text-[9px] ${s.holding_change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          持仓{s.holding_change >= 0 ? '+' : ''}{s.holding_change.toFixed(2)}%
        </div>
      </div>
    </div>
  );
}
