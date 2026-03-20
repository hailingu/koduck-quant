import { useState } from 'react'

// Tick Data Component
function TimeAndSales() {
  const ticks = [
    { time: '14:02:11', price: '63,492.10', size: '0.421', total: 'BTC', highlight: false },
    { time: '14:02:10', price: '63,491.95', size: '1.220', total: 'BTC', highlight: false },
    { time: '14:02:08', price: '63,492.05', size: '0.015', total: 'BTC', highlight: false },
    { time: '14:02:07', price: '63,492.20', size: '5.842', total: 'BTC', highlight: true },
    { time: '14:02:05', price: '63,491.50', size: '0.050', total: 'BTC', highlight: false },
    { time: '14:02:02', price: '63,491.90', size: '0.118', total: 'BTC', highlight: false },
    { time: '14:02:00', price: '63,491.20', size: '2.440', total: 'BTC', highlight: true },
    { time: '14:01:58', price: '63,491.80', size: '0.992', total: 'BTC', highlight: false },
    { time: '14:01:55', price: '63,491.10', size: '0.022', total: 'BTC', highlight: false },
    { time: '14:01:52', price: '63,490.95', size: '1.050', total: 'BTC', highlight: false },
  ]

  return (
    <div className="glass-panel p-4 rounded-xl h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-headline font-bold text-sm text-fluid-text">Time & Sales</h3>
        <div className="flex items-center gap-1 text-[10px] font-mono-data text-fluid-primary">
          <span className="w-1.5 h-1.5 rounded-full bg-fluid-primary animate-pulse" />
          LIVE STREAM
        </div>
      </div>
      <div className="space-y-1 font-mono-data text-xs">
        {ticks.map((tick, idx) => (
          <div key={idx} className="flex justify-between items-center py-1">
            <span className="text-fluid-text-dim">{tick.time}</span>
            <span className={tick.highlight ? 'text-fluid-primary font-semibold' : 'text-fluid-text'}>
              {tick.price}
            </span>
            <span className={tick.highlight ? 'text-fluid-primary' : 'text-fluid-text-muted'}>
              {tick.size} {tick.total}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Volume Chart Component
function VolumeChart() {
  const volumes = [
    { height: 40, color: 'bg-fluid-primary' },
    { height: 60, color: 'bg-fluid-primary' },
    { height: 45, color: 'bg-fluid-secondary' },
    { height: 80, color: 'bg-fluid-primary' },
    { height: 100, color: 'bg-fluid-primary' },
    { height: 30, color: 'bg-fluid-secondary' },
    { height: 50, color: 'bg-fluid-primary' },
    { height: 70, color: 'bg-fluid-primary' },
    { height: 55, color: 'bg-fluid-secondary' },
    { height: 40, color: 'bg-fluid-primary' },
    { height: 65, color: 'bg-fluid-primary' },
    { height: 45, color: 'bg-fluid-secondary' },
    { height: 90, color: 'bg-fluid-primary' },
    { height: 35, color: 'bg-fluid-secondary' },
    { height: 50, color: 'bg-fluid-primary' },
  ]

  return (
    <div className="h-24 flex items-end gap-1">
      {volumes.map((v, i) => (
        <div 
          key={i} 
          className={`flex-1 ${v.color} rounded-t-sm opacity-70`}
          style={{ height: `${v.height}%` }}
        />
      ))}
    </div>
  )
}

// Market Stats Component
function MarketStats() {
  return (
    <div className="glass-panel p-4 rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-mono-data text-fluid-text-muted uppercase">1M Candle Aggregation</span>
        <div className="w-8 h-4 bg-fluid-primary rounded-full relative">
          <div className="absolute right-0.5 top-0.5 w-3 h-3 bg-white rounded-full" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex justify-between text-xs">
          <span className="text-fluid-text-muted">Network Latency</span>
          <span className="font-mono-data text-fluid-text">12ms</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-fluid-text-muted">Depth Concentration</span>
          <span className="font-mono-data text-fluid-text">0.842</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-fluid-text-muted">Liquid Flow Index</span>
          <div className="w-16 h-1.5 bg-fluid-surface-container rounded-full overflow-hidden">
            <div className="h-full bg-fluid-primary w-[65%]" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Kline() {
  const [timeframe, setTimeframe] = useState('intraday')
  
  const timeframes = [
    { key: 'intraday', label: 'INTRADAY (分时)', active: true },
    { key: '1m', label: '1 MIN', active: false },
    { key: '5m', label: '5 MIN', active: false },
    { key: '1h', label: '1 HOUR', active: false },
    { key: 'daily', label: 'DAILY', active: false },
  ]

  return (
    <div className="h-[calc(100vh-140px)] grid grid-cols-12 gap-5">
      {/* Main Chart - 9 cols */}
      <div className="col-span-9 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-headline font-bold text-fluid-text">BTC/USDT</h1>
              <span className="px-2 py-0.5 bg-fluid-secondary/20 text-fluid-secondary text-xs font-mono-data rounded">-2.41%</span>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono-data">
              <span className="text-fluid-primary text-xl">63,492.10</span>
              <span className="text-fluid-text-muted">HIGH: <span className="text-fluid-text">64,210.00</span></span>
              <span className="text-fluid-text-muted">LOW: <span className="text-fluid-text">62,840.50</span></span>
              <span className="text-fluid-text-muted">VOL: <span className="text-fluid-text">14.2B</span></span>
            </div>
          </div>
          
          {/* Timeframe Tabs */}
          <div className="flex items-center gap-1 bg-fluid-surface-container rounded-lg p-1">
            {timeframes.map((tf) => (
              <button
                key={tf.key}
                onClick={() => setTimeframe(tf.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  timeframe === tf.key
                    ? 'bg-fluid-primary text-fluid-surface-container-lowest'
                    : 'text-fluid-text-muted hover:text-fluid-text'
                }`}
              >
                {tf.label}
              </button>
            ))}
            <button className="ml-2 px-3 py-1.5 flex items-center gap-1 text-xs text-fluid-text-muted hover:text-fluid-text">
              <span className="material-symbols-outlined text-sm">calendar_month</span>
              Annual Data
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-fluid-primary" />
            <span className="text-fluid-text-muted font-mono-data">PRICE: <span className="text-fluid-text">63,492.10</span></span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-fluid-tertiary" />
            <span className="text-fluid-text-muted font-mono-data">VWAP: <span className="text-fluid-text">63,410.45</span></span>
          </div>
        </div>

        {/* Chart Area */}
        <div className="flex-1 glass-panel rounded-xl p-4 relative overflow-hidden">
          {/* Grid */}
          <div className="absolute inset-0 grid grid-cols-12 grid-rows-8 opacity-10">
            {Array.from({ length: 96 }).map((_, i) => (
              <div key={i} className="border-r border-b border-fluid-outline" />
            ))}
          </div>

          {/* Line Chart */}
          <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 400">
            {/* VWAP Line (dashed) */}
            <path 
              d="M0 200 L100 195 L200 198 L300 190 L400 185 L500 180 L600 175 L700 170 L800 165 L900 160 L1000 155" 
              fill="none" 
              stroke="#FFD81D" 
              strokeWidth="2"
              strokeDasharray="5,5"
            />
            {/* Price Line */}
            <path 
              d="M0 220 L50 210 L100 200 L150 205 L200 190 L250 180 L300 175 L350 170 L400 165 L450 160 L500 155 L550 150 L600 145 L650 140 L700 135 L750 130 L800 125 L850 120 L900 115 L950 110 L1000 105" 
              fill="none" 
              stroke="#00F2FF" 
              strokeWidth="2"
            />
            {/* Area fill */}
            <path 
              d="M0 220 L50 210 L100 200 L150 205 L200 190 L250 180 L300 175 L350 170 L400 165 L450 160 L500 155 L550 150 L600 145 L650 140 L700 135 L750 130 L800 125 L850 120 L900 115 L950 110 L1000 105 L1000 400 L0 400 Z" 
              fill="url(#areaGrad)"
              opacity="0.2"
            />
            <defs>
              <linearGradient id="areaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#00F2FF" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#00F2FF" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>

          {/* Chart Controls */}
          <div className="absolute bottom-4 right-4 flex gap-2">
            <button className="p-2 rounded-lg bg-fluid-surface-container text-fluid-text hover:bg-fluid-surface-high">
              <span className="material-symbols-outlined text-sm">search</span>
            </button>
            <button className="p-2 rounded-lg bg-fluid-surface-container text-fluid-text hover:bg-fluid-surface-high">
              <span className="material-symbols-outlined text-sm">zoom_in</span>
            </button>
            <button className="p-2 rounded-lg bg-fluid-surface-container text-fluid-text hover:bg-fluid-surface-high">
              <span className="material-symbols-outlined text-sm">photo_camera</span>
            </button>
          </div>
        </div>

        {/* Volume Chart */}
        <VolumeChart />
      </div>

      {/* Side Panel - 3 cols */}
      <div className="col-span-3 flex flex-col gap-4">
        <TimeAndSales />
        <MarketStats />
      </div>
    </div>
  )
}
