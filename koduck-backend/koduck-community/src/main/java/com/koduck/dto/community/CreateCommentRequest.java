package com.koduck.dto.community;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Create comment request DTO.
 *
 * @author Koduck Team
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateCommentRequest {

    /** Comment content. */
    @NotBlank(message = "评论内容不能为空")
    @Size(max = 1000, message = "评论内容最多 1000 个字符")
    private String content;

    /** Parent comment ID, null for top-level comment. */
    private Long parentId;
}
