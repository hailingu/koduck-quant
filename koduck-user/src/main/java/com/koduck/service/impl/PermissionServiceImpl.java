package com.koduck.service.impl;

import com.koduck.dto.user.permission.PermissionInfo;
import com.koduck.entity.user.Permission;
import com.koduck.repository.user.PermissionRepository;
import com.koduck.repository.user.UserRoleRepository;
import com.koduck.service.PermissionService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class PermissionServiceImpl implements PermissionService {

    private final PermissionRepository permissionRepository;
    private final UserRoleRepository userRoleRepository;

    public PermissionServiceImpl(PermissionRepository permissionRepository,
                                 UserRoleRepository userRoleRepository) {
        this.permissionRepository = permissionRepository;
        this.userRoleRepository = userRoleRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<PermissionInfo> listPermissions() {
        return permissionRepository.findAll().stream()
                .map(this::buildPermissionInfo)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<String> getUserPermissions(Long userId) {
        return userRoleRepository.findPermissionsByUserId(userId);
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
