import React, { useState, useMemo } from 'react';

// Types
interface SectorFundData {
  sector: string;
  mainForce: { value: number; direction: 'in' | 'out' };
  retail: { value: number; direction: 'in' | 'out' };
  northbound: { value: number; direction: 'in' | 'out' };
  gameIndex: number;
  priceChange: number;
  signal: 'main_dominant' | 'balanced' | 'retail_dominant' | 'danger';
}

// Mock data - replace with API
const mockSectorData: SectorFundData[] = [
  { sector: '银行', mainForce: { value: 8900000000, direction: 'in' }, retail: { value: 4500000000, direction: 'out' }, northbound: { value: 2300000000, direction: 'in' }, gameIndex: 91, priceChange: 2.35, signal: 'main_dominant' },
  { sector: '新能源', mainForce: { value: 6700000000, direction: 'in' }, retail: { value: 1200000000, direction: 'in' }, northbound: { value: 1500000000, direction: 'in' }, gameIndex: 76, priceChange: 3.12, signal: 'main_dominant' },
  { sector: '汽车', mainForce: { value: 2400000000, direction: 'in' }, retail: { value: 1800000000, direction: 'in' }, northbound: { value: 800000000, direction: 'in' }, gameIndex: 58, priceChange: 1.25, signal: 'balanced' },
  { sector: '医药', mainForce: { value: 1200000000, direction: 'out' }, retail: { value: 3400000000, direction: 'in' }, northbound: { value: 500000000, direction: 'out' }, gameIndex: 32, priceChange: -0.85, signal: 'retail_dominant' },
  { sector: '科技', mainForce: { value: 6700000000, direction: 'out' }, retail: { value: 7800000000, direction: 'in' }, northbound: { value: 1200000000, direction: 'out' }, gameIndex: 18, priceChange: 1.89, signal: 'danger' },
  { sector: '消费', mainForce: { value: 3400000000, direction: 'in' }, retail: { value: 890000000, direction: 'out' }, northbound: { value: 1200000000, direction: 'in' }, gameIndex: 82, priceChange: 1.56, signal: 'main_dominant' },
  { sector: '地产', mainForce: { value: 560000000, direction: 'out' }, retail: { value: 2300000000, direction: 'in' }, northbound: { value: 340000000, direction: 'out' }, gameIndex: 28, priceChange: -1.23, signal: 'retail_dominant' },
  { sector: '有色', mainForce: { value: 4500000000, direction: 'in' }, retail: { value: 1200000000, direction: 'in' }, northbound: { value: 890000000, direction: 'in' }, gameIndex: 71, priceChange: 2.89, signal: 'main_dominant' },
];

// Format currency
function formatCurrency(value: number): string {
  const absValue = Math.abs(value);
  if (absValue >= 100000000) {
    return `${(absValue / 100000000).toFixed(1)}亿`;
  }
  if (absValue >= 10000) {
    return `${(absValue / 10000).toFixed(1)}万`;
  }
  return `${absValue}`;
}

// Signal config
const signalConfig = {
  main_dominant: { label: '主力主导', color: 'text-emerald-400', bgColor: 'bg-emerald-400/10' },
  balanced: { label: '均衡博弈', color: 'text-amber-400', bgColor: 'bg-amber-400/10' },
  retail_dominant: { label: '散户主导', color: 'text-rose-400', bgColor: 'bg-rose-400/10' },
  danger: { label: '⚠️ 危险', color: 'text-red-500', bgColor: 'bg-red-500/20', borderColor: 'border-red-500' },
};

