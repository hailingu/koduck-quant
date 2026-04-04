package com.koduck.dto;

import java.time.LocalDateTime;
import java.util.List;

import com.koduck.entity.auth.User;
import com.koduck.util.CollectionCopyUtils;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 用户信息数据传输对象。
 *
 * @author Koduck Team
 */
@Data
@NoArgsConstructor
public class UserInfo {

    /**
     * 用户ID。
     */
    private Long id;

    /**
     * 用户名。
     */
    private String username;

    /**
     * 邮箱地址。
     */
    private String email;

    /**
     * 昵称。
     */
    private String nickname;

    /**
     * 头像URL。
     */
    private String avatarUrl;

    /**
     * 用户状态。
     */
    private User.UserStatus status;

    /**
     * 邮箱验证时间。
     */
    private LocalDateTime emailVerifiedAt;

    /**
     * 最后登录时间。
     */
    private LocalDateTime lastLoginAt;

    /**
     * 用户角色列表。
     */
    private List<String> roles;

    /**
     * 创建新的 Builder 实例。
     *
     * @return 新的 Builder
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * UserInfo 的构建器类。
     */
    public static final class Builder {

        /**
         * 用户ID。
         */
        private Long id;

        /**
         * 用户名。
         */
        private String username;

        /**
         * 邮箱地址。
         */
        private String email;

        /**
         * 昵称。
         */
        private String nickname;

        /**
         * 头像URL。
         */
        private String avatarUrl;

        /**
         * 用户状态。
         */
        private User.UserStatus status;

        /**
         * 邮箱验证时间。
         */
        private LocalDateTime emailVerifiedAt;

        /**
         * 最后登录时间。
         */
        private LocalDateTime lastLoginAt;

        /**
         * 用户角色列表。
         */
        private List<String> roles;

        /**
         * 设置用户ID。
         *
         * @param id 用户ID
         * @return 此构建器
         */
        public Builder id(Long id) {
            this.id = id;
            return this;
        }

        /**
         * 设置用户名。
         *
         * @param username 用户名
         * @return 此构建器
         */
        public Builder username(String username) {
            this.username = username;
            return this;
        }

        /**
         * 设置邮箱。
         *
         * @param email 邮箱
         * @return 此构建器
         */
        public Builder email(String email) {
            this.email = email;
            return this;
        }

        /**
         * 设置昵称。
         *
         * @param nickname 昵称
         * @return 此构建器
         */
        public Builder nickname(String nickname) {
            this.nickname = nickname;
            return this;
        }

        /**
         * 设置头像URL。
         *
         * @param avatarUrl 头像URL
         * @return 此构建器
         */
        public Builder avatarUrl(String avatarUrl) {
            this.avatarUrl = avatarUrl;
            return this;
        }

        /**
         * 设置用户状态。
         *
         * @param status 状态
         * @return 此构建器
         */
        public Builder status(User.UserStatus status) {
            this.status = status;
            return this;
        }

        /**
         * 设置邮箱验证时间。
         *
         * @param emailVerifiedAt 验证时间
         * @return 此构建器
         */
        public Builder emailVerifiedAt(LocalDateTime emailVerifiedAt) {
            this.emailVerifiedAt = emailVerifiedAt;
            return this;
        }

        /**
         * 设置最后登录时间。
         *
         * @param lastLoginAt 最后登录时间
         * @return 此构建器
         */
        public Builder lastLoginAt(LocalDateTime lastLoginAt) {
            this.lastLoginAt = lastLoginAt;
            return this;
        }

        /**
         * 设置角色列表。
         *
         * @param roles 角色列表
         * @return 此构建器
         */
        public Builder roles(List<String> roles) {
            this.roles = CollectionCopyUtils.copyList(roles);
            return this;
        }

        /**
         * 构建 UserInfo 实例。
         *
         * @return UserInfo 实例
         */
        public UserInfo build() {
            UserInfo userInfo = new UserInfo();
            userInfo.setId(id);
            userInfo.setUsername(username);
            userInfo.setEmail(email);
            userInfo.setNickname(nickname);
            userInfo.setAvatarUrl(avatarUrl);
            userInfo.setStatus(status);
            userInfo.setEmailVerifiedAt(emailVerifiedAt);
            userInfo.setLastLoginAt(lastLoginAt);
            userInfo.setRoles(roles);
            return userInfo;
        }
    }

    /**
     * 返回角色列表的防御性拷贝。
     *
     * @return 角色列表拷贝
     */
    public List<String> getRoles() {
        return CollectionCopyUtils.copyList(roles);
    }

    /**
     * 设置角色列表（防御性拷贝）。
     *
     * @param roles 角色列表 list
     */
    public void setRoles(List<String> roles) {
        this.roles = CollectionCopyUtils.copyList(roles);
    }
}
