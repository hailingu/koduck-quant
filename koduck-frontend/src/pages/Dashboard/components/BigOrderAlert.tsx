import { useEffect, useState } from 'react';
import { getBigOrders, mockBigOrders, type BigOrderAlert as BOType } from '../../../api/dashboard';

interface Props {
  useMock?: boolean;
  limit?: number;
}

export function BigOrderAlert({ useMock = false, limit = 10 }: Props) {
  const [data, setData] = useState<BOType[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'buy' | 'sell'>('all');

  useEffect(() => {
    async function fetchData() {
      try {
        if (useMock) {
          setData(mockBigOrders.slice(0, limit));
        } else {
          const result = await getBigOrders(limit);
          setData(result);
        }
      } catch (error) {
        console.error('Failed to fetch big orders:', error);
        setData(mockBigOrders.slice(0, limit));
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [useMock, limit]);

  const filteredData = filter === 'all' 
    ? data 
    : data.filter(order => order.type === filter);

  if (loading) {
    return (
      <div className="glass-panel p-6 rounded-xl animate-pulse">
        <div className="h-64 bg-slate-800/50 rounded"></div>
      </div>
    );
  }

  return (
    <div className="glass-panel p-6 rounded-xl">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-headline font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-400">notifications_active</span>
            大单预警
          </h2>
          <p className="text-xs text-slate-400 mt-1">Block Order / Dark Pool / Iceberg 检测</p>
        </div>
        
        {/* Filter buttons */}
        <div className="flex gap-1 bg-slate-800 p-1 rounded-lg">
          {(['all', 'buy', 'sell'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                filter === type
                  ? 'bg-cyan-500 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {type === 'all' ? '全部' : type === 'buy' ? '买入' : '卖出'}
            </button>
          ))}
        </div>
      </div>

      {/* Order list */}
      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
        {filteredData.map((order) => (
          <OrderCard key={order.id} order={order} />
        ))}
        
        {filteredData.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <span className="material-symbols-outlined text-3xl mb-2">inbox</span>
            <p className="text-sm">暂无大单数据</p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-slate-700 flex flex-wrap gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-emerald-500"></span>
          BLOCK ORDER
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-amber-500"></span>
          DARK POOL
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-cyan-500"></span>
          ICEBERG
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-purple-500"></span>
          SWEEPER
        </span>
      </div>
    </div>
  );
}

function OrderCard({ order }: { order: BOType }) {
  const isBuy = order.type === 'buy';
  
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
      bg-slate-800/50 p-3 rounded-lg border-l-4 
      ${isBuy ? 'border-l-emerald-500' : 'border-l-rose-500'}
      hover:bg-slate-800 transition-colors
    `}>
      <div className="flex justify-between items-start">
        {/* Left: Symbol info */}
        <div className="flex items-center gap-3">
          <div className={`
            w-8 h-8 rounded flex items-center justify-center text-xs font-bold
            ${isBuy ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}
          `}>
            {isBuy ? 'B' : 'S'}
          </div>
          <div>
            <div className="font-medium text-slate-200">{order.symbol}</div>
            <div className="text-xs text-slate-500">{order.name}</div>
          </div>
        </div>

        {/* Right: Amount and time */}
        <div className="text-right">
          <div className={`text-lg font-mono font-bold ${isBuy ? 'text-emerald-400' : 'text-rose-400'}`}>
            {order.amount_formatted}
          </div>
          <div className="text-xs text-slate-500">{order.time}</div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-700/50">
        <div className="flex items-center gap-2">
          {/* Type badge */}
          <span className={`
            px-2 py-0.5 rounded text-[10px] font-medium text-white
            ${getTypeColor(order.type_label)}
          `}>
            {order.type_label}
          </span>
          
          {/* Exchange */}
          <span className="text-xs text-slate-500">{order.exchange}</span>
          
          {/* Price */}
          <span className="text-xs text-slate-400">
            ${order.price.toFixed(2)}
          </span>
        </div>

        {/* Urgency indicator */}
        <div className={`text-xs ${getUrgencyColor(order.urgency)}`}>
          {order.urgency === 'high' && '🔥 '}
          {order.urgency === 'high' ? '紧急' : order.urgency === 'medium' ? '重要' : '一般'}
        </div>
      </div>

      {/* Volume bar */}
      <div className="mt-2">
        <div className="flex justify-between text-[10px] text-slate-500 mb-1">
          <span>成交量</span>
          <span>{order.volume.toLocaleString()}股</span>
        </div>
        <div className="w-full bg-slate-700 h-1 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${isBuy ? 'bg-emerald-500' : 'bg-rose-500'}`}
            style={{ width: `${Math.min((order.volume / 50000) * 100, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
