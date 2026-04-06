package com.koduck.dto.settings;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 快捷链接 DTO。
 *
 * @author Koduck Team
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuickLinkDto {

    /** ID. */
    private Long id;

    /** 名称. */
    private String name;

    /** 图标. */
    private String icon;

    /** 路径. */
    private String path;

    /** 排序. */
    private Integer sortOrder;
}
