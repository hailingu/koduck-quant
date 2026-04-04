package com.koduck.security;

import java.util.Objects;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 简单的权限标识实现。
 *
 * @author Koduck Team
 */
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class SimpleGrantedAuthority implements GrantedAuthority {

    private static final long serialVersionUID = SERIAL_VERSION_UID;

    /**
     * 权限字符串。
     */
    private String authority;

    @Override
    public boolean equals(final Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        SimpleGrantedAuthority that = (SimpleGrantedAuthority) o;
        return Objects.equals(authority, that.authority);
    }

    @Override
    public int hashCode() {
        return Objects.hash(authority);
    }

    @Override
    public String toString() {
        return authority;
    }
}
