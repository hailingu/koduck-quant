import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import KlineChart from '@/components/KlineChart'
import StockSearch from '@/components/StockSearch'
import { klineApi } from '@/api/kline'
import type { KlineData } from '@/api/kline'
import { marketApi } from '@/api/market'
import { useWatchlistStore } from '@/stores/watchlist'

const TIMEFRAMES = [
  { value: '1m', label: '1分' },
  { value: '5m', label: '5分' },
  { value: '15m', label: '15分' },
  { value: '30m', label: '30分' },
  { value: '60m', label: '60分' },
  { value: '1D', label: '日线' },
  { value: '1W', label: '周线' },
  { value: '1M', label: '月线' },
]

const STORAGE_KEY = 'kline_current_stock'
const DEFAULT_SYMBOL = '002326'
const DEFAULT_NAME = '永太科技'

// Helper function to get stored stock from localStorage
const getStoredStock = (): { symbol: string; name: string } | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (parsed.symbol) {
        return { symbol: parsed.symbol, name: parsed.name || '' }
      }
    }
  } catch (e) {
    console.error('Failed to parse stored stock:', e)
  }
  return null
}

// Helper function to save stock to localStorage
const saveStockToStorage = (symbol: string, name: string) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      symbol,
      name,
      timestamp: Date.now()
    }))
  } catch (e) {
    console.error('Failed to save stock to storage:', e)
  }
}

export default function Kline() {
  const [searchParams, setSearchParams] = useSearchParams()
  
  // Initialize state with priority: URL > localStorage > default
  const [symbol, setSymbol] = useState(() => {
    const urlSymbol = searchParams.get('symbol')
    if (urlSymbol) return urlSymbol
    const stored = getStoredStock()
    if (stored) return stored.symbol
    return DEFAULT_SYMBOL
  })
  
  const [stockName, setStockName] = useState(() => {
    const urlName = searchParams.get('name')
    if (urlName) return urlName
    const stored = getStoredStock()
    if (stored?.name) return stored.name
    return DEFAULT_NAME
  })
  
  const [timeframe, setTimeframe] = useState('1D')
  const [klineData, setKlineData] = useState<KlineData[]>([])
  const [loading, setLoading] = useState(false)
  const [stockInfo, setStockInfo] = useState({
    price: 0,
    change: 0,
    changePercent: 0,
    open: 0,
    high: 0,
    low: 0,
    prevClose: 0,
    volume: 0,
  })

  const { addItem, isInWatchlist } = useWatchlistStore()
  const inWatchlist = isInWatchlist(symbol)

  // Sync URL changes (e.g., browser back/forward)
  useEffect(() => {
    const urlSymbol = searchParams.get('symbol')
    const urlName = searchParams.get('name')
    if (urlSymbol && urlSymbol !== symbol) {
      setSymbol(urlSymbol)
      setStockName(urlName || '')
      saveStockToStorage(urlSymbol, urlName || '')
    }
  }, [searchParams])

  useEffect(() => {
    fetchKlineData()
    fetchStockDetail()
  }, [symbol])

  useEffect(() => {
    fetchKlineData()
  }, [timeframe])

  const fetchStockDetail = async () => {
    try {
      const data = await marketApi.getStockDetail(symbol)
      if (data) {
        setStockName(data.name)
        setStockInfo({
          price: data.price,
          change: data.change,
          changePercent: data.changePercent,
          open: data.open,
          high: data.high,
          low: data.low,
          prevClose: data.prevClose,
          volume: data.volume,
        })
      }
    } catch (error) {
      console.error('Failed to fetch stock detail:', error)
    }
  }

  const fetchKlineData = async () => {
    setLoading(true)
    try {
      const data = await klineApi.getKline({
        market: 'AShare',
        symbol,
        timeframe,
        limit: 300,
      })
      if (data) {
        setKlineData(data)
      }
    } catch (error) {
      console.error('Failed to fetch kline data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStockSelect = (selectedSymbol: string, selectedName: string) => {
    setSymbol(selectedSymbol)
    setStockName(selectedName)
    setSearchParams({ symbol: selectedSymbol, name: selectedName })
    saveStockToStorage(selectedSymbol, selectedName)
  }

  const handleAddToWatchlist = async () => {
    try {
      await addItem(symbol, stockName, 'AShare')
    } catch (error) {
      console.error('Failed to add to watchlist:', error)
    }
  }

  const isUp = stockInfo.change >= 0

  return (
    <div className="space-y-4">
      {/* Header with Search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <StockSearch onSelect={handleStockSelect} />
        
        <button
          onClick={handleAddToWatchlist}
          disabled={inWatchlist}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            inWatchlist
              ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-primary-600 hover:bg-primary-700 text-white'
          }`}
        >
          {inWatchlist ? '已在自选' : '加入自选'}
        </button>
      </div>

      {/* Stock Info */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{stockName}</h1>
            <p className="text-sm text-gray-500">{symbol}</p>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold ${isUp ? 'text-stock-up' : 'text-stock-down'}`}>
              {stockInfo.price.toFixed(2)}
            </span>
            <span className={`text-sm font-medium ${isUp ? 'text-stock-up' : 'text-stock-down'}`}>
              {isUp ? '+' : ''}{stockInfo.change.toFixed(2)} ({isUp ? '+' : ''}
              {stockInfo.changePercent.toFixed(2)}%)
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">今开:</span>
            <span className="ml-2 text-gray-900 dark:text-white">{stockInfo.open.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-gray-500">最高:</span>
            <span className="ml-2 text-gray-900 dark:text-white">{stockInfo.high.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-gray-500">最低:</span>
            <span className="ml-2 text-gray-900 dark:text-white">{stockInfo.low.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-gray-500">昨收:</span>
            <span className="ml-2 text-gray-900 dark:text-white">{stockInfo.prevClose.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Timeframe Selector */}
      <div className="flex flex-wrap gap-2">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf.value}
            onClick={() => setTimeframe(tf.value)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              timeframe === tf.value
                ? 'bg-primary-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {tf.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        {loading ? (
          <div className="h-[400px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <div className="h-[400px]">
            <KlineChart data={klineData} />
          </div>
        )}
      </div>
    </div>
  )
}
