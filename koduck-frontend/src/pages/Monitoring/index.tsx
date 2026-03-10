import { useEffect, useState, useCallback, useMemo } from 'react'

import { useToast } from '@/hooks/useToast'
import {
  getDataFreshness,
  getAllRules,
  getAlertHistory,
  getAllDataSources,
  resolveAlert,
  runMonitoringCheck,
  setRuleEnabled,
  type AlertHistory,
  type AlertRule,
  type DataSourceStatus,
  type DataFreshnessMetrics,
} from '@/api/monitoring'

const APPLE_CARD_CLASS =
  'bg-white dark:bg-[#1c1c1e] rounded-[24px] shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100 dark:border-white/5'

const formatTime = (time: string | null) => {
  if (!time) return '--'
  return new Date(time).toLocaleString('zh-CN')
}

const formatDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds}秒`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`
  return `${Math.floor(seconds / 3600)}小时`
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, string> = {
    HEALTHY: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    UNHEALTHY: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    WARNING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    PENDING: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    RESOLVED: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  }

  const labelMap: Record<string, string> = {
    HEALTHY: '健康',
    UNHEALTHY: '异常',
    WARNING: '告警',
    CRITICAL: '严重',
    PENDING: '待处理',
    RESOLVED: '已处理',
  }

  const cls = statusConfig[status] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {labelMap[status] || status}
    </span>
  )
}

