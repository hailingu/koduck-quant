package com.koduck.dto;

import com.koduck.entity.User;
import com.koduck.util.CollectionCopyUtils;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 *  DTO
 */
@Data
@NoArgsConstructor
public class UserInfo {

    private Long id;
    private String username;
    private String email;
    private String nickname;
    private String avatarUrl;
    private User.UserStatus status;
    private LocalDateTime emailVerifiedAt;
    private LocalDateTime lastLoginAt;
    private List<String> roles;

    public static Builder builder() {
        return new Builder();
    }

    public static final class Builder {

        private Long id;
        private String username;
        private String email;
        private String nickname;
        private String avatarUrl;
        private User.UserStatus status;
        private LocalDateTime emailVerifiedAt;
        private LocalDateTime lastLoginAt;
        private List<String> roles;

        public Builder id(Long id) {
            this.id = id;
            return this;
        }

        public Builder username(String username) {
            this.username = username;
            return this;
        }

        public Builder email(String email) {
            this.email = email;
            return this;
        }

        public Builder nickname(String nickname) {
            this.nickname = nickname;
            return this;
        }

        public Builder avatarUrl(String avatarUrl) {
            this.avatarUrl = avatarUrl;
            return this;
        }

        public Builder status(User.UserStatus status) {
            this.status = status;
            return this;
        }

        public Builder emailVerifiedAt(LocalDateTime emailVerifiedAt) {
            this.emailVerifiedAt = emailVerifiedAt;
            return this;
        }

        public Builder lastLoginAt(LocalDateTime lastLoginAt) {
            this.lastLoginAt = lastLoginAt;
            return this;
        }

        public Builder roles(List<String> roles) {
            this.roles = CollectionCopyUtils.copyList(roles);
            return this;
        }

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

    public List<String> getRoles() {
        return CollectionCopyUtils.copyList(roles);
    }

    public void setRoles(List<String> roles) {
        this.roles = CollectionCopyUtils.copyList(roles);
    }
}
