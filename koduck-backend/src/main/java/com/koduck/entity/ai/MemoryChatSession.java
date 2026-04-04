package com.koduck.entity.ai;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Memory chat session entity for AI conversation sessions.
 *
 * @author Koduck Team
 */
@Entity
@Table(
    name = "chat_sessions",
    uniqueConstraints = @UniqueConstraint(
        name = "uq_chat_sessions_user_session",
        columnNames = {"user_id", "session_id"}
    )
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MemoryChatSession {

    /** Unique identifier for the session. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /** User ID who owns this session. */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** Session ID for external reference. */
    @Column(name = "session_id", nullable = false, length = 64)
    private String sessionId;

    /** Session title or subject. */
    @Column(name = "title", length = 255)
    private String title;

    /** Session status (e.g., active, closed). */
    @Column(name = "status", nullable = false, length = 32)
    @Builder.Default
    private String status = "active";

    /** Timestamp of the last message in the session. */
    @Column(name = "last_message_at", nullable = false)
    @Builder.Default
    private LocalDateTime lastMessageAt = LocalDateTime.now();

    /** Timestamp when the session was created. */
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /** Timestamp of last update. */
    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
