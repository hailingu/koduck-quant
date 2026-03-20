// Market Dashboard Page
import SentimentRadar from '@/components/SentimentRadar'

// Big Order Alert Component
function BigOrderAlert() {
  const orders = [
    { symbol: 'NVDA.US', type: 'buy', amount: '$2.4M', time: '14:23:45', typeLabel: 'BLOCK ORDER' },
    { symbol: 'TSLA.US', type: 'sell', amount: '$1.8M', time: '14:23:12', typeLabel: 'DARK POOL' },
    { symbol: 'AAPL.US', type: 'buy', amount: '$5.1M', time: '14:22:58', typeLabel: 'ICEBERG' },
  ]

  return (
    <div className="glass-panel p-5 rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-headline font-bold text-sm text-fluid-text">Big Order Alert</h3>
        <span className="px-2 py-0.5 rounded bg-fluid-primary/10 text-fluid-primary text-[10px] font-mono-data">LIVE</span>
      </div>
      <div className="space-y-2">
        {orders.map((order, idx) => (
          <div key={idx} className="flex items-center gap-3 p-2 rounded-lg hover:bg-fluid-surface-high/50 transition-colors">
            <span className={`material-symbols-outlined text-sm ${order.type === 'buy' ? 'text-fluid-primary' : 'text-fluid-secondary'}`}>
              {order.type === 'buy' ? 'rocket_launch' : 'trending_down'}
            </span>
            <div className="flex-1">
              <div className="flex justify-between text-[11px] font-mono-data">
                <span className="text-fluid-text font-semibold">{order.symbol}</span>
                <span className={order.type === 'buy' ? 'text-fluid-primary' : 'text-fluid-secondary'}>{order.amount} {order.type.toUpperCase()}</span>
              </div>
              <div className="text-[9px] text-fluid-text-dim">{order.time} • {order.typeLabel}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Warning System Component
function WarningSystem() {
  return (
    <div className="glass-panel p-5 rounded-xl">
      <h3 className="font-headline font-bold text-sm text-fluid-text mb-4">Warning System</h3>
      
      {/* Golden Pit Alert */}
      <div className="relative group mb-3">
        <div className="absolute -inset-0.5 bg-fluid-tertiary rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-500" />
        <div className="relative flex items-center gap-3 p-4 bg-fluid-surface-container-low rounded-lg border border-fluid-tertiary/30">
          <span className="material-symbols-outlined text-fluid-tertiary animate-pulse">warning</span>
          <div>
            <h4 className="text-[11px] font-bold text-fluid-tertiary uppercase tracking-wider">Golden Pit Detected</h4>
            <p className="text-[10px] text-fluid-text-muted leading-tight mt-0.5">Price drop on rising net inflow. Accumulation phase.</p>
          </div>
        </div>
      </div>
      
      {/* False Breakout Alert */}
      <div className="flex items-center gap-3 p-4 bg-fluid-surface-container-low rounded-lg border border-fluid-secondary/20">
        <span className="material-symbols-outlined text-fluid-secondary">trending_down</span>
        <div>
          <h4 className="text-[11px] font-bold text-fluid-secondary uppercase tracking-wider">False Breakout</h4>
          <p className="text-[10px] text-fluid-text-muted leading-tight mt-0.5">Price peak on cooling momentum. High reversal risk.</p>
        </div>
      </div>
    </div>
  )
}

// Northbound Flow Component
function NorthboundFlow() {
  const bars = [0.25, 0.33, 0.5, 1, 0.66, 0.5, 0.25]
  
  return (
    <div className="glass-panel p-5 rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-headline font-bold text-sm text-fluid-text">Northbound Flow</h3>
        <span className="text-[10px] font-mono-data text-fluid-primary">+¥2.4B</span>
      </div>
      <div className="h-16 flex items-end gap-1">
        {bars.map((h, i) => (
          <div 
            key={i} 
            className={`flex-1 rounded-t-sm transition-all ${i === 3 ? 'bg-fluid-primary shadow-glow-primary' : 'bg-fluid-primary/30'}`}
            style={{ height: `${h * 100}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between mt-2 text-[8px] font-mono-data text-fluid-text-dim uppercase">
        <span>Open</span>
        <span>Mid-Day</span>
        <span>Close</span>
      </div>
    </div>
  )
}

// History Playback Mini Component
function HistoryPlaybackMini() {
  return (
    <div className="glass-panel p-5 rounded-xl">
      <h3 className="font-headline font-bold text-sm text-fluid-text mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-sm">history</span>
        History Playback
      </h3>
      <div className="flex items-center justify-between bg-fluid-surface-container-low rounded-lg p-3">
        <button className="material-symbols-outlined text-fluid-text-dim hover:text-fluid-primary transition-colors">fast_rewind</button>
        <button className="material-symbols-outlined text-fluid-primary text-3xl hover:scale-110 transition-transform">play_circle</button>
        <button className="material-symbols-outlined text-fluid-text-dim hover:text-fluid-primary transition-colors">fast_forward</button>
      </div>
      <div className="mt-4 flex flex-col gap-1">
        <div className="flex justify-between text-[10px] font-mono-data text-fluid-text-dim">
          <span>T-12h</span>
          <span>Live</span>
        </div>
        <input 
          type="range" 
          className="w-full h-1 bg-fluid-surface-container rounded-lg appearance-none cursor-pointer accent-fluid-primary"
          defaultValue={100}
        />
      </div>
    </div>
  )
}

// Market Breadth Heatmap
function MarketBreadth() {
  const bars = [
    ...Array(10).fill('up'),
    ...Array(4).fill('neutral'),
    ...Array(6).fill('down')
  ]
  
  return (
    <div className="mt-4">
      <div className="h-12 grid grid-cols-20 gap-0.5">
        {bars.map((type, i) => {
          const opacity = type === 'up' 
            ? 1 - (i * 0.08)
            : type === 'down'
            ? 1 - ((19 - i) * 0.08)
            : 0.3
          return (
            <div 
              key={i} 
              className={`h-full rounded-sm ${type === 'up' ? 'bg-fluid-primary' : type === 'down' ? 'bg-fluid-secondary' : 'bg-fluid-surface-container'}`}
              style={{ opacity }}
            />
          )
        })}
      </div>
      <div className="flex justify-between mt-1 text-[8px] font-mono-data text-fluid-text-dim uppercase tracking-wider">
        <span>Max Gainers (+10%)</span>
        <span>Sector Breadth Distribution</span>
        <span>Max Losers (-10%)</span>
      </div>
    </div>
  )
}

// Capital River Main Component
function CapitalRiverMain() {
  return (
    <div className="flex-1 glass-panel rounded-xl p-6 flex flex-col relative overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-start mb-6 z-10">
        <div>
          <h2 className="font-headline font-bold text-2xl tracking-tight text-fluid-text">Capital River</h2>
          <p className="text-xs text-fluid-text-muted font-mono-data mt-1">Real-time Fund Flow Dynamics</p>
        </div>
        <div className="flex gap-2">
          <div className="bg-fluid-surface-container px-3 py-1.5 rounded-lg text-[10px] font-mono-data text-fluid-primary flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-fluid-primary shadow-glow-primary animate-pulse" />
            INFLOW: $4.2B
          </div>
          <div className="bg-fluid-surface-container px-3 py-1.5 rounded-lg text-[10px] font-mono-data text-fluid-secondary flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-fluid-secondary shadow-glow-secondary" />
            OUTFLOW: $2.1B
          </div>
        </div>
      </div>

      {/* River Visual */}
      <div className="flex-1 relative flex items-center justify-center min-h-[200px]">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-fluid-primary/5 to-transparent" />
        
        {/* Flow Particles */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-[15%] w-2 h-2 rounded-full bg-fluid-primary shadow-glow-primary opacity-80 animate-pulse" />
          <div className="absolute top-1/2 left-[35%] w-3 h-3 rounded-full bg-fluid-primary shadow-glow-primary opacity-60 animate-pulse delay-75" />
          <div className="absolute top-2/3 left-[60%] w-2 h-2 rounded-full bg-fluid-primary shadow-glow-primary opacity-90 animate-pulse delay-150" />
          <div className="absolute top-1/3 left-[80%] w-4 h-4 rounded-full bg-fluid-primary shadow-glow-primary opacity-40 animate-pulse delay-200" />
        </div>

        {/* Data Nodes */}
        <div className="absolute w-full h-full flex items-center justify-around px-8">
          <div className="flex flex-col items-center group cursor-pointer">
            <div className="w-16 h-16 rounded-2xl glass-panel flex flex-col items-center justify-center transition-all group-hover:scale-110 group-hover:border-fluid-primary/40">
              <span className="text-[10px] font-mono-data text-fluid-primary">TECH</span>
              <span className="text-sm font-bold text-fluid-text">+12%</span>
            </div>
          </div>
          <div className="flex flex-col items-center group cursor-pointer">
            <div className="w-24 h-24 rounded-2xl glass-panel border-fluid-primary/30 flex flex-col items-center justify-center transition-all group-hover:scale-110 group-hover:border-fluid-primary">
              <span className="text-[10px] font-mono-data text-fluid-primary">FINANCE</span>
              <span className="text-lg font-bold text-fluid-text">+28%</span>
            </div>
          </div>
          <div className="flex flex-col items-center group cursor-pointer">
            <div className="w-14 h-14 rounded-2xl glass-panel flex flex-col items-center justify-center transition-all group-hover:scale-110 group-hover:border-fluid-secondary/40">
              <span className="text-[10px] font-mono-data text-fluid-secondary">ENERGY</span>
              <span className="text-sm font-bold text-fluid-text">-4%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <MarketBreadth />
    </div>
  )
}

export default function Market() {
  return (
    <div className="grid grid-cols-12 gap-5 h-[calc(100vh-140px)]">
      {/* Left Column - 3 cols */}
      <div className="col-span-3 flex flex-col gap-5">
        <SentimentRadar />
        <HistoryPlaybackMini />
      </div>

      {/* Middle Column - 6 cols */}
      <div className="col-span-6 flex flex-col">
        <CapitalRiverMain />
      </div>

      {/* Right Column - 3 cols */}
      <div className="col-span-3 flex flex-col gap-5 overflow-y-auto scrollbar-hide pb-2">
        <BigOrderAlert />
        <WarningSystem />
        <NorthboundFlow />
      </div>
    </div>
  )
}
