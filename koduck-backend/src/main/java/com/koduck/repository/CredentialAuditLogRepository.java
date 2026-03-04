package com.koduck.repository;

import com.koduck.entity.CredentialAuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 凭证审计日志 Repository
 */
@Repository
public interface CredentialAuditLogRepository extends JpaRepository<CredentialAuditLog, Long> {

    /**
     * 根据用户 ID 查询审计日志（分页）
     */
    Page<CredentialAuditLog> findByUserId(Long userId, Pageable pageable);

    /**
     * 根据凭证 ID 查询审计日志
     */
    List<CredentialAuditLog> findByCredentialId(Long credentialId);

    /**
     * 根据用户 ID 和操作类型查询审计日志
     */
    List<CredentialAuditLog> findByUserIdAndAction(Long userId, CredentialAuditLog.ActionType action);

    /**
     * 查询用户在时间范围内的审计日志
     */
    @Query("SELECT l FROM CredentialAuditLog l WHERE l.userId = :userId AND l.createdAt BETWEEN :startTime AND :endTime ORDER BY l.createdAt DESC")
    List<CredentialAuditLog> findByUserIdAndTimeRange(
            @Param("userId") Long userId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime);

    /**
     * 统计用户在时间范围内的操作次数
     */
    @Query("SELECT COUNT(l) FROM CredentialAuditLog l WHERE l.userId = :userId AND l.action = :action AND l.createdAt >= :since")
    long countByUserIdAndActionAndTimeAfter(
            @Param("userId") Long userId,
            @Param("action") CredentialAuditLog.ActionType action,
            @Param("since") LocalDateTime since);

    /**
     * 查询最近的审计日志
     */
    @Query("SELECT l FROM CredentialAuditLog l WHERE l.userId = :userId ORDER BY l.createdAt DESC")
    List<CredentialAuditLog> findRecentByUserId(@Param("userId") Long userId, Pageable pageable);
}
