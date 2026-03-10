import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import * as echarts from 'echarts'
import type { WatchlistItem } from '@/api/watchlist'
import { watchlistApi } from '@/api/watchlist'
import type { MarketIndex } from '@/api/dashboard'
import { dashboardApi } from '@/api/dashboard'
import type { PortfolioSummary, TradeRecord } from '@/api/portfolio'
import { portfolioApi } from '@/api/portfolio'
import { useWebSocketStore } from '@/stores/websocket'
import { useWebSocketSubscription } from '@/hooks/useWebSocket'
import { useToast } from '@/hooks/useToast'

const normalizeSymbol = (value: string): string => {
  const digits = value.replaceAll(/\D/g, '')
  if (digits.length >= 1 && digits.length <= 6) {
    return digits.padStart(6, '0')
  }
  return value.trim().toUpperCase()
}

// 数字格式化
const formatNumber = (num: number, decimals: number = 2) => {
  return num.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

// 金额格式化
const formatMoney = (num: number) => {
  if (Math.abs(num) >= 100000000) {
    return `${(num / 100000000).toFixed(2)}亿`
  } else if (Math.abs(num) >= 10000) {
    return `${(num / 10000).toFixed(2)}万`
  }
  return formatNumber(num)
}

// 市场指数卡片组件
function IndexCard({ index, loading }: { index: MarketIndex; loading: boolean }) {
  const change = index.change ?? 0
  const changePercent = index.changePercent ?? 0
  const isUp = change >= 0
  const colorClass = isUp ? 'text-stock-up' : 'text-stock-down'
  const bgClass = isUp ? 'bg-stock-up/10' : 'bg-stock-down/10'

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{index.name}</span>
        <span className={`text-xs px-2 py-1 rounded ${bgClass} ${colorClass}`}>
          {index.symbol}
        </span>
      </div>
      {loading ? (
        <div className="animate-pulse">
          <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
        </div>
      ) : (
        <>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {(index.price ?? 0) > 0 ? index.price!.toFixed(2) : '--'}
          </div>
          <div className={`flex items-center gap-1 text-sm ${colorClass}`}>
            <span>{isUp ? '+' : ''}{change.toFixed(2)}</span>
            <span>({isUp ? '+' : ''}{changePercent.toFixed(2)}%)</span>
          </div>
        </>
      )}
    </div>
  )
}

// 资产卡片组件
function AssetCard({
  title,
  value,
  subValue,
  isPositive,
  icon,
  loading,
}: {
  title: string
  value: string
  subValue?: string
  isPositive?: boolean
  icon: React.ReactNode
  loading?: boolean
}) {
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">{icon}</div>
      </div>
      <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">{title}</div>
      {loading ? (
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2"></div>
        </div>
      ) : (
        <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
      )}
      {subValue && !loading && (
        <div className={`text-sm mt-2 ${isPositive ? 'text-stock-up' : 'text-stock-down'}`}>
          {subValue}
        </div>
      )}
    </div>
  )
}

