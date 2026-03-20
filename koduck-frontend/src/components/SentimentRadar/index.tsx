import { useMemo } from 'react'

// 五维数据 (根据设计稿: ACTIVITY, VOLATILITY, TREND, FEAR, FLOW)
interface RadarData {
  activity: number
  volatility: number
  trend: number
  fear: number
  flow: number
}

// 简化版雷达图 - 用于 Dashboard 侧边栏
export default function SentimentRadar() {
  // 模拟数据
  const data: RadarData = {
    activity: 85,
    volatility: 60,
    trend: 75,
    fear: 30,
    flow: 70,
  }

  // Fear/Greed 指数
  const fearGreedIndex = 64

  const radarData = useMemo(() => {
    const size = 200
    const center = size / 2
    const radius = 70
    const values = [data.activity, data.volatility, data.trend, data.fear, data.flow]
    
    // 五边形顶点计算
    const points = values.map((value, i) => {
      const angle = (i * 72 - 90) * (Math.PI / 180)
      const r = (value / 100) * radius
      return {
        x: center + r * Math.cos(angle),
        y: center + r * Math.sin(angle),
      }
    })
    
    return {
      size,
      center,
      radius,
      points,
      path: `M ${points.map(p => `${p.x},${p.y}`).join(' L ')} Z`,
    }
  }, [data])

  const labels = [
    { key: 'activity', label: 'ACTIVITY', pos: { x: 100, y: 15 } },
    { key: 'volatility', label: 'VOLATILITY', pos: { x: 185, y: 75 } },
    { key: 'trend', label: 'TREND', pos: { x: 155, y: 175 } },
    { key: 'fear', label: 'FEAR', pos: { x: 45, y: 175 } },
    { key: 'flow', label: 'FLOW', pos: { x: 15, y: 75 } },
  ]

  return (
    <div className="glass-panel p-5 rounded-xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-headline font-bold text-lg text-fluid-text tracking-tight uppercase">Sentiment Radar</h2>
        <span className="material-symbols-outlined text-fluid-primary/60">radar</span>
      </div>

      {/* Radar Chart */}
      <div className="relative w-full aspect-square flex items-center justify-center mb-6">
        {/* Background circles */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="absolute w-full h-full border border-fluid-primary/10 rounded-full scale-100" />
          <div className="absolute w-full h-full border border-fluid-primary/10 rounded-full scale-75" />
          <div className="absolute w-full h-full border border-fluid-primary/10 rounded-full scale-50" />
        </div>

        {/* SVG Radar */}
        <svg className="w-full h-full max-w-[180px] drop-shadow-[0_0_8px_rgba(0,242,255,0.4)]" viewBox="0 0 200 200">
          <polygon 
            points={radarData.points.map(p => `${p.x},${p.y}`).join(' ')}
            fill="rgba(0, 242, 255, 0.2)"
            stroke="#00F2FF"
            strokeWidth="1.5"
          />
          {radarData.points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="3" fill="#00F2FF" />
          ))}
        </svg>

        {/* Labels */}
        {labels.map((label) => (
          <div 
            key={label.key}
            className="absolute text-[9px] font-mono-data text-fluid-primary"
            style={{ 
              left: label.pos.x > 100 ? `${(label.pos.x / 200) * 100}%` : undefined,
              right: label.pos.x <= 100 ? `${((200 - label.pos.x) / 200) * 100}%` : undefined,
              top: `${(label.pos.y / 200) * 100}%`,
              transform: 'translateY(-50%)'
            }}
          >
            {label.label}
          </div>
        ))}
      </div>

      {/* Fear/Greed Index */}
      <div className="space-y-3">
        <div className="flex justify-between items-end">
          <span className="text-xs text-fluid-text-muted font-mono-data">Fear/Greed Index</span>
          <span className="text-xl font-headline font-bold text-fluid-tertiary">{fearGreedIndex}</span>
        </div>
        <div className="h-1.5 w-full bg-fluid-surface-container-low rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-fluid-secondary via-fluid-tertiary to-fluid-primary"
            style={{ width: `${fearGreedIndex}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] font-mono-data text-fluid-text-dim">
          <span>EXTREME FEAR</span>
          <span>GREED</span>
        </div>
      </div>
    </div>
  )
}
