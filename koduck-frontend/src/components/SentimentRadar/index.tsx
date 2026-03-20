import { useState, useEffect, useMemo, useCallback } from 'react'
import { Radar, TrendingUp, Activity, BarChart3, AlertTriangle, Wallet } from '@mui/icons-material'

// 六维指标数据
interface DimensionData {
  activity: number // 活跃度 0-100
  volatility: number // 波动率 0-100
  trendStrength: number // 趋势强度 0-100
  fearGreed: number // 恐慌度 0-100
  valuation: number // 估值水平 0-100
  fundFlow: number // 资金流向 0-100
}

interface HistoricalPoint {
  timestamp: string
  dimensions: DimensionData
  overall: number
}

// 维度配置
const DIMENSIONS = [
  { key: 'activity', label: '活跃度', icon: Activity, color: '#00F2FF', description: '市场成交活跃程度' },
  { key: 'volatility', label: '波动率', icon: BarChart3, color: '#FFD81D', description: '市场价格波动幅度' },
  { key: 'trendStrength', label: '趋势强度', icon: TrendingUp, color: '#00DBE7', description: '当前趋势的力度' },
  { key: 'fearGreed', label: '恐慌度', icon: AlertTriangle, color: '#FFB3B5', description: '市场恐慌情绪' },
  { key: 'valuation', label: '估值水平', icon: Wallet, color: '#74F5FF', description: '当前市场估值分位' },
  { key: 'fundFlow', label: '资金流向', icon: Radar, color: '#FFE16D', description: '资金净流入强度' },
] as const

type DimensionKey = typeof DIMENSIONS[number]['key']

// 生成模拟数据
const generateMockData = (): DimensionData => ({
  activity: Math.floor(Math.random() * 40) + 60,
  volatility: Math.floor(Math.random() * 50) + 30,
  trendStrength: Math.floor(Math.random() * 30) + 70,
  fearGreed: Math.floor(Math.random() * 40) + 20,
  valuation: Math.floor(Math.random() * 30) + 60,
  fundFlow: Math.floor(Math.random() * 40) + 55,
})

// 生成历史数据
const generateHistory = (): HistoricalPoint[] => {
  const history: HistoricalPoint[] = []
  for (let i = 0; i < 20; i++) {
    const dimensions = generateMockData()
    history.push({
      timestamp: new Date(Date.now() - (19 - i) * 5 * 60 * 1000).toISOString(),
      dimensions,
      overall: calculateOverallScore(dimensions),
    })
  }
  return history
}

// 计算综合评分
function calculateOverallScore(dimensions: DimensionData): number {
  const score =
    dimensions.activity * 0.15 +
    dimensions.volatility * 0.1 +
    dimensions.trendStrength * 0.25 +
    dimensions.fearGreed * 0.15 +
    dimensions.valuation * 0.15 +
    dimensions.fundFlow * 0.2
  return Math.round(score)
}

// 获取市场状态
function getMarketStatus(score: number, dimensions: DimensionData): { status: string; color: string; advice: string } {
  if (score >= 80) {
    return {
      status: '强势上涨',
      color: '#00F2FF',
      advice: '趋势强度(' + dimensions.trendStrength + ')+活跃度(' + dimensions.activity + ')确认强势，但估值(' + dimensions.valuation + ')偏高注意风险',
    }
  } else if (score >= 65) {
    return {
      status: '谨慎看涨',
      color: '#00DBE7',
      advice: '整体健康，关注资金流向(' + dimensions.fundFlow + ')持续流入',
    }
  } else if (score >= 50) {
    return {
      status: '震荡整理',
      color: '#FFD81D',
      advice: '波动率(' + dimensions.volatility + ')较高，建议观望',
    }
  } else if (score >= 35) {
    return {
      status: '谨慎看跌',
      color: '#FFB3B5',
      advice: '恐慌度(' + dimensions.fearGreed + ')上升，注意控制风险',
    }
  } else {
    return {
      status: '弱势下跌',
      color: '#DE0541',
      advice: '趋势偏弱，等待企稳信号',
    }
  }
}

