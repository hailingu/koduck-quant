package com.koduck.repository;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.entity.CredentialAuditLog;

/**
 *  Repository
 */
@Repository
public interface CredentialAuditLogRepository extends JpaRepository<CredentialAuditLog, Long> {

    /**
     *  ID （）
     */
    Page<CredentialAuditLog> findByUserId(Long userId, Pageable pageable);

    /**
     *  ID 
     */
    List<CredentialAuditLog> findByCredentialId(Long credentialId);

    /**
     *  ID 
     */
    List<CredentialAuditLog> findByUserIdAndAction(Long userId, CredentialAuditLog.ActionType action);

    /**
     * 
     */
    @Query("SELECT l FROM CredentialAuditLog l WHERE l.userId = :userId AND l.createdAt BETWEEN :startTime AND :endTime ORDER BY l.createdAt DESC")
    List<CredentialAuditLog> findByUserIdAndTimeRange(
            @Param("userId") Long userId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime);

    /**
     * 
     */
    @Query("SELECT COUNT(l) FROM CredentialAuditLog l WHERE l.userId = :userId AND l.action = :action AND l.createdAt >= :since")
    long countByUserIdAndActionAndTimeAfter(
            @Param("userId") Long userId,
            @Param("action") CredentialAuditLog.ActionType action,
            @Param("since") LocalDateTime since);

    /**
     * 
     */
    @Query("SELECT l FROM CredentialAuditLog l WHERE l.userId = :userId ORDER BY l.createdAt DESC")
    List<CredentialAuditLog> findRecentByUserId(@Param("userId") Long userId, Pageable pageable);
}
