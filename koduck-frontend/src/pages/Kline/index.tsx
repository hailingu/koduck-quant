import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { createChart, HistogramSeries, type Time } from 'lightweight-charts'
import KLineChart from '@/components/KlineChart'
import IntradayChart from '@/components/IntradayChart'
import WebSocketStatus from '@/components/WebSocketStatus'
import { usePriceAnimation, useLastUpdateTime } from '@/hooks/usePriceAnimation'
import { useWebSocketStore } from '@/stores/websocket'
import { marketApi, type PriceQuote } from '@/api/market'
import { klineApi, type KlineData } from '@/api/kline'
import { tickApi, type TickData, type TickStatistics } from '@/api/tick'
import { useToast } from '@/hooks/useToast'

// Market definitions
const MARKETS = [
  { key: 'AShare', label: 'A股', currency: 'CNY' },
  { key: 'HK', label: '港股', currency: 'HKD' },
  { key: 'US', label: '美股', currency: 'USD' },
  { key: 'Forex', label: '外汇', currency: 'USD' },
  { key: 'Futures', label: '期货', currency: 'CNY' },
] as const

type MarketType = typeof MARKETS[number]['key']
const REALTIME_STALE_MS = 20000

const normalizeSymbol = (symbol: string): string => {
  const digits = symbol.replaceAll(/\D/g, '')
  if (digits.length >= 1 && digits.length <= 6) {
    return digits.padStart(6, '0')
  }
  return symbol.trim().toUpperCase()
}

function beijingToLocalTimestamp(beijingTs: number): number {
  return beijingTs
}

// Format timestamp for display
function formatTickTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  })
}

// Format price with proper decimal places
function formatPrice(price: number | null | undefined): string {
  if (price === null || price === undefined) return '--'
  return price.toFixed(2)
}

// Format volume
function formatVolume(volume: number | null | undefined): string {
  if (volume === null || volume === undefined) return '--'
  if (volume >= 10000) {
    return (volume / 10000).toFixed(2) + '万'
  }
  return volume.toString()
}

