package com.koduck.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * 密码重置令牌实体（无外键关联，userId 纯字段存储）
 *
 * <p>用于存储密码重置请求的临时令牌，具有以下安全特性：</p>
 * <ul>
 *   <li>存储令牌哈希而非原始令牌</li>
 *   <li>有过期时间限制</li>
 *   <li>一次性使用，使用后标记为已使用</li>
 * </ul>
 */
@Entity
@Table(name = "password_reset_tokens")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PasswordResetToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "token_hash", nullable = false, unique = true, length = 255)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(nullable = false)
    @Builder.Default
    private Boolean used = false;

    @Column(name = "used_at")
    private LocalDateTime usedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    /**
     * 检查令牌是否过期
     *
     * @return true 如果令牌已过期
     */
    public boolean isExpired() {
        return LocalDateTime.now().isAfter(expiresAt);
    }

    /**
     * 检查令牌是否有效（未过期且未使用）
     *
     * @return true 如果令牌有效
     */
    public boolean isValid() {
        return !used && !isExpired();
    }

    /**
     * 标记令牌为已使用
     */
    public void markAsUsed() {
        this.used = true;
        this.usedAt = LocalDateTime.now();
    }
}
