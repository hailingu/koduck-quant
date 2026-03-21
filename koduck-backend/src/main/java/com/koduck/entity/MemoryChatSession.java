package com.koduck.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

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

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "session_id", nullable = false, length = 64)
    private String sessionId;

    @Column(name = "title", length = 255)
    private String title;

    @Column(name = "status", nullable = false, length = 32)
    @Builder.Default
    private String status = "active";

    @Column(name = "last_message_at", nullable = false)
    @Builder.Default
    private LocalDateTime lastMessageAt = LocalDateTime.now();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
