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
 * 用户信息数据传输对象（兼容层）。
 *
 * <p><strong>已弃用</strong>：请使用 {@link com.koduck.security.AuthUserPrincipal}</p>
 * <p>此类作为临时兼容层保留，将在后续版本中删除。</p>
 *
 * @deprecated 使用 {@link com.koduck.security.AuthUserPrincipal}
 * @author Koduck Team
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Deprecated
public class UserInfo implements UserPrincipal {

    private static final long serialVersionUID = SERIAL_VERSION_UID;

    private Long id;
    private String username;
    private String email;
    private String nickname;
    private String avatarUrl;
    private User.UserStatus status;
    private LocalDateTime emailVerifiedAt;
    private LocalDateTime lastLoginAt;
    private List<String> roles;

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
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
