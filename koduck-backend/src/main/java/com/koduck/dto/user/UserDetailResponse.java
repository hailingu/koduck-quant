package com.koduck.dto.user;

import com.koduck.entity.User;
import com.koduck.util.CollectionCopyUtils;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Singular;

import java.time.LocalDateTime;
import java.util.List;

/**
 *  DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
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
    @Singular
    private List<String> roles;
    @Singular
    private List<String> permissions;

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
