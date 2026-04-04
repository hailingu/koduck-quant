package com.koduck.security;

import java.io.Serializable;
import java.util.Collection;

/**
 * 用户身份接口契约。
 *
 * <p>定义 koduck-auth 认证服务所需的最小用户行为契约。
 * 新项目可以实现此接口，自定义用户字段，无需继承 koduck 的任何类。</p>
 *
 * <p>示例：新项目实现多租户用户</p>
 * <pre>{@code
 * public class TenantUser implements UserPrincipal {
 *     private Long id;
 *     private String username;
 *     private Long tenantId;  // 自定义字段
 *
 *     @Override
 *     public Collection<? extends GrantedAuthority> getAuthorities() {
 *         // 自定义权限逻辑
 *     }
 * }
 * }</pre>
 *
 * @author Koduck Team
 * @see GrantedAuthority
 */
public interface UserPrincipal extends Serializable {

    /**
     * Serial version UID.
     */
    long SERIAL_VERSION_UID = 1L;

    /**
     * 获取用户唯一标识。
     *
     * @return 用户ID
     */
    Long getId();

    /**
     * 获取用户名。
     *
     * @return 用户名
     */
    String getUsername();

    /**
     * 获取用户权限列表。
     *
     * @return 权限集合
     */
    Collection<? extends GrantedAuthority> getAuthorities();

    /**
     * 判断账户是否启用。
     *
     * @return 默认 true
     */
    default boolean isEnabled() {
        return true;
    }

    /**
     * 判断账户是否未过期。
     *
     * @return 默认 true
     */
    default boolean isAccountNonExpired() {
        return true;
    }

    /**
     * 判断账户是否未锁定。
     *
     * @return 默认 true
     */
    default boolean isAccountNonLocked() {
        return true;
    }

    /**
     * 判断凭证是否未过期。
     *
     * @return 默认 true
     */
    default boolean isCredentialsNonExpired() {
        return true;
    }
}
