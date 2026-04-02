package com.koduck.repository;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.koduck.entity.AlertRule;

/**
 * Repository for alert rule configuration.
 */
@Repository
public interface AlertRuleRepository extends JpaRepository<AlertRule, Long> {
    
    /**
     * Find all enabled rules.
     */
    List<AlertRule> findByEnabledTrue();
    
    /**
     * Find rule by name.
     */
    Optional<AlertRule> findByRuleName(String ruleName);
    
    /**
     * Find rules by type.
     */
    List<AlertRule> findByRuleType(String ruleType);
    
    /**
     * Find rules by severity.
     */
    List<AlertRule> findBySeverity(String severity);
}
