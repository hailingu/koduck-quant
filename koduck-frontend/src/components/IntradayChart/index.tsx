import { useEffect, useRef, useState, useCallback } from 'react'
import { createChart, AreaSeries, LineSeries, HistogramSeries, type IChartApi, type Time, type AreaSeriesPartialOptions } from 'lightweight-charts'
import { klineApi, type KlineData } from '@/api/kline'
import { useWebSocketStore } from '@/stores/websocket'
import { useToast } from '@/hooks/useToast'

interface IntradayChartProps {
  symbol: string
  market?: string
  height?: number
}

// Convert Beijing timestamp to local timezone timestamp for display
function beijingToLocalTimestamp(beijingTs: number): number {
  const beijingOffset = -480; // Beijing is UTC+8 (480 minutes ahead)
  const localOffset = new Date().getTimezoneOffset(); // Local timezone offset from UTC (minutes)
  return beijingTs - beijingOffset * 60 + localOffset * 60;
}

// Convert KlineData to line chart format
function convertToLineData(data: KlineData[]) {
  return data.map((item) => ({
    time: beijingToLocalTimestamp(item.timestamp) as Time,
    value: item.close,
  }))
}

// Convert KlineData to volume format
function convertToVolumeData(data: KlineData[]) {
  const maxVol = Math.max(...data.map(d => d.volume))
  return data.map((item) => ({
    time: beijingToLocalTimestamp(item.timestamp) as Time,
    value: item.volume,
    color: item.close >= item.open 
      ? `rgba(0, 242, 255, ${0.3 + (item.volume / maxVol) * 0.4})` 
      : `rgba(222, 5, 65, ${0.3 + (item.volume / maxVol) * 0.4})`,
  }))
}

export default function IntradayChart({ 
  symbol, 
  market: _market = 'AShare',
  height 
}: IntradayChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const areaSeriesRef = useRef<any>(null)
  const avgLineRef = useRef<any>(null)
  const volumeSeriesRef = useRef<any>(null)
  const lastDataRef = useRef<KlineData[]>([])
  const { showToast } = useToast()
  
  const [loading, setLoading] = useState(false)
  const [containerHeight, setContainerHeight] = useState(height || 400)
  
  // WebSocket for real-time updates
  const { subscribe, unsubscribe, stockPrices } = useWebSocketStore()
  const priceUpdate = stockPrices.get(symbol)

  // Initialize chart
  useEffect(() => {
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
    
    setTimeout(handleResize, 0)
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
      chartRef.current = null
    }
  }, [])

  // Subscribe to WebSocket
  useEffect(() => {
    if (!symbol) return
    subscribe([symbol])
    return () => unsubscribe([symbol])
  }, [symbol, subscribe, unsubscribe])

  // Handle real-time price updates
  useEffect(() => {
    if (!priceUpdate || !areaSeriesRef.current || lastDataRef.current.length === 0) return
    
    const lastData = lastDataRef.current[lastDataRef.current.length - 1]
    const lastTime = beijingToLocalTimestamp(lastData.timestamp)
    const updateTime = beijingToLocalTimestamp(Math.floor(priceUpdate.timestamp / 1000))  // WebSocket uses milliseconds
    
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
    if (!symbol || !areaSeriesRef.current) return
    
    try {
      setLoading(true)
      
      // Get today's 1-minute data
      const response = await klineApi.getKline({
        symbol,
        timeframe: '1m',
        limit: 240, // 4 hours of 1-min data
      })
      
      if (response && response.length > 0) {
        // Sort data by timestamp ascending (oldest first)
        const sortedResponse = [...response].sort((a, b) => a.timestamp - b.timestamp)
        
        lastDataRef.current = sortedResponse
        
        // Set price data
        const lineData = convertToLineData(sortedResponse)
        areaSeriesRef.current.setData(lineData)
        
        // Calculate and set average price (cumulative VWAP)
        const avgData = sortedResponse.map((item, index) => {
          const slice = sortedResponse.slice(0, index + 1)
          const totalTPV = slice.reduce((sum, d) => sum + ((d.high + d.low + d.close) / 3) * d.volume, 0)
          const totalVol = slice.reduce((sum, d) => sum + d.volume, 0)
          return {
            time: beijingToLocalTimestamp(item.timestamp) as Time,
            value: totalVol > 0 ? totalTPV / totalVol : item.close,
          }
        })
        avgLineRef.current?.setData(avgData)
        
        // Set volume data
        const volumeData = convertToVolumeData(sortedResponse)
        volumeSeriesRef.current?.setData(volumeData)
        
        // Fit content
        chartRef.current?.timeScale().fitContent()
      }
    } catch (err) {
      showToast('Failed to load intraday data', 'error')
      console.error('Intraday data fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [symbol, showToast])

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