// SVG 雷达图组件
const RadarChart = ({
  data,
  size = 280,
  animated = true,
}: {
  data: DimensionData
  size?: number
  animated?: boolean
}) => {
  const center = size / 2
  const radius = size * 0.35
  const angleStep = (Math.PI * 2) / 6

  // 计算六边形顶点
  const getPoint = (index: number, r: number) => {
    const angle = index * angleStep - Math.PI / 2
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    }
  }

  // 生成网格路径
  const gridPaths = [0.2, 0.4, 0.6, 0.8, 1].map((scale) => {
    const points = Array.from({ length: 6 }, (_, i) => {
      const p = getPoint(i, radius * scale)
      return `${p.x},${p.y}`
    }).join(' ')
    return points
  })

  // 生成数据路径
  const dataPath = useMemo(() => {
    const values = [
      data.activity,
      data.volatility,
      data.trendStrength,
      data.fearGreed,
      data.valuation,
      data.fundFlow,
    ]
    const points = values.map((value, i) => {
      const p = getPoint(i, (value / 100) * radius)
      return `${p.x},${p.y}`
    })
    return `M ${points.join(' L ')} Z`
  }, [data, radius])

  // 生成轴线
  const axes = Array.from({ length: 6 }, (_, i) => {
    const end = getPoint(i, radius)
    return { x2: end.x, y2: end.y }
  })

  return (
    <svg width={size} height={size} className={animated ? 'animate-fade-in' : ''}>
      {/* 背景网格 */}
      {gridPaths.map((points, i) => (
        <polygon
          key={i}
          points={points}
          fill="none"
          stroke="#272A31"
          strokeWidth="1"
          opacity={0.5 + i * 0.1}
        />
      ))}

      {/* 轴线 */}
      {axes.map((axis, i) => (
        <line
          key={i}
          x1={center}
          y1={center}
          x2={axis.x2}
          y2={axis.y2}
          stroke="#272A31"
          strokeWidth="1"
        />
      ))}

      {/* 数据区域 */}
      <path
        d={dataPath}
        fill="rgba(0, 242, 255, 0.2)"
        stroke="#00F2FF"
        strokeWidth="2"
        className={animated ? 'transition-all duration-500' : ''}
      />

      {/* 数据点 */}
      {[
        data.activity,
        data.volatility,
        data.trendStrength,
        data.fearGreed,
        data.valuation,
        data.fundFlow,
      ].map((value, i) => {
        const p = getPoint(i, (value / 100) * radius)
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" fill="#00F2FF" stroke="#0B0E14" strokeWidth="2" />
            <circle cx={p.x} cy={p.y} r="8" fill="transparent" className="hover:fill-[#00F2FF20] cursor-pointer" />
          </g>
        )
      })}

      {/* 标签 */}
      {DIMENSIONS.map((dim, i) => {
        const p = getPoint(i, radius + 25)
        return (
          <text
            key={i}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={dim.color}
            fontSize="10"
            fontFamily="JetBrains Mono, monospace"
          >
            {dim.label}
          </text>
        )
      })}
    </svg>
  )
}

