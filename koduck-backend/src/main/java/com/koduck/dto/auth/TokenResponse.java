package com.koduck.dto.auth;

import com.koduck.dto.UserInfo;
import com.koduck.util.CollectionCopyUtils;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Token  DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TokenResponse {

    private String accessToken;
    private String refreshToken;
    private Long expiresIn;
    private String tokenType;
    private UserInfo user;

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
