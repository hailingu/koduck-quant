import { useEffect, useMemo, useState } from 'react'
import { marketApi } from '@/api/market'
import { useToast } from '@/hooks/useToast'

// Six-dimensional sentiment data
interface SentimentDimensions {
  activity: { value: number; trend: string }
  volatility: { value: number; trend: string }
  trendStrength: { value: number; trend: string }
  fearGreed: { value: number; trend: string }
  valuation: { value: number; trend: string }
  fundFlow: { value: number; trend: string }
}

interface SentimentData {
  timestamp: string
  overall: number
  status: string
  market: string
  dimensions: SentimentDimensions
}

// Status label mapping
const statusLabels: Record<string, { label: string; color: string }> = {
  strong_bullish: { label: 'Strong Bullish', color: 'text-fluid-primary' },
  bullish: { label: 'Bullish', color: 'text-fluid-primary' },
  cautious_bullish: { label: 'Cautious Bullish', color: 'text-fluid-primary-dim' },
  neutral: { label: 'Neutral', color: 'text-fluid-text' },
  cautious_bearish: { label: 'Cautious Bearish', color: 'text-fluid-secondary-dim' },
  bearish: { label: 'Bearish', color: 'text-fluid-secondary' },
  strong_bearish: { label: 'Strong Bearish', color: 'text-fluid-secondary' },
  greedy: { label: 'Greedy', color: 'text-fluid-tertiary' },
  fearful: { label: 'Fearful', color: 'text-fluid-secondary' },
}

// Dimension label mapping
const dimensionLabels: Record<string, string> = {
  activity: 'ACTIVITY',
  volatility: 'VOLATILITY',
  trendStrength: 'TREND',
  fearGreed: 'FEAR',
  valuation: 'VALUE',
  fundFlow: 'FLOW',
}

// Dimension description mapping
const dimensionDescriptions: Record<string, string> = {
  activity: 'Market trading activity',
  volatility: 'Price volatility level',
  trendStrength: 'Trend strength',
  fearGreed: 'Fear/Greed sentiment',
  valuation: 'Valuation level',
  fundFlow: 'Capital flow',
}

