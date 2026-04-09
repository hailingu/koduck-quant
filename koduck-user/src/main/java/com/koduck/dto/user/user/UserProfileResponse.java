package com.koduck.dto.user.user;

import com.koduck.dto.user.role.RoleInfo;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 用户详情响应（公开 API）。
 *
 * <p>用于 GET /api/v1/users/me 和 GET /api/v1/users/{userId}。</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserProfileResponse {

    private Long id;
    private String username;
    private String email;
    private String nickname;
    private String avatarUrl;
    private String status;
    private LocalDateTime emailVerifiedAt;
    private LocalDateTime lastLoginAt;
    private List<RoleInfo> roles;
    private LocalDateTime createdAt;
}
