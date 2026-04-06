package com.koduck.repository.auth;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.entity.auth.Role;

/**
 * 用户-角色关系操作仓库，提供用户角色关联数据的数据库访问。
 *
 * @author Koduck Team
 */
@Repository
public interface UserRoleRepository extends JpaRepository<Role, Integer> {

    /**
     * 插入用户-角色关联。
     *
     * @param userId 用户 ID
     * @param roleId 角色 ID
     */
    @Modifying
    @Query(value = "INSERT INTO user_roles (user_id, role_id) "
            + "VALUES (:userId, :roleId) "
            + "ON CONFLICT DO NOTHING",
            nativeQuery = true)
    void insertUserRole(@Param("userId") Long userId,
                        @Param("roleId") Integer roleId);

    /**
     * 删除用户-角色关联。
     *
     * @param userId 用户 ID
     * @param roleId 角色 ID
     */
    @Modifying
    @Query(value = "DELETE FROM user_roles "
            + "WHERE user_id = :userId AND role_id = :roleId",
            nativeQuery = true)
    void deleteUserRole(@Param("userId") Long userId,
                        @Param("roleId") Integer roleId);

    /**
     * 删除用户的所有角色。
     *
     * @param userId 用户 ID
     */
    @Modifying
    @Query(value = "DELETE FROM user_roles WHERE user_id = :userId",
            nativeQuery = true)
    void deleteAllByUserId(@Param("userId") Long userId);

    /**
     * 根据用户 ID 查询角色 ID 列表。
     *
     * @param userId 用户 ID
     * @return 角色 ID 列表
     */
    @Query(value = "SELECT role_id FROM user_roles WHERE user_id = :userId",
            nativeQuery = true)
    List<Integer> findRoleIdsByUserId(@Param("userId") Long userId);

    /**
     * 检查用户-角色关联是否存在。
     *
     * @param userId 用户 ID
     * @param roleId 角色 ID
     * @return 如果存在返回 true，否则返回 false
     */
    @Query(value = "SELECT CASE WHEN EXISTS "
            + "(SELECT 1 FROM user_roles "
            + "WHERE user_id = :userId AND role_id = :roleId) "
            + "THEN true ELSE false END",
            nativeQuery = true)
    boolean existsByUserIdAndRoleId(@Param("userId") Long userId,
                                    @Param("roleId") Integer roleId);
}
