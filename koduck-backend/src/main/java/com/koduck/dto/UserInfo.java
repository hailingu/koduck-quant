package com.koduck.dto;

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
public class UserInfo {

    private Long id;
    private String username;
    private String email;
    private String nickname;
    private String avatarUrl;
    private User.UserStatus status;
    private LocalDateTime emailVerifiedAt;
    private LocalDateTime lastLoginAt;
    @Singular
    private List<String> roles;

    public List<String> getRoles() {
        return CollectionCopyUtils.copyList(roles);
    }

    public void setRoles(List<String> roles) {
        this.roles = CollectionCopyUtils.copyList(roles);
    }
}
