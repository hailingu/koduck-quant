package com.koduck.repository;

import com.koduck.entity.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 角色仓库（无外键关联）
 */
@Repository
public interface RoleRepository extends JpaRepository<Role, Integer> {

    Optional<Role> findByName(String name);

    boolean existsByName(String name);

    @Query(value = "SELECT r.* FROM roles r " +
           "INNER JOIN user_roles ur ON r.id = ur.role_id " +
           "WHERE ur.user_id = :userId", nativeQuery = true)
    List<Role> findRolesByUserId(@Param("userId") Long userId);

    @Query(value = "SELECT r.name FROM roles r " +
           "INNER JOIN user_roles ur ON r.id = ur.role_id " +
           "WHERE ur.user_id = :userId", nativeQuery = true)
    List<String> findRoleNamesByUserId(@Param("userId") Long userId);
}
