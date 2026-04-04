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
 * Password reset token entity for user password reset functionality.
 *
 * <p>Features:</p>
 * <ul>
 *   <li>Token generation and validation</li>
 *   <li>Expiration time tracking</li>
 *   <li>One-time use enforcement</li>
 * </ul>
 *
 * @author Koduck
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
     * Unique identifier for the token.
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /**
     * ID of the user who requested the password reset.
     */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /**
     * Hashed value of the reset token.
     */
    @Column(name = "token_hash", nullable = false, unique = true, length = 255)
    private String tokenHash;

    /**
     * Token expiration timestamp.
     */
    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    /**
     * Flag indicating whether the token has been used.
     */
    @Column(nullable = false)
    @Builder.Default
    private Boolean used = false;

    /**
     * Timestamp when the token was used.
     */
    @Column(name = "used_at")
    private LocalDateTime usedAt;

    /**
     * Token creation timestamp.
     */
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /**
     * Checks if the token has expired.
     *
     * @return true if the token has expired
     */
    public boolean isExpired() {
        return LocalDateTime.now().isAfter(expiresAt);
    }

    /**
     * Checks if the token is valid (not used and not expired).
     *
     * @return true if the token is valid
     */
    public boolean isValid() {
        return !used && !isExpired();
    }

    /**
     * Marks the token as used.
     */
    public void markAsUsed() {
        this.used = true;
        this.usedAt = LocalDateTime.now();
    }
}
