package com.koduck.repository;

import com.koduck.entity.Permission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 权限仓库（无外键关联）
 */
@Repository
public interface PermissionRepository extends JpaRepository<Permission, Integer> {

    Optional<Permission> findByCode(String code);

    boolean existsByCode(String code);

    @Query(value = "SELECT p.* FROM permissions p " +
           "INNER JOIN role_permissions rp ON p.id = rp.permission_id " +
           "INNER JOIN user_roles ur ON rp.role_id = ur.role_id " +
           "WHERE ur.user_id = :userId", nativeQuery = true)
    List<Permission> findPermissionsByUserId(@Param("userId") Long userId);

    @Query(value = "SELECT p.code FROM permissions p " +
           "INNER JOIN role_permissions rp ON p.id = rp.permission_id " +
           "INNER JOIN user_roles ur ON rp.role_id = ur.role_id " +
           "WHERE ur.user_id = :userId", nativeQuery = true)
    List<String> findPermissionCodesByUserId(@Param("userId") Long userId);
}
