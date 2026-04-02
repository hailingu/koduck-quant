package com.koduck.dto.settings;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 更新主题请求 DTO。
 *
 * @author Koduck Team
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateThemeRequest {

    /** 主题（light, dark, auto）. */
    @NotBlank(message = "主题不能为空")
    @Pattern(regexp = "light|dark|auto", message = "主题必须是 light、dark 或 auto")
    private String theme;
}
