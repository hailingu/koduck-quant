import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { createChart, AreaSeries, LineSeries, HistogramSeries, type Time, type AreaSeriesPartialOptions } from 'lightweight-charts'
import KLineChart from '@/components/KLineChart'
import { marketApi, type PriceQuote } from '@/api/market'
import { klineApi, type KlineData } from '@/api/kline'
import { useToast } from '@/hooks/useToast'

// Time & Sales Component
function TimeAndSales() {
  const ticks = [
    { time: '14:02:11', price: '63,492.10', size: '0.421', total: 'BTC', highlight: false },
    { time: '14:02:10', price: '63,491.95', size: '1.220', total: 'BTC', highlight: false },
    { time: '14:02:08', price: '63,492.05', size: '0.015', total: 'BTC', highlight: false },
    { time: '14:02:07', price: '63,492.20', size: '5.842', total: 'BTC', highlight: true },
    { time: '14:02:05', price: '63,491.50', size: '0.050', total: 'BTC', highlight: false },
    { time: '14:02:02', price: '63,491.90', size: '0.118', total: 'BTC', highlight: false },
    { time: '14:02:00', price: '63,491.20', size: '2.440', total: 'BTC', highlight: true },
    { time: '14:01:58', price: '63,491.80', size: '0.992', total: 'BTC', highlight: false },
    { time: '14:01:55', price: '63,491.10', size: '0.022', total: 'BTC', highlight: false },
    { time: '14:01:52', price: '63,490.95', size: '1.050', total: 'BTC', highlight: false },
  ]

  return (
    <div className="glass-panel p-4 rounded-xl h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-headline font-bold text-sm text-fluid-text">Time & Sales</h3>
        <div className="flex items-center gap-1 text-[10px] font-mono-data text-fluid-primary">
          <span className="w-1.5 h-1.5 rounded-full bg-fluid-primary animate-pulse" />
          LIVE
        </div>
      </div>
      <div className="space-y-1 font-mono-data text-xs">
        {ticks.map((tick, idx) => (
          <div key={idx} className="flex justify-between items-center py-1">
            <span className="text-fluid-text-dim">{tick.time}</span>
            <span className={tick.highlight ? 'text-fluid-primary font-semibold' : 'text-fluid-text'}>
              {tick.price}
            </span>
            <span className={tick.highlight ? 'text-fluid-primary' : 'text-fluid-text-muted'}>
              {tick.size} {tick.total}
            </span>
          </div>
        ))}
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
  market?: string
  timeframe?: string 
}) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<any>(null)
  const volumeSeriesRef = useRef<any>(null)
  const { showToast } = useToast()
  
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
          timeframe: apiTimeframe,
          limit: 100,
        })
        
        if (response && response.length > 0) {
          const volumeData = response.map((item: KlineData) => ({
            time: Math.floor(item.timestamp / 1000) as Time,
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
function MarketStats({ quote }: { quote: PriceQuote | null }) {
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

  const isUp = quote.change >= 0
  const changePercent = quote.prevClose ? ((quote.change / quote.prevClose) * 100).toFixed(2) : '0.00'

  return (
    <div className="glass-panel p-4 rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-mono-data text-fluid-text-muted uppercase">Market Stats</span>
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
            {quote.volume ? (quote.volume / 10000).toFixed(2) + '万' : '--'}
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-fluid-text-muted">Change</span>
          <span className={`font-mono-data ${isUp ? 'text-fluid-primary' : 'text-fluid-secondary'}`}>
            {isUp ? '+' : ''}{quote.change?.toFixed(2) ?? '--'} ({isUp ? '+' : ''}{changePercent}%)
          </span>
        </div>
      </div>
    </div>
  )
}

export default function Kline() {
  const [searchParams] = useSearchParams()
  const { showToast } = useToast()
  
  // Get symbol from URL params or default
  const symbol = searchParams.get('symbol') || '601012'
  const market = searchParams.get('market') || 'AShare'
  const name = searchParams.get('name') || '隆基绿能'
  
  const [timeframe, setTimeframe] = useState('daily')
  const [quote, setQuote] = useState<PriceQuote | null>(null)
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

  // Fetch stock quote
  useEffect(() => {
    const fetchQuote = async () => {
      try {
        setLoading(true)
        const data = await marketApi.getStockDetail(symbol)
        setQuote(data)
      } catch (err) {
        showToast('Failed to load stock quote', 'error')
      } finally {
        setLoading(false)
      }
    }
    void fetchQuote()
  }, [symbol, showToast])

  const isUp = quote ? quote.change >= 0 : false
  const changePercent = quote?.prevClose 
    ? ((quote.change / quote.prevClose) * 100).toFixed(2) 
    : '0.00'

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
              {loading ? (
                <span className="px-2 py-0.5 bg-fluid-surface-higher text-fluid-text-dim text-xs font-mono-data rounded">
                  --
                </span>
              ) : (
                <span className={`px-2 py-0.5 ${isUp ? 'bg-fluid-primary/20 text-fluid-primary' : 'bg-fluid-secondary/20 text-fluid-secondary'} text-xs font-mono-data rounded`}>
                  {isUp ? '+' : ''}{changePercent}%
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs font-mono-data">
              {loading ? (
                <span className="text-fluid-text-dim text-xl">Loading...</span>
              ) : (
                <>
                  <span className={`text-2xl font-bold ${isUp ? 'text-fluid-primary' : 'text-fluid-secondary'}`}>
                    {quote?.price?.toFixed(2) ?? '--'}
                  </span>
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

        {/* Chart Area - Main Chart + Volume */}
        <div className="flex-1 flex flex-col gap-3">
          {/* Main Chart */}
          <div className="flex-[3] glass-panel rounded-xl overflow-hidden">
            <KLineChart 
              symbol={symbol}
              market={market}
              timeframe={timeframe}
            />
          </div>
          
          {/* Volume Chart */}
          <div className="flex-1 glass-panel rounded-xl overflow-hidden min-h-[120px]">
            <VolumeChart 
              symbol={symbol}
              market={market}
              timeframe={timeframe}
            />
          </div>
        </div>
      </div>

      {/* Side Panel - 3 cols */}
      <div className="col-span-3 flex flex-col gap-4">
        <TimeAndSales />
        <MarketStats quote={quote} />
      </div>
    </div>
  )
}
