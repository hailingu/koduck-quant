package com.koduck.community.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.EqualsAndHashCode;
import lombok.ToString;

import java.io.Serializable;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * 评论数据传输对象。
 */
@EqualsAndHashCode
@ToString
public class CommentDto implements Serializable {
    private static final long serialVersionUID = 1L;

    @Positive
    private final Long id;

    @NotNull
    @Positive
    private final Long signalId;

    private final Long parentId;

    @NotNull
    @Positive
    private final Long userId;

    private final String username;
    private final String userAvatar;

    @NotBlank
    private final String content;

    private final Integer likeCount;
    private final Integer replyCount;
    private final List<CommentDto> replies;

    private final Instant createdAt;
    private final Instant updatedAt;

    private CommentDto(Builder builder) {
        this.id = builder.id;
        this.signalId = builder.signalId;
        this.parentId = builder.parentId;
        this.userId = builder.userId;
        this.username = builder.username;
        this.userAvatar = builder.userAvatar;
        this.content = builder.content;
        this.likeCount = builder.likeCount;
        this.replyCount = builder.replyCount;
        this.replies = builder.replies == null ? null : new ArrayList<>(builder.replies);
        this.createdAt = builder.createdAt;
        this.updatedAt = builder.updatedAt;
    }

    public static Builder builder() {
        return new Builder();
    }

    // Getters
    public Long getId() { return id; }
    public Long getSignalId() { return signalId; }
    public Long getParentId() { return parentId; }
    public Long getUserId() { return userId; }
    public String getUsername() { return username; }
    public String getUserAvatar() { return userAvatar; }
    public String getContent() { return content; }
    public Integer getLikeCount() { return likeCount; }
    public Integer getReplyCount() { return replyCount; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    /**
     * 获取回复列表的不可修改视图。
     *
     * @return 回复列表
     */
    public List<CommentDto> getReplies() {
        return replies == null ? Collections.emptyList() : List.copyOf(replies);
    }

    public static class Builder {
        private Long id;
        private Long signalId;
        private Long parentId;
        private Long userId;
        private String username;
        private String userAvatar;
        private String content;
        private Integer likeCount;
        private Integer replyCount;
        private List<CommentDto> replies;
        private Instant createdAt;
        private Instant updatedAt;

        public Builder id(Long id) { this.id = id; return this; }
        public Builder signalId(Long signalId) { this.signalId = signalId; return this; }
        public Builder parentId(Long parentId) { this.parentId = parentId; return this; }
        public Builder userId(Long userId) { this.userId = userId; return this; }
        public Builder username(String username) { this.username = username; return this; }
        public Builder userAvatar(String userAvatar) { this.userAvatar = userAvatar; return this; }
        public Builder content(String content) { this.content = content; return this; }
        public Builder likeCount(Integer likeCount) { this.likeCount = likeCount; return this; }
        public Builder replyCount(Integer replyCount) { this.replyCount = replyCount; return this; }

        public Builder replies(List<CommentDto> replies) {
            this.replies = replies == null ? null : new ArrayList<>(replies);
            return this;
        }

        public Builder createdAt(Instant createdAt) { this.createdAt = createdAt; return this; }
        public Builder updatedAt(Instant updatedAt) { this.updatedAt = updatedAt; return this; }

        public CommentDto build() {
            return new CommentDto(this);
        }
    }
}
