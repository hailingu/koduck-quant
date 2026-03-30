package com.koduck.dto.community;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.koduck.util.CollectionCopyUtils;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Singular;

import java.time.LocalDateTime;
import java.util.List;

/**
 *  DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
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

    @Singular
    private List<CommentResponse> replies; // 

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createdAt;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime updatedAt;

    public List<CommentResponse> getReplies() {
        return CollectionCopyUtils.copyList(replies);
    }

    public void setReplies(List<CommentResponse> replies) {
        this.replies = CollectionCopyUtils.copyList(replies);
    }
}
