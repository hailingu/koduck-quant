-- V13: Create monitoring and alerting tables for data freshness
-- This migration creates tables for:
-- 1. alert_rule - Alert rule configuration
-- 2. alert_history - Alert history records
-- 3. data_source_status - Data source health status

-- Alert Rule Configuration Table
CREATE TABLE IF NOT EXISTS alert_rule (
    id SERIAL PRIMARY KEY,
    rule_name VARCHAR(100) NOT NULL UNIQUE,
    rule_type VARCHAR(50) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    threshold DECIMAL(18, 4) NOT NULL,
    operator VARCHAR(20) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    cooldown_minutes INTEGER DEFAULT 5,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_rule_type ON alert_rule(rule_type);
CREATE INDEX IF NOT EXISTS idx_alert_rule_enabled ON alert_rule(enabled);
CREATE INDEX IF NOT EXISTS idx_alert_rule_severity ON alert_rule(severity);

-- Alert History Table
CREATE TABLE IF NOT EXISTS alert_history (
    id SERIAL PRIMARY KEY,
    alert_rule_id INTEGER NOT NULL,
    rule_name VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(18, 4),
    threshold DECIMAL(18, 4),
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    notified BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_history_rule_id ON alert_history(alert_rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_status ON alert_history(status);
CREATE INDEX IF NOT EXISTS idx_alert_history_created_at ON alert_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_history_severity ON alert_history(severity);

-- Data Source Status Table
CREATE TABLE IF NOT EXISTS data_source_status (
    id SERIAL PRIMARY KEY,
    source_name VARCHAR(100) NOT NULL UNIQUE,
    source_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'UNKNOWN',
    last_success_at TIMESTAMP WITH TIME ZONE,
    last_failure_at TIMESTAMP WITH TIME ZONE,
    failure_count INTEGER DEFAULT 0,
    consecutive_failures INTEGER DEFAULT 0,
    response_time_ms INTEGER,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_source_status_name ON data_source_status(source_name);
CREATE INDEX IF NOT EXISTS idx_data_source_status_status ON data_source_status(status);

-- Insert default alert rules
INSERT INTO alert_rule (rule_name, rule_type, metric_name, threshold, operator, severity, cooldown_minutes, description) VALUES
    ('single_stock_delay', 'latency', 'stock_delay_seconds', 30, '>', 'WARNING', 5, '单只股票数据延迟超过30秒'),
    ('multiple_stock_delay', 'latency', 'stock_delay_percentage', 10, '>', 'CRITICAL', 5, '超过10%的股票数据延迟超过阈值'),
    ('data_source_failure', 'availability', 'consecutive_failures', 3, '>=', 'CRITICAL', 10, '数据源连续失败3次'),
    ('cache_hit_rate', 'performance', 'cache_hit_rate', 80, '<', 'WARNING', 5, '缓存命中率低于80%')
ON CONFLICT (rule_name) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE alert_rule IS '告警规则配置表';
COMMENT ON TABLE alert_history IS '告警历史记录表';
COMMENT ON TABLE data_source_status IS '数据源状态监控表';
