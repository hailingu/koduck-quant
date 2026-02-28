package com.koduck.repository;

import com.koduck.entity.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 用户角色关联仓库（手动管理关联表，无主键实体）
 */
@Repository
public interface UserRoleRepository extends JpaRepository<Role, Long> {

    @Modifying
    @Query(value = "INSERT INTO user_roles (user_id, role_id) VALUES (:userId, :roleId) " +
           "ON CONFLICT DO NOTHING", nativeQuery = true)
    void insertUserRole(@Param("userId") Long userId, @Param("roleId") Integer roleId);

    @Modifying
    @Query(value = "DELETE FROM user_roles WHERE user_id = :userId AND role_id = :roleId", nativeQuery = true)
    void deleteUserRole(@Param("userId") Long userId, @Param("roleId") Integer roleId);

    @Modifying
    @Query(value = "DELETE FROM user_roles WHERE user_id = :userId", nativeQuery = true)
    void deleteAllByUserId(@Param("userId") Long userId);

    @Query(value = "SELECT role_id FROM user_roles WHERE user_id = :userId", nativeQuery = true)
    List<Integer> findRoleIdsByUserId(@Param("userId") Long userId);

    boolean existsByUserIdAndRoleId(Long userId, Integer roleId);
}
