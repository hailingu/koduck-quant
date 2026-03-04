package com.koduck.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * 凭证操作审计日志实体
 */
@Entity
@Table(name = "credential_audit_logs")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CredentialAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "credential_id")
    private Long credentialId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    private ActionType action;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "user_agent", columnDefinition = "TEXT")
    private String userAgent;

    @Column(nullable = false)
    private Boolean success;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    /**
     * 操作类型枚举
     */
    public enum ActionType {
        CREATE, // 创建凭证
        UPDATE, // 更新凭证
        DELETE, // 删除凭证
        VERIFY, // 验证凭证
        VIEW    // 查看凭证列表
    }
}
