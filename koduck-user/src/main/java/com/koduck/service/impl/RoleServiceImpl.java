package com.koduck.service.impl;

import com.koduck.dto.user.permission.PermissionInfo;
import com.koduck.dto.user.role.CreateRoleRequest;
import com.koduck.dto.user.role.RoleDetailResponse;
import com.koduck.dto.user.role.RoleInfo;
import com.koduck.dto.user.role.RoleResponse;
import com.koduck.dto.user.role.SetRolePermissionsRequest;
import com.koduck.dto.user.role.UpdateRoleRequest;
import com.koduck.entity.user.Permission;
import com.koduck.entity.user.Role;
import com.koduck.entity.user.RolePermission;
import com.koduck.entity.user.UserRole;
import com.koduck.exception.PermissionNotFoundException;
import com.koduck.exception.ProtectedRoleException;
import com.koduck.exception.RoleAlreadyExistsException;
import com.koduck.exception.RoleHasUsersException;
import com.koduck.exception.RoleNotFoundException;
import com.koduck.repository.user.PermissionRepository;
import com.koduck.repository.user.RolePermissionRepository;
import com.koduck.repository.user.RoleRepository;
import com.koduck.repository.user.UserRoleRepository;
import com.koduck.service.RoleService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class RoleServiceImpl implements RoleService {

    private static final String DEFAULT_TENANT_ID = Role.DEFAULT_TENANT_ID;

    private static final Set<String> PROTECTED_ROLES = Set.of(
            "ROLE_USER",
            "ROLE_ADMIN",
            "ROLE_SUPER_ADMIN"
    );

    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final RolePermissionRepository rolePermissionRepository;
    private final UserRoleRepository userRoleRepository;

    public RoleServiceImpl(RoleRepository roleRepository,
                           PermissionRepository permissionRepository,
                           RolePermissionRepository rolePermissionRepository,
                           UserRoleRepository userRoleRepository) {
        this.roleRepository = roleRepository;
        this.permissionRepository = permissionRepository;
        this.rolePermissionRepository = rolePermissionRepository;
        this.userRoleRepository = userRoleRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<RoleInfo> listRoles(String tenantId) {
        String resolvedTenantId = resolveTenantId(tenantId);
        return roleRepository.findAllByTenantId(resolvedTenantId).stream()
                .map(this::buildRoleInfo)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public RoleDetailResponse getRoleById(String tenantId, Integer roleId) {
        String resolvedTenantId = resolveTenantId(tenantId);
        Role role = findRoleOrThrow(resolvedTenantId, roleId);
        List<PermissionInfo> permissions = getRolePermissions(resolvedTenantId, roleId);
        return buildRoleDetailResponse(role, permissions);
    }

    @Override
    @Transactional
    public RoleResponse createRole(String tenantId, CreateRoleRequest request) {
        String resolvedTenantId = resolveTenantId(tenantId);
        if (roleRepository.existsByTenantIdAndName(resolvedTenantId, request.getName())) {
            throw new RoleAlreadyExistsException(request.getName());
        }

        Role role = Role.builder()
                .tenantId(resolvedTenantId)
                .name(request.getName())
                .description(request.getDescription())
                .build();

        Role saved = roleRepository.save(role);
        return buildRoleResponse(saved);
    }

    @Override
    @Transactional
    public RoleResponse updateRole(String tenantId, Integer roleId, UpdateRoleRequest request) {
        String resolvedTenantId = resolveTenantId(tenantId);
        Role role = findRoleOrThrow(resolvedTenantId, roleId);

        if (request.getName() != null && !request.getName().equals(role.getName())) {
            if (roleRepository.existsByTenantIdAndName(resolvedTenantId, request.getName())) {
                throw new RoleAlreadyExistsException(request.getName());
            }
            role.setName(request.getName());
        }

        if (request.getDescription() != null) {
            role.setDescription(request.getDescription());
        }

        Role saved = roleRepository.save(role);
        return buildRoleResponse(saved);
    }

    @Override
    @Transactional
    public void deleteRole(String tenantId, Integer roleId) {
        String resolvedTenantId = resolveTenantId(tenantId);
        Role role = findRoleOrThrow(resolvedTenantId, roleId);

        if (PROTECTED_ROLES.contains(role.getName())) {
            throw new ProtectedRoleException(role.getName());
        }

        if (hasAssociatedUsers(resolvedTenantId, roleId)) {
            throw new RoleHasUsersException(roleId);
        }

        rolePermissionRepository.deleteByTenantIdAndRoleId(resolvedTenantId, roleId);
        roleRepository.delete(role);
    }

    @Override
    @Transactional
    public void setRolePermissions(String tenantId, Integer roleId, SetRolePermissionsRequest request) {
        String resolvedTenantId = resolveTenantId(tenantId);
        findRoleOrThrow(resolvedTenantId, roleId);

        // 验证所有权限 ID 存在
        List<Permission> permissions = permissionRepository.findAllById(request.getPermissionIds());
        if (permissions.size() != request.getPermissionIds().size()) {
            Set<Integer> foundIds = permissions.stream()
                    .map(Permission::getId)
                    .collect(Collectors.toSet());
            Set<Integer> missingIds = new HashSet<>(request.getPermissionIds());
            missingIds.removeAll(foundIds);
            throw new PermissionNotFoundException(missingIds);
        }

        // 全量替换：先删除再插入
        rolePermissionRepository.deleteByTenantIdAndRoleId(resolvedTenantId, roleId);

        List<RolePermission> rolePermissions = permissions.stream()
                .map(p -> RolePermission.builder()
                        .tenantId(resolvedTenantId)
                        .roleId(roleId)
                        .permissionId(p.getId())
                        .build())
                .toList();

        rolePermissionRepository.saveAll(rolePermissions);
    }

    @Override
    @Transactional(readOnly = true)
    public List<PermissionInfo> getRolePermissions(String tenantId, Integer roleId) {
        String resolvedTenantId = resolveTenantId(tenantId);
        findRoleOrThrow(resolvedTenantId, roleId);

        return rolePermissionRepository.findByTenantIdAndRoleId(resolvedTenantId, roleId).stream()
                .map(rp -> permissionRepository.findById(rp.getPermissionId()))
                .filter(java.util.Optional::isPresent)
                .map(java.util.Optional::get)
                .map(this::buildPermissionInfo)
                .toList();
    }

    // === 私有辅助方法 ===

    private Role findRoleOrThrow(String tenantId, Integer roleId) {
        return roleRepository.findByIdAndTenantId(roleId, tenantId)
                .orElseThrow(() -> new RoleNotFoundException(roleId));
    }

    private boolean hasAssociatedUsers(String tenantId, Integer roleId) {
        return userRoleRepository.countByTenantIdAndRoleId(tenantId, roleId) > 0;
    }

    private String resolveTenantId(String tenantId) {
        return (tenantId == null || tenantId.isBlank()) ? DEFAULT_TENANT_ID : tenantId;
    }

    private RoleInfo buildRoleInfo(Role role) {
        return RoleInfo.builder()
                .id(role.getId())
                .name(role.getName())
                .description(role.getDescription())
                .build();
    }

    private RoleResponse buildRoleResponse(Role role) {
        return RoleResponse.builder()
                .id(role.getId())
                .name(role.getName())
                .description(role.getDescription())
                .createdAt(role.getCreatedAt())
                .build();
    }

    private RoleDetailResponse buildRoleDetailResponse(Role role, List<PermissionInfo> permissions) {
        return RoleDetailResponse.builder()
                .id(role.getId())
                .name(role.getName())
                .description(role.getDescription())
                .permissions(permissions)
                .createdAt(role.getCreatedAt())
                .build();
    }

    private PermissionInfo buildPermissionInfo(Permission permission) {
        return PermissionInfo.builder()
                .id(permission.getId())
                .code(permission.getCode())
                .name(permission.getName())
                .resource(permission.getResource())
                .action(permission.getAction())
                .build();
    }
}
