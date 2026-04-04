package com.koduck.security;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.security.core.userdetails.UserDetails;

import com.koduck.entity.auth.User;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 认证用户主体默认实现。
 *
 * <p>koduck-auth 提供的默认用户实现，包含完整的认证相关信息。</p>
 * <p>新项目可以直接使用此类，或实现 {@link UserPrincipal} 接口自定义。</p>
 *
 * @author Koduck Team
 * @see UserPrincipal
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthUserPrincipal implements
        UserPrincipal<org.springframework.security.core.GrantedAuthority>,
        UserDetails {

    private static final long serialVersionUID = 1L;

    /**
     * 用户ID。
     */
    private Long id;

    /**
     * 用户名。
     */
    private String username;

    /**
     * 邮箱。
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
    private UserStatus status;

    /**
     * 邮箱验证时间。
     */
    private LocalDateTime emailVerifiedAt;

    /**
     * 最后登录时间。
     */
    private LocalDateTime lastLoginAt;

    /**
     * 权限列表（Spring Security 类型）。
     */
    private List<org.springframework.security.core.GrantedAuthority> authorities;

    /**
     * 账户是否启用。
     */
    @Builder.Default
    private boolean enabled = true;

    /**
     * 账户是否未过期。
     */
    @Builder.Default
    private boolean accountNonExpired = true;

    /**
     * 账户是否未锁定。
     */
    @Builder.Default
    private boolean accountNonLocked = true;

    /**
     * 凭证是否未过期。
     */
    @Builder.Default
    private boolean credentialsNonExpired = true;

    /**
     * 获取 Spring Security 权限列表。
     *
     * @return 权限集合
     */
    @Override
    public Collection<org.springframework.security.core.GrantedAuthority> getAuthorities() {
        if (authorities == null) {
            return List.of();
        }
        return List.copyOf(authorities);
    }



    @Override
    public boolean isEnabled() {
        return enabled;
    }

    @Override
    public boolean isAccountNonExpired() {
        return accountNonExpired;
    }

    @Override
    public boolean isAccountNonLocked() {
        return accountNonLocked;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return credentialsNonExpired;
    }

    @Override
    public String getPassword() {
        // AuthUserPrincipal 不包含密码，由调用方处理凭证验证
        return null;
    }

    /**
     * 从 User 实体和角色列表构建。
     *
     * @param user 用户实体
     * @param roles 角色列表
     * @return AuthUserPrincipal
     */
    public static AuthUserPrincipal from(final User user, final List<String> roles) {
        return AuthUserPrincipal.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .nickname(user.getNickname())
                .avatarUrl(user.getAvatarUrl())
                .status(UserStatus.valueOf(user.getStatus().name()))
                .emailVerifiedAt(user.getEmailVerifiedAt())
                .lastLoginAt(user.getLastLoginAt())
                .authorities(roles.stream()
                        .map(org.springframework.security.core.authority.SimpleGrantedAuthority::new)
                        .collect(Collectors.toList()))
                .enabled(user.getStatus() == User.UserStatus.ACTIVE)
                .build();
    }

    /**
     * 用户状态枚举。
     */
    public enum UserStatus {
        /** 活跃状态. */
        ACTIVE,
        /** 非活跃状态. */
        INACTIVE,
        /** 暂停状态. */
        SUSPENDED
    }
}
