import { useEffect, useState } from 'react';
import { getSectorFlow, mockSectorFlow, type SectorFlowResponse, type SectorFlowItem } from '../../../api/dashboard';

interface Props {
  useMock?: boolean;
}

function formatAmount(amount: number): string {
  if (amount >= 100000000) {
    return `${(amount / 100000000).toFixed(1)}亿`;
  }
  if (amount >= 10000) {
    return `${(amount / 10000).toFixed(1)}万`;
  }
  return amount.toString();
}

export function SectorFlow({ useMock = false }: Props) {
  const [data, setData] = useState<SectorFlowResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'industry' | 'concept' | 'region'>('industry');

  useEffect(() => {
    async function fetchData() {
      try {
        if (useMock) {
          setData(mockSectorFlow);
        } else {
          const result = await getSectorFlow();
          setData(result);
        }
      } catch (error) {
        console.error('Failed to fetch sector flow:', error);
        setData(mockSectorFlow);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [useMock]);

  if (loading || !data) {
    return (
      <div className="glass-panel p-6 rounded-xl animate-pulse">
        <div className="h-64 bg-slate-800/50 rounded"></div>
      </div>
    );
  }

  const getActiveSectors = (): SectorFlowItem[] => {
    switch (activeTab) {
      case 'industry':
        return data.industry || [];
      case 'concept':
        return data.concept || [];
      case 'region':
        return data.region || [];
      default:
        return [];
    }
  };

  const tabLabels: Record<typeof activeTab, string> = {
    industry: '行业板块',
    concept: '概念板块',
    region: '地域板块',
  };

  return (
    <div className="glass-panel p-6 rounded-xl">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-headline font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-cyan-400">account_tree</span>
            行业资金流向
          </h2>
          <p className="text-xs text-slate-400 mt-1">各行业板块资金流入流出情况</p>
        </div>
        <div className="text-right">
          <div className={`text-xl font-mono font-bold ${data.net_flow >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {data.net_flow >= 0 ? '+' : ''}{formatAmount(data.net_flow)}
          </div>
          <div className="text-xs text-slate-500">净流入</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(Object.keys(tabLabels) as Array<typeof activeTab>).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              activeTab === tab
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'
            }`}
          >
            {tabLabels[tab]}
          </button>
        ))}
      </div>

      {/* Sector Grid */}
      <div className="grid grid-cols-2 gap-3">
        {getActiveSectors().slice(0, 6).map((sector) => (
          <SectorCard key={`${activeTab}-${sector.name}`} sector={sector} />
        ))}
      </div>
    </div>
  );
}

function SectorCard({ sector }: { sector: SectorFlowItem }) {
  const isPositive = sector.net_flow >= 0;
  const maxFlow = Math.max(sector.inflow, sector.outflow, 1);
  
  return (
    <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-colors">
      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="font-medium text-slate-200 text-sm">{sector.name}</div>
        </div>
        <div className={`text-xs font-mono font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
          {isPositive ? '+' : ''}{sector.change > 0 ? '+' : ''}{(sector.change * 100).toFixed(2)}%
        </div>
      </div>

      {/* Flow bars */}
      <div className="space-y-1.5 mt-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 w-8">流入</span>
          <div className="flex-1 bg-slate-700 h-1.5 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full"
              style={{ width: `${(sector.inflow / maxFlow) * 100}%` }}
            />
          </div>
          <span className="text-xs text-emerald-400 w-12 text-right">{formatAmount(sector.inflow)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 w-8">流出</span>
          <div className="flex-1 bg-slate-700 h-1.5 rounded-full overflow-hidden">
            <div
              className="h-full bg-rose-500 rounded-full"
              style={{ width: `${(sector.outflow / maxFlow) * 100}%` }}
            />
          </div>
          <span className="text-xs text-rose-400 w-12 text-right">{formatAmount(sector.outflow)}</span>
        </div>
      </div>

      {/* Net flow indicator */}
      <div className="mt-2 pt-2 border-t border-slate-700/50 flex justify-between items-center">
        <span className="text-xs text-slate-400">净流入</span>
        <span className={`text-xs font-mono font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
          {isPositive ? '+' : ''}{formatAmount(sector.net_flow)}
        </span>
      </div>
    </div>
  );
}
