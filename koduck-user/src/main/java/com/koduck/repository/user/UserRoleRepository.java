package com.koduck.repository.user;

import com.koduck.entity.user.UserRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface UserRoleRepository extends JpaRepository<UserRole, Long> {

    boolean existsByTenantIdAndUserIdAndRoleId(String tenantId, Long userId, Integer roleId);

    long countByTenantIdAndRoleId(String tenantId, Integer roleId);

    List<UserRole> findByTenantIdAndUserId(String tenantId, Long userId);

    @Modifying
    void deleteByTenantIdAndUserIdAndRoleId(String tenantId, Long userId, Integer roleId);

    @Query("SELECT ur.roleId FROM UserRole ur WHERE ur.tenantId = :tenantId AND ur.userId = :userId")
    List<Integer> findRoleIdsByTenantIdAndUserId(@Param("tenantId") String tenantId, @Param("userId") Long userId);

    @Query("SELECT DISTINCT p.code FROM UserRole ur " +
           "JOIN RolePermission rp ON rp.roleId = ur.roleId " +
           "JOIN Permission p ON p.id = rp.permissionId " +
           "WHERE ur.tenantId = :tenantId AND rp.tenantId = :tenantId AND ur.userId = :userId")
    List<String> findPermissionsByTenantIdAndUserId(@Param("tenantId") String tenantId, @Param("userId") Long userId);
}
