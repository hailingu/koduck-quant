import { useState } from 'react'

// Event Stream Component
function EventStream() {
  const events = [
    {
      time: 'T-Minus 12 Days',
      title: 'The Great Rotation',
      desc: 'AI: "Liquidity exited Tech growth sectors at 4.2x speed, seeking refuge in Gold-backed indices."',
      color: 'border-fluid-primary',
    },
    {
      time: 'T-Minus 08 Days',
      title: 'Volume Anomalies',
      desc: 'System identified rhythmic whale accumulation in Renewable Energy.',
      color: 'border-fluid-tertiary',
    },
    {
      time: 'T-Minus 02 Days',
      title: 'Equilibrium Shift',
      desc: 'Broad market indices show stagnation; volatility compression reaching critical 5-year lows.',
      color: 'border-fluid-text-muted',
    },
  ]

  return (
    <div className="glass-panel p-5 rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-headline font-bold text-sm text-fluid-text">Event Stream</h3>
        <span className="material-symbols-outlined text-fluid-primary text-sm">auto_awesome</span>
      </div>
      <div className="space-y-4">
        {events.map((evt, idx) => (
          <div key={idx} className={`border-l-2 ${evt.color} pl-3`}>
            <div className="text-[10px] font-mono-data text-fluid-text-dim mb-1">{evt.time}</div>
            <h4 className="text-sm font-semibold text-fluid-text mb-1">{evt.title}</h4>
            <p className="text-xs text-fluid-text-muted italic">{evt.desc}</p>
          </div>
        ))}
      </div>
      <button className="w-full mt-4 py-2 border border-fluid-outline-variant rounded-lg text-xs text-fluid-text-muted hover:text-fluid-text transition-colors">
        EXPORT FULL ANALYSIS
      </button>
    </div>
  )
}

// Radar Comparison Component
function RadarComparison() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="glass-panel p-4 rounded-xl text-center">
        <div className="text-[10px] font-mono-data text-fluid-text-muted uppercase mb-2">Sentiment A: Start Period</div>
        <div className="w-32 h-32 mx-auto relative">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <polygon 
              points="50,10 85,35 75,85 25,85 15,35" 
              fill="rgba(0, 242, 255, 0.2)"
              stroke="#00F2FF"
              strokeWidth="1"
            />
          </svg>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2 text-[10px] font-mono-data">
          <div className="text-fluid-text-muted">GROWTH: <span className="text-fluid-text">62%</span></div>
          <div className="text-fluid-text-muted">VALUE: <span className="text-fluid-text">41%</span></div>
          <div className="text-fluid-text-muted">RISK: <span className="text-fluid-text">18%</span></div>
          <div className="text-fluid-text-muted">YIELD: <span className="text-fluid-text">55%</span></div>
        </div>
      </div>
      <div className="glass-panel p-4 rounded-xl text-center">
        <div className="text-[10px] font-mono-data text-fluid-primary uppercase mb-2">Sentiment B: Current Scrubber</div>
        <div className="w-32 h-32 mx-auto relative">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <polygon 
              points="50,80 70,60 65,30 35,30 30,60" 
              fill="rgba(222, 5, 65, 0.2)"
              stroke="#DE0541"
              strokeWidth="1"
            />
          </svg>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2 text-[10px] font-mono-data">
          <div className="text-fluid-text-muted">GROWTH: <span className="text-fluid-text">22%</span></div>
          <div className="text-fluid-text-muted">VALUE: <span className="text-fluid-text">88%</span></div>
          <div className="text-fluid-text-muted">RISK: <span className="text-fluid-text">91%</span></div>
          <div className="text-fluid-text-muted">YIELD: <span className="text-fluid-text">12%</span></div>
        </div>
      </div>
    </div>
  )
}

export default function HistoryPlayback() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(65)

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-headline font-bold tracking-tight text-fluid-text">
            Historical <span className="text-fluid-primary">Rotation</span>
          </h1>
          <p className="text-fluid-text-muted mt-2 max-w-2xl">
            Reconstruct the 30-day capital migration path. Watch the pressure differential shift between Tech, Energy, and Emerging Markets.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-2 rounded-lg bg-fluid-surface-container text-fluid-text hover:bg-fluid-surface-high">
            <span className="material-symbols-outlined">skip_previous</span>
          </button>
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-12 h-12 rounded-xl bg-fluid-primary text-fluid-surface-container-lowest flex items-center justify-center hover:shadow-glow-primary transition-all"
          >
            <span className="material-symbols-outlined text-2xl">{isPlaying ? 'pause' : 'play_arrow'}</span>
          </button>
          <button className="p-2 rounded-lg bg-fluid-surface-container text-fluid-text hover:bg-fluid-surface-high">
            <span className="material-symbols-outlined">skip_next</span>
          </button>
          <div className="ml-2 px-3 py-1.5 bg-fluid-surface-container rounded-lg text-xs font-mono-data text-fluid-text">
            1X SPEED ▾
          </div>
        </div>
      </div>

      {/* Timeline Scrubber */}
      <div className="glass-panel p-6 rounded-xl">
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="text-[10px] font-mono-data text-fluid-primary uppercase mb-1">Current Phase</div>
            <div className="text-2xl font-headline font-bold text-fluid-text">TECH DIVERGENCE</div>
          </div>
          <div className="text-right">
            <div className="text-xl font-mono-data text-fluid-text">MAY 14, 2024</div>
            <div className="text-xs font-mono-data text-fluid-text-muted">14:22:05 UTC</div>
          </div>
        </div>

        {/* Wave Visualization */}
        <div className="relative h-32 mb-4">
          <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 800 100">
            <defs>
              <linearGradient id="waveGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#00F2FF" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#00F2FF" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path 
              d="M0,50 Q100,20 200,50 T400,50 T600,30 T800,50 L800,100 L0,100 Z" 
              fill="url(#waveGrad)"
            />
            <path 
              d="M0,50 Q100,20 200,50 T400,50 T600,30 T800,50" 
              fill="none"
              stroke="#00F2FF"
              strokeWidth="2"
            />
          </svg>
          
          {/* Scrubber Line */}
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-fluid-tertiary"
            style={{ left: `${progress}%` }}
          >
            <div className="absolute -top-1 -left-1.5 w-4 h-4 rounded-full bg-fluid-tertiary border-2 border-fluid-surface" />
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-fluid-tertiary text-fluid-surface text-[10px] font-mono-data rounded whitespace-nowrap">
              SCRUBBING
            </div>
          </div>
        </div>

        {/* Timeline Labels */}
        <div className="relative">
          <input 
            type="range" 
            className="w-full h-1 bg-fluid-surface-container rounded-lg appearance-none cursor-pointer accent-fluid-primary"
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
          />
          <div className="flex justify-between mt-2 text-[10px] font-mono-data text-fluid-text-muted uppercase">
            <span>-30 Days</span>
            <span>-15 Days</span>
            <span>Peak Inflow</span>
            <span>Present</span>
          </div>
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-8">
          <RadarComparison />
        </div>
        <div className="col-span-4">
          <EventStream />
        </div>
      </div>
    </div>
  )
}
