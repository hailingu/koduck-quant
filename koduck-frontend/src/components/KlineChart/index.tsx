import { useEffect, useRef, useCallback, useState } from 'react'
import { createChart, AreaSeries, LineSeries, HistogramSeries, TickMarkType, type BusinessDay, type IChartApi, type Time, type AreaSeriesPartialOptions } from 'lightweight-charts'
import { klineApi, type KlineData as ApiKlineData } from '@/api/kline'
import { useToast } from '@/hooks/useToast'
import { useWebSocketStore } from '@/stores/websocket'

interface KLineChartProps {
  symbol: string
  market?: string
  timeframe?: string
  height?: number
}

function toBeijingBusinessDay(beijingTs: number): BusinessDay {
  const shifted = new Date((beijingTs + 8 * 3600) * 1000)
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  }
}

function toChartTime(beijingTs: number, apiTimeframe: string): Time {
  if (apiTimeframe === '1D' || apiTimeframe === '1W' || apiTimeframe === '1M') {
    return toBeijingBusinessDay(beijingTs) as Time
  }
  return beijingTs as Time
}

function timeToEpochSeconds(time: Time): number {
  if (typeof time === 'number') return time
  const businessDay = time as BusinessDay
  return Math.floor(Date.UTC(businessDay.year, businessDay.month - 1, businessDay.day) / 1000)
}

function formatTimeInBeijing(time: Time, tickMarkType?: TickMarkType): string {
  if (typeof time !== 'number') {
    const b = time as BusinessDay
    return `${b.year}-${String(b.month).padStart(2, '0')}-${String(b.day).padStart(2, '0')}`
  }

  const ms = timeToEpochSeconds(time) * 1000
  const beijingDate = new Date(ms)
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(beijingDate)
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

// Type guard for BusinessDay
function isBusinessDay(time: Time): time is BusinessDay {
  return typeof time === 'object' && time !== null && 'year' in time && 'month' in time && 'day' in time
}

// Convert API data to line/area chart format (using close price)
// Also handles duplicate chart times (e.g., different timestamps mapping to same BusinessDay)
function convertToLineData(data: ApiKlineData[], apiTimeframe: string): { time: Time; value: number }[] {
  const converted = data.map((item) => ({
    time: toChartTime(item.timestamp, apiTimeframe),
    value: item.close,
  }))

  // Remove duplicates based on chart time (for daily/weekly/monthly, different timestamps may map to same day)
  const seen = new Set<string | number>()
  const cleaned: { time: Time; value: number }[] = []
  for (const item of converted) {
    const timeKey = typeof item.time === 'number' ? item.time : 
      isBusinessDay(item.time) ? `${item.time.year}-${item.time.month}-${item.time.day}` : String(item.time)
    if (seen.has(timeKey)) {
      // Replace with latest value for duplicate time
      const existingIndex = cleaned.findIndex((c) => {
        if (typeof item.time === 'number') return c.time === item.time
        if (isBusinessDay(item.time) && isBusinessDay(c.time)) {
          return c.time.year === item.time.year && c.time.month === item.time.month && c.time.day === item.time.day
        }
        return false
      })
      if (existingIndex >= 0) {
        cleaned[existingIndex] = item
      }
      continue
    }
    seen.add(timeKey)
    cleaned.push(item)
  }
  return cleaned
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
      // keep latest item for duplicate timestamp
      cleaned[cleaned.length - 1] = item
      continue
    }
    cleaned.push(item)
  }
  return { cleaned, removed: sorted.length - cleaned.length }
}

function sanitizeAShareMinuteKline(
  data: ApiKlineData[],
  market: string,
  apiTimeframe: string,
): { cleaned: ApiKlineData[]; removed: number } {
  const isMinuteTimeframe = ['1m', '5m', '15m', '30m', '60m'].includes(apiTimeframe)
  if (!isMinuteTimeframe || market !== 'AShare') {
    return { cleaned: data, removed: 0 }
  }

  // A股盘中时段过滤，去掉混入到分钟级别中的日线/异常时间点（例如北京时间 00:00）
  const allowedHours = new Set([9, 10, 11, 13, 14, 15])
  const cleaned = data.filter((item) => {
    const beijingHour = new Date((item.timestamp + 8 * 3600) * 1000).getUTCHours()
    return allowedHours.has(beijingHour)
  })

  if (cleaned.length === 0) {
    return { cleaned: data, removed: 0 }
  }
  return { cleaned, removed: data.length - cleaned.length }
}

