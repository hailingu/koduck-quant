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
 * Repository for alert history.
 */
@Repository
public interface AlertHistoryRepository extends JpaRepository<AlertHistory, Long> {
    
    /**
     * Find alerts by status.
     */
    List<AlertHistory> findByStatus(String status);
    
    /**
     * Find pending alerts.
     */
    @Query("SELECT a FROM AlertHistory a WHERE a.status = 'PENDING' ORDER BY a.createdAt DESC")
    List<AlertHistory> findPendingAlerts();
    
    /**
     * Find alerts by severity.
     */
    List<AlertHistory> findBySeverity(String severity);
    
    /**
     * Find recent alerts with pagination.
     */
    Page<AlertHistory> findAllByOrderByCreatedAtDesc(Pageable pageable);
    
    /**
     * Find alerts created after a specific time.
     */
    List<AlertHistory> findByCreatedAtAfter(LocalDateTime time);
    
    /**
     * Find unresolved alerts for a specific rule.
     */
    @Query("SELECT a FROM AlertHistory a WHERE a.alertRuleId = :ruleId AND a.status = 'PENDING'")
    List<AlertHistory> findPendingByRuleId(Long ruleId);
    
    /**
     * Count alerts by severity.
     */
    @Query("SELECT a.severity, COUNT(a) FROM AlertHistory a WHERE a.createdAt >= :since GROUP BY a.severity")
    List<Object[]> countBySeveritySince(LocalDateTime since);
}
