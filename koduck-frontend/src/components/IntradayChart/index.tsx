import { useEffect, useRef, useState, useCallback } from 'react'
import { createChart, AreaSeries, LineSeries, HistogramSeries, TickMarkType, type IChartApi, type Time, type AreaSeriesPartialOptions } from 'lightweight-charts'
import { klineApi, type KlineData } from '@/api/kline'
import { tickApi, type TickData } from '@/api/tick'
import { useWebSocketStore } from '@/stores/websocket'
import { useToast } from '@/hooks/useToast'

interface IntradayChartProps {
  symbol: string
  market?: string
  height?: number
}

const BEIJING_TZ = 'Asia/Shanghai'

type BeijingParts = {
  date: string
  hour: number
  minute: number
}

function getBeijingParts(input: Date): BeijingParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BEIJING_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(input)
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  return {
    date: `${pick('year')}-${pick('month')}-${pick('day')}`,
    hour: Number.parseInt(pick('hour'), 10),
    minute: Number.parseInt(pick('minute'), 10),
  }
}

function isInAShareSessionByBeijingTime(hour: number, minute: number): boolean {
  const current = hour * 60 + minute
  const morningStart = 9 * 60 + 30
  const morningEnd = 11 * 60 + 30
  const afternoonStart = 13 * 60
  const afternoonEnd = 15 * 60
  return (current >= morningStart && current <= morningEnd)
    || (current >= afternoonStart && current <= afternoonEnd)
}

function shouldKeepIntradayPoint(timestamp: number, market: string): boolean {
  if (!Number.isFinite(timestamp)) {
    return false
  }

  const pointDate = new Date(timestamp * 1000)
  const now = new Date()
  
  // Filter out future data - can't show data from the future
  if (pointDate.getTime() > now.getTime()) {
    return false
  }

  // For intraday chart, only show today's data
  const nowParts = getBeijingParts(now)
  const pointParts = getBeijingParts(pointDate)
  
  // Only keep data from today
  if (nowParts.date !== pointParts.date) {
    return false
  }

  if (market !== 'AShare') {
    return true
  }

  // For AShare, check if time is within trading session
  return isInAShareSessionByBeijingTime(pointParts.hour, pointParts.minute)
}

