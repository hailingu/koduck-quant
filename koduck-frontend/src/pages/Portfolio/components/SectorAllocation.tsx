import { useEffect, useState } from 'react';
import { getSectorAllocation, mockSectorAllocation, type SectorAllocationResponse } from '../../../api/portfolio';

interface Props {
  useMock?: boolean;
}

export function SectorAllocation({ useMock = false }: Props) {
  const [data, setData] = useState<SectorAllocationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredSector, setHoveredSector] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        if (useMock) {
          setData(mockSectorAllocation);
        } else {
          const result = await getSectorAllocation();
          setData(result);
        }
      } catch (error) {
        console.error('Failed to fetch sector allocation:', error);
        setData(mockSectorAllocation);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [useMock]);

  if (loading || !data) {
    return (
      <div className="glass-panel p-6 rounded-xl animate-pulse">
        <div className="h-64 bg-slate-800/50 rounded"></div>
      </div>
    );
  }

  // Calculate chart segments
  const totalPercent = data.sectors.reduce((sum, s) => sum + s.percent, 0);
  let currentAngle = 0;
  const segments = data.sectors.map((sector) => {
    const angle = (sector.percent / totalPercent) * 360;
    const startAngle = currentAngle;
    currentAngle += angle;
    return { ...sector, startAngle, angle };
  });

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'text-red-400';
      case 'medium': return 'text-amber-400';
      case 'low': return 'text-emerald-400';
      default: return 'text-slate-400';
    }
  };

  const getRiskLabel = (risk: string) => {
    switch (risk) {
      case 'high': return '高集中度风险';
      case 'medium': return '中等集中度';
      case 'low': return '分散配置';
      default: return '未知';
    }
  };

  return (
    <div className="glass-panel p-6 rounded-xl">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-lg font-headline font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-cyan-400">donut_large</span>
            行业配置
          </h2>
          <p className="text-xs text-slate-400 mt-1">持仓行业分布与集中度分析</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-mono font-bold text-slate-200">
            {data.total_value_formatted}
          </div>
          <div className="text-xs text-slate-500">总市值</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Donut Chart */}
        <div className="relative flex items-center justify-center">
          <svg width="200" height="200" viewBox="0 0 200 200">
            {/* Background circle */}
            <circle
              cx="100"
              cy="100"
              r="80"
              fill="none"
              stroke="#1e293b"
              strokeWidth="30"
            />
            
            {/* Segments */}
            {segments.map((sector) => {
              const startRad = (sector.startAngle * Math.PI) / 180;
              const endRad = ((sector.startAngle + sector.angle) * Math.PI) / 180;
              
              const x1 = 100 + 80 * Math.cos(startRad);
              const y1 = 100 + 80 * Math.sin(startRad);
              const x2 = 100 + 80 * Math.cos(endRad);
              const y2 = 100 + 80 * Math.sin(endRad);
              
              const largeArc = sector.angle > 180 ? 1 : 0;
              
              return (
                <path
                  key={sector.code}
                  d={`M ${x1} ${y1} A 80 80 0 ${largeArc} 1 ${x2} ${y2}`}
                  fill="none"
                  stroke={sector.color}
                  strokeWidth={hoveredSector === sector.code ? 35 : 30}
                  className="transition-all duration-300 cursor-pointer"
                  onMouseEnter={() => setHoveredSector(sector.code)}
                  onMouseLeave={() => setHoveredSector(null)}
                />
              );
            })}
            
            {/* Center hole */}
            <circle cx="100" cy="100" r="50" fill="#0f172a" />
            
            {/* Center text */}
            <text x="100" y="95" textAnchor="middle" className="fill-slate-400 text-xs">
              分散度
            </text>
            <text x="100" y="115" textAnchor="middle" className={`fill-slate-200 text-lg font-bold`}>
              {data.diversification_score.toFixed(0)}
            </text>
          </svg>
          
          {/* Risk badge */}
          <div className={`absolute bottom-0 text-xs font-medium ${getRiskColor(data.top_heavy_risk)}`}>
            {getRiskLabel(data.top_heavy_risk)}
          </div>
        </div>

        {/* Legend & List */}
        <div className="space-y-2">
          {/* Cash position */}
          <div className="flex items-center justify-between p-2 bg-slate-800/50 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#64748B' }}></div>
              <span className="text-sm text-slate-300">现金</span>
            </div>
            <div className="text-right">
              <div className="text-sm font-mono text-slate-200">{data.cash_percent.toFixed(1)}%</div>
              <div className="text-xs text-slate-500">{data.total_value_formatted}</div>
            </div>
          </div>
          
          {/* Sector list */}
          {data.sectors.filter(s => s.code !== 'CASH').map((sector) => (
            <div
              key={sector.code}
              className={`flex items-center justify-between p-2 rounded-lg transition-colors cursor-pointer ${
                hoveredSector === sector.code ? 'bg-slate-700/50' : 'bg-slate-800/30'
              }`}
              onMouseEnter={() => setHoveredSector(sector.code)}
              onMouseLeave={() => setHoveredSector(null)}
            >
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: sector.color }}
                ></div>
                <span className="text-sm text-slate-300">{sector.name}</span>
                {sector.stock_count > 0 && (
                  <span className="text-xs text-slate-500">({sector.stock_count}只)</span>
                )}
              </div>
              <div className="text-right">
                <div className="text-sm font-mono text-slate-200">{sector.percent.toFixed(1)}%</div>
                <div className="text-xs text-slate-500">{sector.value_formatted}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Holdings */}
      <div className="mt-6 pt-4 border-t border-slate-700">
        <div className="text-xs text-slate-500 mb-3">重点持仓</div>
        <div className="grid grid-cols-2 gap-2">
          {data.sectors
            .filter(s => s.code !== 'CASH')
            .flatMap(s => s.stocks)
            .slice(0, 6)
            .map((stock, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-slate-800/30 rounded text-sm">
                <span className="text-slate-300">{stock.name}</span>
                <span className="font-mono text-slate-400">{(stock.value / 10000).toFixed(0)}万</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
