package com.koduck.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;
import java.util.Map;

import lombok.AccessLevel;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Setter;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.koduck.util.CollectionCopyUtils;

/**
 * Memory chat message entity.
 *
 * @author Koduck Team
 */
@Entity
@Table(name = "chat_messages")
@Data
@NoArgsConstructor
public class MemoryChatMessage {

    /**
     * Primary key.
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /**
     * User ID.
     */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /**
     * Session ID.
     */
    @Column(name = "session_id", nullable = false, length = 64)
    private String sessionId;

    /**
     * Message role.
     */
    @Column(name = "role", nullable = false, length = 32)
    private String role;

    /**
     * Message content.
     */
    @Column(name = "content", nullable = false, columnDefinition = "text")
    private String content;

    /**
     * Token count.
     */
    @Column(name = "token_count")
    private Integer tokenCount;

    /**
     * Metadata.
     */
    @Column(name = "metadata", nullable = false, columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> metadata = Map.of();

    /**
     * Created at.
     */
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /**
     * Creates a new builder.
     *
     * @return Builder instance
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Builder class for MemoryChatMessage.
     */
    public static final class Builder {

        private Long id;
        private Long userId;
        private String sessionId;
        private String role;
        private String content;
        private Integer tokenCount;
        private Map<String, Object> metadata;
        private LocalDateTime createdAt;

        /**
         * Sets the ID.
         *
         * @param id the ID
         * @return this builder
         */
        public Builder id(Long id) {
            this.id = id;
            return this;
        }

        /**
         * Sets the user ID.
         *
         * @param userId the user ID
         * @return this builder
         */
        public Builder userId(Long userId) {
            this.userId = userId;
            return this;
        }

        /**
         * Sets the session ID.
         *
         * @param sessionId the session ID
         * @return this builder
         */
        public Builder sessionId(String sessionId) {
            this.sessionId = sessionId;
            return this;
        }

        /**
         * Sets the role.
         *
         * @param role the role
         * @return this builder
         */
        public Builder role(String role) {
            this.role = role;
            return this;
        }

        /**
         * Sets the content.
         *
         * @param content the content
         * @return this builder
         */
        public Builder content(String content) {
            this.content = content;
            return this;
        }

        /**
         * Sets the token count.
         *
         * @param tokenCount the token count
         * @return this builder
         */
        public Builder tokenCount(Integer tokenCount) {
            this.tokenCount = tokenCount;
            return this;
        }

        /**
         * Sets the metadata.
         *
         * @param metadata the metadata
         * @return this builder
         */
        public Builder metadata(Map<String, Object> metadata) {
            this.metadata = CollectionCopyUtils.copyMap(metadata);
            return this;
        }

        /**
         * Sets the created at.
         *
         * @param createdAt the created at
         * @return this builder
         */
        public Builder createdAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        /**
         * Builds the MemoryChatMessage.
         *
         * @return the MemoryChatMessage
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
     * Gets metadata copy.
     *
     * @return metadata copy
     */
    public Map<String, Object> getMetadata() {
        return CollectionCopyUtils.copyMap(metadata);
    }

    /**
     * Sets metadata with copy.
     *
     * @param metadata the metadata
     */
    public void setMetadata(Map<String, Object> metadata) {
        this.metadata = CollectionCopyUtils.copyMap(metadata);
    }
}
