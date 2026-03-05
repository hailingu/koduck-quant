import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/hooks/useToast'
import {
  getDashboardSummary,
  getDataFreshness,
  getAllRules,
  getAlertHistory,
  getAllDataSources,
  resolveAlert,
  runMonitoringCheck,
  type AlertHistory,
  type AlertRule,
  type DataSourceStatus,
  type DataFreshnessMetrics,
} from '@/api/monitoring'

// 格式化时间
const formatTime = (time: string | null) => {
  if (!time) return '--'
  return new Date(time).toLocaleString('zh-CN')
}

// 格式化时间差
const formatDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds}秒`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`
  return `${Math.floor(seconds / 3600)}小时`
}

// 状态-badge组件
function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { color: string; bg: string }> = {
    HEALTHY: { color: 'text-green-600', bg: 'bg-green-50' },
    UNHEALTHY: { color: 'text-red-600', bg: 'bg-red-50' },
    WARNING: { color: 'text-yellow-600', bg: 'bg-yellow-50' },
    CRITICAL: { color: 'text-red-600', bg: 'bg-red-50' },
    PENDING: { color: 'text-orange-600', bg: 'bg-orange-50' },
    RESOLVED: { color: 'text-gray-600', bg: 'bg-gray-50' },
  }
  const config = statusConfig[status] || { color: 'text-gray-600', bg: 'bg-gray-50' }

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${config.bg} ${config.color}`}>
      {status}
    </span>
  )
}

// 严重级别-badge组件
function SeverityBadge({ severity }: { severity: string }) {
  const config =
    severity === 'CRITICAL'
      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${config}`}>
      {severity}
    </span>
  )
}

// 数据新鲜度卡片
function DataFreshnessCard({
  metrics,
  loading,
}: {
  metrics: DataFreshnessMetrics | null
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4"></div>
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">数据新鲜度</h3>
        <p className="text-gray-500 dark:text-gray-400">暂无数据</p>
      </div>
    )
  }

  const isHealthy = metrics.delayedPercentage < 10

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">数据新鲜度</h3>
        <StatusBadge status={isHealthy ? 'HEALTHY' : 'WARNING'} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {metrics.totalStocks}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">总股票数</div>
        </div>
        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {metrics.delayedStocks}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">延迟股票</div>
        </div>
        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div
            className={`text-2xl font-bold ${
              metrics.delayedPercentage > 10 ? 'text-red-600' : 'text-green-600'
            }`}
          >
            {metrics.delayedPercentage}%
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">延迟比例</div>
        </div>
        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {metrics.maxDelaySeconds ? formatDuration(metrics.maxDelaySeconds) : '--'}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">最大延迟</div>
        </div>
      </div>
    </div>
  )
}

// 告警规则卡片
function AlertRulesCard({ rules, loading, onToggle }: {
  rules: AlertRule[]
  loading: boolean
  onToggle: (id: number, enabled: boolean) => void
}) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4"></div>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">告警规则</h3>
      <div className="space-y-3">
        {rules.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">暂无告警规则</p>
        ) : (
          rules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-white">{rule.ruleName}</span>
                  <SeverityBadge severity={rule.severity} />
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {rule.description}
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={rule.enabled}
                  onChange={(e) => onToggle(rule.id, e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// 数据源状态卡片
function DataSourcesCard({ sources, loading }: { sources: DataSourceStatus[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4"></div>
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">数据源状态</h3>
      <div className="space-y-3">
        {sources.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">暂无数据源</p>
        ) : (
          sources.map((source) => (
            <div
              key={source.id}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-white">{source.sourceName}</span>
                  <StatusBadge status={source.status || 'UNKNOWN'} />
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  类型: {source.sourceType} | 响应时间: {source.responseTimeMs ?? '--'}ms
                </div>
              </div>
              <div className="text-right text-sm text-gray-500 dark:text-gray-400">
                <div>连续失败: {source.consecutiveFailures || 0}</div>
                <div>上次成功: {formatTime(source.lastSuccessAt)}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// 告警历史卡片
function AlertHistoryCard({
  alerts,
  loading,
  onResolve,
}: {
  alerts: AlertHistory[]
  loading: boolean
  onResolve: (id: number) => void
}) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4"></div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">告警历史</h3>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {alerts.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">暂无告警记录</p>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-start justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-white">{alert.ruleName}</span>
                  <SeverityBadge severity={alert.severity} />
                  <StatusBadge status={alert.status || 'PENDING'} />
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">{alert.message}</div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {formatTime(alert.createdAt)}
                </div>
              </div>
              {alert.status === 'PENDING' && (
                <button
                  onClick={() => onResolve(alert.id)}
                  className="ml-2 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400"
                >
                  标记已处理
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default function Monitoring() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<DataFreshnessMetrics | null>(null)
  const [rules, setRules] = useState<AlertRule[]>([])
  const [alerts, setAlerts] = useState<AlertHistory[]>([])
  const [sources, setSources] = useState<DataSourceStatus[]>([])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [metricsRes, rulesRes, alertsRes, sourcesRes] = await Promise.all([
        getDataFreshness(),
        getAllRules(),
        getAlertHistory(0, 20),
        getAllDataSources(),
      ])
      setMetrics(metricsRes?.data || null)
      setRules(rulesRes?.data || [])
      setAlerts(alertsRes?.data || [])
      setSources(sourcesRes?.data || [])
    } catch (error) {
      showToast('加载监控数据失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    loadData()
    // 定时刷新数据
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [loadData])

  const handleResolveAlert = async (id: number) => {
    try {
      await resolveAlert(id)
      showToast('告警已标记为已处理', 'success')
      loadData()
    } catch (error) {
      showToast('操作失败', 'error')
    }
  }

  const handleToggleRule = async (id: number, enabled: boolean) => {
    // TODO: 实现规则启用/禁用功能
    showToast('规则状态更新功能开发中', 'info')
  }

  const handleRunCheck = async () => {
    try {
      await runMonitoringCheck()
      showToast('监控检查已执行', 'success')
      setTimeout(loadData, 1000)
    } catch (error) {
      showToast('执行失败', 'error')
    }
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">监控中心</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            数据新鲜度监控与告警系统
          </p>
        </div>
        <button
          onClick={handleRunCheck}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          立即检查
        </button>
      </div>

      {/* 数据新鲜度 */}
      <DataFreshnessCard metrics={metrics} loading={loading} />

      {/* 两列布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AlertRulesCard rules={rules} loading={loading} onToggle={handleToggleRule} />
        <DataSourcesCard sources={sources} loading={loading} />
      </div>

      {/* 告警历史 */}
      <AlertHistoryCard alerts={alerts} loading={loading} onResolve={handleResolveAlert} />
    </div>
  )
}
