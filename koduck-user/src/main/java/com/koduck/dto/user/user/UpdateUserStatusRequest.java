package com.koduck.dto.user.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 更新用户状态请求。
 *
 * <p>用于 PUT /api/v1/users/{userId}/status，需要 user:write 权限。</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateUserStatusRequest {

    @NotBlank(message = "状态不能为空")
    @Pattern(regexp = "ACTIVE|DISABLED|PENDING", message = "状态值必须是 ACTIVE、DISABLED 或 PENDING")
    private String status;

    private String reason;
}
