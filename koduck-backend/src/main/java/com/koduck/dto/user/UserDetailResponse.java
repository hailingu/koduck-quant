package com.koduck.dto.user;

import com.koduck.entity.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 用户详情响应 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserDetailResponse {

    private Long id;
    private String username;
    private String email;
    private String nickname;
    private String avatarUrl;
    private User.UserStatus status;
    private LocalDateTime emailVerifiedAt;
    private LocalDateTime lastLoginAt;
    private String lastLoginIp;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<String> roles;
    private List<String> permissions;
}
