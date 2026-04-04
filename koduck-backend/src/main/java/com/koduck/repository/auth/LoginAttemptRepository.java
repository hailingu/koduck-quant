package com.koduck.repository.auth;

import java.time.LocalDateTime;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.entity.auth.LoginAttempt;

/**
 * Repository for login attempt tracking.
 *
 * @author Koduck Team
 */
@Repository
public interface LoginAttemptRepository extends JpaRepository<LoginAttempt, Long> {

    /**
     * Count failed login attempts for an identifier.
     *
     * @param identifier the user identifier
     * @param type       the login type
     * @param since      the time threshold
     * @return the count of failed attempts
     */
    @Query("SELECT COUNT(la) FROM LoginAttempt la "
            + "WHERE la.identifier = :identifier "
            + "AND la.type = :type AND la.success = false "
            + "AND la.createdAt > :since")
    long countFailedAttempts(@Param("identifier") String identifier,
                             @Param("type") String type,
                             @Param("since") LocalDateTime since);

    /**
     * Count failed login attempts by IP address.
     *
     * @param ipAddress the IP address
     * @param since     the time threshold
     * @return the count of failed attempts
     */
    @Query("SELECT COUNT(la) FROM LoginAttempt la "
            + "WHERE la.ipAddress = :ipAddress "
            + "AND la.success = false AND la.createdAt > :since")
    long countFailedAttemptsByIp(@Param("ipAddress") String ipAddress,
                                 @Param("since") LocalDateTime since);
}
