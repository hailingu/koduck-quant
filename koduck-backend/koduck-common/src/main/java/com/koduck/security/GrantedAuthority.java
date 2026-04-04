package com.koduck.security;

import java.io.Serializable;

/**
 * 权限标识接口。
 *
 * <p>表示用户拥有的一个权限或角色。</p>
 *
 * @author Koduck Team
 * @see UserPrincipal#getAuthorities()
 */
public interface GrantedAuthority extends Serializable {

    /**
     * Serial version UID.
     */
    long SERIAL_VERSION_UID = 1L;

    /**
     * 获取权限字符串。
     *
     * @return 权限标识，如 "ROLE_USER", "read:order"
     */
    String getAuthority();
}
