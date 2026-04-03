package com.koduck.dto.user;

import java.util.List;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

import com.koduck.entity.User;
import com.koduck.util.CollectionCopyUtils;

import lombok.Data;

/**
 * 更新用户请求 DTO。
 *
 * @author Koduck Team
 */
@Data
public class UpdateUserRequest {

    /** 邮箱. */
    @Email(message = "邮箱格式不正确")
    @Size(max = 100, message = "邮箱长度不能超过100")
    private String email;

    /** 昵称. */
    @Size(max = 50, message = "昵称长度不能超过50")
    private String nickname;

    /** 头像URL. */
    @Size(max = 255, message = "头像URL长度不能超过255")
    private String avatarUrl;

    /** 用户状态. */
    private User.UserStatus status;

    /** 角色ID列表. */
    private List<Integer> roleIds;

    /**
     * 获取角色ID列表的副本。
     *
     * @return 角色ID列表副本
     */
    public List<Integer> getRoleIds() {
        return CollectionCopyUtils.copyList(roleIds);
    }

    /**
     * 设置角色ID列表。
     *
     * @param roleIds 角色ID列表
     */
    public void setRoleIds(List<Integer> roleIds) {
        this.roleIds = CollectionCopyUtils.copyList(roleIds);
    }
}
