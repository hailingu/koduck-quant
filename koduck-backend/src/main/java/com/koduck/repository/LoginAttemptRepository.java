package com.koduck.repository;
import java.time.LocalDateTime;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.entity.LoginAttempt;

/**
 * （）
 */
@Repository
public interface LoginAttemptRepository extends JpaRepository<LoginAttempt, Long> {

    @Query("SELECT COUNT(la) FROM LoginAttempt la WHERE la.identifier = :identifier " +
           "AND la.type = :type AND la.success = false AND la.createdAt > :since")
    long countFailedAttempts(@Param("identifier") String identifier,
                             @Param("type") String type,
                             @Param("since") LocalDateTime since);

    @Query("SELECT COUNT(la) FROM LoginAttempt la WHERE la.ipAddress = :ipAddress " +
           "AND la.success = false AND la.createdAt > :since")
    long countFailedAttemptsByIp(@Param("ipAddress") String ipAddress,
                                 @Param("since") LocalDateTime since);
}
