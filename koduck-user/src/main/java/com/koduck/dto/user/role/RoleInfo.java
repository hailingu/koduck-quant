package com.koduck.dto.user.role;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 角色基本信息。
 *
 * <p>嵌入在用户详情、角色列表等响应中。</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoleInfo {

    private Integer id;
    private String name;
    private String description;
}
