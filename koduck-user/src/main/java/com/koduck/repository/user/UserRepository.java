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

    Optional<User> findByIdAndTenantId(Long id, String tenantId);

    Optional<User> findByTenantIdAndUsername(String tenantId, String username);

    Optional<User> findByTenantIdAndEmail(String tenantId, String email);

    boolean existsByTenantIdAndUsername(String tenantId, String username);

    boolean existsByTenantIdAndEmail(String tenantId, String email);

    @Query("""
            SELECT u FROM User u
            WHERE u.tenantId = :tenantId
              AND (LOWER(u.username) LIKE LOWER(CONCAT('%', :keyword, '%'))
                OR LOWER(u.email) LIKE LOWER(CONCAT('%', :keyword, '%')))
            """)
    Page<User> searchByTenantIdAndKeyword(@Param("tenantId") String tenantId,
                                          @Param("keyword") String keyword,
                                          Pageable pageable);

    Page<User> findByTenantIdAndStatus(String tenantId, UserStatus status, Pageable pageable);

    Page<User> findByTenantId(String tenantId, Pageable pageable);

    @Modifying
    @Query("""
            UPDATE User u
            SET u.lastLoginAt = :loginTime, u.lastLoginIp = :ipAddress
            WHERE u.id = :userId AND u.tenantId = :tenantId
            """)
    int updateLastLogin(@Param("tenantId") String tenantId,
                        @Param("userId") Long userId,
                        @Param("loginTime") LocalDateTime loginTime,
                        @Param("ipAddress") String ipAddress);
}
