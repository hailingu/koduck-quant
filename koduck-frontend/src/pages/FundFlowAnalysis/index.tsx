import React from 'react';
import { FundDivergenceAlert } from './components/FundDivergenceAlert';

export default function FundFlowAnalysis() {
  return (
    <div className="space-y-6 pb-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-6">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight text-slate-200">
            资金背离 <span className="text-amber-400">预警</span>
          </h1>
          <p className="text-slate-400 mt-2">自动检测价格与资金流向背离，预警关键交易机会和风险</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-slate-800 px-4 py-2 flex flex-col border-l-2 border-red-500">
            <span className="text-[10px] font-mono text-slate-400 uppercase">紧急预警</span>
            <span className="text-xl font-mono text-red-500">2</span>
          </div>
          <div className="bg-slate-800 px-4 py-2 flex flex-col border-l-2 border-amber-400">
            <span className="text-[10px] font-mono text-slate-400 uppercase">机会预警</span>
            <span className="text-xl font-mono text-amber-400">1</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="h-[600px]">
        <FundDivergenceAlert />
      </div>
    </div>
  );
}
