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
 * Credential audit log entity.
 * Records credential-related actions for audit purposes.
 *
 * @author Koduck
 */
@Entity
@Table(name = "credential_audit_logs")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CredentialAuditLog {

    /**
     * Unique identifier for the audit log entry.
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /**
     * ID of the credential being audited.
     */
    @Column(name = "credential_id")
    private Long credentialId;

    /**
     * ID of the user who performed the action.
     */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /**
     * Type of action performed.
     */
    @Column(nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    private ActionType action;

    /**
     * IP address of the user who performed the action.
     */
    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    /**
     * User agent string of the client.
     */
    @Column(name = "user_agent", columnDefinition = "TEXT")
    private String userAgent;

    /**
     * Whether the action was successful.
     */
    @Column(nullable = false)
    private Boolean success;

    /**
     * Error message if the action failed.
     */
    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    /**
     * Timestamp when the audit log entry was created.
     */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /**
     * Enumeration of possible action types for credential audit logs.
     */
    public enum ActionType {

        /**
         * Create a new credential.
         */
        CREATE,

        /**
         * Update an existing credential.
         */
        UPDATE,

        /**
         * Delete a credential.
         */
        DELETE,

        /**
         * Verify a credential.
         */
        VERIFY,

        /**
         * View a credential.
         */
        VIEW
    }
}
