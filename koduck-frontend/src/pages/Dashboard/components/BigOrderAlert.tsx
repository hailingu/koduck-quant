import { useEffect, useState } from 'react';
import { getBigOrders, mockBigOrders, type BigOrderAlert as BOType } from '../../../api/dashboard';

interface Props {
  useMock?: boolean;
  limit?: number;
  data?: BOType[];
  loading?: boolean;
}

export function BigOrderAlert({ useMock = false, limit = 10, data: externalData, loading: externalLoading }: Props) {
  const [data, setData] = useState<BOType[]>([]);
  const [internalLoading, setInternalLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'buy' | 'sell'>('all');
  const useExternalData = externalData !== undefined;

  useEffect(() => {
    if (useExternalData) {
      setInternalLoading(false);
      return;
    }

    async function fetchData() {
      try {
        if (useMock) {
          setData(mockBigOrders.slice(0, limit));
        } else {
          const result = await getBigOrders(limit);
          setData(Array.isArray(result) ? result : []);
        }
      } catch (error) {
        console.error('Failed to fetch big orders:', error);
        setData(mockBigOrders.slice(0, limit));
      } finally {
        setInternalLoading(false);
      }
    }

    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [useMock, limit, useExternalData]);

  const sourceData = useExternalData ? (externalData || []) : data;
  const loading = useExternalData ? Boolean(externalLoading) : internalLoading;
  const filteredData = filter === 'all' 
    ? sourceData
    : sourceData.filter(order => order.type === filter);

  if (loading) {
    return (
      <div className="glass-panel p-3 rounded-xl animate-pulse h-full">
        <div className="h-48 bg-slate-800/50 rounded"></div>
      </div>
    );
  }

  return (
    <div className="glass-panel p-3 rounded-xl h-full flex flex-col justify-between">
      <div className="min-h-0 flex-1 flex flex-col">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h2 className="text-sm font-headline font-semibold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-amber-400 text-base">notifications_active</span>
              大单预警
            </h2>
          </div>
          
          {/* Filter buttons */}
          <div className="flex gap-0.5 bg-slate-800 p-0.5 rounded">
            {(['all', 'buy', 'sell'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                  filter === type
                    ? 'bg-cyan-500 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {type === 'all' ? '全' : type === 'buy' ? '买' : '卖'}
              </button>
            ))}
          </div>
        </div>

        {/* Order list */}
        <div className="space-y-2 flex-1 min-h-0 overflow-y-auto pr-1">
          {filteredData.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
          
          {filteredData.length === 0 && (
            <div className="text-center py-6 text-slate-500">
              <span className="material-symbols-outlined text-2xl mb-1">inbox</span>
              <p className="text-xs">暂无大单数据</p>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="pt-2 border-t border-slate-700/50 flex flex-wrap gap-2 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded bg-emerald-500"></span>
          BLOCK
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded bg-amber-500"></span>
          DARK
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded bg-cyan-500"></span>
          ICEBERG
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded bg-purple-500"></span>
          SWEEPER
        </span>
      </div>
    </div>
  );
}

function OrderCard({ order }: { order: BOType }) {
  const isBuy = order.type === 'buy';
  const typeLabel = (order.typeLabel || (order as unknown as { type_label?: string }).type_label || 'BLOCK ORDER');
  const amountText = (order.amountFormatted || (order as unknown as { amount_formatted?: string }).amount_formatted || '--');
  
  const getTypeColor = (typeLabel: string) => {
    switch (typeLabel) {
      case 'BLOCK ORDER': return 'bg-emerald-500';
      case 'DARK POOL': return 'bg-amber-500';
      case 'ICEBERG': return 'bg-cyan-500';
      case 'SWEEPER': return 'bg-purple-500';
      default: return 'bg-slate-500';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high': return 'text-red-400 animate-pulse';
      case 'medium': return 'text-amber-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className={`
      bg-slate-800/50 p-2 rounded border-l-3 
      ${isBuy ? 'border-l-emerald-500' : 'border-l-rose-500'}
      hover:bg-slate-800 transition-colors
    `}>
      <div className="flex justify-between items-start">
        {/* Left: Symbol info */}
        <div className="flex items-center gap-2">
          <div className={`
            w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold
            ${isBuy ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}
          `}>
            {isBuy ? 'B' : 'S'}
          </div>
          <div>
            <div className="text-sm font-medium text-slate-200">{order.symbol}</div>
            <div className="text-[10px] text-slate-500">{order.name}</div>
          </div>
        </div>

        {/* Right: Amount and time */}
        <div className="text-right">
          <div className={`text-sm font-mono font-bold ${isBuy ? 'text-emerald-400' : 'text-rose-400'}`}>
            {amountText}
          </div>
          <div className="text-[10px] text-slate-500">{order.time}</div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="flex justify-between items-center mt-1.5 pt-1.5 border-t border-slate-700/30">
        <div className="flex items-center gap-1.5">
          {/* Type badge */}
          <span className={`
            px-1.5 py-0 rounded text-[9px] font-medium text-white
            ${getTypeColor(typeLabel)}
          `}>
            {typeLabel.split(' ')[0]}
          </span>
          
          {/* Exchange */}
          <span className="text-[10px] text-slate-500">{order.exchange}</span>
          
          {/* Price */}
          <span className="text-[10px] text-slate-400">${order.price.toFixed(2)}</span>
        </div>
        
        {/* Urgency indicator */}
        <span className={`material-symbols-outlined text-sm ${getUrgencyColor(order.urgency)}`}>
          {order.urgency === 'high' ? 'priority_high' : order.urgency === 'medium' ? 'notifications' : 'info'}
        </span>
      </div>
    </div>
  );
}
