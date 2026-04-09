package com.koduck.dto.user.permission;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 权限信息。
 *
 * <p>用于权限列表查询和角色详情中的权限展示。</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PermissionInfo {

    private Integer id;
    private String code;
    private String name;
    private String resource;
    private String action;
}
