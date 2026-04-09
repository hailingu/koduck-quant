package com.koduck.repository.user;

import com.koduck.entity.user.User;
import com.koduck.entity.user.UserStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByUsername(String username);

    Optional<User> findByEmail(String email);

    boolean existsByUsername(String username);

    boolean existsByEmail(String email);

    Page<User> findByUsernameContainingOrEmailContaining(String username, String email, Pageable pageable);

    Page<User> findByStatus(UserStatus status, Pageable pageable);

    @Modifying
    @Query("UPDATE User u SET u.lastLoginAt = :loginTime, u.lastLoginIp = :ipAddress WHERE u.id = :userId")
    int updateLastLogin(@Param("userId") Long userId,
                        @Param("loginTime") LocalDateTime loginTime,
                        @Param("ipAddress") String ipAddress);
}
