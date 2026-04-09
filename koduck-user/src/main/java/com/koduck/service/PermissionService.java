package com.koduck.service;

import com.koduck.dto.user.permission.PermissionInfo;

import java.util.List;

/**
 * 权限服务接口。
 *
 * <p>提供权限查询能力：权限列表、用户权限聚合查询。</p>
 */
public interface PermissionService {

    List<PermissionInfo> listPermissions();

    List<String> getUserPermissions(Long userId);
}
