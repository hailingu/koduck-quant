package com.koduck.dto.auth;
import com.koduck.dto.UserInfo;
import com.koduck.util.CollectionCopyUtils;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Token 响应 DTO。
 *
 * @author Koduck Team
 */
@Data
@NoArgsConstructor
public class TokenResponse {

    /** 访问令牌. */
    private String accessToken;

    /** 刷新令牌. */
    private String refreshToken;

    /** 过期时间（秒）. */
    private Long expiresIn;

    /** 令牌类型. */
    private String tokenType;

    /** 用户信息. */
    private UserInfo user;

    /**
     * 构造方法。
     *
     * @param accessToken  访问令牌
     * @param refreshToken 刷新令牌
     * @param expiresIn    过期时间
     * @param tokenType    令牌类型
     * @param user         用户信息
     */
    public TokenResponse(
            String accessToken,
            String refreshToken,
            Long expiresIn,
            String tokenType,
            UserInfo user) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.expiresIn = expiresIn;
        this.tokenType = tokenType;
        this.user = copyUserInfo(user);
    }

    /**
     * 创建 Builder 实例。
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

        /** 访问令牌. */
        private String accessToken;

        /** 刷新令牌. */
        private String refreshToken;

        /** 过期时间（秒）. */
        private Long expiresIn;

        /** 令牌类型. */
        private String tokenType;

        /** 用户信息. */
        private UserInfo user;

        /**
         * 设置访问令牌。
         *
         * @param accessToken 访问令牌
         * @return Builder 实例
         */
        public Builder accessToken(String accessToken) {
            this.accessToken = accessToken;
            return this;
        }

        /**
         * 设置刷新令牌。
         *
         * @param refreshToken 刷新令牌
         * @return Builder 实例
         */
        public Builder refreshToken(String refreshToken) {
            this.refreshToken = refreshToken;
            return this;
        }

        /**
         * 设置过期时间。
         *
         * @param expiresIn 过期时间
         * @return Builder 实例
         */
        public Builder expiresIn(Long expiresIn) {
            this.expiresIn = expiresIn;
            return this;
        }

        /**
         * 设置令牌类型。
         *
         * @param tokenType 令牌类型
         * @return Builder 实例
         */
        public Builder tokenType(String tokenType) {
            this.tokenType = tokenType;
            return this;
        }

        /**
         * 设置用户信息。
         *
         * @param user 用户信息
         * @return Builder 实例
         */
        public Builder user(UserInfo user) {
            if (user == null) {
                this.user = null;
                return this;
            }
            UserInfo copy = new UserInfo();
            copy.setId(user.getId());
            copy.setUsername(user.getUsername());
            copy.setEmail(user.getEmail());
            copy.setNickname(user.getNickname());
            copy.setAvatarUrl(user.getAvatarUrl());
            copy.setStatus(user.getStatus());
            copy.setEmailVerifiedAt(user.getEmailVerifiedAt());
            copy.setLastLoginAt(user.getLastLoginAt());
            copy.setRoles(user.getRoles());
            this.user = copy;
            return this;
        }

        /**
         * 构建 TokenResponse 实例。
         *
         * @return TokenResponse 实例
         */
        public TokenResponse build() {
            return new TokenResponse(
                    accessToken,
                    refreshToken,
                    expiresIn,
                    tokenType,
                    user
            );
        }
    }

    /**
     * 获取用户信息的副本。
     *
     * @return 用户信息副本
     */
    public UserInfo getUser() {
        if (user == null) {
            return null;
        }
        UserInfo copy = new UserInfo();
        copy.setId(user.getId());
        copy.setUsername(user.getUsername());
        copy.setEmail(user.getEmail());
        copy.setNickname(user.getNickname());
        copy.setAvatarUrl(user.getAvatarUrl());
        copy.setStatus(user.getStatus());
        copy.setEmailVerifiedAt(user.getEmailVerifiedAt());
        copy.setLastLoginAt(user.getLastLoginAt());
        copy.setRoles(CollectionCopyUtils.copyList(user.getRoles()));
        return copy;
    }

    /**
     * 设置用户信息。
     *
     * @param user 用户信息
     */
    public void setUser(UserInfo user) {
        this.user = copyUserInfo(user);
    }

    /**
     * 复制用户信息。
     *
     * @param user 用户信息
     * @return 用户信息副本
     */
    private static UserInfo copyUserInfo(UserInfo user) {
        if (user == null) {
            return null;
        }
        UserInfo copy = new UserInfo();
        copy.setId(user.getId());
        copy.setUsername(user.getUsername());
        copy.setEmail(user.getEmail());
        copy.setNickname(user.getNickname());
        copy.setAvatarUrl(user.getAvatarUrl());
        copy.setStatus(user.getStatus());
        copy.setEmailVerifiedAt(user.getEmailVerifiedAt());
        copy.setLastLoginAt(user.getLastLoginAt());
        copy.setRoles(CollectionCopyUtils.copyList(user.getRoles()));
        return copy;
    }
}