// Get timeframe duration in seconds
function getTimeframeSeconds(timeframe: string): number {
  const map: Record<string, number> = {
    '1m': 60, '5m': 300, '15m': 900, '30m': 1800,
    '60m': 3600, '1h': 3600, '1D': 86400, '1W': 604800, '1M': 2592000,
    'intraday': 60, 'daily': 86400, 'weekly': 604800, 'monthly': 2592000,
  }
  return map[timeframe] || 86400
}

// Timeframe mapping
const timeframeMap: Record<string, string> = {
  'intraday': '1m',
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '60m',
  'daily': '1D',
  '1D': '1D',
  'weekly': '1W',
  'monthly': '1M',
}

const DEFAULT_LIMIT = 300
const WEEKLY_INCREMENT_LIMIT = 300
const MAX_WEEKLY_LIMIT = 3000
const DAILY_INCREMENT_LIMIT = 200
const MAX_DAILY_LIMIT = 1000
const DAILY_MIN_WINDOW_BARS = 20
const WEEKLY_MIN_WINDOW_BARS = 16
const MONTHLY_MIN_WINDOW_BARS = 12
const KLINE_DEBUG_KEY = 'kline_debug'

type InteractionMode = 'default' | 'weekly-loading' | 'weekly-post-full' | 'daily-loading' | 'daily-post-full'

