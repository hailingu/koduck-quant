package com.koduck.entity.ai;

import java.time.LocalDateTime;
import java.util.Map;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.koduck.util.CollectionCopyUtils;

import lombok.AccessLevel;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 记忆聊天消息实体。
 *
 * @author Koduck Team
 */
@Entity
@Table(name = "chat_messages")
@Data
@NoArgsConstructor
public class MemoryChatMessage {

    /**
     * 主键。
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /**
     * 用户 ID。
     */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /**
     * 会话 ID。
     */
    @Column(name = "session_id", nullable = false, length = 64)
    private String sessionId;

    /**
     * 消息角色。
     */
    @Column(name = "role", nullable = false, length = 32)
    private String role;

    /**
     * 消息内容。
     */
    @Column(name = "content", nullable = false, columnDefinition = "text")
    private String content;

    /**
     * Token 数量。
     */
    @Column(name = "token_count")
    private Integer tokenCount;

    /**
     * 元数据。
     */
    @Column(name = "metadata", nullable = false, columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> metadata = Map.of();

    /**
     * 创建时间。
     */
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /**
     * 创建新的构建器。
     *
     * @return 构建器实例
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * MemoryChatMessage 的构建器类。
     */
    public static final class Builder {

        /**
         * 消息 ID。
         */
        private Long id;

        /**
         * 用户 ID。
         */
        private Long userId;

        /**
         * 会话 ID。
         */
        private String sessionId;

        /**
         * 消息角色。
         */
        private String role;

        /**
         * 消息内容。
         */
        private String content;

        /**
         * Token 数量。
         */
        private Integer tokenCount;

        /**
         * 元数据映射。
         */
        private Map<String, Object> metadata;

        /**
         * 创建时间戳。
         */
        private LocalDateTime createdAt;

        /**
         * 设置 ID。
         *
         * @param id ID
         * @return 此构建器
         */
        public Builder id(Long id) {
            this.id = id;
            return this;
        }

        /**
         * 设置用户 ID。
         *
         * @param userId 用户 ID
         * @return 此构建器
         */
        public Builder userId(Long userId) {
            this.userId = userId;
            return this;
        }

        /**
         * 设置会话 ID。
         *
         * @param sessionId 会话 ID
         * @return 此构建器
         */
        public Builder sessionId(String sessionId) {
            this.sessionId = sessionId;
            return this;
        }

        /**
         * 设置角色。
         *
         * @param role 角色
         * @return 此构建器
         */
        public Builder role(String role) {
            this.role = role;
            return this;
        }

        /**
         * 设置内容。
         *
         * @param content 内容
         * @return 此构建器
         */
        public Builder content(String content) {
            this.content = content;
            return this;
        }

        /**
         * 设置 Token 数量。
         *
         * @param tokenCount Token 数量
         * @return 此构建器
         */
        public Builder tokenCount(Integer tokenCount) {
            this.tokenCount = tokenCount;
            return this;
        }

        /**
         * 设置元数据。
         *
         * @param metadata 元数据
         * @return 此构建器
         */
        public Builder metadata(Map<String, Object> metadata) {
            this.metadata = CollectionCopyUtils.copyMap(metadata);
            return this;
        }

        /**
         * 设置创建时间。
         *
         * @param createdAt 创建时间
         * @return 此构建器
         */
        public Builder createdAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        /**
         * 构建 MemoryChatMessage。
         *
         * @return MemoryChatMessage
         */
        public MemoryChatMessage build() {
            MemoryChatMessage message = new MemoryChatMessage();
            message.id = id;
            message.setUserId(userId);
            message.setSessionId(sessionId);
            message.setRole(role);
            message.setContent(content);
            message.setTokenCount(tokenCount);
            message.setMetadata(metadata);
            message.createdAt = createdAt;
            return message;
        }
    }

    /**
     * 获取元数据副本。
     *
     * @return 元数据副本
     */
    public Map<String, Object> getMetadata() {
        return CollectionCopyUtils.copyMap(metadata);
    }

    /**
     * 使用副本设置元数据。
     *
     * @param metadata 元数据
     */
    public void setMetadata(Map<String, Object> metadata) {
        this.metadata = CollectionCopyUtils.copyMap(metadata);
    }
}
