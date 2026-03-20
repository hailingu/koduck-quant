import SectorNetworkGraph from '@/components/SectorNetworkGraph'

// Sector Rankings Component
function SectorRankings() {
  const rankings = [
    { rank: '01', name: 'TECHNOLOGY', flow: '+$842.5M', status: 'HIGH INFLOW', positive: true },
    { rank: '02', name: 'ENERGY', flow: '+$124.1M', status: 'STABILITY', positive: true },
    { rank: '03', name: 'HEALTHCARE', flow: '-$240.2M', status: 'OUTFLOW', positive: false },
  ]

  return (
    <div className="glass-panel p-5 rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-headline font-bold text-sm text-fluid-text">Sector Rankings</h3>
        <span className="material-symbols-outlined text-fluid-text-dim text-sm">filter_list</span>
      </div>
      <div className="space-y-4">
        {rankings.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono-data text-fluid-text-dim">{item.rank}</span>
              <div>
                <div className="text-sm font-semibold text-fluid-text">{item.name}</div>
                <div className="text-[10px] text-fluid-text-muted uppercase">{item.status}</div>
              </div>
            </div>
            <div className={`text-sm font-mono-data ${item.positive ? 'text-fluid-primary' : 'text-fluid-secondary'}`}>
              {item.flow}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Focus Panel Component
function FocusPanel() {
  return (
    <div className="glass-panel p-5 rounded-xl">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-fluid-primary text-sm">visibility</span>
        <h3 className="font-headline font-bold text-sm text-fluid-text">Focus: Technology</h3>
      </div>
      <p className="text-xs text-fluid-text-muted mb-4">
        Network dominance at 42.1% with strong correlation to semi-conductors.
      </p>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-[10px] text-fluid-text-muted uppercase mb-1">Main Flow</div>
          <div className="text-xl font-mono-data text-fluid-text">72%</div>
          <div className="h-1 bg-fluid-surface-container rounded-full mt-1 overflow-hidden">
            <div className="h-full bg-fluid-primary w-[72%]" />
          </div>
        </div>
        <div>
          <div className="text-[10px] text-fluid-text-muted uppercase mb-1">Retail Flow</div>
          <div className="text-xl font-mono-data text-fluid-text">28%</div>
          <div className="h-1 bg-fluid-surface-container rounded-full mt-1 overflow-hidden">
            <div className="h-full bg-fluid-tertiary w-[28%]" />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-[10px] text-fluid-text-muted uppercase">Top Sector Constituents</div>
        {[
          { symbol: 'NVDA.NAS', flow: '+$214M', positive: true },
          { symbol: 'AAPL.NAS', flow: '+$182M', positive: true },
          { symbol: 'MSFT.NAS', flow: '-$45M', positive: false },
        ].map((stock, idx) => (
          <div key={idx} className="flex justify-between text-xs">
            <span className="text-fluid-text font-mono-data">{stock.symbol}</span>
            <span className={stock.positive ? 'text-fluid-primary' : 'text-fluid-secondary'}>
              {stock.flow}
            </span>
          </div>
        ))}
      </div>

      <button className="w-full mt-4 py-2 bg-fluid-surface-high rounded-lg text-xs text-fluid-primary hover:bg-fluid-surface-container transition-colors">
        View Network Depth →
      </button>
    </div>
  )
}

export default function SectorNetwork() {
  return (
    <div className="h-[calc(100vh-140px)] grid grid-cols-12 gap-5">
      {/* Main Graph - 9 cols */}
      <div className="col-span-9 glass-panel rounded-xl p-5">
        <SectorNetworkGraph />
      </div>

      {/* Side Panel - 3 cols */}
      <div className="col-span-3 flex flex-col gap-5">
        <SectorRankings />
        <FocusPanel />
      </div>
    </div>
  )
}
