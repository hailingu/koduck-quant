package com.koduck.dto.monitoring;

import java.math.BigDecimal;

/**
 * Request body for creating or updating an alert rule.
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
public record AlertRuleRequest(
        String ruleName,
        String ruleType,
        String metricName,
        BigDecimal threshold,
        String operator,
        String severity,
        Boolean enabled,
        Integer cooldownMinutes,
        String description
) {}
