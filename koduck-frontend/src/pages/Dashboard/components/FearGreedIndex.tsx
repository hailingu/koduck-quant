import { useEffect, useState } from 'react';
import { getFearGreedIndex, mockFearGreedIndex, type FearGreedIndex as FGIndexType } from '../../../api/dashboard';

interface Props {
  useMock?: boolean;
  data?: FGIndexType | null;
  loading?: boolean;
}

export function FearGreedIndex({ useMock = false, data: externalData, loading: externalLoading }: Props) {
  const [data, setData] = useState<FGIndexType | null>(null);
  const [internalLoading, setInternalLoading] = useState(true);
  const useExternalData = externalData !== undefined;

  useEffect(() => {
    if (useExternalData) {
      setInternalLoading(false);
      return;
    }

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
        setInternalLoading(false);
      }
    }

    fetchData();
    // Refresh every 60 seconds
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [useMock, useExternalData]);

  const sourceData = useExternalData ? (externalData ?? null) : data;
  const loading = useExternalData ? Boolean(externalLoading) : internalLoading;

  if (loading) {
    return (
      <div className="glass-panel p-3 rounded-xl animate-pulse">
        <div className="h-28 bg-slate-800/50 rounded"></div>
      </div>
    );
  }

  if (!sourceData) {
    return (
      <div className="glass-panel p-3 rounded-xl h-full flex items-center justify-center">
        <div className="text-center text-slate-500">
          <span className="material-symbols-outlined text-2xl mb-1">psychology</span>
          <p className="text-xs">暂无恐惧贪婪数据</p>
        </div>
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
    <div className="glass-panel p-3 rounded-xl">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-sm font-headline font-semibold flex items-center gap-1.5">
          <span className="material-symbols-outlined text-cyan-400 text-base">psychology</span>
          恐惧贪婪
        </h2>
        <span className="text-[10px] text-slate-500">
          {new Date(sourceData.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Main Gauge */}
      <div className="flex items-center justify-center mb-3">
        <div className="relative w-20 h-20">
          {/* Background circle */}
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="40"
              cy="40"
              r="34"
              fill="none"
              stroke="#1e293b"
              strokeWidth="8"
            />
            {/* Progress circle */}
            <circle
              cx="40"
              cy="40"
              r="34"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${(sourceData.value / 100) * 213.6} 213.6`}
              className={`${getColor(sourceData.value)} transition-all duration-1000`}
            />
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-xl font-bold ${getColor(sourceData.value)}`}>
              {sourceData.value}
            </span>
            <span className="text-[10px] text-slate-400 scale-90">{getLabel(sourceData.value)}</span>
          </div>
        </div>
      </div>

      {/* Change indicator */}
      <div className="flex justify-center mb-2">
        <span className={`text-xs ${sourceData.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {sourceData.change >= 0 ? '▲' : '▼'} {Math.abs(sourceData.change)} 较昨日
        </span>
      </div>

      {/* Component breakdown */}
      <div className="space-y-1">
        <div className="text-[10px] text-slate-500">指标构成</div>
        {[
          { label: '波动性', value: sourceData.components.volatility },
          { label: '动量', value: sourceData.components.momentum },
          { label: '成交量', value: sourceData.components.volume },
          { label: '市场宽度', value: sourceData.components.breadth },
          { label: '北向资金', value: sourceData.components.northbound },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 w-12">{item.label}</span>
            <div className="flex-1 bg-slate-800 h-1 rounded-full overflow-hidden">
              <div
                className={`h-full ${getBgColor(item.value)} rounded-full transition-all duration-500`}
                style={{ width: `${item.value}%` }}
              />
            </div>
            <span className={`text-[10px] ${getColor(item.value)} w-6 text-right`}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
