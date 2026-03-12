import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import KlineChart from '@/components/KlineChart'
import StockSearch from '@/components/StockSearch'
import PriceDisplay from '@/components/PriceDisplay'
import AIChat from '@/components/AIChat'
import { klineApi } from '@/api/kline'
import type { KlineData } from '@/api/kline'
import { marketApi, type StockValuation, type StockIndustry } from '@/api/market'
import { useWatchlistStore } from '@/stores/watchlist'
import { useWebSocketStore } from '@/stores/websocket'
import { useWebSocketSubscription } from '@/hooks/useWebSocket'
import { useToast } from '@/hooks/useToast'
import { isTradingHours } from '@/utils/trading'

const TIMEFRAMES = [
  { value: '1m', label: '1分' },
  { value: '15m', label: '15分' },
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

interface DerivedStockInfo {
  price: number
  change: number
  changePercent: number
  open: number
  high: number
  low: number
  prevClose: number
  volume: number
  amount: number
}

const normalizeSymbol = (value: string): string => {
  const digits = value.replaceAll(/\D/g, '')
  if (digits.length >= 1 && digits.length <= 6) {
    return digits.padStart(6, '0')
  }
  return value.trim().toUpperCase()
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

// 格式化成交量（万手/亿手）
const formatVolume = (volume: number): string => {
  if (!volume || volume === 0) return '--'
  const wan = volume / 10000
  if (wan >= 10000) {
    return (wan / 10000).toFixed(2) + '亿手'
  }
  return wan.toFixed(2) + '万手'
}

// 格式化成交额（万/亿）
const formatAmount = (amount: number): string => {
  if (!amount || amount === 0) return '--'
  const wan = amount / 10000
  if (wan >= 10000) {
    return (wan / 10000).toFixed(2) + '亿'
  }
  return wan.toFixed(2) + '万'
}

// 格式化总市值（亿/万亿）
const formatMarketCap = (marketCap: number | null | undefined): string => {
  if (!marketCap || marketCap === 0) return '--'
  const marketCapYi = marketCap >= 100000000 ? marketCap / 100000000 : marketCap
  if (marketCapYi >= 10000) {
    return (marketCapYi / 10000).toFixed(2) + '万亿'
  }
  return marketCapYi.toFixed(2) + '亿'
}

// 格式化市盈率/市净率
const formatRatio = (value: number | null | undefined): string => {
  if (value === null || value === undefined || value === 0) return '--'
  return value.toFixed(2)
}

// 格式化换手率
const formatTurnoverRate = (value: number | null | undefined): string => {
  if (value === null || value === undefined || value === 0) return '--'
  return value.toFixed(2) + '%'
}

const formatSharesInYi = (shares: number | null | undefined): string => {
  if (!shares || shares === 0) return '--'
  const sharesYi = shares >= 100000000 ? shares / 100000000 : shares
  return sharesYi.toFixed(2) + '亿'
}

const deriveStockInfoFromKline = (data: KlineData[]): DerivedStockInfo | null => {
  if (!data || data.length === 0) {
    return null
  }

  const latest = data.at(-1)
  const previous = data.at(-2)
  if (!latest) {
    return null
  }
  const prevClose = previous?.close ?? latest.open
  const change = latest.close - prevClose
  const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0

  return {
    price: latest.close,
    change,
    changePercent,
    open: latest.open,
    high: latest.high,
    low: latest.low,
    prevClose,
    volume: latest.volume,
    amount: latest.amount ?? 0,
  }
}

const MINUTE_TIMEFRAMES = new Set(['1m', '5m', '15m', '30m', '60m'])
const LIVE_PUSH_TIMEFRAMES = new Set(['tick', '1m', '15m', '60m'])
const REALTIME_REFRESH_INTERVAL_MS = 3000

const APPLE_CARD_CLASS =
  'bg-white dark:bg-[#1c1c1e] rounded-[24px] shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100 dark:border-white/5'

const keepLatestTradingDayForMinute = (data: KlineData[], timeframe: string): KlineData[] => {
  if (!MINUTE_TIMEFRAMES.has(timeframe) || data.length === 0) {
    return data
  }

  const minPointsByTimeframe: Record<string, number> = {
    '1m': 30,
    '5m': 12,
    '15m': 8,
    '30m': 4,
    '60m': 3,
  }
  const minPoints = minPointsByTimeframe[timeframe] ?? 2

  const grouped = new Map<string, KlineData[]>()
  for (const item of data) {
    const date = new Date(item.timestamp * 1000).toDateString()
    const group = grouped.get(date) ?? []
    group.push(item)
    grouped.set(date, group)
  }

  const dates = Array.from(grouped.keys()).sort((a, b) => {
    return new Date(a).getTime() - new Date(b).getTime()
  })

  for (let i = dates.length - 1; i >= 0; i -= 1) {
    const dayData = grouped.get(dates[i]) ?? []
    const filteredDayData = dayData.filter((item) => {
      const d = new Date(item.timestamp * 1000)
      return !(d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0)
    })

    if (filteredDayData.length >= minPoints) {
      return filteredDayData
    }
  }

  return data
}

export default function Kline() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { showToast } = useToast()
  
  // Initialize state - default to empty (no stock selected)
  const [symbol, setSymbol] = useState<string>('')
  const [stockName, setStockName] = useState<string>('')
  const [timeframe, setTimeframe] = useState('1D')
  const [klineData, setKlineData] = useState<KlineData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recentStocks, setRecentStocks] = useState<RecentStock[]>([])
  const [addingToWatchlist, setAddingToWatchlist] = useState(false)
  const [removingFromWatchlist, setRemovingFromWatchlist] = useState(false)
  
  const [stockInfo, setStockInfo] = useState({
    price: 0,
    change: 0,
    changePercent: 0,
    open: 0,
    high: 0,
    low: 0,
    prevClose: 0,
    volume: 0,
    amount: 0,
  })

  // 股票估值信息（PE、PB、总市值、换手率等）
  const [valuation, setValuation] = useState<StockValuation | null>(null)

  // 股票所属行业信息（行业、板块、细分行业等）
  const [industry, setIndustry] = useState<StockIndustry | null>(null)

  const { addItem, removeItem, items, isInWatchlist, fetchWatchlist } = useWatchlistStore()
  const inWatchlist = symbol ? isInWatchlist(symbol) : false
  const watchlistItem = inWatchlist && symbol ? items.find(item => item.symbol === symbol) : null
  const watchlistItemId = watchlistItem?.id
  
  let watchlistButtonLabel = '+ 添加自选'
  if (inWatchlist) {
    watchlistButtonLabel = removingFromWatchlist ? '移除中...' : '移除自选'
  } else if (addingToWatchlist) {
    watchlistButtonLabel = '添加中...'
  }
  
  // WebSocket for real-time price updates
  const { stockPrices } = useWebSocketStore()
  const normalizedSymbol = symbol ? normalizeSymbol(symbol) : ''
  const normalizedTimeframe = timeframe.toLowerCase()
  const isLivePushTimeframe = LIVE_PUSH_TIMEFRAMES.has(normalizedTimeframe)
  const subscriptionSymbols = useMemo(
    () => (normalizedSymbol && isLivePushTimeframe ? [normalizedSymbol] : []),
    [isLivePushTimeframe, normalizedSymbol]
  )

  useWebSocketSubscription(subscriptionSymbols, subscriptionSymbols.length > 0)

  // Load watchlist on mount to sync with server
  useEffect(() => {
    fetchWatchlist()
  }, [fetchWatchlist])
  
  // Update stock info when WebSocket pushes new price
  useEffect(() => {
    if (isLivePushTimeframe && normalizedSymbol && stockPrices.has(normalizedSymbol)) {
      const priceUpdate = stockPrices.get(normalizedSymbol)!
      setStockInfo((prev) => ({
        ...prev,
        price: priceUpdate.price,
        change: priceUpdate.change,
        changePercent: priceUpdate.changePercent,
        volume: priceUpdate.volume,
        amount: priceUpdate.amount,
      }))
    }
  }, [isLivePushTimeframe, stockPrices, normalizedSymbol])
  
  // Polling as fallback for real-time updates (every 3 seconds during trading hours)
  const fetchStockDetail = useCallback(async () => {
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
          amount: data.amount,
        })
      }
    } catch (error) {
      console.error('Failed to fetch stock detail:', error)
      setError((currentError) => currentError || null)
    }
  }, [symbol])

  const fetchKlineData = useCallback(async () => {
    if (!symbol) return false
    setLoading(true)
    setError(null)
    try {
      const data = await klineApi.getKline({
        symbol,
        timeframe,
        limit: 300,
      })
      if (!data || data.length === 0) {
        setKlineData([])
        setError('该股票暂无K线数据')
        return false
      }

      const normalizedData = [...data].sort((a, b) => a.timestamp - b.timestamp)
      const chartData = keepLatestTradingDayForMinute(normalizedData, timeframe)
      setKlineData(chartData)
      const derivedStockInfo = deriveStockInfoFromKline(chartData)
      if (derivedStockInfo) {
        // Keep headline quote from stock detail / websocket.
        // Use kline-derived values only as an initial fallback before quote is available.
        setStockInfo((prev) => {
          if (prev.price > 0 && prev.prevClose > 0) {
            return prev
          }
          return derivedStockInfo
        })
      }
      return true
    } catch (err) {
      console.error('Failed to fetch kline data:', err)
      setError('获取K线数据失败，请稍后重试')
      setKlineData([])
      return false
    } finally {
      setLoading(false)
    }
  }, [symbol, timeframe])

  // 获取股票估值信息
  const fetchStockValuation = useCallback(async () => {
    if (!symbol) {
      setValuation(null)
      return
    }
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const data = await marketApi.getStockValuation(symbol)
        if (data) {
          setValuation(data)
        } else {
          setValuation(null)
        }
        return
      } catch (error) {
        const shouldRetry = attempt === 1
        if (shouldRetry) {
          // Data provider occasionally returns slowly; retry once to avoid false-negative error noise.
          await new Promise((resolve) => setTimeout(resolve, 500))
          continue
        }
        setValuation(null)
        console.warn('Failed to fetch stock valuation after retry:', error)
      }
    }
  }, [symbol])

  // 获取股票所属行业信息
  const fetchStockIndustry = useCallback(async () => {
    if (!symbol) {
      setIndustry(null)
      return
    }
    try {
      const data = await marketApi.getStockIndustry(symbol)
      if (data) {
        setIndustry(data)
      } else {
        setIndustry(null)
      }
    } catch (error) {
      setIndustry(null)
      console.error('Failed to fetch stock industry:', error)
    }
  }, [symbol])

  const loadSymbolData = useCallback(async () => {
    const hasKline = await fetchKlineData()
    if (!hasKline) {
      return
    }
    await Promise.allSettled([
      fetchStockDetail(),
      fetchStockValuation(),
      fetchStockIndustry(),
    ])
  }, [fetchKlineData, fetchStockDetail, fetchStockValuation, fetchStockIndustry])

  useEffect(() => {
    if (!symbol) return
    if (klineData.length === 0) return

    const trading = isTradingHours()

    if (!isLivePushTimeframe || !trading) {
      return
    }

    const interval = setInterval(() => {
      void fetchStockDetail()
    }, REALTIME_REFRESH_INTERVAL_MS)

    return () => {
      clearInterval(interval)
    }
  }, [fetchStockDetail, isLivePushTimeframe, klineData.length, symbol])

  useEffect(() => {
    if (!symbol || klineData.length === 0) {
      return
    }
    if (!isLivePushTimeframe || !isTradingHours()) {
      return
    }

    const interval = setInterval(() => {
      void fetchKlineData()
    }, REALTIME_REFRESH_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [fetchKlineData, isLivePushTimeframe, klineData.length, symbol])
  
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
  }, [searchParams, symbol])

  // Reset data and fetch when symbol changes
  useEffect(() => {
    if (symbol) {
      // Clear old data first to prevent showing stale data
      setKlineData([])
      setValuation(null)
      setIndustry(null)
      setError(null)
      void loadSymbolData()
    }
  }, [loadSymbolData, symbol])

  // Fetch kline data when timeframe changes (only if symbol is already loaded)
  useEffect(() => {
    if (symbol && klineData.length > 0) {
      void fetchKlineData()
    }
  }, [fetchKlineData, timeframe])

  const handleStockSelect = (selectedSymbol: string, selectedName: string) => {
    // Clear old data immediately to prevent showing stale data
    setKlineData([])
    setError(null)
    setValuation(null)
    setIndustry(null)
    setSymbol(selectedSymbol)
    setStockName(selectedName)
    setSearchParams({ symbol: selectedSymbol, name: selectedName })
    saveStockToStorage(selectedSymbol, selectedName)
    saveRecentStock(selectedSymbol, selectedName)
    setRecentStocks(getRecentStocks())
  }

  const handleToggleWatchlist = async () => {
    if (!symbol || !stockName) return
    
    if (inWatchlist) {
      // 移除自选
      if (!watchlistItemId) return
      setRemovingFromWatchlist(true)
      try {
        await removeItem(watchlistItemId)
        showToast(`已将 ${stockName} (${symbol}) 从自选股中移除`, 'success')
      } catch (error) {
        console.error('Failed to remove from watchlist:', error)
        showToast('移除自选股失败，请重试', 'error')
      } finally {
        setRemovingFromWatchlist(false)
      }
    } else {
      // 添加自选
      setAddingToWatchlist(true)
      try {
        await addItem(symbol, stockName, 'AShare')
        showToast(`已将 ${stockName} (${symbol}) 添加到自选股`, 'success')
      } catch (error) {
        console.error('Failed to add to watchlist:', error)
        showToast('添加自选股失败，请重试', 'error')
      } finally {
        setAddingToWatchlist(false)
      }
    }
  }

  const handleRetry = () => {
    if (symbol) {
      void loadSymbolData()
    }
  }

  // Render empty state when no stock is selected
  if (!hasSelectedStock) {
    return (
      <div className="space-y-5 [font-family:-apple-system,BlinkMacSystemFont,'SF_Pro_Text','Helvetica_Neue','Segoe_UI',sans-serif]">
        {/* Header with Search */}
        <div>
          <StockSearch onSelect={handleStockSelect} />
        </div>

        {/* Empty State */}
        <div className={APPLE_CARD_CLASS}>
          <div className="flex flex-col items-center justify-center py-20 px-4">
            {/* Icon */}
            <div className="w-20 h-20 mb-6 rounded-full bg-[#f5f5f7] dark:bg-[#2c2c2e] flex items-center justify-center">
              <svg
                className="w-10 h-10 text-[#8e8e93]"
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
            <h2 className="text-xl font-semibold text-[#1d1d1f] dark:text-white mb-2">
              请输入股票代码开始分析
            </h2>
            
            {/* Description */}
            <p className="text-[#8e8e93] dark:text-gray-400 mb-8 text-center max-w-md">
              在上方搜索框输入股票代码（如 000001.SZ）、名称（如 平安银行）或拼音首字母（如 payh）搜索股票
            </p>

            {/* Recent Stocks */}
            {recentStocks.length > 0 && (
              <div className="w-full max-w-md">
                <h3 className="text-sm font-medium text-[#8e8e93] dark:text-gray-400 mb-3">
                  最近浏览
                </h3>
                <div className="flex flex-wrap gap-2">
                  {recentStocks.map((stock) => (
                    <button
                      key={stock.symbol}
                      onClick={() => handleStockSelect(stock.symbol, stock.name)}
                      className="px-3 py-2 bg-[#f5f5f7] dark:bg-[#2c2c2e] hover:bg-[#e9ebef] dark:hover:bg-[#3a3a3c] rounded-[10px] text-sm transition-colors"
                    >
                      <span className="font-medium text-[#3a3a3c] dark:text-gray-300">
                        {stock.name}
                      </span>
                      <span className="ml-1 text-[#8e8e93] dark:text-gray-400">
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
    <div className="space-y-5 h-full [font-family:-apple-system,BlinkMacSystemFont,'SF_Pro_Text','Helvetica_Neue','Segoe_UI',sans-serif]">
      {/* Header with Search */}
      <div>
        <StockSearch onSelect={handleStockSelect} />
      </div>

      {/* Error Message */}
      {error && (
        <div className={`${APPLE_CARD_CLASS} p-4 border-red-200/60 dark:border-red-800/40 bg-red-50/70 dark:bg-red-900/10`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-red-700 dark:text-red-300">{error}</span>
            </div>
            <button
              onClick={handleRetry}
              className="px-3 py-1 text-sm bg-red-100 dark:bg-red-800/70 text-red-700 dark:text-red-200 rounded-[10px] hover:bg-red-200 dark:hover:bg-red-700 transition-colors"
            >
              重试
            </button>
          </div>
        </div>
      )}

      {/* Main Content: Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-200px)] min-h-[600px]">
        {/* Left Column: Stock Info + Chart (2/3 width) */}
        <div className="lg:col-span-2 space-y-3 flex flex-col">
          {/* Stock Info - Compact Style */}
          <div className={`${APPLE_CARD_CLASS} p-5 shrink-0`}>
            {/* 股票标题区 */}
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-[28px] leading-none font-semibold tracking-[-0.02em] text-[#1d1d1f] dark:text-white">{stockName}</h1>
              <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-md">
                SH
              </span>
              <span className="text-sm text-[#8e8e93]">{symbol}</span>
              {/* 所属行业标签 */}
              {industry?.industry && (
                <span className="px-2 py-0.5 text-xs font-medium bg-[#f5f5f7] text-[#6e6e73] dark:bg-[#2c2c2e] dark:text-gray-300 rounded-md">
                  {industry.industry}
                </span>
              )}
              <button
                onClick={handleToggleWatchlist}
                disabled={addingToWatchlist || removingFromWatchlist}
                className={`ml-auto px-2 py-1 text-xs font-medium rounded transition-colors ${
                  inWatchlist
                    ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30'
                    : 'bg-[#f2f7ff] text-[#0a84ff] hover:bg-[#e8f1ff] dark:bg-primary-900/20 dark:text-primary-400 dark:hover:bg-primary-900/30'
                }`}
              >
                {watchlistButtonLabel}
              </button>
            </div>
            
            {/* 行业详细信息 */}
            {(industry?.sector || industry?.subIndustry || industry?.board) && (
              <div className="flex flex-wrap gap-2 mb-3 text-xs">
                {industry.sector && (
                  <span className="text-[#8e8e93]">
                    所属行业: <span className="text-[#3a3a3c] dark:text-gray-300">{industry.sector}</span>
                  </span>
                )}
                {industry.subIndustry && (
                  <span className="text-[#8e8e93]">
                    细分行业: <span className="text-[#3a3a3c] dark:text-gray-300">{industry.subIndustry}</span>
                  </span>
                )}
                {industry.board && (
                  <span className="text-[#8e8e93]">
                    板块: <span className="text-[#3a3a3c] dark:text-gray-300">{industry.board}</span>
                  </span>
                )}
              </div>
            )}

            {/* 价格显示区 */}
            <div className="mb-3">
              <PriceDisplay
                price={stockInfo.price}
                prevClose={stockInfo.prevClose}
                open={stockInfo.open}
                changePercent={stockInfo.changePercent}
                mode="full"
                breathing={true}
              />
              <p className="mt-1 text-xs text-[#8e8e93]">
                {isTradingHours() ? '交易中' : '已收盘'} {new Date().toLocaleDateString('zh-CN')} 北京时间
              </p>
            </div>

            {/* 详细数据网格 - Compact 2行4列 */}
            <div className="grid grid-cols-4 gap-y-2 gap-x-4 text-xs">
              <div className="flex justify-between">
                <span className="text-[#8e8e93]">今开</span>
                <span className="font-medium tabular-nums">{stockInfo.open.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8e8e93]">最高</span>
                <span className={`font-medium tabular-nums ${stockInfo.high > stockInfo.prevClose ? 'text-stock-up' : ''}`}>
                  {stockInfo.high.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8e8e93]">成交量</span>
                <span className="font-medium tabular-nums">{formatVolume(stockInfo.volume)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8e8e93]">总市值</span>
                <span className="font-medium tabular-nums">{formatMarketCap(valuation?.marketCap)}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-[#8e8e93]">昨收</span>
                <span className="font-medium tabular-nums">{stockInfo.prevClose.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8e8e93]">最低</span>
                <span className={`font-medium tabular-nums ${stockInfo.low < stockInfo.prevClose ? 'text-stock-down' : ''}`}>
                  {stockInfo.low.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8e8e93]">成交额</span>
                <span className="font-medium tabular-nums">{formatAmount(stockInfo.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8e8e93]">换手率</span>
                <span className="font-medium tabular-nums">{formatTurnoverRate(valuation?.turnoverRate)}</span>
              </div>

              {/* PE 市盈率 */}
              <div className="flex justify-between">
                <span className="text-[#8e8e93]">市盈率</span>
                <span className="font-medium tabular-nums">{formatRatio(valuation?.peTtm)}</span>
              </div>
              {/* PB 市净率 */}
              <div className="flex justify-between">
                <span className="text-[#8e8e93]">市净率</span>
                <span className="font-medium tabular-nums">{formatRatio(valuation?.pb)}</span>
              </div>
              {/* 流通市值 */}
              <div className="flex justify-between">
                <span className="text-[#8e8e93]">流通市值</span>
                <span className="font-medium tabular-nums">{formatMarketCap(valuation?.floatMarketCap)}</span>
              </div>
              {/* 股本 */}
              <div className="flex justify-between">
                <span className="text-[#8e8e93]">总股本</span>
                <span className="font-medium tabular-nums">{formatSharesInYi(valuation?.totalShares)}</span>
              </div>
            </div>
          </div>

          {/* Timeframe Selector */}
          <div className="flex flex-wrap gap-2 shrink-0">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setTimeframe(tf.value)}
                className={`px-3 py-1.5 text-sm font-medium rounded-[10px] transition-colors ${
                  timeframe === tf.value
                    ? 'bg-[#0a84ff] text-white shadow-sm'
                    : 'bg-[#f5f5f7] dark:bg-[#2c2c2e] text-[#3a3a3c] dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-[#eceef2] dark:hover:bg-[#3a3a3c]'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* Chart */}
          <div className={`${APPLE_CARD_CLASS} p-4 flex-1 min-h-0`}>
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0a84ff]"></div>
              </div>
            ) : (
              <div className="h-full">
                <KlineChart data={klineData} timeframe={timeframe} />
              </div>
            )}
          </div>
        </div>

        {/* Right Column: AI Chat (1/3 width) */}
        <div className="lg:col-span-1 h-full min-h-[500px]">
          <AIChat
            symbol={symbol}
            stockName={stockName}
            stockInfo={stockInfo}
          />
        </div>
      </div>
    </div>
  )
}