function SeverityBadge({ severity }: { severity: string }) {
  const config =
    severity === 'CRITICAL'
      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'

  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config}`}>{severity}</span>
}

function SectionTitle({ title, extra }: { title: string; extra?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h3 className="text-[22px] leading-none font-semibold tracking-[-0.02em] text-[#1d1d1f] dark:text-white">{title}</h3>
      {extra}
    </div>
  )
}

function DataFreshnessCard({
  metrics,
  loading,
  runningCheck,
  onRunCheck,
}: {
  metrics: DataFreshnessMetrics | null
  loading: boolean
  runningCheck: boolean
  onRunCheck: () => void
}) {
  if (loading) {
    return (
      <div className={`${APPLE_CARD_CLASS} p-6`}>
        <div className="animate-pulse">
          <div className="h-6 w-32 rounded-[8px] bg-[#eceef2] dark:bg-[#2c2c2e] mb-4" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 rounded-[14px] bg-[#f5f5f7] dark:bg-[#2c2c2e]" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className={`${APPLE_CARD_CLASS} p-6`}>
        <SectionTitle
          title="数据新鲜度"
          extra={
            <button
              onClick={onRunCheck}
              disabled={runningCheck}
              className="inline-flex h-8 items-center px-3 rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-white font-medium text-[13px] shadow-sm hover:bg-[#f5f5f7] dark:hover:bg-[#2c2c2e] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <svg className={`w-4 h-4 mr-1.5 ${runningCheck ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {runningCheck ? '检查中...' : '刷新'}
            </button>
          }
        />
        <p className="text-[#8e8e93] dark:text-gray-400">暂无数据</p>
      </div>
    )
  }

  const isHealthy = metrics.delayedPercentage < 10

  return (
    <div className={`${APPLE_CARD_CLASS} p-6`}>
      <SectionTitle
        title="数据新鲜度"
        extra={
          <div className="flex items-center gap-2">
            <StatusBadge status={isHealthy ? 'HEALTHY' : 'WARNING'} />
            <button
              onClick={onRunCheck}
              disabled={runningCheck}
              className="inline-flex h-8 items-center px-3 rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-white font-medium text-[13px] shadow-sm hover:bg-[#f5f5f7] dark:hover:bg-[#2c2c2e] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <svg className={`w-4 h-4 mr-1.5 ${runningCheck ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {runningCheck ? '检查中...' : '刷新'}
            </button>
          </div>
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-[14px] bg-[#f5f5f7] dark:bg-[#2c2c2e] p-4">
          <div className="text-[13px] text-[#8e8e93] dark:text-gray-400 mb-2">总股票数</div>
          <div className="text-[30px] leading-none font-semibold tracking-[-0.02em] text-[#1d1d1f] dark:text-white tabular-nums">{metrics.totalStocks}</div>
        </div>
        <div className="rounded-[14px] bg-[#f5f5f7] dark:bg-[#2c2c2e] p-4">
          <div className="text-[13px] text-[#8e8e93] dark:text-gray-400 mb-2">延迟股票</div>
          <div className="text-[30px] leading-none font-semibold tracking-[-0.02em] text-[#1d1d1f] dark:text-white tabular-nums">{metrics.delayedStocks}</div>
        </div>
        <div className="rounded-[14px] bg-[#f5f5f7] dark:bg-[#2c2c2e] p-4">
          <div className="text-[13px] text-[#8e8e93] dark:text-gray-400 mb-2">延迟比例</div>
          <div className={`text-[30px] leading-none font-semibold tracking-[-0.02em] tabular-nums ${metrics.delayedPercentage > 10 ? 'text-[#ff3b30]' : 'text-[#34c759]'}`}>
            {metrics.delayedPercentage}%
          </div>
        </div>
        <div className="rounded-[14px] bg-[#f5f5f7] dark:bg-[#2c2c2e] p-4">
          <div className="text-[13px] text-[#8e8e93] dark:text-gray-400 mb-2">最大延迟</div>
          <div className="text-[30px] leading-none font-semibold tracking-[-0.02em] text-[#1d1d1f] dark:text-white tabular-nums">
            {metrics.maxDelaySeconds ? formatDuration(metrics.maxDelaySeconds) : '--'}
          </div>
        </div>
      </div>
    </div>
  )
}

function AlertRulesCard({ rules, loading, onToggle }: {
  rules: AlertRule[]
  loading: boolean
  onToggle: (id: number, enabled: boolean) => void
}) {
  if (loading) {
    return (
      <div className={`${APPLE_CARD_CLASS} p-6`}>
        <div className="animate-pulse">
          <div className="h-6 w-28 rounded-[8px] bg-[#eceef2] dark:bg-[#2c2c2e] mb-4" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 rounded-[14px] bg-[#f5f5f7] dark:bg-[#2c2c2e] mb-3" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`${APPLE_CARD_CLASS} p-6`}>
      <SectionTitle title="告警规则" />
      <div className="space-y-3">
        {rules.length === 0 ? (
          <p className="text-[#8e8e93] dark:text-gray-400">暂无告警规则</p>
        ) : (
          rules.map((rule) => (
            <div key={rule.id} className="rounded-[14px] bg-[#f5f5f7] dark:bg-[#2c2c2e] p-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[15px] font-medium text-[#1d1d1f] dark:text-white truncate">{rule.ruleName}</span>
                  <SeverityBadge severity={rule.severity} />
                </div>
                <div className="text-sm text-[#8e8e93] dark:text-gray-400">{rule.description}</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={rule.enabled}
                  onChange={(e) => onToggle(rule.id, e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 rounded-full peer dark:bg-gray-600 peer-checked:bg-[#0a84ff] peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
              </label>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function DataSourcesCard({ sources, loading }: { sources: DataSourceStatus[]; loading: boolean }) {
  if (loading) {
    return (
      <div className={`${APPLE_CARD_CLASS} p-6`}>
        <div className="animate-pulse">
          <div className="h-6 w-28 rounded-[8px] bg-[#eceef2] dark:bg-[#2c2c2e] mb-4" />
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-20 rounded-[14px] bg-[#f5f5f7] dark:bg-[#2c2c2e] mb-3" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`${APPLE_CARD_CLASS} p-6`}>
      <SectionTitle title="数据源状态" />
      <div className="space-y-3">
        {sources.length === 0 ? (
          <p className="text-[#8e8e93] dark:text-gray-400">暂无数据源</p>
        ) : (
          sources.map((source) => (
            <div key={source.id} className="rounded-[14px] bg-[#f5f5f7] dark:bg-[#2c2c2e] p-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[15px] font-medium text-[#1d1d1f] dark:text-white truncate">{source.sourceName}</span>
                  <StatusBadge status={source.status || 'UNHEALTHY'} />
                </div>
                <div className="text-sm text-[#8e8e93] dark:text-gray-400">
                  类型: {source.sourceType} · 响应: {source.responseTimeMs ?? '--'}ms
                </div>
              </div>
              <div className="text-right text-xs text-[#8e8e93] dark:text-gray-400 shrink-0">
                <div>连续失败: {source.consecutiveFailures || 0}</div>
                <div className="mt-1">上次成功: {formatTime(source.lastSuccessAt)}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function AlertHistoryCard({ alerts, loading, onResolve }: {
  alerts: AlertHistory[]
  loading: boolean
  onResolve: (id: number) => void
}) {
  if (loading) {
    return (
      <div className={`${APPLE_CARD_CLASS} p-6`}>
        <div className="animate-pulse">
          <div className="h-6 w-28 rounded-[8px] bg-[#eceef2] dark:bg-[#2c2c2e] mb-4" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-[14px] bg-[#f5f5f7] dark:bg-[#2c2c2e] mb-3" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`${APPLE_CARD_CLASS} p-6`}>
      <SectionTitle title="告警历史" />
      <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
        {alerts.length === 0 ? (
          <p className="text-[#8e8e93] dark:text-gray-400">暂无告警记录</p>
        ) : (
          alerts.map((alert) => (
            <div key={alert.id} className="rounded-[14px] bg-[#f5f5f7] dark:bg-[#2c2c2e] p-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[15px] font-medium text-[#1d1d1f] dark:text-white">{alert.ruleName}</span>
                  <SeverityBadge severity={alert.severity} />
                  <StatusBadge status={alert.status || 'PENDING'} />
                </div>
                <div className="text-sm text-[#3a3a3c] dark:text-gray-300">{alert.message}</div>
                <div className="text-xs text-[#8e8e93] dark:text-gray-400 mt-1">{formatTime(alert.createdAt)}</div>
              </div>
              {alert.status === 'PENDING' && (
                <button
                  onClick={() => onResolve(alert.id)}
                  className="inline-flex h-8 items-center justify-center px-3 rounded-full bg-white dark:bg-[#1c1c1e] text-[#0a84ff] font-medium text-[13px] shadow-sm border border-[#0a84ff]/20 hover:bg-[#f5faff] dark:hover:bg-[#2c2c2e] transition-colors"
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
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [runningCheck, setRunningCheck] = useState(false)
  const [metrics, setMetrics] = useState<DataFreshnessMetrics | null>(null)
  const [rules, setRules] = useState<AlertRule[]>([])
  const [alerts, setAlerts] = useState<AlertHistory[]>([])
  const [sources, setSources] = useState<DataSourceStatus[]>([])

  const pendingAlerts = useMemo(() => alerts.filter((item) => item.status === 'PENDING').length, [alerts])
  const unhealthySources = useMemo(
    () => sources.filter((item) => item.status && item.status !== 'HEALTHY').length,
    [sources]
  )

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [metricsRes, rulesRes, alertsRes, sourcesRes] = await Promise.all([
        getDataFreshness(),
        getAllRules(),
        getAlertHistory(0, 20),
        getAllDataSources(),
      ])
      setMetrics((metricsRes as { data?: DataFreshnessMetrics } | null)?.data || null)
      setRules((rulesRes as { data?: AlertRule[] } | null)?.data || [])
      setAlerts((alertsRes as { data?: AlertHistory[] } | null)?.data || [])
      setSources((sourcesRes as { data?: DataSourceStatus[] } | null)?.data || [])
    } catch {
      showToast('加载监控数据失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    void loadData()
    const interval = setInterval(() => {
      void loadData()
    }, 30000)
    return () => clearInterval(interval)
  }, [loadData])

  const handleResolveAlert = async (id: number) => {
    try {
      await resolveAlert(id)
      showToast('告警已标记为已处理', 'success')
      await loadData()
    } catch {
      showToast('操作失败', 'error')
    }
  }

  const handleToggleRule = async (id: number, enabled: boolean) => {
    try {
      await setRuleEnabled(id, enabled)
      setRules((prev) => prev.map((rule) => (rule.id === id ? { ...rule, enabled } : rule)))
      showToast(enabled ? '规则已启用' : '规则已停用', 'success')
    } catch {
      showToast('规则状态更新失败', 'error')
    }
  }

  const handleRunCheck = async () => {
    try {
      setRunningCheck(true)
      await runMonitoringCheck()
      showToast('监控检查已执行', 'success')
      setTimeout(() => {
        void loadData()
      }, 1000)
    } catch {
      showToast('执行失败', 'error')
    } finally {
      setRunningCheck(false)
    }
  }

  return (
    <div className="space-y-6 [font-family:-apple-system,BlinkMacSystemFont,'SF_Pro_Text','Helvetica_Neue','Segoe_UI',sans-serif]">
      <div className={`${APPLE_CARD_CLASS} p-6`}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-[34px] leading-none font-semibold tracking-[-0.03em] text-[#1d1d1f] dark:text-white">监控中心</h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
              每 30 秒刷新
            </span>
          </div>
          <p className="text-[#8e8e93] dark:text-gray-400">数据新鲜度监控与告警系统</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-[16px] border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-[#1c1c1e]/70 px-4 py-3">
          <div className="text-xs text-[#8e8e93] dark:text-gray-400 mb-1">待处理告警</div>
          <div className="text-[24px] leading-none font-semibold tabular-nums text-[#ff3b30]">{pendingAlerts}</div>
        </div>
        <div className="rounded-[16px] border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-[#1c1c1e]/70 px-4 py-3">
          <div className="text-xs text-[#8e8e93] dark:text-gray-400 mb-1">异常数据源</div>
          <div className={`text-[24px] leading-none font-semibold tabular-nums ${unhealthySources > 0 ? 'text-[#ff9500]' : 'text-[#34c759]'}`}>
            {unhealthySources}
          </div>
        </div>
        <div className="rounded-[16px] border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-[#1c1c1e]/70 px-4 py-3">
          <div className="text-xs text-[#8e8e93] dark:text-gray-400 mb-1">规则总数</div>
          <div className="text-[24px] leading-none font-semibold tabular-nums text-[#1d1d1f] dark:text-white">{rules.length}</div>
        </div>
      </div>

      <DataFreshnessCard
        metrics={metrics}
        loading={loading}
        runningCheck={runningCheck}
        onRunCheck={handleRunCheck}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <AlertRulesCard rules={rules} loading={loading} onToggle={handleToggleRule} />
        <DataSourcesCard sources={sources} loading={loading} />
      </div>

      <AlertHistoryCard alerts={alerts} loading={loading} onResolve={handleResolveAlert} />
    </div>
  )
}
