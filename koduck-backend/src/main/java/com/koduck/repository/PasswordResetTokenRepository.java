package com.koduck.repository;

import com.koduck.entity.PasswordResetToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 密码重置令牌仓库（无外键关联）
 */
@Repository
public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {

    /**
     * 根据令牌哈希查找
     */
    Optional<PasswordResetToken> findByTokenHash(String tokenHash);

    /**
     * 根据用户ID查找所有令牌
     */
    List<PasswordResetToken> findByUserId(Long userId);

    /**
     * 根据用户ID查找最新的有效令牌
     */
    @Query("SELECT t FROM PasswordResetToken t WHERE t.userId = :userId AND t.used = false AND t.expiresAt > :now ORDER BY t.createdAt DESC")
    Optional<PasswordResetToken> findLatestValidTokenByUserId(@Param("userId") Long userId, @Param("now") LocalDateTime now);

    /**
     * 删除指定用户的所有令牌（用于生成新令牌时清理旧令牌）
     */
    @Modifying
    @Query("DELETE FROM PasswordResetToken t WHERE t.userId = :userId")
    void deleteByUserId(@Param("userId") Long userId);

    /**
     * 删除所有过期的令牌（清理任务使用）
     */
    @Modifying
    @Query("DELETE FROM PasswordResetToken t WHERE t.expiresAt < :now")
    void deleteAllExpiredBefore(@Param("now") LocalDateTime now);

    /**
     * 检查是否存在有效令牌
     */
    @Query("SELECT COUNT(t) > 0 FROM PasswordResetToken t WHERE t.userId = :userId AND t.used = false AND t.expiresAt > :now")
    boolean existsValidTokenByUserId(@Param("userId") Long userId, @Param("now") LocalDateTime now);

    /**
     * 统计用户在指定时间后创建的令牌数量（用于限流）
     */
    @Query("SELECT COUNT(t) FROM PasswordResetToken t WHERE t.userId = :userId AND t.createdAt > :since")
    long countByUserIdAndCreatedAtAfter(@Param("userId") Long userId, @Param("since") LocalDateTime since);
}
