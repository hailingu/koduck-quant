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
 * Entity for recording login attempts.
 *
 * @author Koduck Team
 */
@Entity
@Table(name = "login_attempts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LoginAttempt {

    /**
     * Unique identifier for the login attempt.
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /**
     * Login identifier (username or IP address).
     */
    @Column(nullable = false, length = 100)
    private String identifier;

    /**
     * Type of login attempt (account or ip).
     */
    @Column(nullable = false, length = 20)
    private String type;

    /**
     * IP address of the login attempt.
     */
    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    /**
     * User agent string of the client.
     */
    @Column(name = "user_agent", length = 500)
    private String userAgent;

    /**
     * Whether the login attempt was successful.
     */
    @Column(nullable = false)
    private Boolean success;

    /**
     * Timestamp when the login attempt was created.
     */
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;
}
