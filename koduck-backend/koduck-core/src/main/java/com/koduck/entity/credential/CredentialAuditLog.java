package com.koduck.entity.credential;

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

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 凭证审计日志实体。
 * 记录凭证相关操作以供审计。
 *
 * @author Koduck Team
 */
@Entity
@Table(name = "credential_audit_logs")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CredentialAuditLog {

    /**
     * 审计日志条目的唯一标识符。
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /**
     * 被审计凭证的 ID。
     */
    @Column(name = "credential_id")
    private Long credentialId;

    /**
     * 执行操作的用户 ID。
     */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /**
     * 执行的操作类型。
     */
    @Column(nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    private ActionType action;

    /**
     * 执行操作的用户的 IP 地址。
     */
    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    /**
     * 客户端的用户代理字符串。
     */
    @Column(name = "user_agent", columnDefinition = "TEXT")
    private String userAgent;

    /**
     * 操作是否成功。
     */
    @Column(nullable = false)
    private Boolean success;

    /**
     * 操作失败时的错误信息。
     */
    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    /**
     * 审计日志条目创建时间戳。
     */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /**
     * 凭证审计日志可能的操作类型枚举。
     */
    public enum ActionType {

        /**
         * 创建新凭证。
         */
        CREATE,

        /**
         * 更新现有凭证。
         */
        UPDATE,

        /**
         * 删除凭证。
         */
        DELETE,

        /**
         * 验证凭证。
         */
        VERIFY,

        /**
         * 查看凭证。
         */
        VIEW
    }
}
