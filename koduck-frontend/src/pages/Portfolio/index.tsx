import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import * as echarts from 'echarts'
import type {
  PortfolioItem,
  SectorDistribution,
  PnLPoint,
} from '@/api/portfolio'
import { portfolioApi } from '@/api/portfolio'
import { marketApi } from '@/api/market'
import { useToast } from '@/hooks/useToast'
import { useWebSocketSubscription } from '@/hooks/useWebSocket'
import { useWebSocketStore } from '@/stores/websocket'
import StockSearch from '@/components/StockSearch'
import { isTradingHours } from '@/utils/trading'

interface PortfolioDisplayItem extends PortfolioItem {
  realtimeTimestamp?: number
}

const REALTIME_STALE_MS = 20000
const SNAPSHOT_STALE_MS = 120000
const MARKET_STATUS_CHECK_MS = 30000
const TRADING_QUOTE_POLL_MS = 5000
const CLOSED_QUOTE_POLL_MS = 30000

const normalizeSymbol = (symbol: string): string => {
  const digits = symbol.replaceAll(/\D/g, '')
  if (digits.length >= 1 && digits.length <= 6) {
    return digits.padStart(6, '0')
  }
  return symbol.trim()
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

const APPLE_CARD_CLASS =
  'bg-white dark:bg-[#1c1c1e] rounded-[24px] shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100 dark:border-white/5'

const GLASS_MODAL_CLASS =
  'relative overflow-hidden rounded-[24px] bg-white dark:bg-[#1c1c1e] shadow-[0_25px_60px_rgba(0,0,0,0.15)] ring-1 ring-black/5 dark:ring-white/10'

// 持仓行组件
function PortfolioRow({
  item,
  onEdit,
  onDelete,
  onClick,
}: {
  item: PortfolioDisplayItem
  onEdit: (item: PortfolioItem) => void
  onDelete: (id: number) => void
  onClick: (symbol: string, market: string) => void
}) {
  const isProfit = item.pnl >= 0
  const colorClass = isProfit ? 'text-[#34c759]' : 'text-[#ff3b30]'

  return (
    <tr className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors group">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex flex-col">
          <div
            className="text-[15px] font-medium text-[#1d1d1f] dark:text-white cursor-pointer hover:text-blue-500 transition-colors"
            onClick={() => onClick(item.symbol, item.market)}
          >
            {item.name}
          </div>
          <div className="text-[13px] text-[#86868b] dark:text-gray-500 mt-0.5">{item.symbol}</div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-[15px] text-[#1d1d1f] dark:text-white">
        {item.quantity}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-[15px] text-[#1d1d1f] dark:text-white">
        {formatNumber(item.avgCost)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-[15px] text-[#1d1d1f] dark:text-white">
        {formatNumber(item.currentPrice)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-[15px] font-medium text-[#1d1d1f] dark:text-white">
        {formatMoney(item.marketValue)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right tabular-nums">
        <div className="flex flex-col items-end">
          <div className={`text-[15px] font-medium ${colorClass}`}>{formatMoney(item.pnl)}</div>
          <div className={`text-[13px] ${colorClass} mt-0.5`}>
            {isProfit ? '+' : ''}
            {item.pnlPercent.toFixed(2)}%
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right">
        <div
          className="
            inline-flex w-[88px] items-center justify-end gap-2
            transition-all duration-200
            opacity-100 translate-x-0
          "
        >
          <button
            onClick={() => onEdit(item)}
            className="text-blue-500 hover:text-blue-600 p-2 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
            title="编辑"
            aria-label={`编辑 ${item.name}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(item.id)}
            className="text-red-500 hover:text-red-600 p-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
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

export default function Portfolio() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([])
  const [sectors, setSectors] = useState<SectorDistribution[]>([])
  const [pnlHistory, setPnLHistory] = useState<PnLPoint[]>([])
  const [marketTrading, setMarketTrading] = useState<boolean>(isTradingHours())

  // 弹窗状态
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null)
  const [formData, setFormData] = useState({
    market: 'SZ',
    symbol: '',
    name: '',
    quantity: '',
    avgCost: '',
  })
  const [editForm, setEditForm] = useState({
    quantity: '',
    avgCost: '',
  })
  const [closedMarketQuotes, setClosedMarketQuotes] = useState<
    Map<string, { price: number; change: number; timestamp: number }>
  >(new Map())

  // WebSocket
  const stockPrices = useWebSocketStore((state) => state.stockPrices)
  const connectionState = useWebSocketStore((state) => state.connectionState)
  const symbols = useMemo(() => portfolio.map((item) => normalizeSymbol(item.symbol)), [portfolio])

  useWebSocketSubscription(symbols, symbols.length > 0)

  useEffect(() => {
    const intervalId = globalThis.setInterval(() => {
      setMarketTrading(isTradingHours())
    }, MARKET_STATUS_CHECK_MS)
    return () => globalThis.clearInterval(intervalId)
  }, [])

  const pollClosedMarketQuotes = useCallback(async () => {
    if (symbols.length === 0) return

    const quoteEntries = await Promise.all(
      symbols.map(async (symbol) => {
        try {
          const quote = await marketApi.getStockDetail(symbol)
          if (quote && Number.isFinite(quote.price) && quote.price > 0) {
            return [normalizeSymbol(symbol), { price: quote.price, change: quote.change, timestamp: Date.now() }] as const
          }
        } catch {
          // ignore
        }
        return null
      })
    )

    setClosedMarketQuotes((prev) => {
      const next = new Map(prev)
      quoteEntries.forEach((entry) => {
        if (!entry) return
        const [symbol, quote] = entry
        next.set(symbol, quote)
      })
      return next
    })
  }, [symbols])

  useEffect(() => {
    if (symbols.length === 0) return
    void pollClosedMarketQuotes()
    const pollIntervalMs = marketTrading ? TRADING_QUOTE_POLL_MS : CLOSED_QUOTE_POLL_MS
    const intervalId = globalThis.setInterval(() => {
      void pollClosedMarketQuotes()
    }, pollIntervalMs)
    return () => globalThis.clearInterval(intervalId)
  }, [symbols, pollClosedMarketQuotes, marketTrading])

  const portfolioWithRealtime = useMemo<PortfolioDisplayItem[]>(() => {
    const now = Date.now()
    return portfolio.map((item) => {
      const normalizedSymbol = normalizeSymbol(item.symbol)
      const realtimePrice = stockPrices.get(normalizedSymbol)
      const closedQuote = closedMarketQuotes.get(normalizedSymbol)
      const isRealtimeFresh = realtimePrice !== undefined && now - realtimePrice.timestamp <= REALTIME_STALE_MS
      const isSnapshotFresh = closedQuote !== undefined && now - closedQuote.timestamp <= SNAPSHOT_STALE_MS

      if (isRealtimeFresh && realtimePrice) {
        const currentPrice = realtimePrice.price
        const totalCost = item.avgCost * item.quantity
        const marketValue = currentPrice * item.quantity
        const pnl = marketValue - totalCost
        const pnlPercent = totalCost > 0 ? (pnl / totalCost) * 100 : 0
        return { ...item, currentPrice, marketValue, pnl, pnlPercent, realtimeTimestamp: realtimePrice.timestamp }
      }

      if (isSnapshotFresh && closedQuote && Number.isFinite(closedQuote.price) && closedQuote.price > 0) {
        const currentPrice = closedQuote.price
        const totalCost = item.avgCost * item.quantity
        const marketValue = currentPrice * item.quantity
        const pnl = marketValue - totalCost
        const pnlPercent = totalCost > 0 ? (pnl / totalCost) * 100 : 0
        return { ...item, currentPrice, marketValue, pnl, pnlPercent, realtimeTimestamp: closedQuote.timestamp }
      }

      if (marketTrading && connectionState !== 'connected') {
        return item
      }
      return item
    })
  }, [portfolio, stockPrices, closedMarketQuotes, marketTrading, connectionState])

  const summaryMetrics = useMemo(() => {
    const totalCost = portfolioWithRealtime.reduce((sum, item) => sum + item.avgCost * item.quantity, 0)
    const totalMarketValue = portfolioWithRealtime.reduce((sum, item) => sum + item.marketValue, 0)
    const totalPnl = totalMarketValue - totalCost
    const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0

    let dailyPnl = 0
    let previousMarketValue = 0
    portfolioWithRealtime.forEach((item) => {
      const normalizedSymbol = normalizeSymbol(item.symbol)
      const realtimePrice = stockPrices.get(normalizedSymbol)
      const closedQuote = closedMarketQuotes.get(normalizedSymbol)
      const now = Date.now()
      const isRealtimeFresh = realtimePrice !== undefined && now - realtimePrice.timestamp <= REALTIME_STALE_MS
      const isSnapshotFresh = closedQuote !== undefined && now - closedQuote.timestamp <= SNAPSHOT_STALE_MS
      const quoteChange = isRealtimeFresh
        ? (realtimePrice?.change ?? 0)
        : isSnapshotFresh
          ? (closedQuote?.change ?? 0)
          : 0
      dailyPnl += quoteChange * item.quantity
      previousMarketValue += (item.currentPrice - quoteChange) * item.quantity
    })
    const dailyPnlPercent = previousMarketValue > 0 ? (dailyPnl / previousMarketValue) * 100 : 0

    return {
      totalCost,
      totalMarketValue,
      totalPnl,
      totalPnlPercent,
      dailyPnl,
      dailyPnlPercent,
    }
  }, [portfolioWithRealtime, stockPrices, closedMarketQuotes])

  // 图表
  const pnlChartRef = useRef<HTMLDivElement>(null)
  const barChartRef = useRef<HTMLDivElement>(null)
  const pnlChartInstance = useRef<echarts.ECharts | null>(null)
  const barChartInstance = useRef<echarts.ECharts | null>(null)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [portfolioData, sectorData, pnlData] = await Promise.all([
        portfolioApi.getPortfolio(),
        portfolioApi.getSectorDistribution(),
        portfolioApi.getPnLHistory(),
      ])
      setPortfolio(portfolioData)
      setSectors(sectorData)
      setPnLHistory(pnlData)
    } catch (error) {
      showToast('加载数据失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (loading || !pnlChartRef.current || !barChartRef.current) return

    pnlChartInstance.current = echarts.init(pnlChartRef.current)
    pnlChartInstance.current.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const data = params[0]
          return `<div class="font-[system-ui]">${data.name}<br/><span class="font-medium">市值: ${formatMoney(data.value)}</span></div>`
        },
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderColor: '#f0f0f0',
        textStyle: { color: '#1d1d1f' },
        padding: [8, 12],
        extraCssText: 'box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-radius: 8px;',
      },
      grid: { top: 10, left: 10, right: 10, bottom: 20, containLabel: true },
      xAxis: {
        type: 'category',
        data: pnlHistory.map((p) => p.date.slice(5)),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#86868b', margin: 12 },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: '#f5f5f7', type: 'dashed' } },
        axisLabel: { color: '#86868b' },
      },
      series: [
        {
          name: '市值',
          type: 'line',
          data: pnlHistory.map((p) => p.value),
          smooth: 0.3,
          showSymbol: false,
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(0, 122, 255, 0.15)' },
              { offset: 1, color: 'rgba(0, 122, 255, 0.01)' },
            ]),
          },
          lineStyle: { color: '#007AFF', width: 3 },
          itemStyle: { color: '#007AFF' },
        },
      ],
    })

    barChartInstance.current = echarts.init(barChartRef.current)
    barChartInstance.current.setOption({
      backgroundColor: 'transparent',
      tooltip: { 
        trigger: 'axis', 
        axisPointer: { type: 'none' },
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderColor: '#f0f0f0',
        textStyle: { color: '#1d1d1f' },
        padding: [8, 12],
        extraCssText: 'box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-radius: 8px;',
      },
      grid: { top: 10, left: 10, right: 10, bottom: 20, containLabel: true },
      xAxis: {
        type: 'category',
        data: sectors.map((s) => s.sector),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#86868b', margin: 12 },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: '#f5f5f7', type: 'dashed' } },
        axisLabel: { color: '#86868b' },
      },
      series: [
        {
          type: 'bar',
          barWidth: '32px',
          data: sectors.map((s) => s.value),
          itemStyle: {
            color: '#007AFF',
            borderRadius: [4, 4, 0, 0],
          },
        },
      ],
    })

    const handleResize = () => {
      pnlChartInstance.current?.resize()
      barChartInstance.current?.resize()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      pnlChartInstance.current?.dispose()
      barChartInstance.current?.dispose()
    }
  }, [loading, pnlHistory, sectors])

  // 添加、编辑、删除
  const handleAdd = async () => {
    const quantity = Number(formData.quantity)
    const avgCost = Number(formData.avgCost)

    if (!formData.symbol || !formData.name) return showToast('请先选择股票', 'warning')
    if (!Number.isFinite(quantity) || quantity <= 0) return showToast('数量必须大于 0', 'warning')
    if (!Number.isFinite(avgCost) || avgCost <= 0) return showToast('成本价必须大于 0', 'warning')

    try {
      await portfolioApi.addPortfolio({ market: formData.market, symbol: formData.symbol, name: formData.name, quantity, avgCost })
      showToast('添加成功', 'success')
      setShowAddModal(false)
      setFormData({ market: 'SZ', symbol: '', name: '', quantity: '', avgCost: '' })
      loadData()
    } catch {
      showToast('添加失败', 'error')
    }
  }

  const handleEdit = async () => {
    if (!editingItem) return
    const quantity = Number(editForm.quantity)
    const avgCost = Number(editForm.avgCost)
    if (!Number.isFinite(quantity) || quantity <= 0) return showToast('数量必须大于 0', 'warning')
    if (!Number.isFinite(avgCost) || avgCost <= 0) return showToast('成本价必须大于 0', 'warning')

    try {
      await portfolioApi.updatePortfolio(editingItem.id, { quantity, avgCost })
      showToast('更新成功', 'success')
      setShowEditModal(false)
      setEditingItem(null)
      setEditForm({ quantity: '', avgCost: '' })
      loadData()
    } catch {
      showToast('更新失败', 'error')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除该持仓吗？')) return
    try {
      await portfolioApi.deletePortfolio(id)
      showToast('删除成功', 'success')
      loadData()
    } catch {
      showToast('删除失败', 'error')
    }
  }

  const handleClickStock = (symbol: string, market: string) => {
    navigate(`/kline?symbol=${symbol}&market=${market}`)
  }

  return (
    <div className="min-h-[calc(100vh-theme(spacing.16))] py-6 px-4 md:px-8 space-y-6 [font-family:-apple-system,BlinkMacSystemFont,'SF_Pro_Text','Helvetica_Neue','Segoe_UI',sans-serif] bg-[#f5f5f7] dark:bg-black text-[#1d1d1f] dark:text-white">
      {/* 紧凑型数据中枢 */}
      <div className={`${APPLE_CARD_CLASS} px-6 py-6 md:px-8`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-0">
          <div className="flex flex-col gap-1 md:w-1/4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[13px] font-medium text-[#86868b] dark:text-gray-400">总资产 (¥)</span>
              {marketTrading && connectionState === 'connected' ? (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#34c759]/10 text-[#34c759] text-[10px] font-bold tracking-widest uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#34c759] animate-pulse" />
                  Live
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-[#86868b] text-[10px] font-bold tracking-widest uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  Closed
                </span>
              )}
            </div>
            <div className="text-[28px] md:text-[32px] font-semibold tracking-tight text-[#1d1d1f] dark:text-white leading-none tabular-nums">
              {formatMoney(summaryMetrics.totalMarketValue)}
            </div>
          </div>

          <div className="hidden md:block w-px h-12 bg-gray-100 dark:bg-white/5 mx-6"></div>

          <div className="flex flex-col gap-1 md:w-1/4">
            <span className="text-[13px] font-medium text-[#86868b] dark:text-gray-400 mb-1">今日盈亏</span>
            <div className={`text-[20px] font-medium tracking-tight leading-none tabular-nums ${summaryMetrics.dailyPnl >= 0 ? 'text-[#34c759]' : 'text-[#ff3b30]'}`}>
              {summaryMetrics.dailyPnl >= 0 ? '+' : ''}{formatMoney(summaryMetrics.dailyPnl)}
            </div>
            <span className={`text-[13px] font-medium tabular-nums ${summaryMetrics.dailyPnl >= 0 ? 'text-[#34c759]' : 'text-[#ff3b30]'}`}>
              {summaryMetrics.dailyPnlPercent >= 0 ? '+' : ''}{summaryMetrics.dailyPnlPercent.toFixed(2)}%
            </span>
          </div>

          <div className="hidden md:block w-px h-12 bg-gray-100 dark:bg-white/5 mx-6"></div>

          <div className="flex flex-col gap-1 md:w-1/4">
            <span className="text-[13px] font-medium text-[#86868b] dark:text-gray-400 mb-1">累计盈亏</span>
            <div className={`text-[20px] font-medium tracking-tight leading-none tabular-nums ${summaryMetrics.totalPnl >= 0 ? 'text-[#34c759]' : 'text-[#ff3b30]'}`}>
              {summaryMetrics.totalPnl >= 0 ? '+' : ''}{formatMoney(summaryMetrics.totalPnl)}
            </div>
            <span className={`text-[13px] font-medium tabular-nums ${summaryMetrics.totalPnl >= 0 ? 'text-[#34c759]' : 'text-[#ff3b30]'}`}>
              {summaryMetrics.totalPnlPercent >= 0 ? '+' : ''}{summaryMetrics.totalPnlPercent.toFixed(2)}%
            </span>
          </div>

          <div className="hidden md:block w-px h-12 bg-gray-100 dark:bg-white/5 mx-6"></div>

          <div className="flex flex-col gap-1 md:w-1/4">
            <span className="text-[13px] font-medium text-[#86868b] dark:text-gray-400 mb-1">持仓情况</span>
            <div className="text-[20px] font-medium tracking-tight text-[#1d1d1f] dark:text-white leading-none tabular-nums">
              {portfolio.length} 只股票
            </div>
            <span className="text-[13px] font-medium text-[#86868b] dark:text-gray-500 tabular-nums">
              成本: ¥{formatMoney(summaryMetrics.totalCost)}
            </span>
          </div>
        </div>
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className={`lg:col-span-2 ${APPLE_CARD_CLASS} p-6`}>
          <h3 className="text-[18px] font-medium text-[#1d1d1f] dark:text-white mb-6">收益曲线</h3>
          <div ref={pnlChartRef} className="h-[280px] w-full" />
        </div>
        <div className={`${APPLE_CARD_CLASS} p-6`}>
          <h3 className="text-[18px] font-medium text-[#1d1d1f] dark:text-white mb-6">行业分布</h3>
          <div ref={barChartRef} className="h-[280px] w-full" />
        </div>
      </div>

      {/* 标签页 */}
      <div className={`${APPLE_CARD_CLASS} p-6 flex flex-col`}>
        <div className="mb-6 flex items-center justify-between">
          <div className="inline-flex bg-gray-100 dark:bg-gray-800 p-0.5 rounded-[10px]">
            <span className="px-4 py-1.5 rounded-[8px] text-[14px] font-medium bg-white text-[#1d1d1f] shadow-sm dark:bg-[#2c2c2e] dark:text-white">
              持仓列表
            </span>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex h-8 items-center justify-center gap-1.5 px-3.5 rounded-full bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-white font-medium text-[13px] shadow-sm border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-[#2c2c2e] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            添加持仓
          </button>
        </div>

        <div className="overflow-x-auto -mx-6 px-6">
          {portfolio.length === 0 ? (
            <div className="py-16 text-center text-[#86868b]">
              <p className="mb-4">暂无持仓</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-[10px] text-[14px] font-medium transition-colors"
              >
                添加第一笔持仓
              </button>
            </div>
          ) : (
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="px-6 pb-3 text-left text-[13px] font-medium text-[#86868b] dark:text-gray-400">股票</th>
                  <th className="px-6 pb-3 text-right text-[13px] font-medium text-[#86868b] dark:text-gray-400">持仓数量</th>
                  <th className="px-6 pb-3 text-right text-[13px] font-medium text-[#86868b] dark:text-gray-400">成本价</th>
                  <th className="px-6 pb-3 text-right text-[13px] font-medium text-[#86868b] dark:text-gray-400">当前价</th>
                  <th className="px-6 pb-3 text-right text-[13px] font-medium text-[#86868b] dark:text-gray-400">市值</th>
                  <th className="px-6 pb-3 text-right text-[13px] font-medium text-[#86868b] dark:text-gray-400">盈亏</th>
                  <th className="px-6 pb-3 text-right text-[13px] font-medium text-[#86868b] dark:text-gray-400">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                {portfolioWithRealtime.map((item) => (
                  <PortfolioRow
                    key={item.id}
                    item={item}
                    onEdit={(item) => {
                      setEditingItem(item)
                      setEditForm({ quantity: String(item.quantity), avgCost: String(item.avgCost) })
                      setShowEditModal(true)
                    }}
                    onDelete={handleDelete}
                    onClick={handleClickStock}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 添加持仓弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className={`${GLASS_MODAL_CLASS} w-full max-w-md p-6 relative animate-in fade-in zoom-in-95 duration-200`}>
            <h3 className="text-[20px] font-semibold text-[#1d1d1f] dark:text-white mb-6">添加持仓</h3>
            <div className="space-y-5">
              <StockSearch
                onSelect={(symbol, name, market) => {
                  setFormData((prev) => ({ ...prev, symbol, name, market: market || 'SZ' }))
                }}
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-medium text-[#86868b] mb-1.5">数量</label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData((prev) => ({ ...prev, quantity: e.target.value }))}
                    className="w-full px-3 py-2 rounded-[10px] border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-black focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#86868b] mb-1.5">成本价</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.avgCost}
                    onChange={(e) => setFormData((prev) => ({ ...prev, avgCost: e.target.value }))}
                    className="w-full px-3 py-2 rounded-[10px] border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-black focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-[10px] text-[14px] font-medium text-[#1d1d1f] dark:text-white bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAdd}
                className="px-4 py-2 rounded-[10px] text-[14px] font-medium text-white bg-blue-500 hover:bg-blue-600 transition-colors"
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑持仓弹窗 */}
      {showEditModal && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowEditModal(false)} />
          <div className={`${GLASS_MODAL_CLASS} w-full max-w-md p-6 relative animate-in fade-in zoom-in-95 duration-200`}>
            <h3 className="text-[20px] font-semibold text-[#1d1d1f] dark:text-white mb-6">编辑持仓 - {editingItem.name}</h3>
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-medium text-[#86868b] mb-1.5">数量</label>
                  <input
                    type="number"
                    value={editForm.quantity}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, quantity: e.target.value }))}
                    className="w-full px-3 py-2 rounded-[10px] border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-black focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#86868b] mb-1.5">成本价</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.avgCost}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, avgCost: e.target.value }))}
                    className="w-full px-3 py-2 rounded-[10px] border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-black focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 rounded-[10px] text-[14px] font-medium text-[#1d1d1f] dark:text-white bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleEdit}
                className="px-4 py-2 rounded-[10px] text-[14px] font-medium text-white bg-blue-500 hover:bg-blue-600 transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
