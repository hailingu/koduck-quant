package com.koduck.dto.monitoring;

import java.math.BigDecimal;

/**
 * Request body for creating or updating an alert rule.
 *
 * @author Koduck Team
 * @param ruleName the rule name
 * @param ruleType the rule type
 * @param metricName the metric name
 * @param threshold the threshold
 * @param operator the operator
 * @param severity the severity
 * @param enabled the enabled
 * @param cooldownMinutes the cooldown minutes
 * @param description the description
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
