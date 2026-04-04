package com.koduck.repository.auth;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.entity.auth.Role;

/**
 * 角色实体操作仓库接口，提供角色查询和用户-角色关联查询方法。
 *
 * @author Koduck Team
 */
@Repository
public interface RoleRepository extends JpaRepository<Role, Integer> {

    /**
     * 根据角色名称查询角色。
     *
     * @param name 角色名称
     * @return 角色
     */
    Optional<Role> findByName(String name);

    /**
     * 根据角色名称检查角色是否存在。
     *
     * @param name 角色名称
     * @return 如果存在返回 true，否则返回 false
     */
    boolean existsByName(String name);

    /**
     * 查询指定用户的角色列表。
     *
     * @param userId 用户 ID
     * @return 角色列表
     */
    @Query(value = "SELECT r.* FROM roles r " +
           "INNER JOIN user_roles ur ON r.id = ur.role_id " +
           "WHERE ur.user_id = :userId", nativeQuery = true)
    List<Role> findRolesByUserId(@Param("userId") Long userId);

    /**
     * 查询指定用户的角色名称列表。
     *
     * @param userId 用户 ID
     * @return 角色名称列表
     */
    @Query(value = "SELECT r.name FROM roles r " +
           "INNER JOIN user_roles ur ON r.id = ur.role_id " +
           "WHERE ur.user_id = :userId", nativeQuery = true)
    List<String> findRoleNamesByUserId(@Param("userId") Long userId);
}