// 维度卡片组件
const DimensionCard = ({
  dimension,
  value,
  trend,
  onClick,
  isActive,
}: {
  dimension: (typeof DIMENSIONS)[number]
  value: number
  trend: 'up' | 'down' | 'flat'
  onClick: () => void
  isActive: boolean
}) => {
  const Icon = dimension.icon
  return (
    <button
      onClick={onClick}
      className={`p-3 rounded-lg text-left transition-all ${
        isActive ? 'bg-[#272A31] border border-[#3A494B]' : 'bg-[#0B0E14] border border-transparent hover:bg-[#191C22]'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon style={{ color: dimension.color, fontSize: 16 }} />
        <span className="text-xs text-[#849495]">{dimension.label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-bold" style={{ color: dimension.color, fontFamily: 'JetBrains Mono, monospace' }}>
          {value}
        </span>
        <span
          className={`text-xs ${
            trend === 'up' ? 'text-[#00F2FF]' : trend === 'down' ? 'text-[#FFB3B5]' : 'text-[#849495]'
          }`}
        >
          {trend === 'up' ? '▲' : trend === 'down' ? '▼' : '—'}
        </span>
      </div>
    </button>
  )
}

export default function SentimentRadar() {
  const [data, setData] = useState<DimensionData>(generateMockData())
  const [history, setHistory] = useState<HistoricalPoint[]>(generateHistory())
  const [selectedDimension, setSelectedDimension] = useState<DimensionKey | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [showHistory, setShowHistory] = useState(false)

  // 综合评分
  const overallScore = useMemo(() => calculateOverallScore(data), [data])

  // 市场状态
  const marketStatus = useMemo(() => getMarketStatus(overallScore, data), [overallScore, data])

  // 趋势计算
  const getTrend = useCallback(
    (key: DimensionKey): 'up' | 'down' | 'flat' => {
      if (history.length < 2) return 'flat'
      const prev = history[history.length - 2].dimensions[key]
      const curr = data[key]
      if (curr > prev + 2) return 'up'
      if (curr < prev - 2) return 'down'
      return 'flat'
    },
    [history, data]
  )

  // 自动刷新
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => {
      const newData = generateMockData()
      setData(newData)
      setHistory((prev) => {
        const newPoint: HistoricalPoint = {
          timestamp: new Date().toISOString(),
          dimensions: newData,
          overall: calculateOverallScore(newData),
        }
        return [...prev.slice(1), newPoint]
      })
    }, 5000)
    return () => clearInterval(interval)
  }, [autoRefresh])

  // 选中的维度详情
  const selectedDimConfig = selectedDimension
    ? DIMENSIONS.find((d) => d.key === selectedDimension)
    : null

  return (
    <div className="w-full space-y-6">
      {/* 标题区域 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1
            className="text-3xl font-bold tracking-tight text-[#E1E2EB]"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            六维市场情绪 <span className="text-[#00F2FF]">雷达</span>
          </h1>
          <p className="text-[#849495] font-body mt-2">多维度量化评估市场健康度与情绪周期</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 text-xs rounded transition-colors ${
              autoRefresh ? 'bg-[#00F2FF]/20 text-[#00F2FF]' : 'bg-[#272A31] text-[#849495]'
            }`}
          >
            {autoRefresh ? '🟢 自动刷新' : '⚪ 手动刷新'}
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`px-3 py-1.5 text-xs rounded transition-colors ${
              showHistory ? 'bg-[#FFD81D]/20 text-[#FFD81D]' : 'bg-[#272A31] text-[#849495]'
            }`}
          >
            {showHistory ? '📊 隐藏历史' : '📈 显示历史'}
          </button>
        </div>
      </div>

      {/* 主要内容区 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：雷达图 */}
        <div className="lg:col-span-1 bg-[#10131A] p-6 rounded-xl border border-[#272A31] flex flex-col items-center">
          <div className="relative">
            <RadarChart data={data} size={300} />
            {/* 中心综合评分 */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div
                  className="text-4xl font-bold"
                  style={{ color: marketStatus.color, fontFamily: 'Space Grotesk, sans-serif' }}
                >
                  {overallScore}
                </div>
                <div className="text-xs text-[#849495] mt-1">综合评分</div>
              </div>
            </div>
          </div>

          {/* 市场状态 */}
          <div className="mt-4 text-center">
            <div
              className="text-lg font-bold mb-1"
              style={{ color: marketStatus.color, fontFamily: 'Space Grotesk, sans-serif' }}
            >
              {marketStatus.status}
            </div>
            <div className="text-xs text-[#849495] max-w-[250px]">{marketStatus.advice}</div>
          </div>
        </div>

        {/* 右侧：维度详情 */}
        <div className="lg:col-span-2 space-y-4">
          {/* 六维卡片网格 */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {DIMENSIONS.map((dim) => (
              <DimensionCard
                key={dim.key}
                dimension={dim}
                value={data[dim.key as DimensionKey]}
                trend={getTrend(dim.key as DimensionKey)}
                onClick={() => setSelectedDimension(dim.key as DimensionKey)}
                isActive={selectedDimension === dim.key}
              />
            ))}
          </div>

          {/* 选中维度详情 */}
          {selectedDimConfig && (
            <div className="bg-[#0B0E14] p-4 rounded-lg border border-[#272A31]">
              <div className="flex items-center gap-2 mb-2">
                <selectedDimConfig.icon style={{ color: selectedDimConfig.color }} />
                <span className="font-bold text-[#E1E2EB]">{selectedDimConfig.label}</span>
                <span className="text-xs text-[#849495]">- {selectedDimConfig.description}</span>
              </div>
              <div className="h-2 bg-[#272A31] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${data[selectedDimension as DimensionKey]}%`,
                    backgroundColor: selectedDimConfig.color,
                  }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-[#849495]">
                <span>0</span>
                <span style={{ color: selectedDimConfig.color }}>
                  当前: {data[selectedDimension as DimensionKey]}
                </span>
                <span>100</span>
              </div>
            </div>
          )}

          {/* 历史趋势图 */}
          {showHistory && (
            <div className="bg-[#0B0E14] p-4 rounded-lg border border-[#272A31]">
              <div className="text-sm font-bold text-[#E1E2EB] mb-4">历史趋势 (最近20个时间点)</div>
              <div className="h-32 flex items-end gap-1">
                {history.map((point, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-[#00F2FF] rounded-t transition-all hover:bg-[#00DBE7] relative group"
                    style={{ height: `${point.overall}%`, opacity: 0.3 + (i / history.length) * 0.7 }}
                  >
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-[#272A31] text-xs text-[#E1E2EB] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      {point.overall}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2 text-xs text-[#849495]">
                <span>100分钟前</span>
                <span>现在</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 底部说明 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs p-4 bg-[#10131A] rounded-lg border border-[#272A31]">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#00F2FF]" />
          <span className="text-[#849495]">80-100: 强势上涨</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#00DBE7]" />
          <span className="text-[#849495]">65-79: 谨慎看涨</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#FFD81D]" />
          <span className="text-[#849495]">50-64: 震荡整理</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#FFB3B5]" />
          <span className="text-[#849495]">&lt;50: 弱势下跌</span>
        </div>
      </div>
    </div>
  )
}
