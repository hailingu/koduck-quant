package com.koduck.dto.user.user;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 头像上传响应。
 *
 * <p>用于 PUT /api/v1/users/me/avatar。</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AvatarUploadResponse {

    private String avatarUrl;
}