// 快捷入口按钮组件
function QuickActionButton({
  icon,
  label,
  onClick,
  variant = 'primary',
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary'
}) {
  const baseClasses =
    'flex items-center gap-3 p-4 rounded-xl transition-all duration-200 cursor-pointer group'
  const variantClasses =
    variant === 'primary'
      ? 'bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 border border-primary-200 dark:border-primary-800'
      : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'

  return (
    <button onClick={onClick} className={`${baseClasses} ${variantClasses}`}>
      <div
        className={`p-2 rounded-lg ${
          variant === 'primary'
            ? 'bg-primary-100 dark:bg-primary-800 text-primary-600 dark:text-primary-400'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
        }`}
      >
        {icon}
      </div>
      <span
        className={`font-medium ${
          variant === 'primary'
            ? 'text-primary-700 dark:text-primary-300'
            : 'text-gray-700 dark:text-gray-300'
        }`}
      >
        {label}
      </span>
      <svg
        className={`w-5 h-5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity ${
          variant === 'primary' ? 'text-primary-500' : 'text-gray-400'
        }`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}

// 自选股列表项组件
function WatchlistPreviewItem({ item }: { item: WatchlistItem }) {
  const navigate = useNavigate()
  const isUp = (item.changePercent || 0) >= 0
  const colorClass = isUp ? 'text-stock-up' : 'text-stock-down'

  return (
    <div
      onClick={() => navigate(`/kline?symbol=${item.symbol}&market=${item.market}`)}
      className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
          <span className="text-xs font-bold text-primary-600 dark:text-primary-400">
            {item.market}
          </span>
        </div>
        <div>
          <div className="font-medium text-gray-900 dark:text-white">{item.name}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">{item.symbol}</div>
        </div>
      </div>
      <div className="text-right">
        <div className="font-medium text-gray-900 dark:text-white">
          {item.price ? item.price.toFixed(2) : '--'}
        </div>
        <div className={`text-sm ${colorClass}`}>
          {item.changePercent ? `${isUp ? '+' : ''}${item.changePercent.toFixed(2)}%` : '--'}
        </div>
      </div>
    </div>
  )
}

// 交易记录行组件
function TradeRow({ record }: { record: TradeRecord }) {
  const isBuy = record.type === 'BUY'
  return (
    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
      <div className="flex items-center gap-3">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
            isBuy ? 'bg-stock-up/10 text-stock-up' : 'bg-stock-down/10 text-stock-down'
          }`}
        >
          {isBuy ? '买' : '卖'}
        </div>
        <div>
          <div className="font-medium text-gray-900 dark:text-white">{record.name}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {record.quantity}股 @ {formatNumber(record.price)}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="font-medium text-gray-900 dark:text-white">{formatMoney(record.amount)}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {new Date(record.tradeTime).toLocaleDateString('zh-CN')}
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [indices, setIndices] = useState<MarketIndex[]>([])
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null)
  const [trades, setTrades] = useState<TradeRecord[]>([])
  const stockPrices = useWebSocketStore((state) => state.stockPrices)
  const connectionState = useWebSocketStore((state) => state.connectionState)

  const subscriptionSymbols = useMemo(() => {
    const combined = [
      ...watchlist.map((item) => normalizeSymbol(item.symbol)),
      ...indices.map((item) => normalizeSymbol(item.symbol)),
    ]
    return Array.from(new Set(combined))
  }, [watchlist, indices])

  useWebSocketSubscription(subscriptionSymbols, subscriptionSymbols.length > 0)

  const watchlistWithRealtime = useMemo(
    () =>
      watchlist.map((item) => {
        const realtime = stockPrices.get(normalizeSymbol(item.symbol))
        if (!realtime) {
          return item
        }
        return {
          ...item,
          price: realtime.price,
          change: realtime.change,
          changePercent: realtime.changePercent,
        }
      }),
    [watchlist, stockPrices]
  )

  const indicesWithRealtime = useMemo(
    () =>
      indices.map((item) => {
        const realtime = stockPrices.get(normalizeSymbol(item.symbol))
        if (!realtime) {
          return item
        }
        return {
          ...item,
          price: realtime.price,
          change: realtime.change,
          changePercent: realtime.changePercent,
        }
      }),
    [indices, stockPrices]
  )

  // 图表引用
  const miniChartRef = useRef<HTMLDivElement>(null)
  const miniChartInstance = useRef<echarts.ECharts | null>(null)

  // 加载数据
  const loadData = useCallback(async () => {
    try {
      setLoading(true)

      // 并行加载所有数据
      const [indicesRes, watchlistRes, summaryRes, tradesRes] = await Promise.all([
        dashboardApi.getMarketIndices(),
        watchlistApi.getWatchlist(),
        portfolioApi.getPortfolioSummary().catch(() => null),
        portfolioApi.getTradeRecords().catch(() => []),
      ])

      setIndices(indicesRes || [])
      setWatchlist(watchlistRes || [])
      setPortfolioSummary(summaryRes)
      setTrades(tradesRes.slice(0, 5))
    } catch (error) {
      showToast('加载数据失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 初始化迷你收益图
  useEffect(() => {
    if (loading || !miniChartRef.current || !portfolioSummary) return

    miniChartInstance.current = echarts.init(miniChartRef.current)
    miniChartInstance.current.setOption({
      grid: { left: 0, right: 0, top: 0, bottom: 0 },
      xAxis: { type: 'category', show: false, data: ['1月', '2月', '3月', '4月', '5月', '6月'] },
      yAxis: { type: 'value', show: false },
      series: [
        {
          type: 'line',
          data: [100000, 105000, 98000, 112000, 108000, 175550],
          smooth: true,
          symbol: 'none',
          lineStyle: { color: '#3b82f6', width: 2 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
              { offset: 1, color: 'rgba(59, 130, 246, 0.05)' },
            ]),
          },
        },
      ],
    })

    const handleResize = () => miniChartInstance.current?.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      miniChartInstance.current?.dispose()
    }
  }, [loading, portfolioSummary])

  return (
    <div className="space-y-6">
      {/* Portfolio Overview Cards */}
      {portfolioSummary && (
        <section>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">资产概览</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <AssetCard
              title="总资产"
              value={`¥${formatMoney(portfolioSummary.totalMarketValue)}`}
              subValue={`${portfolioSummary.totalPnl >= 0 ? '+' : ''}${formatMoney(portfolioSummary.totalPnl)} 累计盈亏`}
              isPositive={portfolioSummary.totalPnl >= 0}
              icon={
                <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              loading={loading}
            />
            <AssetCard
              title="今日盈亏"
              value={`¥${formatMoney(portfolioSummary.dailyPnl)}`}
              subValue={`${portfolioSummary.dailyPnl >= 0 ? '+' : ''}${portfolioSummary.dailyPnlPercent.toFixed(2)}%`}
              isPositive={portfolioSummary.dailyPnl >= 0}
              icon={
                <svg className="w-6 h-6 text-stock-up" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              }
              loading={loading}
            />
            <AssetCard
              title="累计收益率"
              value={`${portfolioSummary.totalPnlPercent >= 0 ? '+' : ''}${portfolioSummary.totalPnlPercent.toFixed(2)}%`}
              subValue={`成本: ¥${formatMoney(portfolioSummary.totalCost)}`}
              isPositive={portfolioSummary.totalPnlPercent >= 0}
              icon={
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              }
              loading={loading}
            />
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                </div>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">收益趋势</div>
              <div ref={miniChartRef} className="h-12 w-full" />
            </div>
          </div>
        </section>
      )}

      {/* Market Indices */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">市场指数</h3>
          {connectionState === 'connected' && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
              <span className="w-2 h-2 mr-1 rounded-full bg-green-500 animate-pulse"></span>
              实时
            </span>
          )}
          {connectionState === 'reconnecting' && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
              <span className="w-2 h-2 mr-1 rounded-full bg-yellow-500 animate-pulse"></span>
              重连中
            </span>
          )}
          {connectionState === 'disconnected' && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400">
              <span className="w-2 h-2 mr-1 rounded-full bg-gray-400"></span>
              离线
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {indicesWithRealtime.map((index) => (
            <IndexCard key={index.symbol} index={index} loading={loading} />
          ))}
        </div>
      </section>

      {/* Quick Actions */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">快捷入口</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickActionButton
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            }
            label="K线分析"
            variant="primary"
            onClick={() => navigate('/kline')}
          />
          <QuickActionButton
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            }
            label="我的自选"
            onClick={() => navigate('/watchlist')}
          />
          <QuickActionButton
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
            label="市场行情"
            onClick={() => navigate('/market')}
          />
          <QuickActionButton
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            }
            label="投资组合"
            onClick={() => navigate('/portfolio')}
          />
        </div>
      </section>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Watchlist Preview */}
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">自选股</h3>
            <button
              onClick={() => navigate('/watchlist')}
              className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
            >
              查看全部 →
            </button>
          </div>
          <div className="p-2">
            {loading ? (
              <div className="space-y-2 p-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse flex items-center gap-3 p-3">
                    <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                    </div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                  </div>
                ))}
              </div>
            ) : watchlistWithRealtime.length > 0 ? (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {watchlistWithRealtime.slice(0, 5).map((item) => (
                  <WatchlistPreviewItem key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                <p>暂无自选股</p>
                <button onClick={() => navigate('/kline')} className="mt-2 text-primary-600 hover:text-primary-700 dark:text-primary-400">
                  去添加 →
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Recent Trades */}
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">最近交易</h3>
            <button
              onClick={() => navigate('/portfolio')}
              className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
            >
              查看全部 →
            </button>
          </div>
          <div className="p-2">
            {loading ? (
              <div className="space-y-2 p-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse flex items-center gap-3 p-3">
                    <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                    </div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                  </div>
                ))}
              </div>
            ) : trades.length > 0 ? (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {trades.map((trade) => (
                  <TradeRow key={trade.id} record={trade} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p>暂无交易记录</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