function formatTimeInBeijing(time: Time): string {
  if (typeof time !== 'number') return ''
  const date = new Date(time * 1000)
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`
}

function formatTickInBeijing(time: Time, tickMarkType: TickMarkType): string {
  if (typeof time !== 'number') return ''
  const date = new Date(time * 1000)
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const yyyy = get('year')
  const MM = get('month')
  const dd = get('day')
  const HH = get('hour')
  const mm = get('minute')
  const ss = get('second')

  if (tickMarkType === TickMarkType.Year) return yyyy
  if (tickMarkType === TickMarkType.Month) return `${yyyy}-${MM}`
  if (tickMarkType === TickMarkType.DayOfMonth) return `${MM}-${dd}`
  if (tickMarkType === TickMarkType.TimeWithSeconds) return `${HH}:${mm}:${ss}`
  if (tickMarkType === TickMarkType.Time) return `${HH}:${mm}`
  return `${yyyy}-${MM}-${dd} ${HH}:${mm}`
}

// Convert KlineData to line chart format
function convertToLineData(data: KlineData[]) {
  return data.map((item) => ({
    time: item.timestamp as Time,
    value: item.close,
  }))
}

// Convert KlineData to volume format
function convertToVolumeData(data: KlineData[]) {
  const maxVol = Math.max(...data.map(d => d.volume))
  return data.map((item) => ({
    time: item.timestamp as Time,
    value: item.volume,
    color: item.close >= item.open 
      ? `rgba(0, 242, 255, ${0.3 + (item.volume / maxVol) * 0.4})` 
      : `rgba(222, 5, 65, ${0.3 + (item.volume / maxVol) * 0.4})`,
  }))
}

// Aggregate tick data into 1-minute K-line format
function aggregateTicksToKline(ticks: TickData[]): KlineData[] {
  if (ticks.length === 0) return []
  
  // Group ticks by minute
  const grouped = new Map<number, TickData[]>()
  
  ticks.forEach(tick => {
    // Handle both seconds and milliseconds timestamps
    // If timestamp > 1e10, it's milliseconds
    const ts = tick.timestamp > 1e10 ? tick.timestamp : tick.timestamp * 1000
    // Round to minute (remove seconds)
    const minuteTs = Math.floor(ts / 60000) * 60
    const existing = grouped.get(minuteTs) || []
    existing.push(tick)
    grouped.set(minuteTs, existing)
  })
  
  // Convert each group to KlineData
  const klines: KlineData[] = []
  
  grouped.forEach((minuteTicks, timestamp) => {
    if (minuteTicks.length === 0) return
    
    // Sort by timestamp
    minuteTicks.sort((a, b) => a.timestamp - b.timestamp)
    
    const prices = minuteTicks.map(t => t.price)
    const volumes = minuteTicks.map(t => t.volume || 0)
    const amounts = minuteTicks.map(t => t.amount || 0)
    
    klines.push({
      timestamp,
      open: prices[0],
      high: Math.max(...prices),
      low: Math.min(...prices),
      close: prices[prices.length - 1],
      volume: volumes.reduce((a, b) => a + b, 0),
      amount: amounts.reduce((a, b) => a + b, 0),
    })
  })
  
  // Sort by timestamp ascending
  return klines.sort((a, b) => a.timestamp - b.timestamp)
}

function ensureStrictAscByTimestamp<T extends { timestamp: number }>(
  data: T[],
): { cleaned: T[]; removed: number } {
  if (data.length <= 1) {
    return { cleaned: data, removed: 0 }
  }

  const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp)
  const cleaned: T[] = []
  for (const item of sorted) {
    const last = cleaned[cleaned.length - 1]
    if (last && last.timestamp === item.timestamp) {
      cleaned[cleaned.length - 1] = item
      continue
    }
    cleaned.push(item)
  }
  return { cleaned, removed: sorted.length - cleaned.length }
}

export default function IntradayChart({ 
  symbol, 
  market = 'AShare',
  height 
}: IntradayChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const areaSeriesRef = useRef<any>(null)
  const avgLineRef = useRef<any>(null)
  const volumeSeriesRef = useRef<any>(null)
  const lastDataRef = useRef<KlineData[]>([])
  const disposedRef = useRef(false)
  const timeoutIdsRef = useRef<Set<number>>(new Set())
  const fetchRequestIdRef = useRef(0)
  const { showToast } = useToast()
  
  const [loading, setLoading] = useState(false)
  const [containerHeight, setContainerHeight] = useState(height || 400)
  
  // WebSocket for real-time updates
  const { subscribe, unsubscribe, stockPrices } = useWebSocketStore()
  const priceUpdate = stockPrices.get(symbol)

  const scheduleTimeout = useCallback((callback: () => void, delay = 0) => {
    const timerId = window.setTimeout(() => {
      timeoutIdsRef.current.delete(timerId)
      callback()
    }, delay)
    timeoutIdsRef.current.add(timerId)
    return timerId
  }, [])

  const clearAllTimeouts = useCallback(() => {
    timeoutIdsRef.current.forEach((id) => window.clearTimeout(id))
    timeoutIdsRef.current.clear()
  }, [])

  // Initialize chart
  useEffect(() => {
    disposedRef.current = false
    if (!chartContainerRef.current) return

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#C5CDD4',
        fontFamily: 'JetBrains Mono, monospace',
      },
      grid: {
        vertLines: { color: 'rgba(132, 148, 149, 0.1)' },
        horzLines: { color: 'rgba(132, 148, 149, 0.1)' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: 'rgba(0, 242, 255, 0.5)',
          width: 1,
          labelBackgroundColor: '#00F2FF',
        },
        horzLine: {
          color: 'rgba(0, 242, 255, 0.5)',
          width: 1,
          labelBackgroundColor: '#00F2FF',
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(132, 148, 149, 0.2)',
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      leftPriceScale: { visible: false },
      timeScale: {
        borderColor: 'rgba(132, 148, 149, 0.2)',
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time: Time, tickMarkType: TickMarkType) =>
          formatTickInBeijing(time, tickMarkType),
      },
      localization: {
        locale: 'zh-CN',
        timeFormatter: (time: Time) => formatTimeInBeijing(time),
      },
      handleScroll: { vertTouchDrag: false },
    })

    chartRef.current = chart

    // Main area series for price
    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: '#00F2FF',
      topColor: 'rgba(0, 242, 255, 0.5)',
      bottomColor: 'rgba(0, 242, 255, 0.05)',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'Price',
    } as AreaSeriesPartialOptions)
    areaSeriesRef.current = areaSeries

    // Average price line (VWAP-like)
    const avgLine = chart.addSeries(LineSeries, {
      color: '#FFD81D',
      lineWidth: 2,
      lineStyle: 2,
      title: 'Avg',
      priceLineVisible: false,
      lastValueVisible: true,
    })
    avgLineRef.current = avgLine

    // Volume series at bottom
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    })
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
      borderVisible: false,
    })
    volumeSeriesRef.current = volumeSeries

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        const rect = chartContainerRef.current.getBoundingClientRect()
        const newHeight = height || rect.height || 400
        chart.applyOptions({ width: rect.width, height: newHeight })
        setContainerHeight(newHeight)
      }
    }
    
    scheduleTimeout(handleResize, 0)
    window.addEventListener('resize', handleResize)

    return () => {
      disposedRef.current = true
      clearAllTimeouts()
      window.removeEventListener('resize', handleResize)
      chart.remove()
      chartRef.current = null
      areaSeriesRef.current = null
      avgLineRef.current = null
      volumeSeriesRef.current = null
    }
  }, [clearAllTimeouts, scheduleTimeout])

  // Subscribe to WebSocket
  useEffect(() => {
    if (!symbol) return
    subscribe([symbol])
    return () => unsubscribe([symbol])
  }, [symbol, subscribe, unsubscribe])

  // Handle real-time price updates
  useEffect(() => {
    if (
      disposedRef.current
      || !priceUpdate
      || !chartRef.current
      || !areaSeriesRef.current
      || lastDataRef.current.length === 0
    ) return
    
    const lastData = lastDataRef.current[lastDataRef.current.length - 1]
    const lastTime = lastData.timestamp
    const updateTime = Math.floor(priceUpdate.timestamp / 1000)  // WebSocket uses milliseconds
    
    // Same minute bucket - update
    if (Math.floor(priceUpdate.timestamp / 1000 / 60) === Math.floor(lastData.timestamp / 60)) {
      areaSeriesRef.current.update({
        time: lastTime as Time,
        value: priceUpdate.price,
      })
    } else {
      // New minute - add new data point
      areaSeriesRef.current.update({
        time: updateTime as Time,
        value: priceUpdate.price,
      })
      void fetchIntradayData()
    }
  }, [priceUpdate])

  // Fetch intraday data (today's 1-minute data)
  const fetchIntradayData = useCallback(async () => {
    if (!symbol || !chartRef.current || !areaSeriesRef.current || disposedRef.current) return
    
    try {
      const currentRequestId = ++fetchRequestIdRef.current
      setLoading(true)
      
      // Get today's 1-minute data
      let response = await klineApi.getKline({
        symbol,
        timeframe: '1m',
        limit: 240, // 4 hours of 1-min data
      })

      // If no K-line data, try to aggregate from tick data
      if (!response || response.length === 0) {
        try {
          const tickResponse = await tickApi.getTickHistory(symbol, {
            market,
            hours: 4,
            limit: 500,
          })
          
          if (tickResponse.data && tickResponse.data.length > 0) {
            // Aggregate tick data into 1-minute K-line format
            response = aggregateTicksToKline(tickResponse.data)
            console.log(`[IntradayChart] Aggregated ${tickResponse.data.length} ticks into ${response.length} minute bars for ${symbol}`)
          }
        } catch (tickErr) {
          console.warn('[IntradayChart] Failed to fetch tick data:', tickErr)
        }
      }

      if (
        disposedRef.current
        || currentRequestId !== fetchRequestIdRef.current
        || !chartRef.current
        || !areaSeriesRef.current
      ) {
        return
      }
      
      if (response && response.length > 0) {
        const { cleaned: sortedResponse, removed } = ensureStrictAscByTimestamp(response)
        if (removed > 0) {
          console.warn(`[IntradayChart] removed ${removed} duplicate timestamp rows for ${symbol}`)
        }

        const visibleResponse = sortedResponse.filter((item) =>
          shouldKeepIntradayPoint(item.timestamp, market),
        )
        if (visibleResponse.length === 0) {
          areaSeriesRef.current.setData([])
          avgLineRef.current?.setData([])
          volumeSeriesRef.current?.setData([])
          lastDataRef.current = []
          return
        }
        
        lastDataRef.current = visibleResponse
        
        // Set price data
        const lineData = convertToLineData(visibleResponse)
        areaSeriesRef.current.setData(lineData)
        
        // Calculate and set average price (cumulative VWAP)
        const avgData = visibleResponse.map((item, index) => {
          const slice = visibleResponse.slice(0, index + 1)
          const totalTPV = slice.reduce((sum, d) => sum + ((d.high + d.low + d.close) / 3) * d.volume, 0)
          const totalVol = slice.reduce((sum, d) => sum + d.volume, 0)
          return {
            time: item.timestamp as Time,
            value: totalVol > 0 ? totalTPV / totalVol : item.close,
          }
        })
        avgLineRef.current?.setData(avgData)
        
        // Set volume data
        const volumeData = convertToVolumeData(visibleResponse)
        volumeSeriesRef.current?.setData(volumeData)
        
        // Fit content
        chartRef.current.timeScale().fitContent()
      }
    } catch (err) {
      showToast('Failed to load intraday data', 'error')
      console.error('Intraday data fetch error:', err)
    } finally {
      if (!disposedRef.current) {
        setLoading(false)
      }
    }
  }, [market, symbol, showToast])

  useEffect(() => {
    void fetchIntradayData()
  }, [fetchIntradayData])

  return (
    <div className="relative w-full h-full">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-fluid-surface-container/50 backdrop-blur-sm z-10">
          <div className="flex items-center gap-2 text-fluid-text-dim">
            <div className="w-5 h-5 border-2 border-fluid-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-mono-data">Loading intraday...</span>
          </div>
        </div>
      )}
      <div 
        ref={chartContainerRef} 
        className="w-full"
        style={{ cursor: 'crosshair', height: containerHeight, minHeight: '300px' }}
      />
    </div>
  )
}
