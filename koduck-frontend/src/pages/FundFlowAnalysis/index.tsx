// Fund Flow Analysis Page

// Capital Game Matrix Component
function CapitalGameMatrix() {
  const rows = [
    { 
      name: 'Main Capital', 
      icon: 'account_balance', 
      color: 'text-fluid-primary',
      value: '$4.2B', 
      change: '▲ 12%', 
      progress: 85,
      progressColor: 'bg-fluid-primary'
    },
    { 
      name: 'Retail Capital', 
      icon: 'group', 
      color: 'text-fluid-secondary',
      value: '$1.1B', 
      change: '▼ 04%', 
      progress: 22,
      progressColor: 'bg-fluid-secondary'
    },
    { 
      name: 'Northbound', 
      icon: 'south_east', 
      color: 'text-fluid-tertiary',
      value: '$2.8B', 
      change: '▲ 08%', 
      progress: 54,
      progressColor: 'bg-fluid-tertiary'
    },
  ]

  return (
    <div className="glass-panel p-6 rounded-xl">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-headline font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-fluid-primary">view_quilt</span>
          Capital Game Matrix
        </h2>
        <span className="bg-fluid-surface-high px-2 py-1 rounded text-[10px] font-mono-data uppercase">Real-time Feed</span>
      </div>

      {/* Header Row */}
      <div className="grid grid-cols-3 gap-1 mb-2">
        <div></div>
        <div className="text-center pb-3 text-[10px] font-mono-data text-fluid-text-muted uppercase tracking-widest">Inflow Volume</div>
        <div className="text-center pb-3 text-[10px] font-mono-data text-fluid-text-muted uppercase tracking-widest">Influence Score</div>
      </div>

      {/* Data Rows */}
      {rows.map((row, idx) => (
        <div key={idx} className="grid grid-cols-3 gap-1 mb-1">
          <div className="bg-fluid-surface-container-low p-4 rounded-l-lg flex items-center gap-3">
            <span className={`material-symbols-outlined ${row.color}`}>{row.icon}</span>
            <span className="text-sm font-medium text-fluid-text">{row.name}</span>
          </div>
          <div className="bg-fluid-surface-container p-4 flex items-center justify-center">
            <span className={`font-mono-data ${row.color}`}>
              {row.value} <span className="text-[10px] opacity-60">{row.change}</span>
            </span>
          </div>
          <div className="bg-fluid-surface-container p-4 rounded-r-lg flex items-center justify-center">
            <div className="w-full bg-fluid-surface-highest h-2 rounded-full overflow-hidden">
              <div className={`h-full ${row.progressColor}`} style={{ width: `${row.progress}%` }} />
            </div>
          </div>
        </div>
      ))}

      {/* Bottom Stats */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="bg-fluid-surface-container-lowest p-5 rounded-lg border border-fluid-outline-variant/10">
          <div className="text-[10px] font-mono-data text-fluid-text-muted uppercase mb-2">Game Index Calculation</div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-headline font-bold text-fluid-text">88.4</span>
            <span className="text-xs font-mono-data text-fluid-primary">High Control</span>
          </div>
          <div className="text-xs text-fluid-text-muted mt-2 italic">Main capital is aggressively absorbing liquidity while retail sentiment remains bearish.</div>
        </div>
        <div className="bg-fluid-surface-container-lowest p-5 rounded-lg border border-fluid-outline-variant/10 flex flex-col justify-center">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium text-fluid-text">Accumulation Phase</span>
            <span className="text-xs font-mono-data text-fluid-primary">92% Complete</span>
          </div>
          <div className="w-full h-4 bg-fluid-surface-highest rounded-sm relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-fluid-primary/20 to-fluid-primary" style={{ width: '92%' }} />
          </div>
        </div>
      </div>
    </div>
  )
}

// Divergence Alerts Component
function DivergenceAlerts() {
  const alerts = [
    {
      type: 'golden',
      title: 'Golden Pit Detected',
      time: '14:22:05',
      desc: 'Price dropped 3.2% while Institutional Inflow spiked 18%.',
      hasActions: true,
    },
    {
      type: 'negative',
      title: 'Negative Divergence',
      time: '13:58:12',
      desc: 'Price hitting 24h highs on declining volume. Retail exhaustion signal.',
      hasActions: false,
    },
    {
      type: 'sideways',
      title: 'Sideways Absorption',
      time: '12:15:44',
      desc: 'V-shaped recovery in flow metrics during price consolidation.',
      hasActions: false,
    },
  ]

  return (
    <div className="glass-panel p-6 rounded-xl flex flex-col h-full">
      <h2 className="text-lg font-headline font-semibold mb-6 flex items-center gap-2">
        <span className="material-symbols-outlined text-fluid-tertiary">crisis_alert</span>
        Divergence Alerts
      </h2>
      <div className="space-y-4 flex-1 overflow-y-auto">
        {alerts.map((alert, idx) => (
          <div 
            key={idx} 
            className={`bg-fluid-surface-container-lowest p-4 rounded-lg border-l-[3px] ${
              alert.type === 'golden' ? 'border-fluid-tertiary' :
              alert.type === 'negative' ? 'border-fluid-secondary' :
              'border-fluid-primary'
            }`}
          >
            <div className="flex justify-between items-start mb-1">
              <span className={`text-[10px] font-mono-data font-bold uppercase ${
                alert.type === 'golden' ? 'text-fluid-tertiary' :
                alert.type === 'negative' ? 'text-fluid-secondary' :
                'text-fluid-primary'
              }`}>{alert.title}</span>
              <span className="text-[10px] font-mono-data text-fluid-text-dim">{alert.time}</span>
            </div>
            <p className="text-sm text-fluid-text leading-tight">{alert.desc}</p>
            {alert.hasActions && (
              <div className="mt-3 flex gap-2">
                <button className="text-[10px] font-mono-data uppercase px-2 py-1 bg-fluid-tertiary text-fluid-surface-container-lowest font-bold rounded">
                  Long Entry
                </button>
                <button className="text-[10px] font-mono-data uppercase px-2 py-1 bg-fluid-surface-high text-fluid-text-muted rounded">
                  Details
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// Divergence Chart Component
function DivergenceChart() {
  return (
    <div className="glass-panel p-6 rounded-xl">
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-lg font-headline font-semibold text-fluid-text">Price vs. Capital Flow Divergence</h2>
          <p className="text-xs text-fluid-text-muted">Visualization of liquidity pressure behind price action.</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-fluid-primary"></span>
            <span className="text-[10px] font-mono-data uppercase text-fluid-text-muted">Net Capital Flow</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-fluid-outline"></span>
            <span className="text-[10px] font-mono-data uppercase text-fluid-text-muted">Price Baseline</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-fluid-tertiary animate-pulse"></span>
            <span className="text-[10px] font-mono-data uppercase text-fluid-tertiary font-bold">Golden Pit Zone</span>
          </div>
        </div>
      </div>

      {/* Chart Area */}
      <div className="h-[250px] w-full relative bg-fluid-surface-container-lowest rounded-lg border border-fluid-outline-variant/10 overflow-hidden">
        {/* Grid */}
        <div className="absolute inset-0 grid grid-cols-12 grid-rows-6 opacity-20">
          {Array.from({ length: 72 }).map((_, i) => (
            <div key={i} className="border-r border-b border-fluid-outline" />
          ))}
        </div>

        {/* SVG Chart */}
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 300">
          {/* Price Line (Faded) */}
          <path 
            d="M0 150 L50 140 L100 160 L150 145 L200 170 L250 185 L300 190 L350 180 L400 200 L450 210 L500 205 L550 215 L600 220 L650 210 L700 215 L750 200 L800 190 L850 195 L900 205 L950 210 L1000 200" 
            fill="none" 
            stroke="#3A494B" 
            strokeWidth="2"
          />
          {/* Capital Flow Line (Strong) */}
          <path 
            d="M0 160 L50 155 L100 140 L150 120 L200 110 L250 95 L300 85 L350 70 L400 80 L450 65 L500 75 L550 90 L600 100 L650 95 L700 85 L750 70 L800 60 L850 55 L900 45 L950 40 L1000 35" 
            fill="none" 
            stroke="#00F2FF" 
            strokeWidth="3"
          />
          {/* Golden Pit Zone */}
          <defs>
            <linearGradient id="goldenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFD81D" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#FFD81D" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect x="200" y="0" width="150" height="300" fill="url(#goldenGrad)" />
        </svg>

        {/* Label */}
        <div className="absolute top-[170px] left-[220px] bg-fluid-tertiary text-fluid-surface-container-lowest px-2 py-1 text-[10px] font-mono-data font-bold rounded shadow-lg">
          DIVERGENCE DETECTED
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="bg-fluid-surface-container-low p-4 rounded-lg">
          <div className="text-[10px] font-mono-data text-fluid-text-muted uppercase mb-1">Inflow Velocity</div>
          <div className="text-xl font-mono-data text-fluid-primary">1.42 BTC/sec</div>
        </div>
        <div className="bg-fluid-surface-container-low p-4 rounded-lg">
          <div className="text-[10px] font-mono-data text-fluid-text-muted uppercase mb-1">Liquidity Gap</div>
          <div className="text-xl font-mono-data text-fluid-secondary">$14.2M Margin</div>
        </div>
        <div className="bg-fluid-surface-container-low p-4 rounded-lg">
          <div className="text-[10px] font-mono-data text-fluid-text-muted uppercase mb-1">Sentiment Divergence</div>
          <div className="text-xl font-mono-data text-fluid-tertiary">-22.5% Delta</div>
        </div>
      </div>
    </div>
  )
}

export default function FundFlowAnalysis() {
  return (
    <div className="space-y-6 pb-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-6">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight text-fluid-text">
            Flow Game & <span className="text-fluid-primary">Divergence</span>
          </h1>
          <p className="text-fluid-text-muted mt-2">Monitoring institutional accumulation cycles and retail liquidity exhaustion.</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-fluid-surface-container-low px-4 py-2 rounded-lg flex flex-col border-l-2 border-fluid-primary">
            <span className="text-[10px] font-mono-data text-fluid-text-muted uppercase">Market Heat</span>
            <span className="text-xl font-mono-data text-fluid-primary">74.8%</span>
          </div>
          <div className="bg-fluid-surface-container-low px-4 py-2 rounded-lg flex flex-col border-l-2 border-fluid-tertiary">
            <span className="text-[10px] font-mono-data text-fluid-text-muted uppercase">Divergence Index</span>
            <span className="text-xl font-mono-data text-fluid-tertiary">CRITICAL</span>
          </div>
        </div>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-12 gap-5">
        {/* Capital Game Matrix - 8 cols */}
        <div className="col-span-12 lg:col-span-8">
          <CapitalGameMatrix />
        </div>

        {/* Divergence Alerts - 4 cols */}
        <div className="col-span-12 lg:col-span-4">
          <DivergenceAlerts />
        </div>

        {/* Divergence Chart - 12 cols */}
        <div className="col-span-12">
          <DivergenceChart />
        </div>
      </div>
    </div>
  )
}
