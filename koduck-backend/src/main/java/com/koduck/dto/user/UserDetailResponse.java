package com.koduck.dto.user;
import java.time.LocalDateTime;
import java.util.List;

import com.koduck.entity.User;
import com.koduck.util.CollectionCopyUtils;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 用户详情响应 DTO。
 *
 * @author Koduck Team
 */
@Data
@NoArgsConstructor
public class UserDetailResponse {

    /** 用户ID. */
    private Long id;

    /** 用户名. */
    private String username;

    /** 邮箱. */
    private String email;

    /** 昵称. */
    private String nickname;

    /** 头像URL. */
    private String avatarUrl;

    /** 用户状态. */
    private User.UserStatus status;

    /** 邮箱验证时间. */
    private LocalDateTime emailVerifiedAt;

    /** 最后登录时间. */
    private LocalDateTime lastLoginAt;

    /** 最后登录IP. */
    private String lastLoginIp;

    /** 创建时间. */
    private LocalDateTime createdAt;

    /** 更新时间. */
    private LocalDateTime updatedAt;

    /** 角色列表. */
    private List<String> roles;

    /** 权限列表. */
    private List<String> permissions;

    /**
     * 获取 Builder 实例。
     *
     * @return Builder 实例
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Builder 类。
     */
    public static final class Builder {

        /** 用户ID. */
        private Long id;

        /** 用户名. */
        private String username;

        /** 邮箱. */
        private String email;

        /** 昵称. */
        private String nickname;

        /** 头像URL. */
        private String avatarUrl;

        /** 用户状态. */
        private User.UserStatus status;

        /** 邮箱验证时间. */
        private LocalDateTime emailVerifiedAt;

        /** 最后登录时间. */
        private LocalDateTime lastLoginAt;

        /** 最后登录IP. */
        private String lastLoginIp;

        /** 创建时间. */
        private LocalDateTime createdAt;

        /** 更新时间. */
        private LocalDateTime updatedAt;

        /** 角色列表. */
        private List<String> roles;

        /** 权限列表. */
        private List<String> permissions;

        /**
         * 设置用户ID。
         *
         * @param idVal 用户ID
         * @return Builder 实例
         */
        public Builder id(Long idVal) {
            this.id = idVal;
            return this;
        }

        /**
         * 设置用户名。
         *
         * @param usernameVal 用户名
         * @return Builder 实例
         */
        public Builder username(String usernameVal) {
            this.username = usernameVal;
            return this;
        }

        /**
         * 设置邮箱。
         *
         * @param emailVal 邮箱
         * @return Builder 实例
         */
        public Builder email(String emailVal) {
            this.email = emailVal;
            return this;
        }

        /**
         * 设置昵称。
         *
         * @param nicknameVal 昵称
         * @return Builder 实例
         */
        public Builder nickname(String nicknameVal) {
            this.nickname = nicknameVal;
            return this;
        }

        /**
         * 设置头像URL。
         *
         * @param avatarUrlVal 头像URL
         * @return Builder 实例
         */
        public Builder avatarUrl(String avatarUrlVal) {
            this.avatarUrl = avatarUrlVal;
            return this;
        }

        /**
         * 设置用户状态。
         *
         * @param statusVal 用户状态
         * @return Builder 实例
         */
        public Builder status(User.UserStatus statusVal) {
            this.status = statusVal;
            return this;
        }

        /**
         * 设置邮箱验证时间。
         *
         * @param emailVerifiedAtVal 邮箱验证时间
         * @return Builder 实例
         */
        public Builder emailVerifiedAt(LocalDateTime emailVerifiedAtVal) {
            this.emailVerifiedAt = emailVerifiedAtVal;
            return this;
        }

        /**
         * 设置最后登录时间。
         *
         * @param lastLoginAtVal 最后登录时间
         * @return Builder 实例
         */
        public Builder lastLoginAt(LocalDateTime lastLoginAtVal) {
            this.lastLoginAt = lastLoginAtVal;
            return this;
        }

        /**
         * 设置最后登录IP。
         *
         * @param lastLoginIpVal 最后登录IP
         * @return Builder 实例
         */
        public Builder lastLoginIp(String lastLoginIpVal) {
            this.lastLoginIp = lastLoginIpVal;
            return this;
        }

        /**
         * 设置创建时间。
         *
         * @param createdAtVal 创建时间
         * @return Builder 实例
         */
        public Builder createdAt(LocalDateTime createdAtVal) {
            this.createdAt = createdAtVal;
            return this;
        }

        /**
         * 设置更新时间。
         *
         * @param updatedAtVal 更新时间
         * @return Builder 实例
         */
        public Builder updatedAt(LocalDateTime updatedAtVal) {
            this.updatedAt = updatedAtVal;
            return this;
        }

        /**
         * 设置角色列表。
         *
         * @param rolesVal 角色列表
         * @return Builder 实例
         */
        public Builder roles(List<String> rolesVal) {
            this.roles = CollectionCopyUtils.copyList(rolesVal);
            return this;
        }

        /**
         * 设置权限列表。
         *
         * @param permissionsVal 权限列表
         * @return Builder 实例
         */
        public Builder permissions(List<String> permissionsVal) {
            this.permissions = CollectionCopyUtils.copyList(permissionsVal);
            return this;
        }

        /**
         * 构建 UserDetailResponse 实例。
         *
         * @return UserDetailResponse 实例
         */
        public UserDetailResponse build() {
            UserDetailResponse response = new UserDetailResponse();
            response.setId(id);
            response.setUsername(username);
            response.setEmail(email);
            response.setNickname(nickname);
            response.setAvatarUrl(avatarUrl);
            response.setStatus(status);
            response.setEmailVerifiedAt(emailVerifiedAt);
            response.setLastLoginAt(lastLoginAt);
            response.setLastLoginIp(lastLoginIp);
            response.setCreatedAt(createdAt);
            response.setUpdatedAt(updatedAt);
            response.setRoles(roles);
            response.setPermissions(permissions);
            return response;
        }
    }

    /**
     * 获取角色列表的副本。
     *
     * @return 角色列表副本
     */
    public List<String> getRoles() {
        return CollectionCopyUtils.copyList(roles);
    }

    /**
     * 设置角色列表。
     *
     * @param rolesVal 角色列表
     */
    public void setRoles(List<String> rolesVal) {
        this.roles = CollectionCopyUtils.copyList(rolesVal);
    }

    /**
     * 获取权限列表的副本。
     *
     * @return 权限列表副本
     */
    public List<String> getPermissions() {
        return CollectionCopyUtils.copyList(permissions);
    }

    /**
     * 设置权限列表。
     *
     * @param permissionsVal 权限列表
     */
    public void setPermissions(List<String> permissionsVal) {
        this.permissions = CollectionCopyUtils.copyList(permissionsVal);
    }
}
