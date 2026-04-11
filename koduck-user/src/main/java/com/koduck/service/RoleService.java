package com.koduck.service;

import com.koduck.dto.user.permission.PermissionInfo;
import com.koduck.dto.user.role.CreateRoleRequest;
import com.koduck.dto.user.role.RoleDetailResponse;
import com.koduck.dto.user.role.RoleInfo;
import com.koduck.dto.user.role.RoleResponse;
import com.koduck.dto.user.role.SetRolePermissionsRequest;
import com.koduck.dto.user.role.UpdateRoleRequest;

import java.util.List;

/**
 * 角色服务接口。
 *
 * <p>覆盖角色管理 API 的全部业务逻辑：列表、详情、创建、更新、删除、权限分配。</p>
 */
public interface RoleService {

    List<RoleInfo> listRoles(String tenantId);

    RoleDetailResponse getRoleById(String tenantId, Integer roleId);

    RoleResponse createRole(String tenantId, CreateRoleRequest request);

    RoleResponse updateRole(String tenantId, Integer roleId, UpdateRoleRequest request);

    void deleteRole(String tenantId, Integer roleId);

    void setRolePermissions(String tenantId, Integer roleId, SetRolePermissionsRequest request);

    List<PermissionInfo> getRolePermissions(String tenantId, Integer roleId);
}
