package com.koduck.repository.strategy;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.koduck.entity.strategy.AlertHistory;

/**
 * 告警历史操作仓库，提供告警历史数据的数据库访问。
 *
 * @author Koduck Team
 */
@Repository
public interface AlertHistoryRepository extends JpaRepository<AlertHistory, Long> {

    /**
     * 根据状态查询告警。
     *
     * @param status 告警状态
     * @return 告警历史列表
     */
    List<AlertHistory> findByStatus(String status);

    /**
     * 查询待处理的告警。
     *
     * @return 待处理告警列表
     */
    @Query("SELECT a FROM AlertHistory a WHERE a.status = 'PENDING' "
            + "ORDER BY a.createdAt DESC")
    List<AlertHistory> findPendingAlerts();

    /**
     * 根据严重级别查询告警。
     *
     * @param severity 告警严重级别
     * @return 告警历史列表
     */
    List<AlertHistory> findBySeverity(String severity);

    /**
     * 分页查询最近的告警。
     *
     * @param pageable 分页信息
     * @return 告警历史分页结果
     */
    Page<AlertHistory> findAllByOrderByCreatedAtDesc(Pageable pageable);

    /**
     * 查询指定时间之后创建的告警。
     *
     * @param time 时间阈值
     * @return 告警历史列表
     */
    List<AlertHistory> findByCreatedAtAfter(LocalDateTime time);

    /**
     * 查询指定规则的未解决告警。
     *
     * @param ruleId 告警规则 ID
     * @return 告警历史列表
     */
    @Query("SELECT a FROM AlertHistory a WHERE a.alertRuleId = :ruleId "
            + "AND a.status = 'PENDING'")
    List<AlertHistory> findPendingByRuleId(Long ruleId);

    /**
     * 按严重级别统计告警数量。
     *
     * @param since 时间阈值
     * @return 严重级别统计列表
     */
    @Query("SELECT a.severity, COUNT(a) FROM AlertHistory a "
            + "WHERE a.createdAt >= :since GROUP BY a.severity")
    List<Object[]> countBySeveritySince(LocalDateTime since);
}
