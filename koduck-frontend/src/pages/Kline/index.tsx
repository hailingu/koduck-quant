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
const RECENT_STOCKS_KEY = 'kline_recent_stocks'
const MAX_RECENT_STOCKS = 10

interface RecentStock {
  symbol: string
  name: string
  timestamp: number
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

// Get recent stocks from localStorage
const getRecentStocks = (): RecentStock[] => {
  try {
    const stored = localStorage.getItem(RECENT_STOCKS_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) {
        return parsed.slice(0, MAX_RECENT_STOCKS)
      }
    }
  } catch (e) {
    console.error('Failed to parse recent stocks:', e)
  }
  return []
}

// Save stock to recent stocks list
const saveRecentStock = (symbol: string, name: string) => {
  try {
    const recent = getRecentStocks()
    // Remove existing entry with same symbol
    const filtered = recent.filter(s => s.symbol !== symbol)
    // Add new entry at the beginning
    const updated = [{ symbol, name, timestamp: Date.now() }, ...filtered].slice(0, MAX_RECENT_STOCKS)
    localStorage.setItem(RECENT_STOCKS_KEY, JSON.stringify(updated))
  } catch (e) {
    console.error('Failed to save recent stock:', e)
  }
}

export default function Kline() {
  const [searchParams, setSearchParams] = useSearchParams()
  
  // Initialize state - default to empty (no stock selected)
  const [symbol, setSymbol] = useState<string>('')
  const [stockName, setStockName] = useState<string>('')
  const [timeframe, setTimeframe] = useState('1D')
  const [klineData, setKlineData] = useState<KlineData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recentStocks, setRecentStocks] = useState<RecentStock[]>([])
  
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
  const inWatchlist = symbol ? isInWatchlist(symbol) : false
  
  // Check if a stock is currently selected
  const hasSelectedStock = symbol !== ''

  // Load recent stocks on mount
  useEffect(() => {
    setRecentStocks(getRecentStocks())
  }, [])

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

  // Fetch data when symbol changes
  useEffect(() => {
    if (symbol) {
      fetchKlineData()
      fetchStockDetail()
    }
  }, [symbol])

  // Fetch kline data when timeframe changes
  useEffect(() => {
    if (symbol) {
      fetchKlineData()
    }
  }, [timeframe])

  const fetchStockDetail = async () => {
    if (!symbol) return
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
      setError('获取股票信息失败')
    }
  }

  const fetchKlineData = async () => {
    if (!symbol) return
    setLoading(true)
    setError(null)
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
    } catch (err) {
      console.error('Failed to fetch kline data:', err)
      setError('获取K线数据失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleStockSelect = (selectedSymbol: string, selectedName: string) => {
    setSymbol(selectedSymbol)
    setStockName(selectedName)
    setSearchParams({ symbol: selectedSymbol, name: selectedName })
    saveStockToStorage(selectedSymbol, selectedName)
    saveRecentStock(selectedSymbol, selectedName)
    setRecentStocks(getRecentStocks())
  }

  const handleAddToWatchlist = async () => {
    if (!symbol || !stockName) return
    try {
      await addItem(symbol, stockName, 'AShare')
    } catch (error) {
      console.error('Failed to add to watchlist:', error)
    }
  }

  const handleRetry = () => {
    if (symbol) {
      fetchKlineData()
      fetchStockDetail()
    }
  }

  const isUp = stockInfo.change >= 0

  // Render empty state when no stock is selected
  if (!hasSelectedStock) {
    return (
      <div className="space-y-4">
        {/* Header with Search */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <StockSearch onSelect={handleStockSelect} />
        </div>

        {/* Empty State */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col items-center justify-center py-20 px-4">
            {/* Icon */}
            <div className="w-20 h-20 mb-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <svg
                className="w-10 h-10 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
                />
              </svg>
            </div>
            
            {/* Title */}
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              请输入股票代码开始分析
            </h2>
            
            {/* Description */}
            <p className="text-gray-500 dark:text-gray-400 mb-8 text-center max-w-md">
              在上方搜索框输入股票代码（如 000001.SZ）、名称（如 平安银行）或拼音首字母（如 payh）搜索股票
            </p>

            {/* Recent Stocks */}
            {recentStocks.length > 0 && (
              <div className="w-full max-w-md">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                  最近浏览
                </h3>
                <div className="flex flex-wrap gap-2">
                  {recentStocks.map((stock) => (
                    <button
                      key={stock.symbol}
                      onClick={() => handleStockSelect(stock.symbol, stock.name)}
                      className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-primary-100 dark:hover:bg-primary-900 rounded-lg text-sm transition-colors"
                    >
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {stock.name}
                      </span>
                      <span className="ml-1 text-gray-500 dark:text-gray-400">
                        {stock.symbol}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

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

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-red-700 dark:text-red-400">{error}</span>
            </div>
            <button
              onClick={handleRetry}
              className="px-3 py-1 text-sm bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-700 transition-colors"
            >
              重试
            </button>
          </div>
        </div>
      )}

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
