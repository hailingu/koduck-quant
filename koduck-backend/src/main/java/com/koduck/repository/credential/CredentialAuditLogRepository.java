package com.koduck.repository.credential;

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
 * Repository for credential audit log operations.
 *
 * @author Koduck Team
 */
@Repository
public interface CredentialAuditLogRepository extends JpaRepository<CredentialAuditLog, Long> {

    /**
     * Find audit logs by user ID with pagination.
     *
     * @param userId   the user ID
     * @param pageable the pagination information
     * @return a page of credential audit logs
     */
    Page<CredentialAuditLog> findByUserId(Long userId, Pageable pageable);

    /**
     * Find audit logs by credential ID.
     *
     * @param credentialId the credential ID
     * @return a list of credential audit logs
     */
    List<CredentialAuditLog> findByCredentialId(Long credentialId);

    /**
     * Find audit logs by user ID and action type.
     *
     * @param userId the user ID
     * @param action the action type
     * @return a list of credential audit logs
     */
    List<CredentialAuditLog> findByUserIdAndAction(
            Long userId,
            CredentialAuditLog.ActionType action);

    /**
     * Find audit logs by user ID within a time range.
     *
     * @param userId    the user ID
     * @param startTime the start time
     * @param endTime   the end time
     * @return a list of credential audit logs
     */
    @Query("SELECT l FROM CredentialAuditLog l WHERE l.userId = :userId "
            + "AND l.createdAt BETWEEN :startTime AND :endTime "
            + "ORDER BY l.createdAt DESC")
    List<CredentialAuditLog> findByUserIdAndTimeRange(
            @Param("userId") Long userId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime);

    /**
     * Count audit logs by user ID and action type after a specific time.
     *
     * @param userId the user ID
     * @param action the action type
     * @param since  the start time
     * @return the count of matching audit logs
     */
    @Query("SELECT COUNT(l) FROM CredentialAuditLog l WHERE l.userId = :userId "
            + "AND l.action = :action AND l.createdAt >= :since")
    long countByUserIdAndActionAndTimeAfter(
            @Param("userId") Long userId,
            @Param("action") CredentialAuditLog.ActionType action,
            @Param("since") LocalDateTime since);

    /**
     * Find recent audit logs by user ID.
     *
     * @param userId   the user ID
     * @param pageable the pagination information
     * @return a list of credential audit logs
     */
    @Query("SELECT l FROM CredentialAuditLog l WHERE l.userId = :userId "
            + "ORDER BY l.createdAt DESC")
    List<CredentialAuditLog> findRecentByUserId(
            @Param("userId") Long userId,
            Pageable pageable);
}
