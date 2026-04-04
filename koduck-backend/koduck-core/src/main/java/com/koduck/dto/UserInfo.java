package com.koduck.dto;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.stream.Collectors;

import com.koduck.entity.auth.User;
import com.koduck.security.GrantedAuthority;
import com.koduck.security.SimpleGrantedAuthority;
import com.koduck.security.UserPrincipal;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 用户信息数据传输对象。
 *
 * <p>用于认证响应中的用户信息。</p>
 *
 * @author Koduck Team
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserInfo implements UserPrincipal<GrantedAuthority> {

    private static final long serialVersionUID = SERIAL_VERSION_UID;

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
    /** 角色列表. */
    private transient List<String> roles;

    @Override
    public Collection<GrantedAuthority> getAuthorities() {
        if (roles == null) {
            return List.of();
        }
        return roles.stream()
                .map(SimpleGrantedAuthority::new)
                .collect(Collectors.toList());
    }

    @Override
    public boolean isEnabled() {
        return status == User.UserStatus.ACTIVE;
    }
}
