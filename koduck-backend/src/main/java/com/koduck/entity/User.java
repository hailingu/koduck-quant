package com.koduck.entity;

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
import org.hibernate.annotations.UpdateTimestamp;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * User entity representing application users.
 *
 * @author koduck
 */
@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    /** Unique identifier for the user. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /** Username for login, must be unique. */
    @Column(nullable = false, unique = true, length = 50)
    private String username;

    /** Email address, must be unique. */
    @Column(nullable = false, unique = true, length = 100)
    private String email;

    /** Hashed password for authentication. */
    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    /** Display name or nickname. */
    @Column(length = 50)
    private String nickname;

    /** URL to user's avatar image. */
    @Column(name = "avatar_url", length = 255)
    private String avatarUrl;

    /** User account status. */
    @Column(nullable = false)
    @Enumerated(EnumType.ORDINAL)
    @Builder.Default
    private UserStatus status = UserStatus.ACTIVE;

    /** Timestamp when email was verified. */
    @Column(name = "email_verified_at")
    private LocalDateTime emailVerifiedAt;

    /** Timestamp of last login. */
    @Column(name = "last_login_at")
    private LocalDateTime lastLoginAt;

    /** IP address of last login. */
    @Column(name = "last_login_ip", length = 45)
    private String lastLoginIp;

    /** Timestamp when user was created. */
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /** Timestamp of last update. */
    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    /** Enumeration of possible user account statuses. */
    public enum UserStatus {

        /** Account is disabled/inactive. */
        DISABLED,

        /** Account is active and functional. */
        ACTIVE,

        /** Account is pending activation. */
        PENDING
    }
}