// Time & Sales Component with Real Tick Data
function TimeAndSales({ 
  symbol, 
  market = 'AShare',
  onTickDataStateChange,
}: { 
  symbol: string
  market?: MarketType
  onTickDataStateChange?: (hasData: boolean) => void
}) {
  const [ticks, setTicks] = useState<TickData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tickStats, setTickStats] = useState<TickStatistics | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Fetch tick data
  const fetchTicks = useCallback(async () => {
    if (!symbol) return
    
    try {
      setLoading(true)
      setError(null)
      
      // Fetch latest 50 ticks
      const response = await tickApi.getTickHistory(symbol, {
        market,
        hours: 1,
        limit: 50,
      })
      
      // Sort by timestamp descending (newest first)
      const sortedTicks = [...response.data].sort((a, b) => b.timestamp - a.timestamp)
      setTicks(sortedTicks)
      onTickDataStateChange?.(sortedTicks.length > 0)
      
      // Fetch statistics (may be null if no tick data available)
      const stats = await tickApi.getTickStatistics(symbol, { market })
      setTickStats(stats)
      
    } catch (err) {
      console.error('Failed to fetch tick data:', err)
      onTickDataStateChange?.(false)
      // Only show error for actual request failures, not for empty data
      // setError('获取 Tick 数据失败')
    } finally {
      setLoading(false)
    }
  }, [symbol, market, onTickDataStateChange])

  // Initial fetch
  useEffect(() => {
    fetchTicks()
  }, [fetchTicks])

  // Auto refresh every 10 seconds (fallback)
  useEffect(() => {
    const interval = setInterval(fetchTicks, 10000)
    return () => clearInterval(interval)
  }, [fetchTicks])

  // Subscribe SSE tick stream for realtime incremental updates
  useEffect(() => {
    if (!symbol) {
      return
    }
    const streamUrl = `/api/v1/market/ticks/stream?market=${encodeURIComponent(market)}&symbol=${encodeURIComponent(symbol)}`
    const eventSource = new EventSource(streamUrl)

    const onTick = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as {
          time?: string
          price?: number
          size?: number
          amount?: number
          type?: 'buy' | 'sell'
          flag?: 'NORMAL' | 'BLOCK_ORDER' | 'ICEBERG'
          epochMillis?: number | null
        }
        if (typeof payload.price !== 'number') {
          return
        }
        const newTick: TickData = {
          timestamp: typeof payload.epochMillis === 'number' ? payload.epochMillis : Date.now(),
          price: payload.price,
          volume: typeof payload.size === 'number' ? payload.size : 0,
          size: typeof payload.size === 'number' ? payload.size : 0,
          amount: typeof payload.amount === 'number' ? payload.amount : 0,
          type: payload.type,
          flag: payload.flag,
          side: payload.type,
        }
        setTicks((prev) => [newTick, ...prev].slice(0, 50))
        onTickDataStateChange?.(true)
        if (containerRef.current) {
          containerRef.current.scrollTop = 0
        }
      } catch (err) {
        console.warn('Tick SSE parse failed', err)
      }
    }

    eventSource.addEventListener('tick', onTick)
    eventSource.onerror = () => {
      eventSource.close()
    }

    return () => {
      eventSource.removeEventListener('tick', onTick)
      eventSource.close()
    }
  }, [symbol, market, onTickDataStateChange])

  // Calculate highlight based on price change
  const getHighlight = (tick: TickData, index: number) => {
    if (index >= ticks.length - 1) return false
    const nextTick = ticks[index + 1]
    return tick.volume > (nextTick.volume * 5) // Highlight large volume
  }

  const getTickColor = (tick: TickData, index: number) => {
    if (index >= ticks.length - 1) return 'text-fluid-text'
    const nextTick = ticks[index + 1]
    if (tick.price > nextTick.price) return 'text-stock-up'
    if (tick.price < nextTick.price) return 'text-stock-down'
    return 'text-fluid-text'
  }

  return (
    <div className="glass-panel p-4 rounded-xl h-full min-h-0 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-headline font-bold text-sm text-fluid-text">Time & Sales (Tick)</h3>
        <div className="flex items-center gap-2">
          {tickStats && (
            <span className="text-[10px] font-mono-data text-fluid-text-dim">
              {tickStats.count} ticks / {formatVolume(tickStats.totalVolume)} vol
            </span>
          )}
          <div className="flex items-center gap-1 text-[10px] font-mono-data text-fluid-primary">
            <span className="w-1.5 h-1.5 rounded-full bg-fluid-primary animate-pulse" />
            LIVE
          </div>
        </div>
      </div>
      
      {/* Header */}
      <div className="flex justify-between text-[10px] font-mono-data text-fluid-text-dim mb-2 px-1">
        <span>Time</span>
        <span>Price</span>
        <span>Volume</span>
      </div>
      
      {/* Tick List */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto space-y-0.5 font-mono-data text-xs scrollbar-thin"
      >
        {loading && ticks.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-fluid-text-dim">
            <span className="animate-pulse">Loading ticks...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-32 text-fluid-secondary text-xs">
            <span>{error}</span>
            <button 
              onClick={fetchTicks}
              className="mt-2 px-3 py-1 bg-fluid-surface-container rounded text-fluid-text hover:bg-fluid-surface-container-high transition-colors"
            >
              重试
            </button>
          </div>
        ) : ticks.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-fluid-text-dim text-xs">
            No tick data available
          </div>
        ) : (
          ticks.map((tick, idx) => {
            const highlight = getHighlight(tick, idx)
            const colorClass = getTickColor(tick, idx)
            
            return (
              <div 
                key={`${tick.timestamp}-${idx}`} 
                className={`flex justify-between items-center py-1 px-1 rounded hover:bg-fluid-surface-container/50 transition-colors ${
                  highlight ? 'bg-fluid-primary/10' : ''
                }`}
              >
                <span className="text-fluid-text-dim w-16">
                  {formatTickTime(tick.timestamp)}
                </span>
                <span className={`${colorClass} font-medium w-16 text-right ${highlight ? 'font-semibold' : ''}`}>
                  {formatPrice(tick.price)}
                </span>
                <span className={`text-fluid-text-muted w-16 text-right ${highlight ? 'text-fluid-primary' : ''}`}>
                  {formatVolume(tick.volume)}
                </span>
              </div>
            )
          })
        )}
      </div>
      
      {/* Tick Statistics Footer */}
      {tickStats && tickStats.count > 0 && (
        <div className="mt-3 pt-3 border-t border-fluid-outline-variant/30">
          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono-data">
            <div className="flex justify-between">
              <span className="text-fluid-text-dim">Avg</span>
              <span className="text-fluid-text">{formatPrice(tickStats.avgPrice)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-fluid-text-dim">Range</span>
              <span className="text-fluid-text">
                {formatPrice(tickStats.minPrice)} - {formatPrice(tickStats.maxPrice)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Tick Distribution Chart Component
function TickDistributionChart({ 
  symbol, 
  market = 'AShare',
  enabled = true,
}: { 
  symbol: string
  market?: MarketType
  enabled?: boolean
}) {
  const [volumeData, setVolumeData] = useState<{
    date: string
    tickCount: number
    totalVolume: number
    avgPrice: number
  }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchVolumeData = async () => {
      if (!enabled) {
        setVolumeData([])
        setLoading(false)
        return
      }
      if (!symbol) return
      
      try {
        setLoading(true)
        const response = await tickApi.getVolumeSummary(symbol, 7, market)
        
        if (response.dailyData) {
          setVolumeData(response.dailyData.slice(0, 7).reverse())
        }
      } catch (err) {
        console.error('Failed to fetch volume data:', err)
      } finally {
        setLoading(false)
      }
    }
    
    void fetchVolumeData()
  }, [symbol, market, enabled])

  if (loading) {
    return (
      <div className="glass-panel p-4 rounded-xl h-full flex items-center justify-center">
        <span className="text-fluid-text-dim text-xs animate-pulse">Loading...</span>
      </div>
    )
  }

  if (volumeData.length === 0) {
    return (
      <div className="glass-panel p-4 rounded-xl h-full flex items-center justify-center">
        <span className="text-fluid-text-dim text-xs">No volume data</span>
      </div>
    )
  }

  const maxTicks = Math.max(...volumeData.map(d => d.tickCount), 1)

  return (
    <div className="glass-panel p-4 rounded-xl h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-headline font-bold text-sm text-fluid-text">Tick Distribution (7D)</h3>
      </div>
      
      <div className="space-y-2">
        {volumeData.map((day) => {
          const percentage = (day.tickCount / maxTicks) * 100
          
          return (
            <div key={day.date} className="space-y-1">
              <div className="flex justify-between text-[10px] font-mono-data">
                <span className="text-fluid-text-dim">{day.date.slice(5)}</span>
                <span className="text-fluid-text">{day.tickCount.toLocaleString()} ticks</span>
              </div>
              <div className="h-1.5 bg-fluid-surface-container rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-fluid-primary/50 to-fluid-primary rounded-full transition-all duration-500"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] font-mono-data text-fluid-text-muted">
                <span>Vol: {formatVolume(day.totalVolume)}</span>
                <span>Avg: ¥{day.avgPrice.toFixed(2)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Volume Chart Component
function VolumeChart({ 
  symbol, 
  market = 'AShare', 
  timeframe = '1D' 
}: { 
  symbol: string
  market?: MarketType
  timeframe?: string 
}) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<any>(null)
  const volumeSeriesRef = useRef<any>(null)
  
  const timeframeMap: Record<string, string> = {
    'intraday': '1m', '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m',
    '1h': '60m', 'daily': '1D', '1D': '1D', 'weekly': '1W', 'monthly': '1M',
  }

  useEffect(() => {
    if (!chartContainerRef.current) return

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#849495',
        fontFamily: 'JetBrains Mono, monospace',
      },
      grid: {
        vertLines: { color: 'rgba(132, 148, 149, 0.08)' },
        horzLines: { color: 'rgba(132, 148, 149, 0.08)' },
      },
      crosshair: {
        mode: 1,
        vertLine: { color: 'rgba(0, 242, 255, 0.3)', width: 1, labelVisible: false },
        horzLine: { visible: false },
      },
      rightPriceScale: {
        borderColor: 'rgba(132, 148, 149, 0.2)',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      leftPriceScale: { visible: false },
      timeScale: {
        borderColor: 'rgba(132, 148, 149, 0.2)',
        timeVisible: timeframe === 'intraday' || timeframe === '1m' || timeframe === '5m',
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    })

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'right',
    })
    volumeSeriesRef.current = volumeSeries
    chartRef.current = chart

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        })
      }
    }
    
    setTimeout(handleResize, 0)
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [timeframe])

  useEffect(() => {
    const fetchData = async () => {
      if (!symbol || !volumeSeriesRef.current) return
      
      try {
        const apiTimeframe = timeframeMap[timeframe] || '1D'
        const response = await klineApi.getKline({
          symbol,
          market,
          timeframe: apiTimeframe,
          limit: 100,
        })
        
        if (response && response.length > 0) {
          // Sort data by timestamp ascending (oldest first)
          const sortedResponse = [...response].sort((a, b) => a.timestamp - b.timestamp)
          
          const volumeData = sortedResponse.map((item: KlineData) => ({
            time: beijingToLocalTimestamp(item.timestamp) as Time,
            value: item.volume,
            color: item.close >= item.open ? '#00F2FF' : '#DE0541',
          }))
          volumeSeriesRef.current.setData(volumeData)
          chartRef.current?.timeScale().fitContent()
        }
      } catch (err) {
        console.error('Volume data fetch error:', err)
      }
    }
    
    void fetchData()
  }, [symbol, market, timeframe])

  return (
    <div className="relative w-full h-full p-2">
      <div className="absolute top-2 left-3 z-10">
        <span className="text-[10px] font-mono-data text-fluid-text-muted uppercase tracking-wider">Volume Analysis</span>
      </div>
      <div ref={chartContainerRef} className="w-full h-full" style={{ cursor: 'crosshair' }} />
    </div>
  )
}

// Market Stats Component
function MarketStats({
  quote,
  market,
  latestPrice,
  latestChange,
  latestChangePercent,
  realtimeVolume,
}: {
  quote: PriceQuote | null
  market: MarketType
  latestPrice?: number | null
  latestChange?: number | null
  latestChangePercent?: number | null
  realtimeVolume?: number | null
}) {
  const marketInfo = MARKETS.find(m => m.key === market)
  
  if (!quote) {
    return (
      <div className="glass-panel p-4 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] font-mono-data text-fluid-text-muted uppercase">Market Stats</span>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between text-xs">
            <span className="text-fluid-text-muted">Loading...</span>
          </div>
        </div>
      </div>
    )
  }

  const resolvedPrice = latestPrice ?? quote.price ?? null
  const resolvedChange = latestChange
    ?? (quote.prevClose && resolvedPrice !== null ? resolvedPrice - quote.prevClose : null)
    ?? quote.change
    ?? null
  const resolvedChangePercent = latestChangePercent
    ?? (quote.prevClose && resolvedChange !== null ? (resolvedChange / quote.prevClose) * 100 : null)
    ?? quote.changePercent
    ?? null
  const resolvedVolume =
    typeof realtimeVolume === 'number' && realtimeVolume > 0
      ? realtimeVolume
      : quote.volume
  const isUp = (resolvedChange ?? 0) >= 0

  return (
    <div className="glass-panel p-4 rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-mono-data text-fluid-text-muted uppercase">Market Stats</span>
        <span className="text-[10px] font-mono-data text-fluid-primary">{marketInfo?.currency}</span>
      </div>
      <div className="space-y-3">
        <div className="flex justify-between text-xs">
          <span className="text-fluid-text-muted">Open</span>
          <span className="font-mono-data text-fluid-text">{quote.open?.toFixed(2) ?? '--'}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-fluid-text-muted">High</span>
          <span className="font-mono-data text-fluid-text">{quote.high?.toFixed(2) ?? '--'}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-fluid-text-muted">Low</span>
          <span className="font-mono-data text-fluid-text">{quote.low?.toFixed(2) ?? '--'}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-fluid-text-muted">Prev Close</span>
          <span className="font-mono-data text-fluid-text">{quote.prevClose?.toFixed(2) ?? '--'}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-fluid-text-muted">Volume</span>
          <span className="font-mono-data text-fluid-text">
            {resolvedVolume ? (resolvedVolume / 10000).toFixed(2) + '万' : '--'}
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-fluid-text-muted">Change</span>
          <span className={`font-mono-data ${isUp ? 'text-stock-up' : 'text-stock-down'}`}>
            {resolvedChange !== null && resolvedChange !== undefined
              ? `${isUp ? '+' : ''}${resolvedChange.toFixed(2)}`
              : '--'}{' '}
            (
            {resolvedChangePercent !== null && resolvedChangePercent !== undefined
              ? `${isUp ? '+' : ''}${resolvedChangePercent.toFixed(2)}%`
              : '--'}
            )
          </span>
        </div>
      </div>
    </div>
  )
}

// Market Selector Dropdown
function MarketSelector({ 
  currentMarket, 
  onMarketChange 
}: { 
  currentMarket: MarketType
  onMarketChange: (market: MarketType) => void 
}) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  const currentMarketInfo = MARKETS.find(m => m.key === currentMarket)
  
  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-fluid-surface-container rounded-lg text-xs font-medium text-fluid-text hover:bg-fluid-surface-container-high transition-colors"
      >
        <span className="text-fluid-primary font-semibold">{currentMarketInfo?.label}</span>
        <span className="text-fluid-text-dim">{currentMarketInfo?.currency}</span>
        <svg 
          className={`w-3 h-3 text-fluid-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-32 glass-panel rounded-lg shadow-lg overflow-hidden z-50">
          {MARKETS.map((market) => (
            <button
              key={market.key}
              onClick={() => {
                onMarketChange(market.key)
                setIsOpen(false)
              }}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-fluid-surface-container-high transition-colors ${
                currentMarket === market.key ? 'bg-fluid-primary/10 text-fluid-primary' : 'text-fluid-text'
              }`}
            >
              <span className="font-medium">{market.label}</span>
              <span className="text-fluid-text-dim">{market.currency}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Kline() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  
  // Get symbol from URL params or default
  const symbol = searchParams.get('symbol') || '601012'
  const marketParam = searchParams.get('market') || 'AShare'
  const name = searchParams.get('name') || '隆基绿能'
  
  // Validate market param
  const validMarkets: MarketType[] = ['AShare', 'HK', 'US', 'Forex', 'Futures']
  const market: MarketType = validMarkets.includes(marketParam as MarketType) 
    ? (marketParam as MarketType) 
    : 'AShare'
  
  const [timeframe, setTimeframe] = useState('daily')
  const [quote, setQuote] = useState<PriceQuote | null>(null)
  const [latestPrice, setLatestPrice] = useState<number | null>(null)
  const [hasTickData, setHasTickData] = useState(false)
  const [loading, setLoading] = useState(true)

  const timeframes = [
    { key: 'intraday', label: '分时' },
    { key: '1m', label: '1分' },
    { key: '5m', label: '5分' },
    { key: '15m', label: '15分' },
    { key: '30m', label: '30分' },
    { key: '1h', label: '1时' },
    { key: 'daily', label: '日线' },
    { key: 'weekly', label: '周线' },
    { key: 'monthly', label: '月线' },
  ]

  // Handle market change
  const handleMarketChange = (newMarket: MarketType) => {
    // Update URL with new market
    const params = new URLSearchParams(searchParams)
    params.set('market', newMarket)
    navigate(`/kline?${params.toString()}`, { replace: true })
  }

  // Fetch stock quote
  useEffect(() => {
    const fetchQuote = async () => {
      try {
        setLoading(true)
        const data = await marketApi.getStockDetail(symbol, market)
        setQuote(data)
      } catch (err) {
        showToast('Failed to load stock quote', 'error')
      } finally {
        setLoading(false)
      }
    }
    void fetchQuote()
  }, [symbol, market, showToast])

  // WebSocket real-time price
  const { stockPrices } = useWebSocketStore()
  const normalizedSymbol = normalizeSymbol(symbol)
  const realtimePrice = stockPrices.get(normalizedSymbol)
  const isRealtimeFresh = realtimePrice !== undefined
    && Date.now() - realtimePrice.timestamp <= REALTIME_STALE_MS
  const effectiveRealtimePrice = isRealtimeFresh ? realtimePrice : null
  const displayPrice = effectiveRealtimePrice?.price ?? latestPrice ?? quote?.price
  const displayChange = effectiveRealtimePrice?.changePercent
    ?? ((displayPrice !== undefined && displayPrice !== null && quote?.prevClose)
      ? ((displayPrice - quote.prevClose) / quote.prevClose) * 100
      : (quote?.changePercent || 0))
  const displayIsUp = displayChange >= 0
  
  // Price animation
  const priceAnimation = usePriceAnimation(displayPrice)
  
  // Last update time
  const lastUpdateTime = useLastUpdateTime(effectiveRealtimePrice?.timestamp || null)

  // Subscribe to symbol
  useEffect(() => {
    const { subscribe, unsubscribe } = useWebSocketStore.getState()
    subscribe([symbol])
    return () => unsubscribe([symbol])
  }, [symbol])

  // Poll latest price as fallback when WebSocket is disconnected/stale
  useEffect(() => {
    let stopped = false

    const fetchLatestPrice = async () => {
      try {
        const apiTimeframe = timeframe === 'intraday'
          ? '1m'
          : ({
            '1m': '1m',
            '5m': '5m',
            '15m': '15m',
            '30m': '30m',
            '1h': '60m',
            daily: '1D',
            weekly: '1W',
            monthly: '1M',
          }[timeframe] || '1D')
        const latest = await klineApi.getLatestPrice({
          symbol,
          market,
          timeframe: apiTimeframe,
        })
        if (!stopped) {
          setLatestPrice(typeof latest?.price === 'number' ? latest.price : null)
        }
      } catch (error) {
        if (!stopped) {
          setLatestPrice(null)
        }
      }
    }

    void fetchLatestPrice()
    const timer = setInterval(fetchLatestPrice, 10000)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [symbol, market, timeframe])

  return (
    <div className="h-[calc(100vh-140px)] grid grid-cols-12 gap-5">
      {/* Main Chart - 9 cols */}
      <div className="col-span-9 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-headline font-bold text-fluid-text">{name}</h1>
              <span className="text-lg text-fluid-text-dim font-mono-data">{symbol}</span>
              
              {/* Market Selector */}
              <MarketSelector currentMarket={market} onMarketChange={handleMarketChange} />
              
              {loading ? (
                <span className="px-2 py-0.5 bg-fluid-surface-higher text-fluid-text-dim text-xs font-mono-data rounded">
                  --
                </span>
              ) : (
                <span className={`px-2 py-0.5 ${displayIsUp ? 'bg-stock-up/20 text-stock-up' : 'bg-stock-down/20 text-stock-down'} text-xs font-mono-data rounded`}>
                  {displayIsUp ? '+' : ''}{displayChange.toFixed(2)}%
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs font-mono-data">
              {loading ? (
                <span className="text-fluid-text-dim text-xl">Loading...</span>
              ) : (
                <>
                  <span 
                    className={`
                      text-2xl font-bold 
                      transition-all duration-300
                      ${displayIsUp ? 'text-stock-up' : 'text-stock-down'}
                      ${priceAnimation === 'up' ? 'bg-stock-up/20 scale-105' : ''}
                      ${priceAnimation === 'down' ? 'bg-stock-down/20 scale-105' : ''}
                      rounded px-1
                    `}
                  >
                    {displayPrice?.toFixed(2) ?? '--'}
                  </span>
                  {effectiveRealtimePrice && (
                    <span className="text-[10px] text-fluid-text-muted ml-1">
                      {lastUpdateTime}
                    </span>
                  )}
                  <span className="text-fluid-text-muted">
                    高: <span className="text-fluid-text">{quote?.high?.toFixed(2) ?? '--'}</span>
                  </span>
                  <span className="text-fluid-text-muted">
                    低: <span className="text-fluid-text">{quote?.low?.toFixed(2) ?? '--'}</span>
                  </span>
                  <span className="text-fluid-text-muted">
                    量: <span className="text-fluid-text">{quote?.volume ? (quote.volume / 10000).toFixed(2) + '万' : '--'}</span>
                  </span>
                </>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* WebSocket Status */}
            <WebSocketStatus />
            
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
            </div>
          </div>
        </div>

        {/* Chart Area - Main Chart + Volume */}
        <div className="flex-none flex flex-col gap-3">
          {/* Main Chart - Show IntradayChart for 分时, KLineChart for others */}
          <div className="h-[380px] xl:h-[430px] glass-panel rounded-xl overflow-hidden">
            {timeframe === 'intraday' ? (
              <IntradayChart 
                symbol={symbol}
                market={market}
              />
            ) : (
              <KLineChart 
                symbol={symbol}
                market={market}
                timeframe={timeframe}
              />
            )}
          </div>
          
          {/* Volume Chart - Hide for intraday (volume is in IntradayChart) */}
          {timeframe !== 'intraday' && (
            <div className="h-[180px] xl:h-[220px] glass-panel rounded-xl overflow-hidden min-h-[120px]">
              <VolumeChart 
                symbol={symbol}
                market={market}
                timeframe={timeframe}
              />
            </div>
          )}
        </div>
      </div>

      {/* Side Panel - 3 cols */}
      <div className="col-span-3 flex flex-col gap-4 min-h-0">
        {/* Time & Sales with Real Tick Data */}
        <div className="h-[560px] shrink-0">
          <TimeAndSales 
            symbol={symbol}
            market={market}
            onTickDataStateChange={setHasTickData}
          />
        </div>
        
        {/* Tick Distribution Chart */}
        <div className="h-[220px] shrink-0">
          <TickDistributionChart 
            symbol={symbol}
            market={market}
            enabled={hasTickData}
          />
        </div>
        
        {/* Market Stats */}
        <div className="flex-1 min-h-0">
          <MarketStats
            quote={quote}
            market={market}
            latestPrice={displayPrice}
            latestChange={effectiveRealtimePrice?.change ?? null}
            latestChangePercent={displayChange}
            realtimeVolume={effectiveRealtimePrice?.volume ?? null}
          />
        </div>
      </div>
    </div>
  )
}
