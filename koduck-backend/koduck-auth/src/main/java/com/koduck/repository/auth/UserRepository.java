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

import com.koduck.entity.auth.User;

/**
 * 用户操作仓库，提供用户数据的数据库访问。
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
     * 根据用户名或邮箱模糊搜索用户。
     *
     * @param username 要搜索的用户名
     * @param email 要搜索的邮箱
     * @param pageable 分页对象
     * @return 用户分页结果
     */
    Page<User> findByUsernameContainingOrEmailContaining(
            String username, String email, Pageable pageable);
}
