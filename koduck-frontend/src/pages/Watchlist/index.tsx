// Watchlist Page - Fluid Ledger Design
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { WatchlistItem } from '@/api/watchlist'
import { watchlistApi } from '@/api/watchlist'
import { useToast } from '@/hooks/useToast'
import { useWebSocketSubscription } from '@/hooks/useWebSocket'
import { useWebSocketStore } from '@/stores/websocket'
import StockSearch from '@/components/StockSearch'
import { isTradingHours } from '@/utils/trading'

interface WatchlistDisplayItem extends WatchlistItem {
  realtimeTimestamp?: number
}

const REALTIME_STALE_MS = 20000
const WATCHLIST_REFRESH_MS = 15000

const normalizeSymbol = (symbol: string): string => {
  const digits = symbol.replaceAll(/\D/g, '')
  if (digits.length >= 1 && digits.length <= 6) {
    return digits.padStart(6, '0')
  }
  return symbol.trim()
}

// Watchlist Row Component
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
  const colorClass = isUp ? 'text-fluid-primary' : 'text-fluid-secondary'

  return (
    <tr className="group hover:bg-fluid-surface-container/50 transition-colors cursor-pointer" onClick={() => onClick(item.symbol, item.market)}>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-fluid-surface-container flex items-center justify-center">
            <span className="text-xs font-mono-data text-fluid-text">{item.symbol.slice(0, 2)}</span>
          </div>
          <div>
            <div className="text-sm font-medium text-fluid-text">{item.name}</div>
            <div className="text-xs text-fluid-text-dim font-mono-data">{item.symbol}</div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right">
        <div className="text-sm font-mono-data text-fluid-text">
          {item.price ? item.price.toFixed(2) : '--'}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right">
        <div className={`text-sm font-mono-data ${colorClass}`}>
          {item.changePercent ? `${isUp ? '+' : ''}${item.changePercent.toFixed(2)}%` : '--'}
        </div>
        <div className={`text-xs font-mono-data ${colorClass}`}>
          {item.change ? `${isUp ? '+' : ''}${item.change.toFixed(2)}` : '--'}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-xs text-fluid-text-dim font-mono-data">
        {new Date(item.createdAt).toLocaleDateString('zh-CN')}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete(item)
          }}
          className="p-2 rounded-lg text-fluid-text-dim hover:text-fluid-secondary hover:bg-fluid-secondary/10 transition-colors opacity-0 group-hover:opacity-100"
        >
          <span className="material-symbols-outlined text-lg">delete</span>
        </button>
      </td>
    </tr>
  )
}

