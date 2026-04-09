package com.koduck.dto.user.role;

import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 设置角色权限请求（全量替换）。
 *
 * <p>用于 PUT /api/v1/roles/{roleId}/permissions，需要 role:write 权限。</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SetRolePermissionsRequest {

    @NotEmpty(message = "权限ID列表不能为空")
    private List<Integer> permissionIds;
}
