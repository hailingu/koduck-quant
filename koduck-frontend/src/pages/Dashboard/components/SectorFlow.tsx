import React, { useEffect, useState } from 'react';
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

  return (
    <div className="glass-panel p-6 rounded-xl">
      <div className="flex justify-between items-center mb-6">
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

      {/* Sector Grid */}
      <div className="grid grid-cols-2 gap-3">
        {data.sectors.map((sector) => (
          <SectorCard key={sector.code} sector={sector} />
        ))}
      </div>
    </div>
  );
}

function SectorCard({ sector }: { sector: SectorFlowItem }) {
  const isPositive = sector.net_flow >= 0;
  const flowIntensity = Math.min(Math.abs(sector.net_flow) / 1000000000, 1); // Max 10亿

  return (
    <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-colors">
      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="font-medium text-slate-200">{sector.name}</div>
          <div className="text-xs text-slate-500">{sector.code}</div>
        </div>
        <div className={`text-sm font-mono font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
          {isPositive ? '+' : ''}{sector.change > 0 ? '+' : ''}{(sector.change * 100).toFixed(2)}%
        </div>
      </div>

      {/* Flow bars */}
      <div className="space-y-2 mt-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 w-8">流入</span>
          <div className="flex-1 bg-slate-700 h-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full"
              style={{ width: `${Math.min((sector.inflow / sector.outflow) * 50, 100)}%` }}
            />
          </div>
          <span className="text-xs text-emerald-400 w-12 text-right">{formatAmount(sector.inflow)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 w-8">流出</span>
          <div className="flex-1 bg-slate-700 h-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-rose-500 rounded-full"
              style={{ width: `${Math.min((sector.outflow / sector.inflow) * 50, 100)}%` }}
            />
          </div>
          <span className="text-xs text-rose-400 w-12 text-right">{formatAmount(sector.outflow)}</span>
        </div>
      </div>

      {/* Net flow indicator */}
      <div className="mt-3 pt-3 border-t border-slate-700/50 flex justify-between items-center">
        <span className="text-xs text-slate-400">净流入</span>
        <span className={`text-sm font-mono font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
          {isPositive ? '+' : ''}{formatAmount(sector.net_flow)}
        </span>
      </div>

      {/* Flow intensity bar */}
      <div className="mt-2">
        <div className="w-full bg-slate-700 h-1 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${isPositive ? 'bg-emerald-500' : 'bg-rose-500'}`}
            style={{ width: `${flowIntensity * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