export default function SentimentRadar({ market = 'a_share' }: { market?: string }) {
  const [sentiment, setSentiment] = useState<SentimentData | null>(null)
  const [loading, setLoading] = useState(true)
  const { showToast } = useToast()

  // Fetch sentiment data
  useEffect(() => {
    const fetchSentiment = async () => {
      try {
        setLoading(true)
        const data = await marketApi.getMarketSentiment(market)
        setSentiment(data)
      } catch (error) {
        console.error('Failed to fetch sentiment:', error)
        showToast('Failed to load sentiment data', 'error')
      } finally {
        setLoading(false)
      }
    }

    fetchSentiment()

    // Auto refresh every 30 seconds
    const interval = setInterval(fetchSentiment, 30000)
    return () => clearInterval(interval)
  }, [market, showToast])

  // Transform dimensions to array for radar chart
  const radarData = useMemo(() => {
    if (!sentiment?.dimensions) {
      // Default fallback data
      return {
        size: 200,
        center: 100,
        radius: 70,
        points: [],
        values: [50, 30, 50, 50, 50, 50],
        path: '',
      }
    }

    const dims = sentiment.dimensions
    const values = [
      dims.activity.value,
      dims.volatility.value,
      dims.trendStrength.value,
      dims.fearGreed.value,
      dims.valuation.value,
      dims.fundFlow.value,
    ]

    const size = 200
    const center = size / 2
    const radius = 70

    // Hexagon vertices (6 dimensions, 60 degrees apart)
    const points = values.map((value, i) => {
      const angle = (i * 60 - 90) * (Math.PI / 180)
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
      values,
      path: points.length > 0 ? `M ${points.map((p) => `${p.x},${p.y}`).join(' L ')} Z` : '',
    }
  }, [sentiment])

  // Label positions for hexagon
  const labelPositions = useMemo(
    () => [
      { key: 'activity', x: 100, y: 15 },
      { key: 'volatility', x: 185, y: 60 },
      { key: 'trendStrength', x: 185, y: 140 },
      { key: 'fearGreed', x: 100, y: 185 },
      { key: 'valuation', x: 15, y: 140 },
      { key: 'fundFlow', x: 15, y: 60 },
    ],
    []
  )

  // Get status display
  const statusDisplay = sentiment?.status
    ? statusLabels[sentiment.status] || { label: sentiment.status, color: 'text-fluid-text' }
    : { label: 'Loading...', color: 'text-fluid-text-dim' }

  // Fear/Greed value
  const fearGreedValue = sentiment?.dimensions?.fearGreed?.value ?? 50

  // Dimension details for tooltip
  const dimensionDetails = sentiment?.dimensions
    ? [
        { key: 'activity', ...sentiment.dimensions.activity },
        { key: 'volatility', ...sentiment.dimensions.volatility },
        { key: 'trendStrength', ...sentiment.dimensions.trendStrength },
        { key: 'fearGreed', ...sentiment.dimensions.fearGreed },
        { key: 'valuation', ...sentiment.dimensions.valuation },
        { key: 'fundFlow', ...sentiment.dimensions.fundFlow },
      ]
    : []

  return (
    <div className="glass-panel p-5 rounded-xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="font-headline font-bold text-lg text-fluid-text tracking-tight uppercase">
            Sentiment Radar
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs font-mono-data ${statusDisplay.color}`}>{statusDisplay.label}</span>
            <span className="text-xs text-fluid-text-dim">•</span>
            <span className="text-xs font-mono-data text-fluid-primary">
              Overall: {sentiment?.overall ?? '--'}
            </span>
          </div>
        </div>
        <span className="material-symbols-outlined text-fluid-primary/60">radar</span>
      </div>

      {/* Radar Chart */}
      <div className="relative w-full aspect-square flex items-center justify-center mb-6">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-fluid-primary border-t-transparent" />
          </div>
        ) : (
          <>
            {/* Background circles */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="absolute w-full h-full border border-fluid-primary/10 rounded-full scale-100" />
              <div className="absolute w-full h-full border border-fluid-primary/10 rounded-full scale-75" />
              <div className="absolute w-full h-full border border-fluid-primary/10 rounded-full scale-50" />
              <div className="absolute w-full h-full border border-fluid-primary/10 rounded-full scale-25" />
            </div>

            {/* SVG Radar */}
            {radarData.path && (
              <svg
                className="w-full h-full max-w-[180px] drop-shadow-[0_0_8px_rgba(0,242,255,0.4)]"
                viewBox="0 0 200 200"
              >
                <polygon
                  points={radarData.points.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="rgba(0, 242, 255, 0.2)"
                  stroke="#00F2FF"
                  strokeWidth="1.5"
                />
                {radarData.points.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r="3" fill="#00F2FF" />
                ))}
              </svg>
            )}

            {/* Labels */}
            {labelPositions.map((label) => (
              <div
                key={label.key}
                className="absolute text-[9px] font-mono-data text-fluid-primary cursor-help group"
                style={{
                  left: label.x > 100 ? `${(label.x / 200) * 100}%` : undefined,
                  right: label.x <= 100 ? `${((200 - label.x) / 200) * 100}%` : undefined,
                  top: `${(label.y / 200) * 100}%`,
                  transform: 'translateY(-50%)',
                }}
              >
                {dimensionLabels[label.key]}

                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-fluid-surface-container-high rounded text-[10px] text-fluid-text whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  {dimensionDescriptions[label.key]}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Dimension Values Grid */}
      {dimensionDetails.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {dimensionDetails.map((dim) => (
            <div key={dim.key} className="text-center p-2 bg-fluid-surface-container-low rounded">
              <div className="text-[8px] text-fluid-text-dim uppercase">{dimensionLabels[dim.key]}</div>
              <div
                className={`text-sm font-mono-data font-bold ${
                  dim.value >= 60 ? 'text-fluid-primary' : dim.value <= 40 ? 'text-fluid-secondary' : 'text-fluid-text'
                }`}
              >
                {dim.value}
              </div>
              <div className="text-[8px] text-fluid-text-dim">
                {dim.trend === 'up' ? '↑' : dim.trend === 'down' ? '↓' : '→'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fear/Greed Index */}
      <div className="space-y-3">
        <div className="flex justify-between items-end">
          <span className="text-xs text-fluid-text-muted font-mono-data">Fear/Greed Index</span>
          <span
            className={`text-xl font-headline font-bold ${
              fearGreedValue >= 70
                ? 'text-fluid-tertiary'
                : fearGreedValue <= 30
                  ? 'text-fluid-secondary'
                  : 'text-fluid-primary'
            }`}
          >
            {fearGreedValue}
          </span>
        </div>
        <div className="h-1.5 w-full bg-fluid-surface-container-low rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-fluid-secondary via-fluid-tertiary to-fluid-primary transition-all duration-500"
            style={{ width: `${fearGreedValue}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] font-mono-data text-fluid-text-dim">
          <span>EXTREME FEAR</span>
          <span>GREED</span>
        </div>
      </div>

      {/* Last Updated */}
      {sentiment?.timestamp && (
        <div className="mt-4 text-center">
          <span className="text-[9px] text-fluid-text-dim font-mono-data">
            Updated: {new Date(sentiment.timestamp).toLocaleTimeString()}
          </span>
        </div>
      )}
    </div>
  )
}
