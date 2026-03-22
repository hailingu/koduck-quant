import React, { useEffect, useState } from 'react';
import { getPnLHistory, mockPnLHistory, type PnLHistoryResponse, type PnLDataPoint, type PeriodType } from '../../../api/portfolio';

interface Props {
  useMock?: boolean;
}

const PERIODS: { value: PeriodType; label: string }[] = [
  { value: '1d', label: '1日' },
  { value: '1w', label: '1周' },
  { value: '1m', label: '1月' },
  { value: '3m', label: '3月' },
  { value: '1y', label: '1年' },
  { value: 'ytd', label: 'YTD' },
];

export function PnLChart({ useMock = false }: Props) {
  const [data, setData] = useState<PnLHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodType>('1w');

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        if (useMock) {
          setData(mockPnLHistory);
        } else {
          const result = await getPnLHistory(period);
          setData(result);
        }
      } catch (error) {
        console.error('Failed to fetch PnL history:', error);
        setData(mockPnLHistory);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [period, useMock]);

  if (loading || !data) {
    return (
      <div className="glass-panel p-6 rounded-xl animate-pulse">
        <div className="h-64 bg-slate-800/50 rounded"></div>
      </div>
    );
  }

  const isPositive = data.summary.total_pnl >= 0;
  const maxValue = Math.max(...data.data.map(d => d.total_market_value));
  const minValue = Math.min(...data.data.map(d => d.total_market_value));
  const valueRange = maxValue - minValue;

  return (
    <div className="glass-panel p-6 rounded-xl">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-lg font-headline font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-cyan-400">show_chart</span>
            盈亏趋势
          </h2>
          <div className="flex items-baseline gap-3 mt-2">
            <span className={`text-3xl font-mono font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              {data.summary.total_pnl_formatted}
            </span>
            <span className={`text-sm font-mono ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              ({isPositive ? '+' : ''}{data.summary.total_pnl_percent.toFixed(2)}%)
            </span>
          </div>
        </div>
        
        {/* Period Selector */}
        <div className="flex gap-1 bg-slate-800 p-1 rounded-lg">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                period === p.value
                  ? 'bg-cyan-500 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-48 mb-6 relative">
        <svg className="w-full h-full" viewBox={`0 0 ${data.data.length * 60} 200`} preserveAspectRatio="none">
          {/* Grid lines */}
          {[0, 50, 100, 150, 200].map((y) => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2={data.data.length * 60}
              y2={y}
              stroke="#1e293b"
              strokeWidth="1"
            />
          ))}
          
          {/* Area fill */}
          <defs>
            <linearGradient id="pnlGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={isPositive ? "#10b981" : "#f43f5e"} stopOpacity="0.3" />
              <stop offset="100%" stopColor={isPositive ? "#10b981" : "#f43f5e"} stopOpacity="0" />
            </linearGradient>
          </defs>
          
          {/* Area */}
          <path
            d={`
              M 0 ${200 - ((data.data[0].total_market_value - minValue) / valueRange) * 180 - 10}
              ${data.data.map((d, i) => {
                const x = i * 60 + 30;
                const y = 200 - ((d.total_market_value - minValue) / valueRange) * 180 - 10;
                return `L ${x} ${y}`;
              }).join(' ')}
              L ${(data.data.length - 1) * 60 + 30} 200
              L 0 200
              Z
            `}
            fill="url(#pnlGradient)"
          />
          
          {/* Line */}
          <path
            d={`
              M 0 ${200 - ((data.data[0].total_market_value - minValue) / valueRange) * 180 - 10}
              ${data.data.map((d, i) => {
                const x = i * 60 + 30;
                const y = 200 - ((d.total_market_value - minValue) / valueRange) * 180 - 10;
                return `L ${x} ${y}`;
              }).join(' ')}
            `}
            fill="none"
            stroke={isPositive ? "#10b981" : "#f43f5e"}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Data points */}
          {data.data.map((d, i) => {
            const x = i * 60 + 30;
            const y = 200 - ((d.total_market_value - minValue) / valueRange) * 180 - 10;
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="4"
                fill={isPositive ? "#10b981" : "#f43f5e"}
                stroke="#0f172a"
                strokeWidth="2"
              />
            );
          })}
        </svg>
        
        {/* X-axis labels */}
        <div className="flex justify-between text-xs text-slate-500 mt-2">
          {data.data.filter((_, i) => i % Math.ceil(data.data.length / 5) === 0).map((d, i) => (
            <span key={i}>{d.date.slice(5)}</span>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="最佳日"
          value={data.summary.best_day ? data.summary.best_day.pnl_formatted : 'N/A'}
          color="emerald"
        />
        <StatCard
          label="最差日"
          value={data.summary.worst_day ? data.summary.worst_day.pnl_formatted : 'N/A'}
          color="rose"
        />
        <StatCard
          label="波动率"
          value={`${data.summary.volatility.toFixed(1)}万`}
          color="amber"
        />
        <StatCard
          label="夏普比率"
          value={data.summary.sharpe_ratio.toFixed(2)}
          color="cyan"
        />
      </div>

      {/* Benchmark Comparison */}
      <div className="mt-4 pt-4 border-t border-slate-700">
        <div className="text-xs text-slate-500 mb-2">基准对比</div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">组合收益</span>
            <span className={`text-sm font-mono font-bold ${data.benchmark_comparison.portfolio_return >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {data.benchmark_comparison.portfolio_return >= 0 ? '+' : ''}{data.benchmark_comparison.portfolio_return.toFixed(2)}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">基准收益</span>
            <span className="text-sm font-mono text-slate-300">
              {data.benchmark_comparison.benchmark_return >= 0 ? '+' : ''}{data.benchmark_comparison.benchmark_return.toFixed(2)}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Alpha</span>
            <span className={`text-sm font-mono font-bold ${data.benchmark_comparison.alpha >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {data.benchmark_comparison.alpha >= 0 ? '+' : ''}{data.benchmark_comparison.alpha.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colorClasses: Record<string, string> = {
    emerald: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    rose: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
    amber: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    cyan: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
  };

  return (
    <div className={`p-3 rounded-lg border ${colorClasses[color]}`}>
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="text-lg font-mono font-bold">{value}</div>
    </div>
  );
}
