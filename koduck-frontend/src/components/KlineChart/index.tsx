import { useEffect, useRef } from 'react'
import { createChart, type IChartApi, type CandlestickData, type Time, CandlestickSeries } from 'lightweight-charts'
import type { KlineData } from '@/api/kline'

interface KlineChartProps {
  data: KlineData[]
}

export default function KlineChart({ data }: KlineChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)

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
        timeVisible: true,
        secondsVisible: false,
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
      const chartData: CandlestickData<Time>[] = data.map((item) => ({
        time: item.timestamp as unknown as Time,
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
  }, [data])

  return <div ref={chartContainerRef} className="w-full h-full min-h-[400px]" />
}
