import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { WatchlistItem } from '@/api/watchlist'
import { watchlistApi } from '@/api/watchlist'
import { useToast } from '@/hooks/useToast'
import { useWebSocketSubscription } from '@/hooks/useWebSocket'
import { useWebSocketStore } from '@/stores/websocket'
import StockSearch from '@/components/StockSearch'
import PriceDisplay from '@/components/PriceDisplay'
import { isTradingHours } from '@/utils/trading'
import { marketApi } from '@/api/market'
import { klineApi } from '@/api/kline'

interface WatchlistDisplayItem extends WatchlistItem {
  realtimeTimestamp?: number
}

const REALTIME_STALE_MS = 20000
const WATCHLIST_REFRESH_MS = 15000
const MARKET_STATUS_CHECK_MS = 30000

const WATCHLIST_PANEL_CLASS = 'glass-panel rounded-xl border border-fluid-outline-variant/30'

const normalizeSymbol = (symbol: string): string => {
  const digits = symbol.replaceAll(/\D/g, '')
  if (digits.length >= 1 && digits.length <= 6) {
    return digits.padStart(6, '0')
  }
  return symbol.trim()
}


function SortButton({ direction, onClick, active }: { direction: 'up' | 'down'; onClick: () => void; active: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md p-1 transition-colors hover:bg-fluid-surface-higher/70 ${active ? 'text-fluid-primary' : 'text-fluid-text-dim'}`}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {direction === 'up' ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        )}
      </svg>
    </button>
  )
}

function WatchlistRow({
  item,
  onDelete,
  onClick,
}: {
  item: WatchlistDisplayItem
  onDelete: (item: WatchlistDisplayItem) => void
  onClick: (symbol: string, market: string) => void
}) {
  const isUp = (item.changePercent || 0) >= 0
  const colorClass = isUp ? 'text-stock-up' : 'text-stock-down'
  const indicatorStrength = Math.min(3, Math.max(1, Math.ceil(Math.abs(item.changePercent || 0) / 3)))

  return (
    <tr className="group border-b border-fluid-outline-variant/15 transition-colors hover:bg-fluid-surface-higher/50">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-3">
          <span className="text-fluid-text-dim/70">⋮</span>
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-fluid-outline-variant/40 bg-fluid-surface-higher">
            <span className="text-[10px] font-mono-data text-fluid-text-muted">{item.name.slice(0, 1).toUpperCase()}</span>
          </div>
          <div>
            <div
              className="cursor-pointer text-[15px] font-semibold text-fluid-text transition-colors hover:text-fluid-primary"
              onClick={() => onClick(item.symbol, item.market)}
            >
              {item.name}
            </div>
            <div className="mt-0.5 text-[11px] font-mono-data uppercase tracking-wider text-fluid-text-dim">
              {item.symbol}/{item.market}
            </div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right">
        <PriceDisplay
          price={item.price ?? null}
          changePercent={item.changePercent ?? null}
          pulseKey={item.realtimeTimestamp}
          className="text-sm font-medium"
        />
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right">
        <div className={`text-sm font-medium ${colorClass}`}>
          {item.changePercent ? `${isUp ? '+' : ''}${item.changePercent.toFixed(2)}%` : '--'}
        </div>
        <div className={`text-xs ${colorClass}`}>
          {item.change ? `${isUp ? '+' : ''}${item.change.toFixed(2)}` : '--'}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-fluid-text-dim">
        {new Date(item.createdAt).toLocaleDateString('zh-CN')}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right">
        <div className="inline-flex items-center gap-2">
          {[0, 1, 2].map((idx) => (
            <span
              key={idx}
              className={`h-1.5 w-1.5 rounded-full ${idx < indicatorStrength ? 'bg-fluid-primary shadow-glow-primary' : 'bg-fluid-outline-variant/80'}`}
            />
          ))}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right">
        <div className="inline-flex w-[90px] justify-end gap-1 transition-all duration-200 opacity-100 md:opacity-20 md:group-hover:opacity-100">
          <button
            onClick={() => onClick(item.symbol, item.market)}
            className="rounded-[10px] p-2 text-fluid-text-dim transition-colors hover:bg-fluid-primary/10 hover:text-fluid-primary"
            title="分析"
            aria-label={`分析 ${item.name}`}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4v-4z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(item)}
            className="rounded-[10px] p-2 text-fluid-text-dim transition-colors hover:bg-fluid-secondary/10 hover:text-fluid-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fluid-secondary/60"
            title="删除"
            aria-label={`删除 ${item.name}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  )
}

