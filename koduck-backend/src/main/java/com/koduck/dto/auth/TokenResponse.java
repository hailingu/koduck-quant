package com.koduck.dto.auth;

import com.koduck.dto.UserInfo;
import com.koduck.util.CollectionCopyUtils;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Token  DTO
 */
@Data
@NoArgsConstructor
public class TokenResponse {

    private String accessToken;
    private String refreshToken;
    private Long expiresIn;
    private String tokenType;
    private UserInfo user;

    public TokenResponse(String accessToken, String refreshToken, Long expiresIn, String tokenType, UserInfo user) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.expiresIn = expiresIn;
        this.tokenType = tokenType;
        setUser(user);
    }

    public static Builder builder() {
        return new Builder();
    }

    public static final class Builder {

        private String accessToken;
        private String refreshToken;
        private Long expiresIn;
        private String tokenType;
        private UserInfo user;

        public Builder accessToken(String accessToken) {
            this.accessToken = accessToken;
            return this;
        }

        public Builder refreshToken(String refreshToken) {
            this.refreshToken = refreshToken;
            return this;
        }

        public Builder expiresIn(Long expiresIn) {
            this.expiresIn = expiresIn;
            return this;
        }

        public Builder tokenType(String tokenType) {
            this.tokenType = tokenType;
            return this;
        }

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

        public TokenResponse build() {
            return new TokenResponse(accessToken, refreshToken, expiresIn, tokenType, user);
        }
    }

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

    public void setUser(UserInfo user) {
        if (user == null) {
            this.user = null;
            return;
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
        this.user = copy;
    }
}
