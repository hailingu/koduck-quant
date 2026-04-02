package com.koduck.security;
import java.io.Serial;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import com.koduck.entity.User;

/**
 *  UserDetails ， User 
 */
public class UserPrincipal implements UserDetails {

    @Serial
    private static final long serialVersionUID = 1L;

    private final Long id;
    private final String email;
    private final String nickname;
    private final String passwordHash;
    private final User.UserStatus status;
    private final Collection<? extends GrantedAuthority> authorities;

    public UserPrincipal(User user, Collection<? extends GrantedAuthority> authorities) {
        User nonNullUser = Objects.requireNonNull(user, "user must not be null");
        this.id = nonNullUser.getId();
        this.email = nonNullUser.getEmail();
        this.nickname = nonNullUser.getNickname();
        this.passwordHash = nonNullUser.getPasswordHash();
        this.status = nonNullUser.getStatus();
        this.authorities = authorities == null ? List.of() : Collections.unmodifiableList(new ArrayList<>(authorities));
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return Collections.unmodifiableList(new ArrayList<>(authorities));
    }

    @Override
    public String getPassword() {
        return passwordHash;
    }

    @Override
    public String getUsername() {
        return String.valueOf(id);
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return status == User.UserStatus.ACTIVE;
    }

    public Long getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public String getNickname() {
        return nickname;
    }

    public User getUser() {
        return User.builder()
                .id(id)
                .email(email)
                .nickname(nickname)
                .passwordHash(passwordHash)
                .status(status)
                .build();
    }
}
