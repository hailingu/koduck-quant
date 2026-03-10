import { useEffect, useRef } from 'react'
import {
  CandlestickSeries,
  createChart,
  type CandlestickData,
  type IChartApi,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import type { KlineData } from '@/api/kline'

interface KlineChartProps {
  data: KlineData[]
  timeframe: string
}

// lightweight-charts uses UTCTimestamp for intraday candlesticks.
const MINUTE_TIMEFRAMES = new Set(['1m', '5m', '15m', '30m', '60m'])
const CHINA_TZ_OFFSET_SECONDS = 8 * 60 * 60

function convertTimestampToChartTime(timestamp: number, timeframe: string): Time {
  if (MINUTE_TIMEFRAMES.has(timeframe)) {
    return (timestamp + CHINA_TZ_OFFSET_SECONDS) as UTCTimestamp
  }
  return timestamp as UTCTimestamp
}

export default function KlineChart({ data, timeframe }: Readonly<KlineChartProps>) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const isMinuteTimeframe = MINUTE_TIMEFRAMES.has(timeframe)
  const isMonthlyTimeframe = timeframe === '1M'
  const monthlyTickFormatter = isMonthlyTimeframe
    ? (time: Time): string => {
        if (typeof time === 'number') {
          const date = new Date((time + CHINA_TZ_OFFSET_SECONDS) * 1000)
          const year = date.getUTCFullYear()
          const month = String(date.getUTCMonth() + 1).padStart(2, '0')
          return `${year}-${month}`
        }
        if (typeof time === 'object' && time !== null) {
          const month = String(time.month).padStart(2, '0')
          return `${time.year}-${month}`
        }
        return ''
      }
    : undefined

  useEffect(() => {
    if (!chartContainerRef.current) return

    const isDark = document.documentElement.classList.contains('dark')

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: isDark ? '#d1d5db' : '#374151',
      },
      grid: {
        vertLines: { color: isDark ? '#374151' : '#e5e7eb' },
        horzLines: { color: isDark ? '#374151' : '#e5e7eb' },
      },
      crosshair: { mode: 1 },
      rightPriceScale: {
        borderColor: isDark ? '#4b5563' : '#d1d5db',
      },
      timeScale: {
        borderColor: isDark ? '#4b5563' : '#d1d5db',
        timeVisible: isMinuteTimeframe,
        secondsVisible: false,
        tickMarkFormatter: monthlyTickFormatter,
      },
    })

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#ef4444',
      downColor: '#22c55e',
      borderVisible: false,
      wickUpColor: '#ef4444',
      wickDownColor: '#22c55e',
    })

    chartRef.current = chart

    if (data.length > 0) {
      const sortedData = [...data].sort((a, b) => a.timestamp - b.timestamp)
      const chartData: CandlestickData<Time>[] = sortedData.map((item) => ({
        time: convertTimestampToChartTime(item.timestamp, timeframe),
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
      }))
      candlestickSeries.setData(chartData)
      chart.timeScale().fitContent()
    }

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        })
      }
    }

    window.addEventListener('resize', handleResize)
    handleResize()

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [data, isMinuteTimeframe, monthlyTickFormatter, timeframe])

  return <div ref={chartContainerRef} className="w-full h-full min-h-[400px]" />
}