// Game Index Bar Component
function GameIndexBar({ value }: { value: number }) {
  const getColor = () => {
    if (value >= 70) return 'from-emerald-500 to-emerald-400';
    if (value >= 40) return 'from-amber-500 to-amber-400';
    return 'from-rose-500 to-rose-400';
  };

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs mb-1">
        <span className={`font-mono ${value >= 70 ? 'text-emerald-400' : value >= 40 ? 'text-amber-400' : 'text-rose-400'}`}>
          {value}%
        </span>
      </div>
      <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
        <div 
          className={`h-full bg-gradient-to-r ${getColor()} rounded-full transition-all duration-500`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

// Fund Flow Cell Component
function FundFlowCell({ data, type }: { data: { value: number; direction: 'in' | 'out' }; type: 'main' | 'retail' | 'northbound' }) {
  const isIn = data.direction === 'in';
  const absValue = Math.abs(data.value);
  const maxValue = 10000000000; // 100亿作为最大值
  const barWidth = Math.min((absValue / maxValue) * 100, 100);

  const getColors = () => {
    switch (type) {
      case 'main':
        return isIn ? 'text-cyan-400 bg-cyan-400' : 'text-rose-400 bg-rose-400';
      case 'retail':
        return isIn ? 'text-pink-400 bg-pink-400' : 'text-slate-400';
      case 'northbound':
        return isIn ? 'text-amber-400 bg-amber-400' : 'text-slate-400';
    }
  };

  const getLabel = () => {
    switch (type) {
      case 'main': return '主力';
      case 'retail': return '散户';
      case 'northbound': return '北向';
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className={`text-xs ${getColors().split(' ')[0]} font-mono`}>
          {isIn ? '+' : '-'}{formatCurrency(absValue)}
        </span>
        <span className="text-[10px] text-slate-500">{getLabel()}</span>
      </div>
      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
        <div 
          className={`h-full ${getColors().split(' ')[1]} rounded-full transition-all duration-500`}
          style={{ width: `${barWidth}%`, opacity: isIn ? 1 : 0.5 }}
        />
      </div>
    </div>
  );
}

export function SectorFundGameMatrix() {
  const [sortBy, setSortBy] = useState<'gameIndex' | 'mainForce' | 'sector'>('gameIndex');
  const [filterSignal, setFilterSignal] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const sortedData = useMemo(() => {
    let data = [...mockSectorData];
    
    if (filterSignal) {
      data = data.filter(item => item.signal === filterSignal);
    }

    switch (sortBy) {
      case 'gameIndex':
        return data.sort((a, b) => b.gameIndex - a.gameIndex);
      case 'mainForce':
        return data.sort((a, b) => Math.abs(b.mainForce.value) - Math.abs(a.mainForce.value));
      case 'sector':
        return data.sort((a, b) => a.sector.localeCompare(b.sector));
      default:
        return data;
    }
  }, [sortBy, filterSignal]);

  return (
    <div className="glass-panel p-6 rounded-xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-headline font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-cyan-400">view_quilt</span>
            板块资金博弈矩阵
          </h2>
          <p className="text-xs text-slate-400 mt-1">主力 vs 散户 vs 北向资金流向对比</p>
        </div>
        <div className="flex gap-2">
          {/* Filter buttons */}
          <select 
            className="bg-slate-800 border border-slate-700 rounded px-3 py-1 text-xs text-slate-300"
            value={filterSignal || ''}
            onChange={(e) => setFilterSignal(e.target.value || null)}
          >
            <option value="">全部信号</option>
            <option value="main_dominant">主力主导</option>
            <option value="balanced">均衡博弈</option>
            <option value="retail_dominant">散户主导</option>
            <option value="danger">危险信号</option>
          </select>
          
          {/* Sort buttons */}
          <select 
            className="bg-slate-800 border border-slate-700 rounded px-3 py-1 text-xs text-slate-300"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="gameIndex">按博弈指数</option>
            <option value="mainForce">按主力资金</option>
            <option value="sector">按板块名称</option>
          </select>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          {/* Table Header */}
          <thead>
            <tr className="text-[10px] font-mono text-slate-500 uppercase tracking-wider border-b border-slate-700">
              <th className="py-3 px-4 text-left">板块</th>
              <th className="py-3 px-4 text-left">主力资金</th>
              <th className="py-3 px-4 text-left">散户资金</th>
              <th className="py-3 px-4 text-left">北向资金</th>
              <th className="py-3 px-4 text-center">博弈指数</th>
              <th className="py-3 px-4 text-center">涨跌幅</th>
              <th className="py-3 px-4 text-center">信号</th>
            </tr>
          </thead>
          
          {/* Table Body */}
          <tbody>
            {sortedData.map((row, idx) => {
              const signal = signalConfig[row.signal];
              const isDanger = row.signal === 'danger';
              const isExpanded = expandedRow === row.sector;
              
              return (
                <React.Fragment key={row.sector}>
                  <tr 
                    className={`
                      border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors cursor-pointer
                      ${isDanger ? 'bg-red-500/5' : idx % 2 === 0 ? 'bg-slate-900/20' : 'bg-slate-800/20'}
                      ${isDanger ? 'border-l-2 border-l-red-500' : ''}
                    `}
                    onClick={() => setExpandedRow(isExpanded ? null : row.sector)}
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-200">{row.sector}</span>
                        <span className="material-symbols-outlined text-xs text-slate-500">
                          {isExpanded ? 'expand_less' : 'expand_more'}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 w-40">
                      <FundFlowCell data={row.mainForce} type="main" />
                    </td>
                    <td className="py-4 px-4 w-40">
                      <FundFlowCell data={row.retail} type="retail" />
                    </td>
                    <td className="py-4 px-4 w-40">
                      <FundFlowCell data={row.northbound} type="northbound" />
                    </td>
                    <td className="py-4 px-4 w-32">
                      <GameIndexBar value={row.gameIndex} />
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`font-mono text-sm ${row.priceChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {row.priceChange >= 0 ? '+' : ''}{row.priceChange.toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${signal.color} ${signal.bgColor} ${signal.borderColor || ''}`}>
                        {signal.label}
                      </span>
                    </td>
                  </tr>
                  
                  {/* Expanded Detail Row */}
                  {isExpanded && (
                    <tr className="bg-slate-900/50">
                      <td colSpan={7} className="py-4 px-4">
                        <div className="grid grid-cols-3 gap-4">
                          {/* Fund Flow Detail */}
                          <div className="col-span-2 grid grid-cols-3 gap-4">
                            <div className="bg-slate-800/50 p-3 rounded-lg">
                              <div className="text-[10px] text-slate-500 uppercase mb-2">主力资金明细</div>
                              <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                  <span className="text-slate-400">超大单</span>
                                  <span className="text-cyan-400">+{formatCurrency(row.mainForce.value * 0.6)}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-slate-400">大单</span>
                                  <span className="text-cyan-400">+{formatCurrency(row.mainForce.value * 0.4)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="bg-slate-800/50 p-3 rounded-lg">
                              <div className="text-[10px] text-slate-500 uppercase mb-2">散户资金明细</div>
                              <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                  <span className="text-slate-400">中单</span>
                                  <span className={row.retail.direction === 'in' ? 'text-pink-400' : 'text-slate-400'}>
                                    {row.retail.direction === 'in' ? '+' : '-'}{formatCurrency(row.retail.value * 0.4)}
                                  </span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-slate-400">小单</span>
                                  <span className={row.retail.direction === 'in' ? 'text-pink-400' : 'text-slate-400'}>
                                    {row.retail.direction === 'in' ? '+' : '-'}{formatCurrency(row.retail.value * 0.6)}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="bg-slate-800/50 p-3 rounded-lg">
                              <div className="text-[10px] text-slate-500 uppercase mb-2">资金流向分析</div>
                              <div className="text-xs text-slate-300">
                                {row.signal === 'main_dominant' && '主力资金大幅流入，控盘度较高，建议关注'}
                                {row.signal === 'balanced' && '多空双方力量均衡，观望为主'}
                                {row.signal === 'retail_dominant' && '散户资金活跃，主力观望，注意风险'}
                                {row.signal === 'danger' && '⚠️ 主力出逃，散户接盘，建议减仓'}
                              </div>
                            </div>
                          </div>
                          
                          {/* Action Buttons */}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-cyan-400"></div>
          <span>主力资金流入</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-rose-400"></div>
          <span>主力资金流出</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-pink-400"></div>
          <span>散户资金</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-amber-400"></div>
          <span>北向资金</span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <span className="text-slate-400">博弈指数 = 主力资金占比</span>
        </div>
      </div>
    </div>
  );
}
