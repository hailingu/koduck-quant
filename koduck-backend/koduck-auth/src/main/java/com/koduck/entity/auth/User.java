package com.koduck.entity.auth;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 用户实体，表示应用用户。
 *
 * @author Koduck Team
 */
@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    /** 用户的唯一标识符。 */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /** 登录用户名，必须唯一。 */
    @Column(nullable = false, unique = true, length = 50)
    private String username;

    /** 邮箱地址，必须唯一。 */
    @Column(nullable = false, unique = true, length = 100)
    private String email;

    /** 认证用的哈希密码。 */
    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    /** 显示名称或昵称。 */
    @Column(length = 50)
    private String nickname;

    /** 用户头像图片 URL。 */
    @Column(name = "avatar_url", length = 255)
    private String avatarUrl;

    /** 用户账户状态。 */
    @Column(nullable = false)
    @Enumerated(EnumType.ORDINAL)
    @Builder.Default
    private UserStatus status = UserStatus.ACTIVE;

    /** 邮箱验证时间戳。 */
    @Column(name = "email_verified_at")
    private LocalDateTime emailVerifiedAt;

    /** 上次登录时间戳。 */
    @Column(name = "last_login_at")
    private LocalDateTime lastLoginAt;

    /** 上次登录 IP 地址。 */
    @Column(name = "last_login_ip", length = 45)
    private String lastLoginIp;

    /** 用户创建时间戳。 */
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /** 最后更新时间戳。 */
    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    /** 可能的用户账户状态枚举。 */
    public enum UserStatus {

        /** 账户已禁用/非活跃。 */
        DISABLED,

        /** 账户处于活跃状态。 */
        ACTIVE,

        /** 账户待激活。 */
        PENDING
    }
}
