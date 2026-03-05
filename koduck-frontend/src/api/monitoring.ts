import request from './request';

// Types
export interface AlertRule {
  id: number;
  ruleName: string;
  ruleType: string;
  metricName: string;
  threshold: number;
  operator: string;
  severity: string;
  enabled: boolean;
  cooldownMinutes: number;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface AlertHistory {
  id: number;
  alertRuleId: number;
  ruleName: string;
  severity: string;
  metricName: string;
  metricValue: number;
  threshold: number;
  message: string;
  status: string;
  notified: boolean;
  resolvedAt: string | null;
  createdAt: string;
}

export interface DataSourceStatus {
  id: number;
  sourceName: string;
  sourceType: string;
  status: string;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  failureCount: number;
  consecutiveFailures: number;
  responseTimeMs: number | null;
  metadata: Record<string, unknown> | null;
}

export interface DataFreshnessMetrics {
  totalStocks: number;
  delayedStocks: number;
  delayedPercentage: number;
  thresholdSeconds: number;
  maxDelaySeconds?: number;
  status: string;
}

export interface DashboardSummary {
  dataFreshness: DataFreshnessMetrics;
  alerts: {
    total: number;
    critical: number;
    warning: number;
  };
  dataSources: number;
  healthySources: number;
  recentAlerts: AlertHistory[];
}

// API functions

// Data Freshness
export function getDataFreshness() {
  return request.get<{ data: DataFreshnessMetrics }>('/api/v1/monitoring/freshness');
}

export function getDelayedStocks(thresholdSeconds = 30, limit = 50) {
  return request.get<{ data: any[] }>('/api/v1/monitoring/delayed-stocks', {
    params: { thresholdSeconds, limit },
  });
}

export function checkStockDelay(symbol: string, thresholdSeconds = 30) {
  return request.get<{ data: Record<string, any> }>(`/api/v1/monitoring/stock/${symbol}/delay`, {
    params: { thresholdSeconds },
  });
}

// Alert Rules
export function getAllRules() {
  return request.get<{ data: AlertRule[] }>('/api/v1/monitoring/rules');
}

export function getEnabledRules() {
  return request.get<{ data: AlertRule[] }>('/api/v1/monitoring/rules/enabled');
}

export function getRuleById(id: number) {
  return request.get<{ data: AlertRule }>(`/api/v1/monitoring/rules/${id}`);
}

export function createRule(rule: Partial<AlertRule>) {
  return request.post<{ data: AlertRule }>('/api/v1/monitoring/rules', rule);
}

export function updateRule(id: number, rule: Partial<AlertRule>) {
  return request.put<{ data: AlertRule }>(`/api/v1/monitoring/rules/${id}`, rule);
}

export function deleteRule(id: number) {
  return request.delete<void>(`/api/v1/monitoring/rules/${id}`);
}

export function setRuleEnabled(id: number, enabled: boolean) {
  return request.patch<{ data: AlertRule }>(`/api/v1/monitoring/rules/${id}/enable`, null, {
    params: { enabled },
  });
}

// Alert History
export function getAlertHistory(page = 0, size = 20) {
  return request.get<{ data: AlertHistory[] }>('/api/v1/monitoring/alerts', {
    params: { page, size },
  });
}

export function getPendingAlerts() {
  return request.get<{ data: AlertHistory[] }>('/api/v1/monitoring/alerts/pending');
}

export function getAlertsBySeverity(severity: string) {
  return request.get<{ data: AlertHistory[] }>(`/api/v1/monitoring/alerts/severity/${severity}`);
}

export function resolveAlert(id: number) {
  return request.post<{ data: AlertHistory }>(`/api/v1/monitoring/alerts/${id}/resolve`);
}

export function getAlertStatistics() {
  return request.get<{ data: Record<string, number> }>('/api/v1/monitoring/alerts/statistics');
}

// Data Sources
export function getAllDataSources() {
  return request.get<{ data: DataSourceStatus[] }>('/api/v1/monitoring/datasources');
}

export function getDataSourceByName(sourceName: string) {
  return request.get<{ data: DataSourceStatus }>(`/api/v1/monitoring/datasources/${sourceName}`);
}

export function getUnhealthyDataSources() {
  return request.get<{ data: DataSourceStatus[] }>('/api/v1/monitoring/datasources/unhealthy');
}

// Dashboard
export function getDashboardSummary() {
  return request.get<{ data: DashboardSummary }>('/api/v1/monitoring/dashboard');
}

export function runMonitoringCheck() {
  return request.post<void>('/api/v1/monitoring/check');
}
