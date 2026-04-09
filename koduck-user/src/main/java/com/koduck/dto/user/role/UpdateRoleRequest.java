package com.koduck.dto.user.role;

import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 更新角色请求。
 *
 * <p>用于 PUT /api/v1/roles/{roleId}，需要 role:write 权限。</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateRoleRequest {

    @Size(max = 50, message = "角色名称长度不能超过50个字符")
    private String name;

    @Size(max = 255, message = "角色描述长度不能超过255个字符")
    private String description;
}
