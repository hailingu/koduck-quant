import { useState, useEffect, useMemo } from 'react'
import { Warning, TrendingUp, TrendingDown, Schedule, CheckCircle } from '@mui/icons-material'

// 预警类型
type AlertPriority = 'critical' | 'high' | 'medium' | 'low'
type AlertCategory = 'fake_breakout' | 'golden_pit' | 'accumulation_complete' | 'distribution' | 'retail_trap'

interface DivergenceAlert {
  id: string
  sector: string
  category: AlertCategory
  priority: AlertPriority
  title: string
  description: string
  priceChange: number
  mainForceFlow: number
  timestamp: string
  isRead: boolean
}

// 生成模拟预警数据
const generateMockAlerts = (): DivergenceAlert[] => [
  {
    id: '1',
    sector: '科技',
    category: 'retail_trap',
    priority: 'critical',
    title: '⚠️ 散户接盘预警',
    description: '散户大量买入78.2亿，主力暗中出货67.5亿，价格虚高+3.2%',
    priceChange: 3.2,
    mainForceFlow: -67.5,
    timestamp: '14:32:18',
    isRead: false,
  },
  {
    id: '2',
    sector: '银行',
    category: 'golden_pit',
    priority: 'high',
    title: '💎 黄金坑机会',
    description: '价格下跌2.1%，但主力流入89.3亿，吸筹迹象明显',
    priceChange: -2.1,
    mainForceFlow: 89.3,
    timestamp: '14:28:45',
    isRead: false,
  },
  {
    id: '3',
    sector: '新能源',
    category: 'fake_breakout',
    priority: 'critical',
    title: '🔴 假突破风险',
    description: '价格大涨5.8%创新高，但主力净流出23.4亿，警惕诱多',
    priceChange: 5.8,
    mainForceFlow: -23.4,
    timestamp: '14:15:22',
    isRead: false,
  },
  {
    id: '4',
    sector: '医药',
    category: 'accumulation_complete',
    priority: 'medium',
    title: '🔵 吸筹完成信号',
    description: '横盘整理7天，主力累计流入156亿，建仓基本完成',
    priceChange: 0.3,
    mainForceFlow: 156.0,
    timestamp: '13:58:10',
    isRead: true,
  },
  {
    id: '5',
    sector: '地产',
    category: 'distribution',
    priority: 'high',
    title: '🔴 主力出货中',
    description: '价格横盘滞涨，主力连续3天净流出共89亿，派发筹码',
    priceChange: -0.5,
    mainForceFlow: -45.6,
    timestamp: '13:42:33',
    isRead: false,
  },
]

// 获取优先级样式
const getPriorityStyle = (priority: AlertPriority) => {
  switch (priority) {
    case 'critical':
      return {
        borderColor: '#DE0541',
        bgColor: 'rgba(222, 5, 65, 0.1)',
        textColor: '#FFB3B5',
        icon: <Warning className="text-[#DE0541]" />,
        pulse: true,
      }
    case 'high':
      return {
        borderColor: '#FFD81D',
        bgColor: 'rgba(255, 216, 29, 0.1)',
        textColor: '#FFD81D',
        icon: <TrendingUp className="text-[#FFD81D]" />,
        pulse: true,
      }
    case 'medium':
      return {
        borderColor: '#00F2FF',
        bgColor: 'rgba(0, 242, 255, 0.1)',
        textColor: '#00F2FF',
        icon: <Schedule className="text-[#00F2FF]" />,
        pulse: false,
      }
    case 'low':
      return {
        borderColor: '#849495',
        bgColor: 'rgba(132, 148, 149, 0.1)',
        textColor: '#849495',
        icon: <CheckCircle className="text-[#849495]" />,
        pulse: false,
      }
  }
}

// 获取操作按钮文本
const getActionButton = (category: AlertCategory) => {
  switch (category) {
    case 'golden_pit':
      return { text: '买入机会', color: '#FFD81D', bgColor: '#221B00' }
    case 'fake_breakout':
    case 'retail_trap':
    case 'distribution':
      return { text: '减仓回避', color: '#FFB3B5', bgColor: '#40000C' }
    case 'accumulation_complete':
      return { text: '关注突破', color: '#00F2FF', bgColor: '#00363A' }
    default:
      return { text: '查看详情', color: '#E1E2EB', bgColor: '#272A31' }
  }
}

