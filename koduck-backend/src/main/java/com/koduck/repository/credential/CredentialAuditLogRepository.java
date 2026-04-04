package com.koduck.repository.credential;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.entity.credential.CredentialAuditLog;

/**
 * 凭证审计日志操作仓库，提供凭证审计日志数据的数据库访问。
 *
 * @author Koduck Team
 */
@Repository
public interface CredentialAuditLogRepository extends JpaRepository<CredentialAuditLog, Long> {

    /**
     * 根据用户 ID 分页查询审计日志。
     *
     * @param userId 用户 ID
     * @param pageable 分页信息
     * @return 凭证审计日志分页结果
     */
    Page<CredentialAuditLog> findByUserId(Long userId, Pageable pageable);

    /**
     * 根据凭证 ID 查询审计日志。
     *
     * @param credentialId 凭证 ID
     * @return 凭证审计日志列表
     */
    List<CredentialAuditLog> findByCredentialId(Long credentialId);

    /**
     * 根据用户 ID 和操作类型查询审计日志。
     *
     * @param userId 用户 ID
     * @param action 操作类型
     * @return 凭证审计日志列表
     */
    List<CredentialAuditLog> findByUserIdAndAction(
            Long userId,
            CredentialAuditLog.ActionType action);

    /**
     * 根据用户 ID 查询指定时间范围内的审计日志。
     *
     * @param userId 用户 ID
     * @param startTime 开始时间
     * @param endTime 结束时间
     * @return 凭证审计日志列表
     */
    @Query("SELECT l FROM CredentialAuditLog l WHERE l.userId = :userId "
            + "AND l.createdAt BETWEEN :startTime AND :endTime "
            + "ORDER BY l.createdAt DESC")
    List<CredentialAuditLog> findByUserIdAndTimeRange(
            @Param("userId") Long userId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime);

    /**
     * 统计用户指定操作类型在指定时间之后的审计日志数量。
     *
     * @param userId 用户 ID
     * @param action 操作类型
     * @param since 起始时间
     * @return 匹配的审计日志数量
     */
    @Query("SELECT COUNT(l) FROM CredentialAuditLog l WHERE l.userId = :userId "
            + "AND l.action = :action AND l.createdAt >= :since")
    long countByUserIdAndActionAndTimeAfter(
            @Param("userId") Long userId,
            @Param("action") CredentialAuditLog.ActionType action,
            @Param("since") LocalDateTime since);

    /**
     * 查询用户最近的审计日志。
     *
     * @param userId 用户 ID
     * @param pageable 分页信息
     * @return 凭证审计日志列表
     */
    @Query("SELECT l FROM CredentialAuditLog l WHERE l.userId = :userId "
            + "ORDER BY l.createdAt DESC")
    List<CredentialAuditLog> findRecentByUserId(
            @Param("userId") Long userId,
            Pageable pageable);
}
