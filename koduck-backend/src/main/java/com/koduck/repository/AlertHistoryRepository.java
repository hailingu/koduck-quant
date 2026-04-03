package com.koduck.repository;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.koduck.entity.AlertHistory;

/**
 * Repository for alert history operations.
 *
 * @author Koduck Team
 */
@Repository
public interface AlertHistoryRepository extends JpaRepository<AlertHistory, Long> {

    /**
     * Find alerts by status.
     *
     * @param status the alert status
     * @return list of alert history
     */
    List<AlertHistory> findByStatus(String status);

    /**
     * Find pending alerts.
     *
     * @return list of pending alerts
     */
    @Query("SELECT a FROM AlertHistory a WHERE a.status = 'PENDING' "
            + "ORDER BY a.createdAt DESC")
    List<AlertHistory> findPendingAlerts();

    /**
     * Find alerts by severity.
     *
     * @param severity the alert severity
     * @return list of alert history
     */
    List<AlertHistory> findBySeverity(String severity);

    /**
     * Find recent alerts with pagination.
     *
     * @param pageable the pagination information
     * @return page of alert history
     */
    Page<AlertHistory> findAllByOrderByCreatedAtDesc(Pageable pageable);

    /**
     * Find alerts created after a specific time.
     *
     * @param time the time threshold
     * @return list of alert history
     */
    List<AlertHistory> findByCreatedAtAfter(LocalDateTime time);

    /**
     * Find unresolved alerts for a specific rule.
     *
     * @param ruleId the alert rule ID
     * @return list of alert history
     */
    @Query("SELECT a FROM AlertHistory a WHERE a.alertRuleId = :ruleId "
            + "AND a.status = 'PENDING'")
    List<AlertHistory> findPendingByRuleId(Long ruleId);

    /**
     * Count alerts by severity.
     *
     * @param since the time threshold
     * @return list of severity counts
     */
    @Query("SELECT a.severity, COUNT(a) FROM AlertHistory a "
            + "WHERE a.createdAt >= :since GROUP BY a.severity")
    List<Object[]> countBySeveritySince(LocalDateTime since);
}
