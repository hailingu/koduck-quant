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
 * AI 对话会话的记忆聊天会话实体。
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

    /** 会话的唯一标识符。 */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /** 拥有此会话的用户 ID。 */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** 外部引用的会话 ID。 */
    @Column(name = "session_id", nullable = false, length = 64)
    private String sessionId;

    /** 会话标题或主题。 */
    @Column(name = "title", length = 255)
    private String title;

    /** 会话状态（例如：活跃、已关闭）。 */
    @Column(name = "status", nullable = false, length = 32)
    @Builder.Default
    private String status = "active";

    /** 会话中最后一条消息的时间戳。 */
    @Column(name = "last_message_at", nullable = false)
    @Builder.Default
    private LocalDateTime lastMessageAt = LocalDateTime.now();

    /** 会话创建时间戳。 */
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /** 最后更新时间戳。 */
    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
