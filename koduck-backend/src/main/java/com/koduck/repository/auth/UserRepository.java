package com.koduck.repository.auth;

import java.time.LocalDateTime;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.entity.User;

/**
 * Repository for User operations.
 *
 * @author Koduck Team
 */
@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByUsername(String username);

    Optional<User> findByEmail(String email);

    boolean existsByUsername(String username);

    boolean existsByEmail(String email);

    @Modifying
    @Query("UPDATE User u SET u.lastLoginAt = :loginTime, u.lastLoginIp = :ip WHERE u.id = :userId")
    void updateLastLogin(@Param("userId") Long userId,
                         @Param("loginTime") LocalDateTime loginTime,
                         @Param("ip") String ip);

    @Modifying
    @Query("UPDATE User u SET u.passwordHash = :passwordHash WHERE u.id = :userId")
    void updatePassword(@Param("userId") Long userId, @Param("passwordHash") String passwordHash);

    /**
     * Find users by username or email containing the given strings.
     *
     * @param username the username to search for
     * @param email the email to search for
     * @param pageable the pageable
     * @return page of users
     */
    Page<User> findByUsernameContainingOrEmailContaining(
            String username, String email, Pageable pageable);
}
