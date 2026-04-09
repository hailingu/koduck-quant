package com.koduck.dto.user.user;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 用户摘要响应（用户列表项）。
 *
 * <p>用于 GET /api/v1/users 分页查询结果。</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserSummaryResponse {

    private Long id;
    private String username;
    private String email;
    private String nickname;
    private String status;
    private LocalDateTime createdAt;
}
