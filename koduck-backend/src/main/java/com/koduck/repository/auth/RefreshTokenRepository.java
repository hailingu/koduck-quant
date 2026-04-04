package com.koduck.repository.auth;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.entity.RefreshToken;

/**
 * Repository for refresh token operations.
 *
 * @author Koduck Team
 */
@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    /**
     * Find refresh token by token hash.
     *
     * @param tokenHash the token hash
     * @return optional of refresh token
     */
    Optional<RefreshToken> findByTokenHash(String tokenHash);

    /**
     * Find all refresh tokens by user ID.
     *
     * @param userId the user ID
     * @return list of refresh tokens
     */
    List<RefreshToken> findByUserId(Long userId);

    /**
     * Find refresh tokens by user ID, ordered by creation time.
     *
     * @param userId the user ID
     * @return list of refresh tokens
     */
    List<RefreshToken> findByUserIdOrderByCreatedAtAsc(Long userId);

    /**
     * Delete refresh token by token hash.
     *
     * @param tokenHash the token hash
     */
    @Modifying
    @Query("DELETE FROM RefreshToken rt WHERE rt.tokenHash = :tokenHash")
    void deleteByTokenHash(@Param("tokenHash") String tokenHash);

    /**
     * Delete all refresh tokens by user ID.
     *
     * @param userId the user ID
     */
    @Modifying
    @Query("DELETE FROM RefreshToken rt WHERE rt.userId = :userId")
    void deleteByUserId(@Param("userId") Long userId);

    /**
     * Delete all expired refresh tokens before given time.
     *
     * @param now the current time
     */
    @Modifying
    @Query("DELETE FROM RefreshToken rt WHERE rt.expiresAt < :now")
    void deleteAllExpiredBefore(@Param("now") LocalDateTime now);

    /**
     * Check if refresh token exists by token hash.
     *
     * @param tokenHash the token hash
     * @return true if exists
     */
    boolean existsByTokenHash(String tokenHash);

    /**
     * Count refresh tokens by user ID.
     *
     * @param userId the user ID
     * @return the count
     */
    long countByUserId(Long userId);
}
