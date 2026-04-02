package com.koduck.repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.entity.PasswordResetToken;

/**
 * Repository for password reset token operations.
 *
 * @author Koduck Team
 */
@Repository
public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {

    /**
     * Find token by token hash.
     *
     * @param tokenHash the token hash
     * @return the optional password reset token
     */
    Optional<PasswordResetToken> findByTokenHash(String tokenHash);

    /**
     * Find tokens by user ID.
     *
     * @param userId the user ID
     * @return the list of password reset tokens
     */
    List<PasswordResetToken> findByUserId(Long userId);

    /**
     * Find the latest valid token by user ID.
     *
     * @param userId the user ID
     * @param now    the current time
     * @return the optional password reset token
     */
    @Query("SELECT t FROM PasswordResetToken t WHERE t.userId = :userId "
           + "AND t.used = false AND t.expiresAt > :now ORDER BY t.createdAt DESC")
    Optional<PasswordResetToken> findLatestValidTokenByUserId(
        @Param("userId") Long userId,
        @Param("now") LocalDateTime now
    );

    /**
     * Delete all tokens by user ID.
     *
     * @param userId the user ID
     */
    @Modifying
    @Query("DELETE FROM PasswordResetToken t WHERE t.userId = :userId")
    void deleteByUserId(@Param("userId") Long userId);

    /**
     * Delete all expired tokens before the given time.
     *
     * @param now the current time
     */
    @Modifying
    @Query("DELETE FROM PasswordResetToken t WHERE t.expiresAt < :now")
    void deleteAllExpiredBefore(@Param("now") LocalDateTime now);

    /**
     * Check if a valid token exists for the user.
     *
     * @param userId the user ID
     * @param now    the current time
     * @return true if a valid token exists
     */
    @Query("SELECT COUNT(t) > 0 FROM PasswordResetToken t WHERE t.userId = :userId "
           + "AND t.used = false AND t.expiresAt > :now")
    boolean existsValidTokenByUserId(
        @Param("userId") Long userId,
        @Param("now") LocalDateTime now
    );

    /**
     * Count tokens by user ID created after a given time.
     *
     * @param userId the user ID
     * @param since  the time since
     * @return the count of tokens
     */
    @Query("SELECT COUNT(t) FROM PasswordResetToken t "
           + "WHERE t.userId = :userId AND t.createdAt > :since")
    long countByUserIdAndCreatedAtAfter(
        @Param("userId") Long userId,
        @Param("since") LocalDateTime since
    );
}