// 统计卡片组件
const StatCard = ({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string
  value: string | number
  color: string
  icon: React.ElementType
}) => (
  <div className="bg-[#0B0E14] p-4 rounded-lg border border-[#272A31] flex items-center gap-3">
    <div className="p-2 rounded" style={{ backgroundColor: `${color}20` }}>
      <Icon style={{ color }} />
    </div>
    <div>
      <div className="text-[10px] text-[#849495] uppercase" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
        {label}
      </div>
      <div className="text-lg font-bold" style={{ color, fontFamily: 'JetBrains Mono, monospace' }}>
        {value}
      </div>
    </div>
  </div>
)

export default function FundDivergenceAlert() {
  const [alerts, setAlerts] = useState<DivergenceAlert[]>(generateMockAlerts())
  const [filterPriority, setFilterPriority] = useState<AlertPriority | 'all'>('all')
  const [filterCategory, setFilterCategory] = useState<AlertCategory | 'all'>('all')
  const [autoRefresh, setAutoRefresh] = useState(true)

  // 自动刷新模拟
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => {
      // 模拟新预警
      if (Math.random() > 0.7) {
        const newAlert: DivergenceAlert = {
          id: Date.now().toString(),
          sector: ['科技', '医药', '银行', '地产'][Math.floor(Math.random() * 4)],
          category: ['golden_pit', 'fake_breakout', 'retail_trap'][Math.floor(Math.random() * 3)] as AlertCategory,
          priority: ['critical', 'high', 'medium'][Math.floor(Math.random() * 3)] as AlertPriority,
          title: '新预警',
          description: '价格与资金流向出现背离',
          priceChange: (Math.random() - 0.5) * 10,
          mainForceFlow: (Math.random() - 0.5) * 100,
          timestamp: new Date().toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          isRead: false,
        }
        setAlerts((prev) => [newAlert, ...prev].slice(0, 20))
      }
    }, 15000)
    return () => clearInterval(interval)
  }, [autoRefresh])

  // 过滤后的预警
  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      if (filterPriority !== 'all' && alert.priority !== filterPriority) return false
      if (filterCategory !== 'all' && alert.category !== filterCategory) return false
      return true
    })
  }, [alerts, filterPriority, filterCategory])

  // 统计数据
  const stats = useMemo(() => {
    const unread = alerts.filter((a) => !a.isRead).length
    const critical = alerts.filter((a) => a.priority === 'critical').length
    const opportunities = alerts.filter((a) => a.category === 'golden_pit').length
    const risks = alerts.filter((a) => ['fake_breakout', 'retail_trap', 'distribution'].includes(a.category)).length
    return { unread, critical, opportunities, risks }
  }, [alerts])

  // 标记已读
  const markAsRead = (id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, isRead: true } : a)))
  }

  // 清除所有
  const clearAll = () => {
    setAlerts([])
  }

  return (
    <div className="w-full space-y-6">
      {/* 标题区域 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1
            className="text-3xl font-bold tracking-tight text-[#E1E2EB]"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            资金背离 <span className="text-[#DE0541]">预警中心</span>
          </h1>
          <p className="text-[#849495] font-body mt-2">
            实时监控价格与资金流向背离，捕捉主力动向
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 text-xs rounded transition-colors ${
              autoRefresh ? 'bg-[#00F2FF]/20 text-[#00F2FF]' : 'bg-[#272A31] text-[#849495]'
            }`}
          >
            {autoRefresh ? '🟢 自动刷新' : '⚪ 手动刷新'}
          </button>
          <button
            onClick={clearAll}
            className="px-3 py-1.5 text-xs rounded bg-[#272A31] text-[#849495] hover:bg-[#32353C] transition-colors"
          >
            清空全部
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="未读预警" value={stats.unread} color="#00F2FF" icon={Warning} />
        <StatCard label="危险信号" value={stats.critical} color="#DE0541" icon={TrendingDown} />
        <StatCard label="买入机会" value={stats.opportunities} color="#FFD81D" icon={TrendingUp} />
        <StatCard label="风险预警" value={stats.risks} color="#FFB3B5" icon={Warning} />
      </div>

      {/* 过滤器 */}
      <div className="flex flex-wrap gap-3 p-4 bg-[#10131A] rounded-lg border border-[#272A31]">
        {/* 优先级过滤 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#849495]">优先级:</span>
          {[
            { key: 'all', label: '全部', color: '#E1E2EB' },
            { key: 'critical', label: '🔴 危险', color: '#DE0541' },
            { key: 'high', label: '🟡 高', color: '#FFD81D' },
            { key: 'medium', label: '🔵 中', color: '#00F2FF' },
          ].map(({ key, label, color }) => (
            <button
              key={key}
              onClick={() => setFilterPriority(key as AlertPriority | 'all')}
              className={`px-2.5 py-1 text-xs rounded transition-all ${
                filterPriority === key
                  ? 'bg-[#272A31] text-[#E1E2EB] border border-[#3A494B]'
                  : 'text-[#849495] hover:text-[#E1E2EB]'
              }`}
            >
              <span style={{ color }}>●</span> {label}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-[#272A31] hidden md:block" />

        {/* 类型过滤 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#849495]">类型:</span>
          {[
            { key: 'all', label: '全部' },
            { key: 'golden_pit', label: '💎 黄金坑' },
            { key: 'fake_breakout', label: '🔴 假突破' },
            { key: 'retail_trap', label: '⚠️ 散户接盘' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilterCategory(key as AlertCategory | 'all')}
              className={`px-2.5 py-1 text-xs rounded transition-all ${
                filterCategory === key
                  ? 'bg-[#272A31] text-[#E1E2EB]'
                  : 'text-[#849495] hover:text-[#E1E2EB]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 预警列表 */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="text-center py-12 text-[#849495]">
            <CheckCircle className="text-4xl mx-auto mb-2 opacity-30" />
            <p>暂无符合条件的预警</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const style = getPriorityStyle(alert.priority)
            const action = getActionButton(alert.category)
            return (
              <div
                key={alert.id}
                onClick={() => markAsRead(alert.id)}
                className={`relative p-4 rounded-lg cursor-pointer transition-all hover:translate-x-1 ${
                  alert.isRead ? 'opacity-60' : 'opacity-100'
                }`}
                style={{
                  backgroundColor: style.bgColor,
                  borderLeft: `4px solid ${style.borderColor}`,
                  boxShadow: style.pulse ? `0 0 20px ${style.borderColor}20` : 'none',
                }}
              >
                {/* 未读指示器 */}
                {!alert.isRead && (
                  <div
                    className="absolute top-4 right-4 w-2 h-2 rounded-full animate-pulse"
                    style={{ backgroundColor: style.borderColor }}
                  />
                )}

                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    {/* 头部 */}
                    <div className="flex items-center gap-3 mb-2">
                      {style.icon}
                      <span
                        className="font-bold text-sm"
                        style={{ color: style.textColor }}
                      >
                        {alert.title}
                      </span>
                      <span className="text-[10px] text-[#849495] px-2 py-0.5 bg-[#272A31] rounded">
                        {alert.sector}
                      </span>
                      <span
                        className="text-[10px] text-[#849495]"
                        style={{ fontFamily: 'JetBrains Mono, monospace' }}
                      >
                        {alert.timestamp}
                      </span>
                    </div>

                    {/* 描述 */}
                    <p className="text-sm text-[#E1E2EB] mb-3">{alert.description}</p>

                    {/* 数据标签 */}
                    <div className="flex gap-3">
                      <span
                        className="text-xs px-2 py-1 rounded bg-[#272A31]"
                        style={{
                          color: alert.priceChange >= 0 ? '#00F2FF' : '#FFB3B5',
                          fontFamily: 'JetBrains Mono, monospace',
                        }}
                      >
                        价格 {alert.priceChange >= 0 ? '+' : ''}
                        {alert.priceChange.toFixed(2)}%
                      </span>
                      <span
                        className="text-xs px-2 py-1 rounded bg-[#272A31]"
                        style={{
                          color: alert.mainForceFlow >= 0 ? '#00F2FF' : '#FFB3B5',
                          fontFamily: 'JetBrains Mono, monospace',
                        }}
                      >
                        主力 {alert.mainForceFlow >= 0 ? '+' : ''}
                        {alert.mainForceFlow.toFixed(1)}亿
                      </span>
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <button
                    className="px-3 py-1.5 text-xs font-bold rounded whitespace-nowrap"
                    style={{
                      backgroundColor: action.bgColor,
                      color: action.color,
                    }}
                  >
                    {action.text}
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* 底部说明 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs p-4 bg-[#10131A] rounded-lg border border-[#272A31]">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#DE0541]" />
          <span className="text-[#849495]">危险: 立即关注</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#FFD81D]" />
          <span className="text-[#849495]">高优先级: 重点关注</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#00F2FF]" />
          <span className="text-[#849495]">中优先级: 持续观察</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#849495]" />
          <span className="text-[#849495]">低优先级: 参考信息</span>
        </div>
      </div>

      {/* CSS 动画 */}
      <style>{`
        @keyframes pulse-border {
          0%, 100% { box-shadow: 0 0 10px currentColor; }
          50% { box-shadow: 0 0 20px currentColor; }
        }
      `}</style>
    </div>
  )
}
