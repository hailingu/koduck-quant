package com.koduck.dto.user;

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
public class UserDetailResponse {

    private Long id;
    private String username;
    private String email;
    private String nickname;
    private String avatarUrl;
    private User.UserStatus status;
    private LocalDateTime emailVerifiedAt;
    private LocalDateTime lastLoginAt;
    private String lastLoginIp;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<String> roles;
    private List<String> permissions;

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
        private String lastLoginIp;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
        private List<String> roles;
        private List<String> permissions;

        public Builder id(Long id) { this.id = id; return this; }
        public Builder username(String username) { this.username = username; return this; }
        public Builder email(String email) { this.email = email; return this; }
        public Builder nickname(String nickname) { this.nickname = nickname; return this; }
        public Builder avatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; return this; }
        public Builder status(User.UserStatus status) { this.status = status; return this; }
        public Builder emailVerifiedAt(LocalDateTime emailVerifiedAt) { this.emailVerifiedAt = emailVerifiedAt; return this; }
        public Builder lastLoginAt(LocalDateTime lastLoginAt) { this.lastLoginAt = lastLoginAt; return this; }
        public Builder lastLoginIp(String lastLoginIp) { this.lastLoginIp = lastLoginIp; return this; }
        public Builder createdAt(LocalDateTime createdAt) { this.createdAt = createdAt; return this; }
        public Builder updatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; return this; }
        public Builder roles(List<String> roles) { this.roles = CollectionCopyUtils.copyList(roles); return this; }
        public Builder permissions(List<String> permissions) { this.permissions = CollectionCopyUtils.copyList(permissions); return this; }

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

    public List<String> getRoles() {
        return CollectionCopyUtils.copyList(roles);
    }

    public void setRoles(List<String> roles) {
        this.roles = CollectionCopyUtils.copyList(roles);
    }

    public List<String> getPermissions() {
        return CollectionCopyUtils.copyList(permissions);
    }

    public void setPermissions(List<String> permissions) {
        this.permissions = CollectionCopyUtils.copyList(permissions);
    }
}
