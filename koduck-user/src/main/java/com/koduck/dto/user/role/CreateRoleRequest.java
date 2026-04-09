package com.koduck.dto.user.role;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 创建角色请求。
 *
 * <p>用于 POST /api/v1/roles，需要 role:write 权限。</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateRoleRequest {

    @NotBlank(message = "角色名称不能为空")
    @Size(max = 50, message = "角色名称长度不能超过50个字符")
    private String name;

    @Size(max = 255, message = "角色描述长度不能超过255个字符")
    private String description;
}
