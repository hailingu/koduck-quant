import { useEffect, useState } from 'react';
import { getMarketBreadth, mockMarketBreadth, type MarketBreadth as MBType } from '../../../api/dashboard';

interface Props {
  useMock?: boolean;
}

export function MarketBreadth({ useMock = false }: Props) {
  const [data, setData] = useState<MBType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        if (useMock) {
          setData(mockMarketBreadth);
        } else {
          const result = await getMarketBreadth();
          setData(result);
        }
      } catch (error) {
        console.error('Failed to fetch market breadth:', error);
        setData(mockMarketBreadth);
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
      <div className="glass-panel p-3 rounded-xl animate-pulse h-full">
        <div className="h-36 bg-slate-800/50 rounded"></div>
      </div>
    );
  }

  return (
    <div className="glass-panel p-3 rounded-xl h-full flex flex-col justify-between">
      <div className="min-h-0 flex-1 flex flex-col">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h2 className="text-sm font-headline font-semibold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-cyan-400 text-base">heatmap</span>
              市场宽度
            </h2>
          </div>
          <div className="flex gap-3 text-right">
            <div>
              <div className="text-[10px] text-slate-500">涨</div>
              <div className="text-sm font-mono font-bold text-emerald-400">{data.gainers}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">跌</div>
              <div className="text-sm font-mono font-bold text-rose-400">{data.losers}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">平</div>
              <div className="text-sm font-mono font-bold text-slate-400">{data.unchanged}</div>
            </div>
          </div>
        </div>

        {/* Overview stats */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-emerald-500/10 border border-emerald-500/30 p-2 rounded text-center">
            <div className="text-lg font-bold text-emerald-400">{data.gainers_percentage}%</div>
            <div className="text-[10px] text-slate-400">上涨</div>
          </div>
          <div className="bg-rose-500/10 border border-rose-500/30 p-2 rounded text-center">
            <div className="text-lg font-bold text-rose-400">{data.losers_percentage}%</div>
            <div className="text-[10px] text-slate-400">下跌</div>
          </div>
          <div className="bg-cyan-500/10 border border-cyan-500/30 p-2 rounded text-center">
            <div className={`text-lg font-bold ${data.advance_decline_line >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {data.advance_decline_line >= 0 ? '+' : ''}{data.advance_decline_line}
            </div>
            <div className="text-[10px] text-slate-400">涨跌差</div>
          </div>
        </div>

        {/* Heatmap Grid */}
        <div className="mb-2">
          <div className="text-[10px] text-slate-500 mb-1">涨跌分布热力图</div>
          <div className="grid grid-cols-11 gap-0.5">
            {data.distribution.map((item) => {
              const getColor = () => {
                if (item.range.includes('+')) {
                  const intensity = Math.min(item.percentage / 15, 1);
                  return `rgba(16, 185, 129, ${0.3 + intensity * 0.7})`;
                } else if (item.range.includes('-')) {
                  const intensity = Math.min(item.percentage / 15, 1);
                  return `rgba(244, 63, 94, ${0.3 + intensity * 0.7})`;
                }
                return 'rgba(100, 116, 139, 0.5)';
              };

              return (
                <div
                  key={item.range}
                  className="relative group cursor-pointer"
                >
                  <div
                    className="h-6 rounded-sm transition-all duration-300 hover:scale-110"
                    style={{ backgroundColor: getColor() }}
                  />
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-slate-800 text-[10px] text-slate-200 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                    {item.range}: {item.count}只
                  </div>
                </div>
              );
            })}
          </div>
          {/* Range labels */}
          <div className="grid grid-cols-11 gap-0.5 mt-0.5">
            {['<-10%', '', '', '', '', '0%', '', '', '', '', '>+10%'].map((label, i) => (
              <div key={i} className="text-[8px] text-slate-500 text-center">
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* New highs/lows */}
      <div className="flex justify-between text-xs pt-2 border-t border-slate-700/30">
        <div className="flex items-center gap-1">
          <span className="text-slate-400 text-[10px]">新高:</span>
          <span className="text-emerald-400 font-mono">{data.new_highs}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-slate-400 text-[10px]">新低:</span>
          <span className="text-rose-400 font-mono">{data.new_lows}</span>
        </div>
      </div>
    </div>
  );
}
