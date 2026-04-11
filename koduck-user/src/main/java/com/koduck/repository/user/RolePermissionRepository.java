package com.koduck.repository.user;

import com.koduck.entity.user.RolePermission;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RolePermissionRepository extends JpaRepository<RolePermission, Long> {

    List<RolePermission> findByTenantIdAndRoleId(String tenantId, Integer roleId);

    void deleteByTenantIdAndRoleId(String tenantId, Integer roleId);
}
