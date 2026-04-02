package com.koduck.dto.community;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 *  DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateCommentRequest {

    @NotBlank(message = "评论内容不能为空")
    @Size(max = 1000, message = "评论内容最多 1000 个字符")
    private String content;

    private Long parentId; //  ID，
}
