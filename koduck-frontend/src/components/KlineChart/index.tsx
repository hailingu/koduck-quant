import { useEffect, useRef, useCallback, useState } from 'react'
import { createChart, AreaSeries, LineSeries, HistogramSeries, type IChartApi, type Time, type AreaSeriesPartialOptions } from 'lightweight-charts'
import { klineApi, type KlineData as ApiKlineData } from '@/api/kline'
import { useToast } from '@/hooks/useToast'

interface KLineChartProps {
  symbol: string
  market?: string
  timeframe?: string
  height?: number
}

// Convert API data to line/area chart format (using close price)
function convertToLineData(data: ApiKlineData[]) {
  return data.map((item) => ({
    time: Math.floor(item.timestamp / 1000) as Time,
    value: item.close,
  }))
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
  const { showToast } = useToast()
  
  const [loading, setLoading] = useState(false)
  const [containerHeight, setContainerHeight] = useState(height || 500)

  // Initialize chart
  useEffect(() => {
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
          labelTextColor: '#10131A',
        },
        horzLine: {
          color: 'rgba(0, 242, 255, 0.5)',
          width: 1,
          style: 2,
          labelBackgroundColor: '#00F2FF',
          labelTextColor: '#10131A',
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
      },
      handleScroll: {
        vertTouchDrag: false,
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
    setTimeout(handleResize, 0)
    
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
      chartRef.current = null
    }
  }, [])

  // Fetch and update data
  const fetchKlineData = useCallback(async () => {
    if (!symbol || !areaSeriesRef.current) return
    
    try {
      setLoading(true)
      const apiTimeframe = timeframeMap[timeframe] || '1D'
      const response = await klineApi.getKline({
        symbol,
        timeframe: apiTimeframe,
        limit: 300,
      })
      
      if (response && response.length > 0) {
        // Convert to area chart data (using close price)
        const lineData = convertToLineData(response)
        areaSeriesRef.current.setData(lineData)
        
        // Calculate and set VWAP data
        const vwapData = response.map((item, index) => {
          const cumulativeTPV = response
            .slice(0, index + 1)
            .reduce((sum, d) => sum + ((d.high + d.low + d.close) / 3) * d.volume, 0)
          const cumulativeVol = response
            .slice(0, index + 1)
            .reduce((sum, d) => sum + d.volume, 0)
          return {
            time: Math.floor(item.timestamp / 1000) as Time,
            value: cumulativeVol > 0 ? cumulativeTPV / cumulativeVol : item.close,
          }
        })
        vwapSeriesRef.current.setData(vwapData)
        
        // Set volume data - semi-transparent overlay
        const maxVol = Math.max(...response.map(d => d.volume))
        const volumeData = response.map((item) => ({
          time: Math.floor(item.timestamp / 1000) as Time,
          value: item.volume,
          color: item.close >= item.open 
            ? `rgba(0, 242, 255, ${0.2 + (item.volume / maxVol) * 0.3})` 
            : `rgba(222, 5, 65, ${0.2 + (item.volume / maxVol) * 0.3})`,
        }))
        volumeSeriesRef.current.setData(volumeData)
        
        // Fit content
        chartRef.current?.timeScale().fitContent()
      } else {
        showToast('No K-line data available', 'warning')
      }
    } catch (err) {
      showToast('Failed to load K-line data', 'error')
      console.error('K-line data fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [symbol, market, timeframe, showToast])

  useEffect(() => {
    void fetchKlineData()
  }, [fetchKlineData])

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
