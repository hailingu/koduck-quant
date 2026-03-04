package com.koduck.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * 用户凭证实体 - 用于安全存储 API Key 和 Secret
 */
@Entity
@Table(name = "user_credentials")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserCredential {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    private CredentialType type;

    @Column(nullable = false, length = 50)
    private String provider;

    @Column(name = "api_key_encrypted", nullable = false, columnDefinition = "TEXT")
    private String apiKeyEncrypted;

    @Column(name = "api_secret_encrypted", columnDefinition = "TEXT")
    private String apiSecretEncrypted;

    @Column(length = 20)
    @Enumerated(EnumType.STRING)
    private Environment environment;

    @Column(name = "additional_config", columnDefinition = "JSONB")
    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> additionalConfig;

    @Column(name = "is_active")
    private Boolean isActive = true;

    @Column(name = "last_verified_at")
    private LocalDateTime lastVerifiedAt;

    @Column(name = "last_verified_status", length = 20)
    @Enumerated(EnumType.STRING)
    private VerificationStatus lastVerifiedStatus;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /**
     * 凭证类型枚举
     */
    public enum CredentialType {
        BROKER,      // 券商 API
        DATA_SOURCE, // 数据源 API
        EXCHANGE,    // 交易所 API
        AI_PROVIDER  // AI 服务提供商 API
    }

    /**
     * 环境类型枚举
     */
    public enum Environment {
        paper,   // 模拟盘/纸交易
        live,    // 实盘
        sandbox  // 沙盒环境
    }

    /**
     * 验证状态枚举
     */
    public enum VerificationStatus {
        SUCCESS, // 验证成功
        FAILED,  // 验证失败
        PENDING  // 待验证
    }
}
