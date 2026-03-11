import { useEffect, useState, useCallback, useMemo } from 'react'

import { useToast } from '@/hooks/useToast'
import {
  getDataFreshness,
  getAllRules,
  getAlertHistory,
  getAllDataSources,
  createRule,
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

const METRIC_OPTIONS = [
  {
    label: '单只股票延迟秒数',
    metricName: 'stock_delay_seconds',
    ruleType: 'latency',
    defaultThreshold: 30,
    defaultOperator: '>',
    defaultSeverity: 'WARNING',
  },
  {
    label: '股票延迟比例 (%)',
    metricName: 'stock_delay_percentage',
    ruleType: 'latency',
    defaultThreshold: 10,
    defaultOperator: '>',
    defaultSeverity: 'CRITICAL',
  },
  {
    label: '数据源连续失败次数',
    metricName: 'consecutive_failures',
    ruleType: 'availability',
    defaultThreshold: 3,
    defaultOperator: '>=',
    defaultSeverity: 'CRITICAL',
  },
  {
    label: '缓存命中率 (%)',
    metricName: 'cache_hit_rate',
    ruleType: 'performance',
    defaultThreshold: 80,
    defaultOperator: '<',
    defaultSeverity: 'WARNING',
  },
] as const

const OPERATOR_OPTIONS = ['>', '>=', '<', '<=', '=', '!='] as const
const SEVERITY_OPTIONS = ['WARNING', 'CRITICAL'] as const

type CreateRuleForm = {
  ruleName: string
  metricName: (typeof METRIC_OPTIONS)[number]['metricName']
  ruleType: (typeof METRIC_OPTIONS)[number]['ruleType']
  threshold: string
  operator: (typeof OPERATOR_OPTIONS)[number]
  severity: (typeof SEVERITY_OPTIONS)[number]
  cooldownMinutes: string
  description: string
  enabled: boolean
}

const getMetricOption = (metricName: string) =>
  METRIC_OPTIONS.find((item) => item.metricName === metricName) || METRIC_OPTIONS[0]

const getDefaultCreateRuleForm = (): CreateRuleForm => ({
  ruleName: '',
  metricName: METRIC_OPTIONS[0].metricName,
  ruleType: METRIC_OPTIONS[0].ruleType,
  threshold: String(METRIC_OPTIONS[0].defaultThreshold),
  operator: METRIC_OPTIONS[0].defaultOperator,
  severity: METRIC_OPTIONS[0].defaultSeverity,
  cooldownMinutes: '5',
  description: '',
  enabled: true,
})

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

function CreateRuleModal({
  open,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean
  submitting: boolean
  onClose: () => void
  onSubmit: (payload: Partial<AlertRule>) => void
}) {
  const { showToast } = useToast()
  const [form, setForm] = useState<CreateRuleForm>(getDefaultCreateRuleForm())

  useEffect(() => {
    if (open) {
      setForm(getDefaultCreateRuleForm())
    }
  }, [open])

  if (!open) return null

  const handleSubmit = () => {
    const trimmedName = form.ruleName.trim()
    if (!trimmedName) {
      showToast('请输入规则名称', 'error')
      return
    }

    const threshold = Number(form.threshold)
    if (Number.isNaN(threshold)) {
      showToast('阈值必须是数字', 'error')
      return
    }

    const cooldownMinutes = Number(form.cooldownMinutes)
    if (!Number.isInteger(cooldownMinutes) || cooldownMinutes <= 0) {
      showToast('冷却时间必须是正整数（分钟）', 'error')
      return
    }

    onSubmit({
      ruleName: trimmedName,
      ruleType: form.ruleType,
      metricName: form.metricName,
      threshold,
      operator: form.operator,
      severity: form.severity,
      cooldownMinutes,
      description: form.description.trim(),
      enabled: form.enabled,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl rounded-[20px] bg-white dark:bg-[#1c1c1e] border border-gray-200 dark:border-white/10 shadow-2xl">
        <div className="p-6 border-b border-gray-200 dark:border-white/10">
          <h3 className="text-xl font-semibold text-[#1d1d1f] dark:text-white">新增告警规则</h3>
          <p className="text-sm text-[#8e8e93] dark:text-gray-400 mt-1">创建后将立即参与监控检查。</p>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm text-[#3a3a3c] dark:text-gray-300 mb-1">规则名称</label>
            <input
              value={form.ruleName}
              onChange={(e) => setForm((prev) => ({ ...prev, ruleName: e.target.value }))}
              placeholder="例如：核心行情延迟告警"
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#2c2c2e] px-3 py-2 text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0a84ff]"
            />
          </div>

          <div>
            <label className="block text-sm text-[#3a3a3c] dark:text-gray-300 mb-1">监控指标</label>
            <select
              value={form.metricName}
              onChange={(e) => {
                const option = getMetricOption(e.target.value)
                setForm((prev) => ({
                  ...prev,
                  metricName: option.metricName,
                  ruleType: option.ruleType,
                  threshold: String(option.defaultThreshold),
                  operator: option.defaultOperator,
                  severity: option.defaultSeverity,
                }))
              }}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#2c2c2e] px-3 py-2 text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0a84ff]"
            >
              {METRIC_OPTIONS.map((item) => (
                <option key={item.metricName} value={item.metricName}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-[#3a3a3c] dark:text-gray-300 mb-1">比较符</label>
            <select
              value={form.operator}
              onChange={(e) => setForm((prev) => ({ ...prev, operator: e.target.value as CreateRuleForm['operator'] }))}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#2c2c2e] px-3 py-2 text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0a84ff]"
            >
              {OPERATOR_OPTIONS.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-[#3a3a3c] dark:text-gray-300 mb-1">阈值</label>
            <input
              value={form.threshold}
              onChange={(e) => setForm((prev) => ({ ...prev, threshold: e.target.value }))}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#2c2c2e] px-3 py-2 text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0a84ff]"
            />
          </div>

          <div>
            <label className="block text-sm text-[#3a3a3c] dark:text-gray-300 mb-1">告警等级</label>
            <select
              value={form.severity}
              onChange={(e) => setForm((prev) => ({ ...prev, severity: e.target.value as CreateRuleForm['severity'] }))}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#2c2c2e] px-3 py-2 text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0a84ff]"
            >
              {SEVERITY_OPTIONS.map((severity) => (
                <option key={severity} value={severity}>
                  {severity}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-[#3a3a3c] dark:text-gray-300 mb-1">冷却时间（分钟）</label>
            <input
              value={form.cooldownMinutes}
              onChange={(e) => setForm((prev) => ({ ...prev, cooldownMinutes: e.target.value }))}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#2c2c2e] px-3 py-2 text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0a84ff]"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm text-[#3a3a3c] dark:text-gray-300 mb-1">描述</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="例如：当超过 10% 股票延迟时触发严重告警"
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#2c2c2e] px-3 py-2 text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0a84ff]"
            />
          </div>

          <label className="md:col-span-2 inline-flex items-center gap-2 text-sm text-[#3a3a3c] dark:text-gray-300">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))}
              className="rounded border-gray-300 text-[#0a84ff] focus:ring-[#0a84ff]"
            />
            创建后立即启用
          </label>
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-white/10 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="inline-flex h-9 items-center justify-center px-4 rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-white text-sm font-medium hover:bg-gray-50 dark:hover:bg-[#3a3a3c] transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex h-9 items-center justify-center px-4 rounded-full bg-[#0a84ff] text-white text-sm font-medium hover:bg-[#0071e3] transition-colors disabled:opacity-60"
          >
            {submitting ? '创建中...' : '创建规则'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AlertRulesCard({ rules, loading, onToggle, onCreate }: {
  rules: AlertRule[]
  loading: boolean
  onToggle: (id: number, enabled: boolean) => void
  onCreate: () => void
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
      <SectionTitle
        title="告警规则"
        extra={
          <button
            onClick={onCreate}
            className="inline-flex h-8 items-center px-3 rounded-full border border-[#0a84ff]/20 bg-white dark:bg-[#1c1c1e] text-[#0a84ff] font-medium text-[13px] shadow-sm hover:bg-[#f5faff] dark:hover:bg-[#2c2c2e] transition-colors"
          >
            新增规则
          </button>
        }
      />
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
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [creatingRule, setCreatingRule] = useState(false)

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

  const handleCreateRule = async (payload: Partial<AlertRule>) => {
    try {
      setCreatingRule(true)
      await createRule(payload)
      showToast('告警规则创建成功', 'success')
      setCreateDialogOpen(false)
      await loadData()
    } catch (error: any) {
      showToast(error?.message || '创建规则失败', 'error')
    } finally {
      setCreatingRule(false)
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
        <AlertRulesCard
          rules={rules}
          loading={loading}
          onToggle={handleToggleRule}
          onCreate={() => setCreateDialogOpen(true)}
        />
        <DataSourcesCard sources={sources} loading={loading} />
      </div>

      <AlertHistoryCard alerts={alerts} loading={loading} onResolve={handleResolveAlert} />

      <CreateRuleModal
        open={createDialogOpen}
        submitting={creatingRule}
        onClose={() => setCreateDialogOpen(false)}
        onSubmit={handleCreateRule}
      />
    </div>
  )
}