export default function Watchlist() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [deletingItem, setDeletingItem] = useState<WatchlistDisplayItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [marketTrading, setMarketTrading] = useState<boolean>(isTradingHours())
  const [quickSymbol, setQuickSymbol] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ symbol: string; name: string; market: string }>>([])
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stockPrices = useWebSocketStore((state) => state.stockPrices)
  const connectionState = useWebSocketStore((state) => state.connectionState)

  const symbols = useMemo(() => watchlist.map((item) => normalizeSymbol(item.symbol)), [watchlist])

  useWebSocketSubscription(symbols, symbols.length > 0)

  const watchlistWithRealtime = useMemo<WatchlistDisplayItem[]>(() => {
    const now = Date.now()
    return watchlist.map((item) => {
      const realtimePrice = stockPrices.get(normalizeSymbol(item.symbol))
      const isRealtimeFresh =
        realtimePrice !== undefined && now - realtimePrice.timestamp <= REALTIME_STALE_MS

      if (isRealtimeFresh && realtimePrice) {
        return {
          ...item,
          price: realtimePrice.price,
          change: realtimePrice.change,
          changePercent: realtimePrice.changePercent,
          realtimeTimestamp: realtimePrice.timestamp,
        }
      }
      return item
    })
  }, [watchlist, stockPrices])

  const loadWatchlist = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false
    try {
      if (!silent) {
        setLoading(true)
      }
      const data = await watchlistApi.getWatchlist()
      setWatchlist(data || [])
    } catch {
      if (!silent) {
        showToast('加载自选股失败', 'error')
      }
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }, [showToast])

  useEffect(() => {
    loadWatchlist()
  }, [loadWatchlist])

  useEffect(() => {
    const intervalId = globalThis.setInterval(() => {
      setMarketTrading(isTradingHours())
    }, MARKET_STATUS_CHECK_MS)

    return () => {
      globalThis.clearInterval(intervalId)
    }
  }, [])

  // Click outside to close search dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Search stocks with debounce
  const handleSearchInput = useCallback((value: string) => {
    setQuickSymbol(value)

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    const trimmed = value.trim()
    if (!trimmed) {
      setSearchResults([])
      setShowSearchDropdown(false)
      return
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        // Check if input is 6-digit code, try getStockDetail first
        if (/^\d{6}$/.test(trimmed)) {
          try {
            const detail = await marketApi.getStockDetail(trimmed)
            if (detail) {
              setSearchResults([{ symbol: detail.symbol, name: detail.name, market: 'AShare' }])
              setShowSearchDropdown(true)
              setIsSearching(false)
              return
            }
          } catch {
            // Fall through to search
          }
        }

        // Search by name
        const results = await klineApi.searchStocks(trimmed, 5)
        if (results && results.length > 0) {
          setSearchResults(results.map((r) => ({ symbol: r.symbol, name: r.name, market: r.market })))
          setShowSearchDropdown(true)
        } else {
          setSearchResults([])
          setShowSearchDropdown(false)
        }
      } catch {
        setSearchResults([])
        setShowSearchDropdown(false)
      } finally {
        setIsSearching(false)
      }
    }, 300)
  }, [])

  useEffect(() => {
    const intervalId = globalThis.setInterval(() => {
      // Only refresh during trading hours when WebSocket is not connected
      // Non-trading hours: no need to refresh as prices don't change
      if (marketTrading && connectionState !== 'connected') {
        loadWatchlist({ silent: true })
      }
    }, WATCHLIST_REFRESH_MS)

    return () => {
      globalThis.clearInterval(intervalId)
    }
  }, [connectionState, loadWatchlist, marketTrading])

  const handleAddStock = async (symbol: string, name: string, market: string) => {
    const normalizedSymbol = normalizeSymbol(symbol)

    try {
      if (watchlist.some((item) => normalizeSymbol(item.symbol) === normalizedSymbol && item.market === market)) {
        showToast('该股票已在自选股中', 'warning')
        return
      }

      await watchlistApi.addToWatchlist({
        market,
        symbol: normalizedSymbol,
        name,
      })
      showToast('添加成功', 'success')
      setShowAddModal(false)
      await loadWatchlist()
    } catch {
      showToast('添加自选股失败', 'error')
    }
  }

  const handleDelete = async () => {
    if (!deletingItem || deleting) return
    try {
      setDeleting(true)
      await watchlistApi.removeFromWatchlist(deletingItem.id)
      showToast('删除成功', 'success')
      setWatchlist((prev) => prev.filter((item) => item.id !== deletingItem.id))
      setDeletingItem(null)
    } catch {
      showToast('删除失败', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })

    const sorted = [...watchlist].sort((a, b) => {
      let aValue: number | string = ''
      let bValue: number | string = ''

      switch (key) {
        case 'name':
          aValue = a.name
          bValue = b.name
          break
        case 'price':
          aValue = a.price || 0
          bValue = b.price || 0
          break
        case 'change':
          aValue = a.changePercent || 0
          bValue = b.changePercent || 0
          break
        case 'time':
          aValue = a.createdAt
          bValue = b.createdAt
          break
        default:
          return 0
      }

      if (aValue < bValue) return direction === 'asc' ? -1 : 1
      if (aValue > bValue) return direction === 'asc' ? 1 : -1
      return 0
    })

    setWatchlist(sorted)
  }

  const handleClickStock = (symbol: string, market: string) => {
    const item = watchlist.find((i) => i.symbol === symbol && i.market === market)
    if (item) {
      navigate(`/kline?symbol=${symbol}&market=${market}&name=${encodeURIComponent(item.name)}`)
    }
  }

  const handleSelectSearchResult = async (result: { symbol: string; name: string; market: string }) => {
    setShowSearchDropdown(false)
    setQuickSymbol('')
    await handleAddStock(result.symbol, result.name, result.market)
  }

  const handleQuickAdd = async () => {
    const trimmedInput = quickSymbol.trim()
    if (!trimmedInput) {
      setShowAddModal(true)
      return
    }

    // 如果有搜索结果，直接添加第一个
    if (searchResults.length > 0) {
      await handleSelectSearchResult(searchResults[0])
      return
    }

    showToast('请输入股票代码或名称进行搜索', 'warning')
  }

  const handleExport = () => {
    const rows = watchlistWithRealtime.map((item) => ({
      symbol: item.symbol,
      name: item.name,
      market: item.market,
      price: item.price ?? '',
      changePercent: item.changePercent ?? '',
      createdAt: item.createdAt,
    }))
    const header = 'symbol,name,market,price,changePercent,createdAt'
    const csv = [header, ...rows.map((r) => `${r.symbol},${r.name},${r.market},${r.price},${r.changePercent},${r.createdAt}`)].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `watchlist-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleBatchDelete = async () => {
    if (!watchlist.length) {
      showToast('当前没有可删除的自选股', 'warning')
      return
    }
    if (!window.confirm(`确认批量删除 ${watchlist.length} 条自选股吗？`)) {
      return
    }
    try {
      await Promise.all(watchlist.map((item) => watchlistApi.removeFromWatchlist(item.id)))
      showToast('批量删除成功', 'success')
      setWatchlist([])
    } catch {
      showToast('批量删除失败', 'error')
    }
  }

  const topPerformer = [...watchlistWithRealtime]
    .sort((a, b) => (b.changePercent || -Infinity) - (a.changePercent || -Infinity))[0]
  const mostVolatile = [...watchlistWithRealtime]
    .sort((a, b) => Math.abs(b.changePercent || 0) - Math.abs(a.changePercent || 0))[0]
  const topPerformerChange = topPerformer?.changePercent
  const topPerformerChangeClass =
    topPerformerChange == null
      ? 'text-fluid-text-dim'
      : topPerformerChange >= 0
        ? 'text-fluid-primary'
        : 'text-fluid-secondary'
  const topPerformerChangeLabel =
    topPerformerChange == null ? '--' : `${topPerformerChange >= 0 ? '+' : ''}${topPerformerChange.toFixed(2)}%`

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-4">
          <h1 className="font-headline text-5xl font-bold tracking-tight text-fluid-text">
            Watchlist <span className="text-fluid-primary">Management</span>
          </h1>
          <div className="mt-2 flex items-center gap-2 font-mono-data text-[10px] uppercase tracking-[0.22em] text-fluid-text-muted">
            <span className="inline-block h-2 w-2 rounded-full bg-fluid-primary shadow-glow-primary animate-pulse" />
            <span>
              System: {connectionState === 'connected' ? (marketTrading ? 'Connected' : 'Closed Market') : connectionState}
            </span>
            <span>•</span>
            <span>Latency: 0ms</span>
          </div>
        </div>
        <div className="lg:col-span-8">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div ref={searchContainerRef} className="relative flex-1">
              <input
                value={quickSymbol}
                onChange={(e) => handleSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    void handleQuickAdd()
                  }
                }}
                placeholder="搜索股票代码或名称..."
                className="glass-input h-11 w-full rounded-lg px-4 font-mono-data text-sm"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-fluid-primary border-t-transparent" />
                </div>
              )}
              {showSearchDropdown && searchResults.length > 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-lg border border-fluid-outline-variant/30 bg-fluid-surface shadow-lg">
                  {searchResults.map((result, index) => (
                    <button
                      key={`${result.symbol}-${index}`}
                      onClick={() => void handleSelectSearchResult(result)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-fluid-surface-higher first:rounded-t-lg last:rounded-b-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-fluid-text">{result.name}</span>
                        <span className="font-mono-data text-sm text-fluid-text-dim">{result.symbol}</span>
                      </div>
                      <span className="text-xs text-fluid-text-muted">{result.market}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => void handleQuickAdd()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-fluid-primary/50 bg-fluid-primary/10 px-4 font-mono-data text-xs uppercase tracking-widest text-fluid-primary transition-all hover:bg-fluid-primary/20 hover:shadow-glow-primary"
            >
              Quick Add
            </button>
          </div>
          <div className="mt-2 flex items-center justify-end gap-5 font-mono-data text-[10px] uppercase tracking-widest text-fluid-text-muted">
            <button onClick={handleExport} className="hover:text-fluid-text">Export</button>
            <button onClick={() => setShowAddModal(true)} className="hover:text-fluid-text">Import</button>
            <button onClick={() => void handleBatchDelete()} className="text-fluid-secondary hover:text-fluid-secondary/80">Batch Delete</button>
          </div>
        </div>
      </div>

      <div className={`${WATCHLIST_PANEL_CLASS} p-0`}>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8">
              <div className="animate-pulse space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <div className="h-10 w-10 rounded-[10px] bg-fluid-surface-higher"></div>
                    <div className="h-12 flex-1 rounded-[10px] bg-fluid-surface-higher"></div>
                  </div>
                ))}
              </div>
            </div>
          ) : watchlist.length === 0 ? (
            <div className="text-center py-16">
              <svg
                className="mb-4 mx-auto h-16 w-16 text-fluid-text-dim"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 19h16M7 15v3M11 11v7M15 13v5M19 9v9M6.5 10.5l3.5-3 3 2 4-4"
                />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 5h3v3" />
              </svg>
              <h3 className="mb-2 text-lg font-semibold text-fluid-text">暂无自选股</h3>
              <p className="mb-4 text-fluid-text-muted">从右上角 Quick Add 添加首只股票开始追踪</p>
              <button
                onClick={() => void handleQuickAdd()}
                className="rounded-[10px] border border-fluid-primary/50 bg-fluid-primary/10 px-4 py-2 text-fluid-primary transition-colors hover:bg-fluid-primary/20"
              >
                添加第一只股票
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-fluid-outline-variant/20 font-mono-data text-[10px] uppercase tracking-[0.2em] text-fluid-text-muted">
                    <th className="px-6 py-4 text-left">Asset / Symbol</th>
                    <th className="px-6 py-4 text-right">Current Price</th>
                    <th className="px-6 py-4 text-right">24h Change</th>
                    <th className="px-6 py-4 text-right">Added Date</th>
                    <th className="px-6 py-4 text-right">Indicators</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {watchlistWithRealtime.map((item) => (
                    <WatchlistRow
                      key={item.id}
                      item={item}
                      onDelete={setDeletingItem}
                      onClick={handleClickStock}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className={`${WATCHLIST_PANEL_CLASS} !rounded-none border-l-2 border-l-fluid-primary p-5`}>
            <div className="font-mono-data text-[10px] uppercase tracking-[0.18em] text-fluid-text-muted">Top Performer (24h)</div>
            <div className="mt-2 flex items-end justify-between">
              <span className="font-headline text-3xl font-bold text-fluid-text">{topPerformer?.symbol ?? '--'}</span>
              <span className={`font-mono-data text-sm font-semibold ${topPerformerChangeClass}`}>
                {topPerformerChangeLabel}
              </span>
            </div>
          </div>
          <div className={`${WATCHLIST_PANEL_CLASS} !rounded-none p-5`}>
            <div className="font-mono-data text-[10px] uppercase tracking-[0.18em] text-fluid-text-muted">Watchlist Health</div>
            <div className="mt-4 h-1.5 w-full overflow-hidden bg-fluid-outline-variant/40">
              <div
                className="h-full bg-fluid-primary"
                style={{
                  width: `${Math.min(100, Math.max(0, Math.round((watchlistWithRealtime.filter((i) => (i.changePercent || 0) >= 0).length / Math.max(1, watchlistWithRealtime.length)) * 100)))}%`,
                }}
              />
            </div>
            <div className="mt-2 flex justify-between font-mono-data text-[10px] uppercase tracking-widest text-fluid-text-muted">
              <span>Bull</span>
              <span>
                {Math.round((watchlistWithRealtime.filter((i) => (i.changePercent || 0) >= 0).length / Math.max(1, watchlistWithRealtime.length)) * 100)}%
              </span>
            </div>
          </div>
          <div className={`${WATCHLIST_PANEL_CLASS} !rounded-none border-l-2 border-l-fluid-secondary p-5`}>
            <div className="font-mono-data text-[10px] uppercase tracking-[0.18em] text-fluid-text-muted">Most Volatile</div>
            <div className="mt-2 flex items-end justify-between">
              <span className="font-headline text-3xl font-bold text-fluid-text">{mostVolatile?.symbol ?? '--'}</span>
              <span className="font-mono-data text-sm font-semibold text-fluid-text-muted">
                {mostVolatile?.changePercent ? `${Math.abs(mostVolatile.changePercent).toFixed(2)}%` : '--'}
              </span>
            </div>
          </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black/20 backdrop-blur-sm transition-opacity" onClick={() => setShowAddModal(false)}></div>
            <div className="relative w-full max-w-md rounded-[24px] border border-fluid-outline-variant/50 bg-fluid-surface-container p-6 shadow-[0_25px_60px_rgba(0,0,0,0.35)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-fluid-text">添加自选股</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-fluid-text-muted hover:text-fluid-text"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <StockSearch
                onSelect={(symbol, name, market) => {
                  handleAddStock(symbol, name, market || 'AShare')
                }}
              />
              <p className="mt-4 text-sm text-[#8e8e93] dark:text-gray-400">
                搜索股票代码或名称，点击即可添加到自选股
              </p>
            </div>
          </div>
        </div>
      )}

      {deletingItem && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div
              className="fixed inset-0 bg-black/30 backdrop-blur-sm transition-opacity"
              onClick={() => {
                if (!deleting) {
                  setDeletingItem(null)
                }
              }}
            />
            <div className="relative w-full max-w-[620px] rounded-[24px] border border-fluid-outline-variant/40 bg-fluid-surface-container shadow-[0_25px_60px_rgba(0,0,0,0.45)]">
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-fluid-secondary/10 text-fluid-secondary">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-fluid-text">确认删除</h3>
                    <p className="mt-2 text-sm text-fluid-text-muted sm:whitespace-nowrap">
                      将从自选列表移除
                      <span className="mx-1 font-semibold text-fluid-text">{deletingItem.name}</span>
                      ({deletingItem.symbol})。此操作不可撤销。
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-fluid-outline-variant/20 px-6 py-4">
                <button
                  onClick={() => setDeletingItem(null)}
                  disabled={deleting}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-fluid-outline-variant/40 bg-fluid-surface-higher px-5 text-sm font-medium text-fluid-text transition-colors hover:bg-fluid-surface-high disabled:opacity-60"
                >
                  取消
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex h-10 items-center justify-center rounded-full bg-fluid-secondary px-5 text-sm font-semibold text-white transition-colors hover:bg-fluid-secondary/90 disabled:opacity-60"
                >
                  {deleting ? '删除中...' : '确认删除'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
