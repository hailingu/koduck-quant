package com.koduck.dto.settings;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 显示配置 DTO。
 *
 * @author Koduck Team
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DisplayConfigDto {

    /** 图表类型. */
    private String chartType;

    /** 时间周期. */
    private String timeFrame;

    /** 是否显示网格. */
    private Boolean showGrid;
}
