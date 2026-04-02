package com.koduck.dto.user;
import java.util.List;

import com.koduck.entity.User;
import com.koduck.util.CollectionCopyUtils;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 创建用户请求 DTO。
 *
 * @author Koduck Team
 */
@Data
public class CreateUserRequest {

    /** 用户名. */
    @NotBlank(message = "用户名不能为空")
    @Size(min = 3, max = 50, message = "用户名长度必须在3-50之间")
    private String username;

    /** 邮箱. */
    @NotBlank(message = "邮箱不能为空")
    @Email(message = "邮箱格式不正确")
    @Size(max = 100, message = "邮箱长度不能超过100")
    private String email;

    /** 密码. */
    @NotBlank(message = "密码不能为空")
    @Size(min = 6, max = 100, message = "密码长度必须在6-100之间")
    private String password;

    /** 昵称. */
    @Size(max = 50, message = "昵称长度不能超过50")
    private String nickname;

    /** 用户状态. */
    @NotNull(message = "状态不能为空")
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
