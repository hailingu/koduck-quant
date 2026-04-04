package com.koduck.repository.auth;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.entity.auth.PasswordResetToken;

/**
 * 密码重置令牌操作仓库，提供密码重置令牌数据的数据库访问。
 *
     * @author Koduck Team
     */
    @Repository
    public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {

    /**
     * 根据令牌哈希查询令牌。
     *
     * @param tokenHash 令牌哈希
     * @return 密码重置令牌
     */
    Optional<PasswordResetToken> findByTokenHash(String tokenHash);

    /**
     * 根据用户 ID 查询令牌列表。
     *
     * @param userId 用户 ID
     * @return 密码重置令牌列表
     */
    List<PasswordResetToken> findByUserId(Long userId);

    /**
     * 根据用户 ID 查询最新有效令牌。
     *
     * @param userId 用户 ID
     * @param now 当前时间
     * @return 密码重置令牌
     */
    @Query("SELECT t FROM PasswordResetToken t WHERE t.userId = :userId "
           + "AND t.used = false AND t.expiresAt > :now ORDER BY t.createdAt DESC")
    Optional<PasswordResetToken> findLatestValidTokenByUserId(
        @Param("userId") Long userId,
        @Param("now") LocalDateTime now
    );

    /**
     * 根据用户 ID 删除所有令牌。
     *
     * @param userId 用户 ID
     */
    @Modifying
    @Query("DELETE FROM PasswordResetToken t WHERE t.userId = :userId")
    void deleteByUserId(@Param("userId") Long userId);

    /**
     * 删除指定时间之前的所有过期令牌。
     *
     * @param now 当前时间
     */
    @Modifying
    @Query("DELETE FROM PasswordResetToken t WHERE t.expiresAt < :now")
    void deleteAllExpiredBefore(@Param("now") LocalDateTime now);

    /**
     * 检查用户是否存在有效令牌。
     *
     * @param userId 用户 ID
     * @param now 当前时间
     * @return 如果存在有效令牌返回 true
     */
    @Query("SELECT COUNT(t) > 0 FROM PasswordResetToken t WHERE t.userId = :userId "
           + "AND t.used = false AND t.expiresAt > :now")
    boolean existsValidTokenByUserId(
        @Param("userId") Long userId,
        @Param("now") LocalDateTime now
    );

    /**
     * 统计用户指定时间之后创建的令牌数量。
     *
     * @param userId 用户 ID
     * @param since 起始时间
     * @return 令牌数量
     */
    @Query("SELECT COUNT(t) FROM PasswordResetToken t "
           + "WHERE t.userId = :userId AND t.createdAt > :since")
    long countByUserIdAndCreatedAtAfter(
        @Param("userId") Long userId,
        @Param("since") LocalDateTime since
    );
}
