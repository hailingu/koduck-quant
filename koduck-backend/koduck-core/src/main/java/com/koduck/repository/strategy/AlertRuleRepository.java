package com.koduck.repository.strategy;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.koduck.entity.strategy.AlertRule;

/**
 * 告警规则配置仓库，提供告警规则数据的数据库访问。
 *
 * @author Koduck Team
 */
@Repository
public interface AlertRuleRepository extends JpaRepository<AlertRule, Long> {

    /**
     * 查询所有启用的规则。
     *
     * @return 启用的告警规则列表
     */
    List<AlertRule> findByEnabledTrue();

    /**
     * 根据规则名称查询规则。
     *
     * @param ruleName 规则名称
     * @return 告警规则
     */
    Optional<AlertRule> findByRuleName(String ruleName);

    /**
     * 根据规则类型查询规则。
     *
     * @param ruleType 规则类型
     * @return 告警规则列表
     */
    List<AlertRule> findByRuleType(String ruleType);

    /**
     * 根据严重级别查询规则。
     *
     * @param severity 严重级别
     * @return 告警规则列表
     */
    List<AlertRule> findBySeverity(String severity);
}
