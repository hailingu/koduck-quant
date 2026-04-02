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
 * （）
 */
@Repository
public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {

    /**
     * 
     */
    Optional<PasswordResetToken> findByTokenHash(String tokenHash);

    /**
     * ID
     */
    List<PasswordResetToken> findByUserId(Long userId);

    /**
     * ID
     */
    @Query("SELECT t FROM PasswordResetToken t WHERE t.userId = :userId AND t.used = false AND t.expiresAt > :now ORDER BY t.createdAt DESC")
    Optional<PasswordResetToken> findLatestValidTokenByUserId(@Param("userId") Long userId, @Param("now") LocalDateTime now);

    /**
     * （）
     */
    @Modifying
    @Query("DELETE FROM PasswordResetToken t WHERE t.userId = :userId")
    void deleteByUserId(@Param("userId") Long userId);

    /**
     * （）
     */
    @Modifying
    @Query("DELETE FROM PasswordResetToken t WHERE t.expiresAt < :now")
    void deleteAllExpiredBefore(@Param("now") LocalDateTime now);

    /**
     * 
     */
    @Query("SELECT COUNT(t) > 0 FROM PasswordResetToken t WHERE t.userId = :userId AND t.used = false AND t.expiresAt > :now")
    boolean existsValidTokenByUserId(@Param("userId") Long userId, @Param("now") LocalDateTime now);

    /**
     * （）
     */
    @Query("SELECT COUNT(t) FROM PasswordResetToken t WHERE t.userId = :userId AND t.createdAt > :since")
    long countByUserIdAndCreatedAtAfter(@Param("userId") Long userId, @Param("since") LocalDateTime since);
}
