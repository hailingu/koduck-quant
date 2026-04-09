package com.koduck.dto.user.user;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 最后登录时间更新请求。
 *
 * <p>供 koduck-auth 登录成功后调用，用于 PUT /internal/users/{userId}/last-login。</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LastLoginUpdateRequest {

    @NotNull(message = "登录时间不能为空")
    private LocalDateTime loginTime;

    private String ipAddress;
}