export default function Watchlist() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [deletingItem, setDeletingItem] = useState<WatchlistDisplayItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [marketTrading, setMarketTrading] = useState<boolean>(isTradingHours())

  const stockPrices = useWebSocketStore((state) => state.stockPrices)
  const connectionState = useWebSocketStore((state) => state.connectionState)

  const symbols = useMemo(() => watchlist.map((item) => normalizeSymbol(item.symbol)), [watchlist])
  useWebSocketSubscription(symbols, symbols.length > 0)

  const watchlistWithRealtime = useMemo<WatchlistDisplayItem[]>(() => {
    const now = Date.now()
    return watchlist.map((item) => {
      const realtimePrice = stockPrices.get(normalizeSymbol(item.symbol))
      const isRealtimeFresh = realtimePrice !== undefined && now - realtimePrice.timestamp <= REALTIME_STALE_MS

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
      if (!silent) setLoading(true)
      const data = await watchlistApi.getWatchlist()
      setWatchlist(data || [])
    } catch {
      if (!silent) showToast('Failed to load watchlist', 'error')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    loadWatchlist()
  }, [loadWatchlist])

  useEffect(() => {
    const intervalId = globalThis.setInterval(() => {
      setMarketTrading(isTradingHours())
    }, 30000)
    return () => globalThis.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    const intervalId = globalThis.setInterval(() => {
      if (connectionState !== 'connected' || marketTrading) {
        loadWatchlist({ silent: true })
      }
    }, WATCHLIST_REFRESH_MS)
    return () => globalThis.clearInterval(intervalId)
  }, [connectionState, loadWatchlist, marketTrading])

  const handleAddStock = async (symbol: string, name: string, market: string) => {
    const normalizedSymbol = normalizeSymbol(symbol)
    try {
      if (watchlist.some((item) => normalizeSymbol(item.symbol) === normalizedSymbol && item.market === market)) {
        showToast('Stock already in watchlist', 'warning')
        return
      }
      await watchlistApi.addToWatchlist({ market, symbol: normalizedSymbol, name })
      showToast('Added successfully', 'success')
      setShowAddModal(false)
      await loadWatchlist()
    } catch {
      showToast('Failed to add stock', 'error')
    }
  }

  const handleDelete = async () => {
    if (!deletingItem || deleting) return
    try {
      setDeleting(true)
      await watchlistApi.removeFromWatchlist(deletingItem.id)
      showToast('Deleted successfully', 'success')
      setWatchlist((prev) => prev.filter((item) => item.id !== deletingItem.id))
      setDeletingItem(null)
    } catch {
      showToast('Failed to delete', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handleClickStock = (symbol: string, market: string) => {
    navigate(`/kline?symbol=${symbol}&market=${market}`)
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight text-fluid-text">
            Watchlist
          </h1>
          <p className="text-fluid-text-muted mt-1">Track your favorite assets in real-time</p>
        </div>
        <div className="flex items-center gap-3">
          {connectionState === 'connected' && marketTrading && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono-data text-fluid-primary bg-fluid-primary/10">
              <span className="w-1.5 h-1.5 rounded-full bg-fluid-primary animate-pulse" />
              LIVE
            </span>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-fluid-primary text-fluid-surface-container-lowest font-medium text-sm rounded-lg hover:shadow-glow-primary transition-all"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Add Stock
          </button>
        </div>
      </div>

      {/* Watchlist Table */}
      <div className="glass-panel rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="w-10 h-10 bg-fluid-surface-container rounded-lg" />
                <div className="flex-1 h-12 bg-fluid-surface-container rounded-lg" />
              </div>
            ))}
          </div>
        ) : watchlist.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-fluid-surface-container flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl text-fluid-text-dim">star_outline</span>
            </div>
            <h3 className="text-lg font-medium text-fluid-text mb-2">No stocks in watchlist</h3>
            <p className="text-fluid-text-muted mb-4">Add your first stock to start tracking</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-fluid-primary text-fluid-surface-container-lowest rounded-lg font-medium hover:shadow-glow-primary transition-all"
            >
              Add First Stock
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-fluid-surface-container/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-mono-data text-fluid-text-muted uppercase tracking-wider">Stock</th>
                  <th className="px-6 py-3 text-right text-xs font-mono-data text-fluid-text-muted uppercase tracking-wider">Price</th>
                  <th className="px-6 py-3 text-right text-xs font-mono-data text-fluid-text-muted uppercase tracking-wider">Change</th>
                  <th className="px-6 py-3 text-right text-xs font-mono-data text-fluid-text-muted uppercase tracking-wider">Added</th>
                  <th className="px-6 py-3 text-right text-xs font-mono-data text-fluid-text-muted uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fluid-outline-variant/10">
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

      {/* Add Stock Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative w-full max-w-md glass-panel p-6 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-headline font-semibold text-fluid-text">Add Stock</h3>
              <button onClick={() => setShowAddModal(false)} className="text-fluid-text-dim hover:text-fluid-text">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <StockSearch onSelect={(symbol, name, market) => handleAddStock(symbol, name, market || 'AShare')} />
            <p className="mt-4 text-xs text-fluid-text-muted">Search by stock code or name</p>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !deleting && setDeletingItem(null)} />
          <div className="relative w-full max-w-md glass-panel p-6 rounded-xl">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-fluid-secondary/20 text-fluid-secondary">
                <span className="material-symbols-outlined">warning</span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-headline font-semibold text-fluid-text">Remove Stock</h3>
                <p className="mt-2 text-sm text-fluid-text-muted">
                  Remove <span className="text-fluid-text font-medium">{deletingItem.name}</span> ({deletingItem.symbol}) from watchlist?
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setDeletingItem(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm font-medium text-fluid-text hover:bg-fluid-surface-container transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-fluid-secondary text-white hover:bg-fluid-secondary/90 transition-colors"
              >
                {deleting ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
