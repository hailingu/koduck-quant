import React from 'react';
import { SectorFundGameMatrix } from './components/SectorFundGameMatrix';

export default function FundFlowAnalysis() {
  return (
    <div className="space-y-6 pb-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-6">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight text-slate-200">
            资金博弈 <span className="text-cyan-400">矩阵</span>
          </h1>
          <p className="text-slate-400 mt-2">板块资金流向对比分析，识别主力与散户博弈态势</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-slate-800 px-4 py-2 flex flex-col border-l-2 border-cyan-400">
            <span className="text-[10px] font-mono text-slate-400 uppercase">监控板块</span>
            <span className="text-xl font-mono text-cyan-400">32</span>
          </div>
          <div className="bg-slate-800 px-4 py-2 flex flex-col border-l-2 border-amber-400">
            <span className="text-[10px] font-mono text-slate-400 uppercase">危险信号</span>
            <span className="text-xl font-mono text-amber-400">3</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <SectorFundGameMatrix />
    </div>
  );
}
