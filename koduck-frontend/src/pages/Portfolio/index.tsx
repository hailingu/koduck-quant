import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import * as echarts from 'echarts'
import type {
  PortfolioItem,
  PortfolioSummary,
  AssetAllocation,
  SectorDistribution,
  PnLPoint,
  TradeRecord,
  AddPortfolioRequest,
} from '@/api/portfolio'
import { portfolioApi } from '@/api/portfolio'
import { useToast } from '@/hooks/useToast'
import StockSearch from '@/components/StockSearch'

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

// 汇总卡片组件
function SummaryCard({
  title,
  value,
  subValue,
  subLabel,
  isPositive,
  icon,
}: {
  title: string
  value: string
  subValue?: string
  subLabel?: string
  isPositive?: boolean
  icon: React.ReactNode
}) {
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">{icon}</div>
      </div>
      <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">{title}</div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
      {subValue && (
        <div className={`text-sm mt-2 ${isPositive ? 'text-stock-up' : 'text-stock-down'}`}>
          {subValue}
          {subLabel && <span className="text-gray-400 ml-1">{subLabel}</span>}
        </div>
      )}
    </div>
  )
}

// 持仓行组件
function PortfolioRow({
  item,
  onEdit,
  onDelete,
  onClick,
}: {
  item: PortfolioItem
  onEdit: (item: PortfolioItem) => void
  onDelete: (id: number) => void
  onClick: (symbol: string, market: string) => void
}) {
  const isProfit = item.pnl >= 0
  const colorClass = isProfit ? 'text-stock-up' : 'text-stock-down'

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
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
        {item.quantity}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
        {formatNumber(item.avgCost)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
        {formatNumber(item.currentPrice)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900 dark:text-white">
        {formatMoney(item.marketValue)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right">
        <div className={`text-sm font-medium ${colorClass}`}>{formatMoney(item.pnl)}</div>
        <div className={`text-xs ${colorClass}`}>
          {isProfit ? '+' : ''}
          {item.pnlPercent.toFixed(2)}%
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right">
        <button
          onClick={() => onEdit(item)}
          className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300 p-2 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors mr-1"
          title="编辑"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
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

// 交易记录行组件
function TradeRow({ record }: { record: TradeRecord }) {
  const isBuy = record.type === 'BUY'
  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-gray-900 dark:text-white">{record.name}</div>
        <div className="text-sm text-gray-500 dark:text-gray-400">{record.symbol}</div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${
            isBuy
              ? 'bg-stock-up/10 text-stock-up'
              : 'bg-stock-down/10 text-stock-down'
          }`}
        >
          {isBuy ? '买入' : '卖出'}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
        {record.quantity}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
        {formatNumber(record.price)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900 dark:text-white">
        {formatMoney(record.amount)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500 dark:text-gray-400">
        {new Date(record.tradeTime).toLocaleString('zh-CN')}
      </td>
    </tr>
  )
}

export default function Portfolio() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<PortfolioSummary | null>(null)
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([])
  const [allocation, setAllocation] = useState<AssetAllocation[]>([])
  const [sectors, setSectors] = useState<SectorDistribution[]>([])
  const [pnlHistory, setPnLHistory] = useState<PnLPoint[]>([])
  const [trades, setTrades] = useState<TradeRecord[]>([])
  const [activeTab, setActiveTab] = useState<'holdings' | 'trades'>('holdings')

  // 弹窗状态
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null)
  const [formData, setFormData] = useState<AddPortfolioRequest>({
    market: 'SZ',
    symbol: '',
    name: '',
    quantity: 0,
    avgCost: 0,
  })

  // 图表引用
  const pnlChartRef = useRef<HTMLDivElement>(null)
  const pieChartRef = useRef<HTMLDivElement>(null)
  const barChartRef = useRef<HTMLDivElement>(null)
  const pnlChartInstance = useRef<echarts.ECharts | null>(null)
  const pieChartInstance = useRef<echarts.ECharts | null>(null)
  const barChartInstance = useRef<echarts.ECharts | null>(null)

  // 加载数据
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [summaryData, portfolioData, allocationData, sectorData, pnlData, tradesData] =
        await Promise.all([
          portfolioApi.getPortfolioSummary(),
          portfolioApi.getPortfolio(),
          portfolioApi.getAssetAllocation(),
          portfolioApi.getSectorDistribution(),
          portfolioApi.getPnLHistory(),
          portfolioApi.getTradeRecords(),
        ])
      setSummary(summaryData)
      setPortfolio(portfolioData)
      setAllocation(allocationData)
      setSectors(sectorData)
      setPnLHistory(pnlData)
      setTrades(tradesData)
    } catch (error) {
      showToast('加载数据失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 初始化图表
  useEffect(() => {
    if (loading || !pnlChartRef.current || !pieChartRef.current || !barChartRef.current) return

    // 收益曲线图
    pnlChartInstance.current = echarts.init(pnlChartRef.current)
    pnlChartInstance.current.setOption({
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const data = params[0]
          return `${data.name}<br/>市值: ${formatMoney(data.value)}`
        },
      },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        data: pnlHistory.map((p) => p.date.slice(5)),
        axisLine: { lineStyle: { color: '#9ca3af' } },
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: '#9ca3af' } },
        splitLine: { lineStyle: { color: '#e5e7eb' } },
      },
      series: [
        {
          name: '市值',
          type: 'line',
          data: pnlHistory.map((p) => p.value),
          smooth: true,
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
              { offset: 1, color: 'rgba(59, 130, 246, 0.05)' },
            ]),
          },
          lineStyle: { color: '#3b82f6', width: 2 },
          itemStyle: { color: '#3b82f6' },
        },
      ],
    })

    // 资产配置饼图
    pieChartInstance.current = echarts.init(pieChartRef.current)
    pieChartInstance.current.setOption({
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { bottom: '5%', left: 'center' },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
          label: { show: false },
          emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
          data: allocation.map((a) => ({ name: a.type, value: a.value })),
        },
      ],
    })

    // 行业分布柱状图
    barChartInstance.current = echarts.init(barChartRef.current)
    barChartInstance.current.setOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        data: sectors.map((s) => s.sector),
        axisLine: { lineStyle: { color: '#9ca3af' } },
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: '#9ca3af' } },
        splitLine: { lineStyle: { color: '#e5e7eb' } },
      },
      series: [
        {
          type: 'bar',
          data: sectors.map((s) => s.value),
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#3b82f6' },
              { offset: 1, color: '#1d4ed8' },
            ]),
            borderRadius: [4, 4, 0, 0],
          },
        },
      ],
    })

    const handleResize = () => {
      pnlChartInstance.current?.resize()
      pieChartInstance.current?.resize()
      barChartInstance.current?.resize()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      pnlChartInstance.current?.dispose()
      pieChartInstance.current?.dispose()
      barChartInstance.current?.dispose()
    }
  }, [loading, pnlHistory, allocation, sectors])

  // 处理添加持仓
  const handleAdd = async () => {
    try {
      await portfolioApi.addPortfolio(formData)
      showToast('添加成功', 'success')
      setShowAddModal(false)
      setFormData({ market: 'SZ', symbol: '', name: '', quantity: 0, avgCost: 0 })
      loadData()
    } catch (error) {
      showToast('添加失败', 'error')
    }
  }

  // 处理编辑持仓
  const handleEdit = async () => {
    if (!editingItem) return
    try {
      await portfolioApi.updatePortfolio(editingItem.id, {
        quantity: editingItem.quantity,
        avgCost: editingItem.avgCost,
      })
      showToast('更新成功', 'success')
      setShowEditModal(false)
      setEditingItem(null)
      loadData()
    } catch (error) {
      showToast('更新失败', 'error')
    }
  }

  // 处理删除持仓
  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除该持仓吗？')) return
    try {
      await portfolioApi.deletePortfolio(id)
      showToast('删除成功', 'success')
      loadData()
    } catch (error) {
      showToast('删除失败', 'error')
    }
  }

  // 跳转K线图
  const handleClickStock = (symbol: string, market: string) => {
    navigate(`/kline?symbol=${symbol}&market=${market}`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">投资组合</h2>
          <p className="mt-1 text-gray-600 dark:text-gray-400">管理您的持仓和查看盈亏分析</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          添加持仓
        </button>
      </div>

      {/* 汇总卡片 */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            title="总资产"
            value={`¥${formatMoney(summary.totalMarketValue)}`}
            subValue={`${summary.totalPnl >= 0 ? '+' : ''}${formatMoney(summary.totalPnl)}`}
            subLabel="累计盈亏"
            isPositive={summary.totalPnl >= 0}
            icon={
              <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <SummaryCard
            title="今日盈亏"
            value={`¥${formatMoney(summary.dailyPnl)}`}
            subValue={`${summary.dailyPnl >= 0 ? '+' : ''}${summary.dailyPnlPercent.toFixed(2)}%`}
            isPositive={summary.dailyPnl >= 0}
            icon={
              <svg className="w-6 h-6 text-stock-up" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            }
          />
          <SummaryCard
            title="累计收益率"
            value={`${summary.totalPnlPercent >= 0 ? '+' : ''}${summary.totalPnlPercent.toFixed(2)}%`}
            subValue={`成本: ¥${formatMoney(summary.totalCost)}`}
            isPositive={summary.totalPnlPercent >= 0}
            icon={
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
          />
          <SummaryCard
            title="持仓数量"
            value={`${portfolio.length}只`}
            icon={
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            }
          />
        </div>
      )}

      {/* 图表区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">收益曲线</h3>
          <div ref={pnlChartRef} className="h-64" />
        </div>
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">资产配置</h3>
            <div ref={pieChartRef} className="h-48" />
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">行业分布</h3>
            <div ref={barChartRef} className="h-48" />
          </div>
        </div>
      </div>

      {/* 标签页 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('holdings')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'holdings'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              持仓列表
            </button>
            <button
              onClick={() => setActiveTab('trades')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'trades'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              交易记录
            </button>
          </nav>
        </div>

        {/* 持仓列表 */}
        {activeTab === 'holdings' && (
          <div className="overflow-x-auto">
            {portfolio.length === 0 ? (
              <div className="text-center py-16">
                <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">暂无持仓</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">点击上方按钮添加您的第一笔持仓</p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
                >
                  添加持仓
                </button>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">股票</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">持仓数量</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">成本价</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">当前价</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">市值</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">盈亏</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {portfolio.map((item) => (
                    <PortfolioRow
                      key={item.id}
                      item={item}
                      onEdit={(item) => {
                        setEditingItem(item)
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
        )}

        {/* 交易记录 */}
        {activeTab === 'trades' && (
          <div className="overflow-x-auto">
            {trades.length === 0 ? (
              <div className="text-center py-16 text-gray-500 dark:text-gray-400">暂无交易记录</div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">股票</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">类型</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">数量</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">价格</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">金额</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">时间</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {trades.map((record) => (
                    <TradeRow key={record.id} record={record} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* 添加持仓弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowAddModal(false)}></div>
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">添加持仓</h3>
              <div className="space-y-4">
                <StockSearch
                  onSelect={(symbol, name, market) => {
                    setFormData({ ...formData, symbol, name, market: market || 'SZ' })
                  }}
                />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">数量</label>
                    <input
                      type="number"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">成本价</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.avgCost}
                      onChange={(e) => setFormData({ ...formData, avgCost: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  取消
                </button>
                <button
                  onClick={handleAdd}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg"
                >
                  添加
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 编辑持仓弹窗 */}
      {showEditModal && editingItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowEditModal(false)}></div>
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">编辑持仓 - {editingItem.name}</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">数量</label>
                    <input
                      type="number"
                      value={editingItem.quantity}
                      onChange={(e) =>
                        setEditingItem({ ...editingItem, quantity: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">成本价</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingItem.avgCost}
                      onChange={(e) =>
                        setEditingItem({ ...editingItem, avgCost: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  取消
                </button>
                <button
                  onClick={handleEdit}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
