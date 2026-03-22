import { useEffect, useState } from 'react';
import { getFearGreedIndex, mockFearGreedIndex, type FearGreedIndex as FGIndexType } from '../../../api/dashboard';

interface Props {
  useMock?: boolean;
}

export function FearGreedIndex({ useMock = false }: Props) {
  const [data, setData] = useState<FGIndexType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        if (useMock) {
          setData(mockFearGreedIndex);
        } else {
          const result = await getFearGreedIndex();
          setData(result);
        }
      } catch (error) {
        console.error('Failed to fetch fear/greed index:', error);
        setData(mockFearGreedIndex);
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
      <div className="glass-panel p-6 rounded-xl animate-pulse">
        <div className="h-32 bg-slate-800/50 rounded"></div>
      </div>
    );
  }

  const getColor = (value: number) => {
    if (value <= 20) return 'text-red-500';
    if (value <= 40) return 'text-orange-500';
    if (value <= 60) return 'text-yellow-500';
    if (value <= 80) return 'text-emerald-500';
    return 'text-emerald-400';
  };

  const getBgColor = (value: number) => {
    if (value <= 20) return 'bg-red-500';
    if (value <= 40) return 'bg-orange-500';
    if (value <= 60) return 'bg-yellow-500';
    if (value <= 80) return 'bg-emerald-500';
    return 'bg-emerald-400';
  };

  const getLabel = (value: number) => {
    if (value <= 20) return '极度恐惧';
    if (value <= 40) return '恐惧';
    if (value <= 60) return '中性';
    if (value <= 80) return '贪婪';
    return '极度贪婪';
  };

  return (
    <div className="glass-panel p-6 rounded-xl">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-headline font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-cyan-400">psychology</span>
          恐惧贪婪指数
        </h2>
        <span className="text-xs text-slate-500">
          {new Date(data.timestamp).toLocaleTimeString('zh-CN')}
        </span>
      </div>

      {/* Main Gauge */}
      <div className="flex items-center justify-center mb-6">
        <div className="relative w-32 h-32">
          {/* Background circle */}
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="64"
              cy="64"
              r="56"
              fill="none"
              stroke="#1e293b"
              strokeWidth="12"
            />
            {/* Progress circle */}
            <circle
              cx="64"
              cy="64"
              r="56"
              fill="none"
              stroke="currentColor"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${(data.value / 100) * 351.86} 351.86`}
              className={`${getColor(data.value)} transition-all duration-1000`}
            />
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-3xl font-bold ${getColor(data.value)}`}>
              {data.value}
            </span>
            <span className="text-xs text-slate-400">{getLabel(data.value)}</span>
          </div>
        </div>
      </div>

      {/* Change indicator */}
      <div className="flex justify-center mb-4">
        <span className={`text-sm ${data.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {data.change >= 0 ? '▲' : '▼'} {Math.abs(data.change)} 较昨日
        </span>
      </div>

      {/* Component breakdown */}
      <div className="space-y-2">
        <div className="text-xs text-slate-500 mb-2">指标构成</div>
        {[
          { label: '波动性', value: data.components.volatility },
          { label: '动量', value: data.components.momentum },
          { label: '成交量', value: data.components.volume },
          { label: '市场宽度', value: data.components.breadth },
          { label: '北向资金', value: data.components.northbound },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="text-xs text-slate-400 w-16">{item.label}</span>
            <div className="flex-1 bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full ${getBgColor(item.value)} rounded-full transition-all duration-500`}
                style={{ width: `${item.value}%` }}
              />
            </div>
            <span className={`text-xs ${getColor(item.value)} w-8 text-right`}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
