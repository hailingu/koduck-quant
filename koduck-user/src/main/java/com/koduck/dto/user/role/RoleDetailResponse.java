package com.koduck.dto.user.role;

import com.koduck.dto.user.permission.PermissionInfo;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 角色详情响应（含权限列表）。
 *
 * <p>用于 GET /api/v1/roles/{roleId}。</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoleDetailResponse {

    private Integer id;
    private String name;
    private String description;
    private List<PermissionInfo> permissions;
    private LocalDateTime createdAt;
}
