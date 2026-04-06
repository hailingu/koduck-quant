package com.koduck.entity.auth;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import org.hibernate.annotations.CreationTimestamp;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 用户密码重置功能的密码重置令牌实体。
 *
 * <p>功能特性：</p>
 * <ul>
 *   <li>令牌生成和验证</li>
 *   <li>过期时间跟踪</li>
 *   <li>一次性使用强制</li>
 * </ul>
 *
 * @author Koduck Team
 */
@Entity
@Table(name = "password_reset_tokens")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PasswordResetToken {

    /**
     * 令牌的唯一标识符。
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /**
     * 请求密码重置的用户 ID。
     */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /**
     * 重置令牌的哈希值。
     */
    @Column(name = "token_hash", nullable = false, unique = true, length = 255)
    private String tokenHash;

    /**
     * 令牌过期时间戳。
     */
    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    /**
     * 指示令牌是否已使用的标志。
     */
    @Column(nullable = false)
    @Builder.Default
    private Boolean used = false;

    /**
     * 令牌使用时间戳。
     */
    @Column(name = "used_at")
    private LocalDateTime usedAt;

    /**
     * 令牌创建时间戳。
     */
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /**
     * 检查令牌是否已过期。
     *
     * @return 如果令牌已过期返回 true
     */
    public boolean isExpired() {
        return LocalDateTime.now().isAfter(expiresAt);
    }

    /**
     * 检查令牌是否有效（未使用且未过期）。
     *
     * @return 如果令牌有效返回 true
     */
    public boolean isValid() {
        return !used && !isExpired();
    }

    /**
     * 将令牌标记为已使用。
     */
    public void markAsUsed() {
        this.used = true;
        this.usedAt = LocalDateTime.now();
    }
}
