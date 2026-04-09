package com.koduck.dto.user.user;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 分配角色请求。
 *
 * <p>用于 POST /api/v1/users/{userId}/roles，需要 role:write 权限。</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AssignRoleRequest {

    @NotNull(message = "角色ID不能为空")
    private Integer roleId;
}
