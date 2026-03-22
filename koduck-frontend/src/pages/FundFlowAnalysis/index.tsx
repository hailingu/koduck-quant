import React, { useState } from 'react';
import { SectorFundGameMatrix } from './components/SectorFundGameMatrix';
import { FundDivergenceAlert } from './components/FundDivergenceAlert';

type TabType = 'matrix' | 'alerts';

export default function FundFlowAnalysis() {
  const [activeTab, setActiveTab] = useState<TabType>('matrix');

  return (
    <div className="space-y-6 pb-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-6">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight text-slate-200">
            资金流分析 <span className="text-cyan-400">中心</span>
          </h1>
          <p className="text-slate-400 mt-2">板块资金博弈矩阵与背离预警系统</p>
        </div>
        
        {/* Stats Summary */}
        <div className="flex gap-4">
          <div className="bg-slate-800 px-4 py-2 flex flex-col border-l-2 border-cyan-400">
            <span className="text-[10px] font-mono text-slate-400 uppercase">监控板块</span>
            <span className="text-xl font-mono text-cyan-400">32</span>
          </div>
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

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-700">
        <button
          onClick={() => setActiveTab('matrix')}
          className={`px-6 py-3 text-sm font-medium transition-colors relative ${
            activeTab === 'matrix' 
              ? 'text-cyan-400' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">view_quilt</span>
            资金博弈矩阵
          </span>
          {activeTab === 'matrix' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400"></span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('alerts')}
          className={`px-6 py-3 text-sm font-medium transition-colors relative ${
            activeTab === 'alerts' 
              ? 'text-amber-400' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">crisis_alert</span>
            背离预警
          </span>
          {activeTab === 'alerts' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400"></span>
          )}
        </button>
      </div>

      {/* Main Content */}
      {activeTab === 'matrix' ? (
        <SectorFundGameMatrix />
      ) : (
        <div className="h-[600px]">
          <FundDivergenceAlert />
        </div>
      )}
    </div>
  );
}
