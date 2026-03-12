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
 *  -  API Key  Secret
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
     * 
     */
    public enum CredentialType {
        BROKER,      //  API
        DATA_SOURCE, //  API
        EXCHANGE,    //  API
        AI_PROVIDER  // AI  API
    }

    /**
     * 
     */
    public enum Environment {
        paper,   // /
        live,    // 
        sandbox  // 
    }

    /**
     * 
     */
    public enum VerificationStatus {
        SUCCESS, // 
        FAILED,  // 
        PENDING  // 
    }
}
