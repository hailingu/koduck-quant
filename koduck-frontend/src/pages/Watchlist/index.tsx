import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { klineApi } from '@/api/kline'
import type { WatchlistItem } from '@/api/watchlist'
import { watchlistApi } from '@/api/watchlist'
import { useToast } from '@/hooks/useToast'
import StockSearch from '@/components/StockSearch'

// 排序按钮组件
function SortButton({ direction, onClick, active }: { direction: 'up' | 'down'; onClick: () => void; active: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${active ? 'text-primary-600' : 'text-gray-400'}`}
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

// 自选股行组件
function WatchlistRow({
  item,
  onDelete,
  onUpdateNotes,
  onClick,
}: {
  item: WatchlistItem
  onDelete: (id: number) => void
  onUpdateNotes: (id: number, notes: string) => void
  onClick: (symbol: string, market: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editNotes, setEditNotes] = useState(item.note || '')
  const isUp = (item.changePercent || 0) >= 0
  const colorClass = isUp ? 'text-stock-up' : 'text-stock-down'

  const handleSaveNotes = () => {
    onUpdateNotes(item.id, editNotes)
    setIsEditing(false)
  }

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mr-3">
            <span className="text-xs font-bold text-primary-600 dark:text-primary-400">{item.market}</span>
          </div>
          <div>
            <div
              className="text-sm font-medium text-gray-900 dark:text-white cursor-pointer hover:text-primary-600"
              onClick={() => onClick(item.symbol, item.market)}
            >
              {item.name}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{item.symbol}</div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right">
        <div className="text-sm font-medium text-gray-900 dark:text-white">
          {item.price ? item.price.toFixed(2) : '--'}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right">
        <div className={`text-sm font-medium ${colorClass}`}>
          {item.changePercent ? `${isUp ? '+' : ''}${item.changePercent.toFixed(2)}%` : '--'}
        </div>
        <div className={`text-xs ${colorClass}`}>
          {item.change ? `${isUp ? '+' : ''}${item.change.toFixed(2)}` : '--'}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="添加备注..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveNotes()
                if (e.key === 'Escape') setIsEditing(false)
              }}
            />
            <button
              onClick={handleSaveNotes}
              className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>
            <button
              onClick={() => {
                setIsEditing(false)
                setEditNotes(item.note || '')
              }}
              className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <div
            className="text-sm text-gray-500 dark:text-gray-400 cursor-pointer hover:text-primary-600 flex items-center gap-1"
            onClick={() => setIsEditing(true)}
          >
            {item.note || (
              <span className="text-gray-400 dark:text-gray-600 italic">点击添加备注</span>
            )}
            {!item.note && (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            )}
          </div>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500 dark:text-gray-400">
        {new Date(item.createdAt).toLocaleDateString('zh-CN')}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right">
        <button
          onClick={() => onDelete(item.id)}
          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          title="删除"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
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
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)

  // 加载自选股列表
  const loadWatchlist = useCallback(async () => {
    try {
      setLoading(true)
      const data = await watchlistApi.getWatchlist()
      setWatchlist(data || [])

      // 加载实时价格
      if (data && data.length > 0) {
        const withPrices = await Promise.all(
          data.map(async (item) => {
            try {
              const priceData = await klineApi.getLatestPrice({
                market: item.market,
                symbol: item.symbol,
              })
              return {
                ...item,
                price: priceData?.price || 0,
              }
            } catch {
              return item
            }
          })
        )
        setWatchlist(withPrices)
      }
    } catch (error) {
      showToast('加载自选股失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    loadWatchlist()
  }, [loadWatchlist])

  // 添加自选股
  const handleAddStock = async (symbol: string, name: string, market: string) => {
    try {
      // 检查是否已存在
      if (watchlist.some((item) => item.symbol === symbol && item.market === market)) {
        showToast('该股票已在自选股中', 'warning')
        return
      }

      await watchlistApi.addToWatchlist({
        market,
        symbol,
        name,
      })
      showToast('添加成功', 'success')
      setShowAddModal(false)
      loadWatchlist()
    } catch (error) {
      showToast('添加失败', 'error')
    }
  }

  // 删除自选股
  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这只股票吗？')) return

    try {
      await watchlistApi.removeFromWatchlist(id)
      showToast('删除成功', 'success')
      setWatchlist((prev) => prev.filter((item) => item.id !== id))
    } catch (error) {
      showToast('删除失败', 'error')
    }
  }

  // 更新备注
  const handleUpdateNotes = async (id: number, notes: string) => {
    try {
      await watchlistApi.updateNotes(id, notes)
      setWatchlist((prev) => prev.map((item) => (item.id === id ? { ...item, note: notes } : item)))
      showToast('备注更新成功', 'success')
    } catch (error) {
      showToast('更新备注失败', 'error')
    }
  }

  // 排序
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

  // 跳转K线
  const handleClickStock = (symbol: string, market: string) => {
    const item = watchlist.find((i) => i.symbol === symbol && i.market === market)
    if (item) {
      navigate(`/kline?symbol=${symbol}&market=${market}&name=${encodeURIComponent(item.name)}`)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">自选股</h2>
          <p className="mt-1 text-gray-600 dark:text-gray-400">管理您的关注股票列表</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          添加股票
        </button>
      </div>

      {/* Stats Card */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">{watchlist.length}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">自选股总数</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-stock-up">
              {watchlist.filter((i) => (i.changePercent || 0) > 0).length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">上涨</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-stock-down">
              {watchlist.filter((i) => (i.changePercent || 0) < 0).length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">下跌</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-600 dark:text-gray-400">
              {watchlist.filter((i) => (i.changePercent || 0) === 0).length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">平盘</div>
          </div>
        </div>
      </div>

      {/* Watchlist Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-8">
            <div className="animate-pulse space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                  <div className="flex-1 h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              ))}
            </div>
          </div>
        ) : watchlist.length === 0 ? (
          <div className="text-center py-16">
            <svg
              className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">暂无自选股</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">点击上方按钮添加您关注的股票</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
            >
              添加第一只股票
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <button
                      className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200"
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
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <button
                      className="flex items-center justify-end gap-1 hover:text-gray-700 dark:hover:text-gray-200 ml-auto"
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
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <button
                      className="flex items-center justify-end gap-1 hover:text-gray-700 dark:hover:text-gray-200 ml-auto"
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    备注
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <button
                      className="flex items-center justify-end gap-1 hover:text-gray-700 dark:hover:text-gray-200 ml-auto"
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
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {watchlist.map((item) => (
                  <WatchlistRow
                    key={item.id}
                    item={item}
                    onDelete={handleDelete}
                    onUpdateNotes={handleUpdateNotes}
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
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowAddModal(false)}></div>
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">添加自选股</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
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
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                搜索股票代码或名称，点击即可添加到自选股
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
