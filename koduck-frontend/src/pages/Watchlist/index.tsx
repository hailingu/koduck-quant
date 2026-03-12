import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { WatchlistItem } from '@/api/watchlist'
import { watchlistApi } from '@/api/watchlist'
import { useToast } from '@/hooks/useToast'
import { useWebSocketSubscription } from '@/hooks/useWebSocket'
import { useWebSocketStore } from '@/stores/websocket'
import StockSearch from '@/components/StockSearch'
import PriceDisplay from '@/components/PriceDisplay'
import { isTradingHours } from '@/utils/trading'

interface WatchlistDisplayItem extends WatchlistItem {
  realtimeTimestamp?: number
}

const REALTIME_STALE_MS = 20000
const WATCHLIST_REFRESH_MS = 15000
const MARKET_STATUS_CHECK_MS = 30000

const APPLE_CARD_CLASS =
  'bg-white dark:bg-[#1c1c1e] rounded-[24px] shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100 dark:border-white/5'

const normalizeSymbol = (symbol: string): string => {
  const digits = symbol.replaceAll(/\D/g, '')
  if (digits.length >= 1 && digits.length <= 6) {
    return digits.padStart(6, '0')
  }
  return symbol.trim()
}


// 
function SortButton({ direction, onClick, active }: { direction: 'up' | 'down'; onClick: () => void; active: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`p-1 rounded-md transition-colors hover:bg-[#eceef2] dark:hover:bg-[#2c2c2e] ${active ? 'text-[#0a84ff]' : 'text-[#8e8e93]'}`}
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

// 
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

  return (
    <tr className="group hover:bg-gray-50/60 dark:hover:bg-white/5 transition-colors">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div>
            <div
              className="text-[15px] font-medium text-[#1d1d1f] dark:text-white cursor-pointer hover:text-[#0a84ff] transition-colors"
              onClick={() => onClick(item.symbol, item.market)}
            >
              {item.name}
            </div>
            <div className="text-[13px] text-[#8e8e93] dark:text-gray-400 mt-0.5">{item.symbol}</div>
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
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500 dark:text-gray-400">
        {new Date(item.createdAt).toLocaleDateString('zh-CN')}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right">
        <div
          className="
            inline-flex w-[52px] justify-end
            transition-all duration-200
            opacity-100 translate-x-0
            md:opacity-30 md:translate-x-1
            md:group-hover:opacity-100 md:group-hover:translate-x-0
            md:group-focus-within:opacity-100 md:group-focus-within:translate-x-0
          "
        >
          <button
            onClick={() => onDelete(item)}
            className="text-red-500 hover:text-red-600 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-[10px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
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

  // WebSocket store for real-time price updates
  const stockPrices = useWebSocketStore((state) => state.stockPrices)
  const connectionState = useWebSocketStore((state) => state.connectionState)

  // Get symbols from watchlist for WebSocket subscription
  const symbols = useMemo(() => watchlist.map((item) => normalizeSymbol(item.symbol)), [watchlist])

  // Use WebSocket subscription hook (auto-subscribes when watchlist has items)
  useWebSocketSubscription(symbols, symbols.length > 0)

  // Merge watchlist with real-time prices from WebSocket
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

  // （ price/change/changePercent，）
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

  useEffect(() => {
    const intervalId = globalThis.setInterval(() => {
      // Trading hours keeps values changing quickly; outside hours this is lightweight fallback.
      if (connectionState !== 'connected' || marketTrading) {
        loadWatchlist({ silent: true })
      }
    }, WATCHLIST_REFRESH_MS)

    return () => {
      globalThis.clearInterval(intervalId)
    }
  }, [connectionState, loadWatchlist, marketTrading])

  // 
  const handleAddStock = async (symbol: string, name: string, market: string) => {
    const normalizedSymbol = normalizeSymbol(symbol)

    try {
      // 
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

  // 
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

  // 
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

  // K
  const handleClickStock = (symbol: string, market: string) => {
    const item = watchlist.find((i) => i.symbol === symbol && i.market === market)
    if (item) {
      navigate(`/kline?symbol=${symbol}&market=${market}&name=${encodeURIComponent(item.name)}`)
    }
  }

  return (
    <div className="space-y-6 [font-family:-apple-system,BlinkMacSystemFont,'SF_Pro_Text','Helvetica_Neue','Segoe_UI',sans-serif]">
      {/* Watchlist Table */}
      <div className={`${APPLE_CARD_CLASS} p-6 flex flex-col`}>
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="inline-flex bg-gray-100 dark:bg-gray-800 p-0.5 rounded-[10px]">
              <span className="px-4 py-1.5 rounded-[8px] text-[14px] font-medium bg-white text-[#1d1d1f] shadow-sm dark:bg-[#2c2c2e] dark:text-white">
                自选列表
              </span>
            </div>
            {connectionState === 'connected' && marketTrading && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                <span className="w-1.5 h-1.5 mr-1 rounded-full bg-green-500 animate-pulse"></span>
                实时
              </span>
            )}
            {connectionState === 'connected' && !marketTrading && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400">
                <span className="w-1.5 h-1.5 mr-1 rounded-full bg-gray-400"></span>
                已收盘
              </span>
            )}
            {connectionState === 'reconnecting' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                <span className="w-1.5 h-1.5 mr-1 rounded-full bg-yellow-500 animate-pulse"></span>
                重连中
              </span>
            )}
            {connectionState === 'disconnected' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400">
                <span className="w-1.5 h-1.5 mr-1 rounded-full bg-gray-400"></span>
                离线
              </span>
            )}
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex h-8 items-center justify-center gap-1.5 px-3.5 rounded-full bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-white font-medium text-[13px] shadow-sm border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-[#2c2c2e] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            添加股票
          </button>
        </div>

        <div className="overflow-x-auto -mx-6 px-6">
          {loading ? (
            <div className="p-8">
              <div className="animate-pulse space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-[#eceef2] dark:bg-[#2c2c2e] rounded-[10px]"></div>
                    <div className="flex-1 h-12 bg-[#eceef2] dark:bg-[#2c2c2e] rounded-[10px]"></div>
                  </div>
                ))}
              </div>
            </div>
          ) : watchlist.length === 0 ? (
            <div className="text-center py-16">
              <svg
                className="w-16 h-16 mx-auto text-[#c7c7cc] dark:text-gray-600 mb-4"
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
              <h3 className="text-lg font-medium text-[#1d1d1f] dark:text-white mb-2"></h3>
              <p className="text-[#8e8e93] dark:text-gray-400 mb-4"></p>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 rounded-[10px] bg-[#0a84ff] hover:bg-[#0077ed] text-white transition-colors"
              >
                添加第一只股票
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 dark:divide-white/10">
                <thead className="bg-[#fbfbfd] dark:bg-[#232326]">
                  <tr>
                    <th className="px-6 py-3 text-left text-[13px] font-medium text-[#8e8e93] dark:text-gray-400">
                      <button
                        className="flex items-center gap-1 hover:text-[#3a3a3c] dark:hover:text-gray-200"
                        onClick={() => handleSort('name')}
                      >
                        股票名称
                        <SortButton
                          direction={sortConfig?.key === 'name' && sortConfig.direction === 'asc' ? 'up' : 'down'}
                          onClick={() => handleSort('name')}
                          active={sortConfig?.key === 'name'}
                        />
                      </button>
                    </th>
                    <th className="px-6 py-3 text-right text-[13px] font-medium text-[#8e8e93] dark:text-gray-400">
                      <button
                        className="flex items-center justify-end gap-1 hover:text-[#3a3a3c] dark:hover:text-gray-200 ml-auto"
                        onClick={() => handleSort('price')}
                      >
                        最新价
                        <SortButton
                          direction={sortConfig?.key === 'price' && sortConfig.direction === 'asc' ? 'up' : 'down'}
                          onClick={() => handleSort('price')}
                          active={sortConfig?.key === 'price'}
                        />
                      </button>
                    </th>
                    <th className="px-6 py-3 text-right text-[13px] font-medium text-[#8e8e93] dark:text-gray-400">
                      <button
                        className="flex items-center justify-end gap-1 hover:text-[#3a3a3c] dark:hover:text-gray-200 ml-auto"
                        onClick={() => handleSort('change')}
                      >
                        涨跌幅
                        <SortButton
                          direction={sortConfig?.key === 'change' && sortConfig.direction === 'asc' ? 'up' : 'down'}
                          onClick={() => handleSort('change')}
                          active={sortConfig?.key === 'change'}
                        />
                      </button>
                    </th>
                    <th className="px-6 py-3 text-right text-[13px] font-medium text-[#8e8e93] dark:text-gray-400">
                      <button
                        className="flex items-center justify-end gap-1 hover:text-[#3a3a3c] dark:hover:text-gray-200 ml-auto"
                        onClick={() => handleSort('time')}
                      >
                        添加时间
                        <SortButton
                          direction={sortConfig?.key === 'time' && sortConfig.direction === 'asc' ? 'up' : 'down'}
                          onClick={() => handleSort('time')}
                          active={sortConfig?.key === 'time'}
                        />
                      </button>
                    </th>
                    <th className="px-6 py-3 text-right text-[13px] font-medium text-[#8e8e93] dark:text-gray-400">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-[#1c1c1e] divide-y divide-gray-100 dark:divide-white/10">
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

      {/* Add Stock Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black/20 backdrop-blur-sm transition-opacity" onClick={() => setShowAddModal(false)}></div>
            <div className="relative max-w-md w-full p-6 bg-white dark:bg-[#1c1c1e] rounded-[24px] shadow-[0_25px_60px_rgba(0,0,0,0.15)] ring-1 ring-black/5 dark:ring-white/10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[#1d1d1f] dark:text-white"></h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-[#8e8e93] hover:text-[#6e6e73] dark:hover:text-gray-300"
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

      {/* Delete Confirmation Modal */}
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
            <div className="relative w-full max-w-[620px] rounded-[24px] border border-gray-200/80 dark:border-white/10 bg-white dark:bg-[#1c1c1e] shadow-[0_25px_60px_rgba(0,0,0,0.2)]">
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-[#1d1d1f] dark:text-white"></h3>
                    <p className="mt-2 text-sm text-[#6e6e73] dark:text-gray-300 sm:whitespace-nowrap">
                      将从自选列表移除
                      <span className="mx-1 font-semibold text-[#1d1d1f] dark:text-white">{deletingItem.name}</span>
                      ({deletingItem.symbol})。此操作不可撤销。
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-gray-100 dark:border-white/10 px-6 py-4">
                <button
                  onClick={() => setDeletingItem(null)}
                  disabled={deleting}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-gray-200 dark:border-white/15 bg-white dark:bg-[#2c2c2e] px-5 text-sm font-medium text-[#3a3a3c] dark:text-gray-100 transition-colors hover:bg-gray-50 disabled:opacity-60"
                >
                  取消
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex h-10 items-center justify-center rounded-full bg-red-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
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
