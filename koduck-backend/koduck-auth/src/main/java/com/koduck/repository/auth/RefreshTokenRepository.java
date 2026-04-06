package com.koduck.repository.auth;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.entity.auth.RefreshToken;

/**
 * 刷新令牌操作仓库，提供刷新令牌数据的数据库访问。
 *
 * @author Koduck Team
 */
@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    /**
     * 根据令牌哈希查询刷新令牌。
     *
     * @param tokenHash 令牌哈希
     * @return 刷新令牌
     */
    Optional<RefreshToken> findByTokenHash(String tokenHash);

    /**
     * 根据用户 ID 查询所有刷新令牌。
     *
     * @param userId 用户 ID
     * @return 刷新令牌列表
     */
    List<RefreshToken> findByUserId(Long userId);

    /**
     * 根据用户 ID 查询刷新令牌列表，按创建时间排序。
     *
     * @param userId 用户 ID
     * @return 刷新令牌列表
     */
    List<RefreshToken> findByUserIdOrderByCreatedAtAsc(Long userId);

    /**
     * 根据令牌哈希删除刷新令牌。
     *
     * @param tokenHash 令牌哈希
     */
    @Modifying
    @Query("DELETE FROM RefreshToken rt WHERE rt.tokenHash = :tokenHash")
    void deleteByTokenHash(@Param("tokenHash") String tokenHash);

    /**
     * 根据用户 ID 删除所有刷新令牌。
     *
     * @param userId 用户 ID
     */
    @Modifying
    @Query("DELETE FROM RefreshToken rt WHERE rt.userId = :userId")
    void deleteByUserId(@Param("userId") Long userId);

    /**
     * 删除指定时间之前的所有过期刷新令牌。
     *
     * @param now 当前时间
     */
    @Modifying
    @Query("DELETE FROM RefreshToken rt WHERE rt.expiresAt < :now")
    void deleteAllExpiredBefore(@Param("now") LocalDateTime now);

    /**
     * 根据令牌哈希检查刷新令牌是否存在。
     *
     * @param tokenHash 令牌哈希
     * @return 如果存在返回 true
     */
    boolean existsByTokenHash(String tokenHash);

    /**
     * 根据用户 ID 统计刷新令牌数量。
     *
     * @param userId 用户 ID
     * @return 令牌数量
     */
    long countByUserId(Long userId);
}