export default function KLineChart({ 
  symbol, 
  market = 'AShare', 
  timeframe = '1D',
  height 
}: KLineChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const areaSeriesRef = useRef<any>(null)
  const vwapSeriesRef = useRef<any>(null)
  const volumeSeriesRef = useRef<any>(null)
  const lastDataRef = useRef<ApiKlineData[]>([])
  const weeklyFullyLoadedRef = useRef(false)
  const weeklyFirstFullShownRef = useRef(false)
  const dailyFullyLoadedRef = useRef(false)
  const dailyFirstFullShownRef = useRef(false)
  const loadingMoreHistoryRef = useRef(false)
  const adjustingRangeRef = useRef(false)
  const pendingVisibleRangeRef = useRef<{ from: number; to: number } | null>(null)
  const requestedLimitRef = useRef(DEFAULT_LIMIT)
  const disposedRef = useRef(false)
  const timeoutIdsRef = useRef<Set<number>>(new Set())
  const fetchRequestIdRef = useRef(0)
  const fetchKlineDataRef = useRef<
    (opts?: { preserveLogicalRange?: boolean; pinRightToLatest?: boolean }) => Promise<void>
  >(
    async () => {},
  )
  const { showToast } = useToast()
  
  const [loading, setLoading] = useState(false)
  const [containerHeight, setContainerHeight] = useState(height || 500)
  const isDebugEnabledRef = useRef(false)

  const debugLog = useCallback((event: string, payload?: Record<string, unknown>) => {
    if (!isDebugEnabledRef.current) return
    const now = new Date().toISOString()
    console.log(`[KLineDebug][${now}] ${event}`, payload ?? {})
  }, [])

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
  
  // WebSocket integration
  const { subscribe, unsubscribe, stockPrices } = useWebSocketStore()
  const priceUpdate = stockPrices.get(symbol)
  const isWeeklyTimeframe = (timeframeMap[timeframe] || '1D') === '1W'
  const isDailyTimeframe = (timeframeMap[timeframe] || '1D') === '1D'

  const applyInteractionMode = useCallback((mode: InteractionMode) => {
    if (!chartRef.current) return
    const weeklyLoading = mode === 'weekly-loading'
    const dailyLoading = mode === 'daily-loading'
    const apiTimeframe = timeframeMap[timeframe] || '1D'
    const constrainedTimeframe =
      apiTimeframe === '1D' || apiTimeframe === '1W' || apiTimeframe === '1M'
    const shouldFixRightEdge = constrainedTimeframe || weeklyLoading || dailyLoading
    const shouldFixLeftEdge = constrainedTimeframe

    chartRef.current.applyOptions({
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisDoubleClickReset: true,
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
      timeScale: {
        // Pin both edges for D/W/M to avoid blank space on either side.
        // Window change still works via zoom (within data bounds) and pan in-range.
        fixLeftEdge: shouldFixLeftEdge,
        fixRightEdge: shouldFixRightEdge,
        rightOffset: 0,
        tickMarkFormatter: (time: Time, tickMarkType: TickMarkType) =>
          formatTimeInBeijing(time, tickMarkType),
      },
      localization: {
        locale: 'zh-CN',
        timeFormatter: (time: Time) => formatTimeInBeijing(time),
      },
    })
    debugLog('interaction_mode_applied', {
      symbol,
      timeframe,
      apiTimeframe,
      mode,
      weeklyLoading,
      dailyLoading,
      shouldFixLeftEdge,
      shouldFixRightEdge,
    })
  }, [debugLog, symbol, timeframe])

  // Initialize chart
  useEffect(() => {
    disposedRef.current = false
    try {
      isDebugEnabledRef.current = window.localStorage.getItem(KLINE_DEBUG_KEY) === '1'
    } catch {
      isDebugEnabledRef.current = false
    }
    debugLog('debug_mode', {
      enabled: isDebugEnabledRef.current,
      key: KLINE_DEBUG_KEY,
      symbol,
      timeframe,
    })
    if (!chartContainerRef.current) return

    // Create chart with The Fluid Ledger theme
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#C5CDD4',
        fontFamily: 'JetBrains Mono, monospace',
      },
      grid: {
        vertLines: {
          color: 'rgba(132, 148, 149, 0.15)',
          style: 2,
        },
        horzLines: {
          color: 'rgba(132, 148, 149, 0.15)',
          style: 2,
        },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: 'rgba(0, 242, 255, 0.5)',
          width: 1,
          style: 2,
          labelBackgroundColor: '#00F2FF',
        },
        horzLine: {
          color: 'rgba(0, 242, 255, 0.5)',
          width: 1,
          style: 2,
          labelBackgroundColor: '#00F2FF',
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(132, 148, 149, 0.2)',
        scaleMargins: {
          top: 0.1,
          bottom: 0.25,
        },
      },
      leftPriceScale: {
        visible: false,
      },
      timeScale: {
        borderColor: 'rgba(132, 148, 149, 0.2)',
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: false,
        fixRightEdge: false,
        tickMarkFormatter: (time: Time, tickMarkType: TickMarkType) =>
          formatTimeInBeijing(time, tickMarkType),
      },
      localization: {
        locale: 'zh-CN',
        timeFormatter: (time: Time) => formatTimeInBeijing(time),
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisDoubleClickReset: true,
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    })

    chartRef.current = chart

    // Create area series (main price chart with fill)
    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: '#00F2FF',
      topColor: 'rgba(0, 242, 255, 0.4)',
      bottomColor: 'rgba(0, 242, 255, 0.05)',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'PRICE',
    } as AreaSeriesPartialOptions)
    areaSeriesRef.current = areaSeries

    // Create VWAP line series
    const vwapSeries = chart.addSeries(LineSeries, {
      color: '#FFD81D',
      lineWidth: 2,
      lineStyle: 2, // dashed
      title: 'VWAP',
      priceLineVisible: false,
      lastValueVisible: true,
    })
    vwapSeriesRef.current = vwapSeries

    // Create volume histogram - overlaid on main chart with transparency
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: 'rgba(0, 242, 255, 0.3)',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume',
    })
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.7,
        bottom: 0,
      },
      borderVisible: false,
    })
    volumeSeriesRef.current = volumeSeries

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        const rect = chartContainerRef.current.getBoundingClientRect()
        const newHeight = height || rect.height || 500
        chart.applyOptions({
          width: rect.width,
          height: newHeight,
        })
        setContainerHeight(newHeight)
      }
    }
    
    // Initial resize with slight delay to ensure container is rendered
    scheduleTimeout(handleResize, 0)
    
    window.addEventListener('resize', handleResize)

    return () => {
      disposedRef.current = true
      clearAllTimeouts()
      window.removeEventListener('resize', handleResize)
      chart.remove()
      chartRef.current = null
      areaSeriesRef.current = null
      vwapSeriesRef.current = null
      volumeSeriesRef.current = null
    }
  }, [])

  useEffect(() => {
    if (isWeeklyTimeframe) {
      applyInteractionMode(weeklyFullyLoadedRef.current ? 'weekly-post-full' : 'weekly-loading')
      return
    }
    if (isDailyTimeframe) {
      applyInteractionMode(dailyFullyLoadedRef.current ? 'daily-post-full' : 'daily-loading')
      return
    }
    applyInteractionMode('default')
  }, [isWeeklyTimeframe, isDailyTimeframe, applyInteractionMode])

  // Subscribe to WebSocket for real-time price updates
  useEffect(() => {
    if (!symbol) return
    
    subscribe([symbol])
    
    return () => {
      unsubscribe([symbol])
    }
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
    
    const apiTimeframe = timeframeMap[timeframe] || '1D'
    const tfSeconds = getTimeframeSeconds(apiTimeframe)
    const lastData = lastDataRef.current[lastDataRef.current.length - 1]
    const lastTime = toChartTime(lastData.timestamp, apiTimeframe)
    const updateTime = toChartTime(Math.floor(priceUpdate.timestamp / 1000), apiTimeframe)
    
    // Check if we're still in the same timeframe bucket
    const lastBucket = Math.floor(lastData.timestamp / tfSeconds) * tfSeconds
    const updateBucket = Math.floor(priceUpdate.timestamp / 1000 / tfSeconds) * tfSeconds
    
    if (updateBucket === lastBucket) {
      // Update the last candle with new price
      areaSeriesRef.current.update({
        time: lastTime,
        value: priceUpdate.price,
      })
      
      // Update volume if available
      if (volumeSeriesRef.current && priceUpdate.volume > 0) {
        const volumeDelta = priceUpdate.volume - lastData.volume
        if (volumeDelta > 0) {
          volumeSeriesRef.current.update({
            time: lastTime,
            value: priceUpdate.volume,
            color: priceUpdate.change >= 0 ? '#00F2FF' : '#DE0541',
          })
        }
      }
    } else {
      // New timeframe bucket - add new data point
      areaSeriesRef.current.update({
        time: updateTime,
        value: priceUpdate.price,
      })
      
      if (volumeSeriesRef.current) {
        volumeSeriesRef.current.update({
          time: updateTime,
          value: 0, // Will be updated as ticks come in
          color: priceUpdate.change >= 0 ? '#00F2FF' : '#DE0541',
        })
      }
      
      // Refresh data to get proper OHLC for the new candle
      void fetchKlineData()
    }
  }, [priceUpdate, timeframe])

  // Fetch and update data
  const fetchKlineData = useCallback(async (opts?: { preserveLogicalRange?: boolean; pinRightToLatest?: boolean }) => {
    if (!symbol || !areaSeriesRef.current || !chartRef.current || disposedRef.current) return
    
    try {
      const currentRequestId = ++fetchRequestIdRef.current
      const preserveLogicalRange = opts?.preserveLogicalRange ?? false
      const pinRightToLatest = opts?.pinRightToLatest ?? false
      const previousDataCount = lastDataRef.current.length
      const previousLogicalRange = preserveLogicalRange && chartRef.current
        ? chartRef.current.timeScale().getVisibleLogicalRange()
        : null
      const previousLogicalSpan = previousLogicalRange ? previousLogicalRange.to - previousLogicalRange.from : null
      const previousRightOffset = previousLogicalRange
        ? Math.min(0, previousLogicalRange.to - (previousDataCount - 1))
        : 0

      setLoading(true)
      const apiTimeframe = timeframeMap[timeframe] || '1D'
      const limit = requestedLimitRef.current
      const response = await klineApi.getKline({
        symbol,
        timeframe: apiTimeframe,
        limit,
      })

      if (
        disposedRef.current
        || currentRequestId !== fetchRequestIdRef.current
        || !chartRef.current
        || !areaSeriesRef.current
      ) {
        return
      }
      debugLog('fetch_kline_response', {
        symbol,
        apiTimeframe,
        requestedLimit: limit,
        returned: response?.length ?? 0,
        preserveLogicalRange,
        pinRightToLatest,
      })
      
      if (response && response.length > 0) {
        // Ensure strict ascending/unique timestamps for lightweight-charts.
        const { cleaned: sortedResponse, removed: removedDuplicates } =
          ensureStrictAscByTimestamp(response)
        if (removedDuplicates > 0) {
          debugLog('sanitize_kline_removed_duplicate_timestamps', {
            symbol,
            market,
            apiTimeframe,
            removed: removedDuplicates,
            before: response.length,
            after: sortedResponse.length,
          })
        }
        const { cleaned: normalizedResponse, removed } = sanitizeAShareMinuteKline(
          sortedResponse,
          market,
          apiTimeframe,
        )
        if (removed > 0) {
          debugLog('sanitize_kline_removed_non_session_bars', {
            symbol,
            market,
            apiTimeframe,
            removed,
            before: sortedResponse.length,
            after: normalizedResponse.length,
          })
        }
        
        // Store reference to raw data for real-time updates
        lastDataRef.current = normalizedResponse
        weeklyFullyLoadedRef.current = apiTimeframe === '1W' && normalizedResponse.length < limit
        dailyFullyLoadedRef.current = apiTimeframe === '1D' && normalizedResponse.length < limit
        if (apiTimeframe === '1W') {
          applyInteractionMode(weeklyFullyLoadedRef.current ? 'weekly-post-full' : 'weekly-loading')
        } else if (apiTimeframe === '1D') {
          applyInteractionMode(dailyFullyLoadedRef.current ? 'daily-post-full' : 'daily-loading')
        } else {
          applyInteractionMode('default')
        }
        
        // Convert to area chart data (using close price)
        const lineData = convertToLineData(normalizedResponse, apiTimeframe)
        areaSeriesRef.current.setData(lineData)
        
        // Calculate and set VWAP data
        const vwapData = normalizedResponse.map((item, index) => {
          const cumulativeTPV = normalizedResponse
            .slice(0, index + 1)
            .reduce((sum, d) => sum + ((d.high + d.low + d.close) / 3) * d.volume, 0)
          const cumulativeVol = normalizedResponse
            .slice(0, index + 1)
            .reduce((sum, d) => sum + d.volume, 0)
          return {
            time: toChartTime(item.timestamp, apiTimeframe),
            value: cumulativeVol > 0 ? cumulativeTPV / cumulativeVol : item.close,
          }
        })
        vwapSeriesRef.current?.setData(vwapData)
        
        // Set volume data - semi-transparent overlay
        const maxVol = Math.max(...normalizedResponse.map(d => d.volume))
        const volumeData = normalizedResponse.map((item) => ({
          time: toChartTime(item.timestamp, apiTimeframe),
          value: item.volume,
          color: item.close >= item.open 
            ? `rgba(0, 242, 255, ${0.2 + (item.volume / maxVol) * 0.3})` 
            : `rgba(222, 5, 65, ${0.2 + (item.volume / maxVol) * 0.3})`,
        }))
        volumeSeriesRef.current?.setData(volumeData)
        
        scheduleTimeout(() => {
          if (!chartRef.current || disposedRef.current || normalizedResponse.length <= 0) {
            return
          }
            if (preserveLogicalRange && previousLogicalRange) {
              if (pinRightToLatest && previousLogicalSpan !== null && previousLogicalSpan > 0) {
                const latestLogicalIndex = normalizedResponse.length - 1
                const anchoredTo = latestLogicalIndex + previousRightOffset
                chartRef.current.timeScale().setVisibleLogicalRange({
                  from: anchoredTo - previousLogicalSpan,
                  to: anchoredTo,
                })
              } else {
                const prependedCount = Math.max(0, normalizedResponse.length - previousDataCount)
                chartRef.current.timeScale().setVisibleLogicalRange({
                  from: previousLogicalRange.from + prependedCount,
                  to: previousLogicalRange.to + prependedCount,
                })
              } 
              debugLog('time_scale_restore_preserved_range', {
                symbol,
                apiTimeframe,
                previousCount: previousDataCount,
                newCount: normalizedResponse.length,
                previousLogicalRange,
                previousLogicalSpan,
                previousRightOffset,
              })
            } else {
              const firstTime = toChartTime(normalizedResponse[0].timestamp, apiTimeframe)
              const lastTime = toChartTime(normalizedResponse[normalizedResponse.length - 1].timestamp, apiTimeframe)
              chartRef.current.timeScale().setVisibleRange({
                from: firstTime,
                to: lastTime,
              })
              debugLog('time_scale_set_visible_range', {
                symbol,
                apiTimeframe,
                from: firstTime,
                to: lastTime,
                dataCount: normalizedResponse.length,
              })
            }

            // Weekly: once full history is loaded, keep current window width/position,
            // then switch to post-full mode (no zoom, draggable window within data bounds).
            if (apiTimeframe === '1W' && weeklyFullyLoadedRef.current && !weeklyFirstFullShownRef.current) {
              weeklyFirstFullShownRef.current = true
            }
            if (apiTimeframe === '1D' && dailyFullyLoadedRef.current && !dailyFirstFullShownRef.current) {
              dailyFirstFullShownRef.current = true
            }
        }, 0)
      } else {
        // Clear chart data when no data available
        areaSeriesRef.current?.setData([])
        vwapSeriesRef.current?.setData([])
        volumeSeriesRef.current?.setData([])
        lastDataRef.current = []
        weeklyFullyLoadedRef.current = false
        dailyFullyLoadedRef.current = false
        applyInteractionMode('default')
        showToast(`${timeframe}: No K-line data available`, 'warning')
      }
    } catch (err) {
      showToast('Failed to load K-line data', 'error')
      console.error('K-line data fetch error:', err)
    } finally {
      if (!disposedRef.current) {
        setLoading(false)
      }
    }
  }, [symbol, market, timeframe, showToast, applyInteractionMode])

  useEffect(() => {
    void fetchKlineData()
  }, [fetchKlineData])

  useEffect(() => {
    fetchKlineDataRef.current = fetchKlineData
  }, [fetchKlineData])

  useEffect(() => {
    if (!chartRef.current) return
    const apiTimeframe = timeframeMap[timeframe] || '1D'
    requestedLimitRef.current = DEFAULT_LIMIT
    weeklyFullyLoadedRef.current = false
    weeklyFirstFullShownRef.current = false
    dailyFullyLoadedRef.current = false
    dailyFirstFullShownRef.current = false
    loadingMoreHistoryRef.current = false
    adjustingRangeRef.current = false
    pendingVisibleRangeRef.current = null
    applyInteractionMode('default')
    if (apiTimeframe !== '1W' && apiTimeframe !== '1D' && apiTimeframe !== '1M') return

    const timeScale = chartRef.current.timeScale()
    const isWeekly = apiTimeframe === '1W'
    const isDaily = apiTimeframe === '1D'
    const isMonthly = apiTimeframe === '1M'
    const incrementLimit = isWeekly ? WEEKLY_INCREMENT_LIMIT : DAILY_INCREMENT_LIMIT
    const maxLimit = isWeekly ? MAX_WEEKLY_LIMIT : MAX_DAILY_LIMIT
    const clampRangeToData = (range: { from: number; to: number }) => {
      const latestLogicalIndex = Math.max(0, lastDataRef.current.length - 1)
      let nextFrom = range.from
      let nextTo = range.to
      const minBars = isDaily
        ? DAILY_MIN_WINDOW_BARS
        : isWeekly
          ? WEEKLY_MIN_WINDOW_BARS
          : isMonthly
            ? MONTHLY_MIN_WINDOW_BARS
            : 0
      const minLogicalSpan = minBars > 0
        ? Math.min(minBars - 1, Math.max(0, latestLogicalIndex))
        : 0

      if (nextTo > latestLogicalIndex) {
        const shift = nextTo - latestLogicalIndex
        nextFrom -= shift
        nextTo -= shift
      }
      if (nextFrom < 0) {
        const shift = -nextFrom
        nextFrom += shift
        nextTo += shift
      }
      const currentSpan = nextTo - nextFrom
      if (minLogicalSpan > 0 && currentSpan < minLogicalSpan) {
        const extra = minLogicalSpan - currentSpan
        nextFrom -= extra / 2
        nextTo += extra - extra / 2
      }
      if (nextTo > latestLogicalIndex) {
        const shift = nextTo - latestLogicalIndex
        nextFrom -= shift
        nextTo -= shift
      }
      if (nextFrom < 0) {
        const shift = -nextFrom
        nextFrom += shift
        nextTo += shift
      }

      return {
        from: nextFrom,
        to: nextTo,
        changed: nextFrom !== range.from || nextTo !== range.to,
      }
    }

    const onVisibleLogicalRangeChange = (range: { from: number; to: number } | null) => {
      if (!range) return
      const latestLogicalIndex = Math.max(0, lastDataRef.current.length - 1)
      const fullyLoaded = isMonthly
        ? true
        : isWeekly
          ? weeklyFullyLoadedRef.current
          : dailyFullyLoadedRef.current
      const firstFullShown = isMonthly
        ? true
        : isWeekly
          ? weeklyFirstFullShownRef.current
          : dailyFirstFullShownRef.current

      // Clamp boundaries in all stages (loading/full) so zoom never reveals blank space.
      if (adjustingRangeRef.current) {
        pendingVisibleRangeRef.current = range
        debugLog('range_change_queued_while_adjusting', {
          symbol,
          timeframe: apiTimeframe,
          range,
        })
        return
      }
      const clampedRange = clampRangeToData(range)
      const nextFrom = clampedRange.from
      const nextTo = clampedRange.to
      debugLog('range_change', {
        symbol,
        timeframe: apiTimeframe,
        inRange: range,
        outRange: { from: nextFrom, to: nextTo },
        changed: clampedRange.changed,
        latestLogicalIndex,
        dataCount: lastDataRef.current.length,
        fullyLoaded,
        firstFullShown,
      })

      if (clampedRange.changed) {
        adjustingRangeRef.current = true
        pendingVisibleRangeRef.current = null
        timeScale.setVisibleLogicalRange({
          from: nextFrom,
          to: nextTo,
        })
        scheduleTimeout(() => {
          if (disposedRef.current) {
            adjustingRangeRef.current = false
            return
          }
          adjustingRangeRef.current = false
          const latestRange = pendingVisibleRangeRef.current ?? timeScale.getVisibleLogicalRange()
          pendingVisibleRangeRef.current = null
          if (!latestRange) return
          const secondPass = clampRangeToData(latestRange)
          debugLog('range_change_second_pass', {
            symbol,
            timeframe: apiTimeframe,
            latestRange,
            secondPass,
          })
          if (!secondPass.changed) return
          adjustingRangeRef.current = true
          timeScale.setVisibleLogicalRange({
            from: secondPass.from,
            to: secondPass.to,
          })
          scheduleTimeout(() => {
            adjustingRangeRef.current = false
          }, 0)
        }, 0)
        return
      }

      if (fullyLoaded && firstFullShown) {
        return
      }

      if (loadingMoreHistoryRef.current) return
      if (isMonthly) return
      if (nextFrom > 20) return
      if (requestedLimitRef.current >= maxLimit) {
        if (isWeekly) {
          weeklyFullyLoadedRef.current = true
          weeklyFirstFullShownRef.current = true
          applyInteractionMode('weekly-post-full')
        } else if (isDaily) {
          dailyFullyLoadedRef.current = true
          dailyFirstFullShownRef.current = true
          applyInteractionMode('daily-post-full')
        }
        debugLog('history_load_reached_max_limit', {
          symbol,
          timeframe: apiTimeframe,
          requestedLimit: requestedLimitRef.current,
          maxLimit,
        })
        return
      }

      loadingMoreHistoryRef.current = true
      requestedLimitRef.current = Math.min(maxLimit, requestedLimitRef.current + incrementLimit)
      debugLog('history_load_increment', {
        symbol,
        timeframe: apiTimeframe,
        nextRequestedLimit: requestedLimitRef.current,
        incrementLimit,
        maxLimit,
      })
      void fetchKlineDataRef
        .current({ preserveLogicalRange: true, pinRightToLatest: true })
        .finally(() => {
          loadingMoreHistoryRef.current = false
          debugLog('history_load_increment_done', {
            symbol,
            timeframe: apiTimeframe,
            requestedLimit: requestedLimitRef.current,
          })
        })
    }

    timeScale.subscribeVisibleLogicalRangeChange(onVisibleLogicalRangeChange)
    return () => {
      timeScale.unsubscribeVisibleLogicalRangeChange(onVisibleLogicalRangeChange)
    }
  }, [timeframe, applyInteractionMode, debugLog, fetchKlineDataRef, scheduleTimeout, symbol])

  return (
    <div className="relative w-full h-full">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-fluid-surface-container/50 backdrop-blur-sm z-10">
          <div className="flex items-center gap-2 text-fluid-text-dim">
            <div className="w-5 h-5 border-2 border-fluid-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-mono-data">Loading chart...</span>
          </div>
        </div>
      )}
      <div 
        ref={chartContainerRef} 
        className="w-full"
        style={{ 
          cursor: 'crosshair',
          height: containerHeight,
          minHeight: '300px',
        }}
      />
    </div>
  )
}
