package com.koduck.dto.user.user;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 用户详情响应（内部 API）。
 *
 * <p>供 koduck-auth 调用，包含 passwordHash 等内部字段。</p>
 * <p>用于 GET /internal/users/by-username/{username}、
 * GET /internal/users/by-email/{email}、POST /internal/users。</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserDetailsResponse {

    private Long id;
    private String username;
    private String email;
    private String passwordHash;
    private String nickname;
    private String status;
    private LocalDateTime createdAt;
}
