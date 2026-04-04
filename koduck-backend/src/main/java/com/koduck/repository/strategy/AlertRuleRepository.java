package com.koduck.repository.strategy;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.koduck.entity.strategy.AlertRule;

/**
 * Repository for alert rule configuration.
 *
 * @author Koduck Team
 */
@Repository
public interface AlertRuleRepository extends JpaRepository<AlertRule, Long> {

    /**
     * Find all enabled rules.
     *
     * @return the list of enabled alert rules
     */
    List<AlertRule> findByEnabledTrue();

    /**
     * Find rule by name.
     *
     * @param ruleName the rule name
     * @return the optional alert rule
     */
    Optional<AlertRule> findByRuleName(String ruleName);

    /**
     * Find rules by type.
     *
     * @param ruleType the rule type
     * @return the list of alert rules
     */
    List<AlertRule> findByRuleType(String ruleType);

    /**
     * Find rules by severity.
     *
     * @param severity the severity level
     * @return the list of alert rules
     */
    List<AlertRule> findBySeverity(String severity);
}
