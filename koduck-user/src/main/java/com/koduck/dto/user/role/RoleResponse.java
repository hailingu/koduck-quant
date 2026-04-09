package com.koduck.dto.user.role;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 角色创建/更新响应。
 *
 * <p>用于 POST /api/v1/roles 和 PUT /api/v1/roles/{roleId}。</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoleResponse {

    private Integer id;
    private String name;
    private String description;
    private LocalDateTime createdAt;
}
