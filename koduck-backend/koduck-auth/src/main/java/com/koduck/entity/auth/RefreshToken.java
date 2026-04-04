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
 * 表示用户认证的刷新令牌实体。
 * 存储令牌哈希、设备信息和过期时间。
 *
 * @author Koduck Team
 */
@Entity
@Table(name = "refresh_tokens")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RefreshToken {

    /**
     * 刷新令牌的唯一标识符。
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /**
     * 此令牌所属的用户 ID。
     */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /**
     * 刷新令牌的哈希值。
     */
    @Column(name = "token_hash", nullable = false, unique = true, length = 255)
    private String tokenHash;

    /**
     * 创建令牌的设备信息。
     */
    @Column(name = "device_info", length = 255)
    private String deviceInfo;

    /**
     * 创建令牌的 IP 地址。
     */
    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    /**
     * 令牌过期时间戳。
     */
    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

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
     * @return 如果过期返回 true，否则返回 false
     */
    public boolean isExpired() {
        return LocalDateTime.now().isAfter(expiresAt);
    }
}
