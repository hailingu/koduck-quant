package com.koduck.dto.community;
import java.time.LocalDateTime;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonFormat;

import com.koduck.common.constants.DateTimePatternConstants;
import com.koduck.util.CollectionCopyUtils;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 *  DTO
 */
@Data
@NoArgsConstructor
public class CommentResponse {

    private Long id;
    private Long signalId;
    private Long userId;
    private String username;
    private String avatarUrl;
    private Long parentId;

    private String content;
    private Integer likeCount;
    private Boolean isDeleted;

    private List<CommentResponse> replies;

    @JsonFormat(pattern = DateTimePatternConstants.STANDARD_DATE_TIME_PATTERN)
    private LocalDateTime createdAt;

    @JsonFormat(pattern = DateTimePatternConstants.STANDARD_DATE_TIME_PATTERN)
    private LocalDateTime updatedAt;

    public List<CommentResponse> getReplies() {
        return CollectionCopyUtils.copyList(replies);
    }

    public void setReplies(List<CommentResponse> replies) {
        this.replies = CollectionCopyUtils.copyList(replies);
    }

    public static Builder builder() {
        return new Builder();
    }

    public static final class Builder {

        private Long id;
        private Long signalId;
        private Long userId;
        private String username;
        private String avatarUrl;
        private Long parentId;
        private String content;
        private Integer likeCount;
        private Boolean isDeleted;
        private List<CommentResponse> replies;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;

        public Builder id(Long id) {
            this.id = id;
            return this;
        }

        public Builder signalId(Long signalId) {
            this.signalId = signalId;
            return this;
        }

        public Builder userId(Long userId) {
            this.userId = userId;
            return this;
        }

        public Builder username(String username) {
            this.username = username;
            return this;
        }

        public Builder avatarUrl(String avatarUrl) {
            this.avatarUrl = avatarUrl;
            return this;
        }

        public Builder parentId(Long parentId) {
            this.parentId = parentId;
            return this;
        }

        public Builder content(String content) {
            this.content = content;
            return this;
        }

        public Builder likeCount(Integer likeCount) {
            this.likeCount = likeCount;
            return this;
        }

        public Builder isDeleted(Boolean isDeleted) {
            this.isDeleted = isDeleted;
            return this;
        }

        public Builder replies(List<CommentResponse> replies) {
            this.replies = CollectionCopyUtils.copyList(replies);
            return this;
        }

        public Builder createdAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        public Builder updatedAt(LocalDateTime updatedAt) {
            this.updatedAt = updatedAt;
            return this;
        }

        public CommentResponse build() {
            CommentResponse response = new CommentResponse();
            response.id = id;
            response.signalId = signalId;
            response.userId = userId;
            response.username = username;
            response.avatarUrl = avatarUrl;
            response.parentId = parentId;
            response.content = content;
            response.likeCount = likeCount;
            response.isDeleted = isDeleted;
            response.setReplies(replies);
            response.createdAt = createdAt;
            response.updatedAt = updatedAt;
            return response;
        }
    }
}
