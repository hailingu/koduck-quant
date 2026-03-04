package com.koduck.dto.market;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

/**
 * 股票搜索请求参数。
 *
 * @param keyword 搜索关键词（代码或名称）
 * @param page    页码（从 1 开始）
 * @param size    每页数量
 */
public record StockSearchRequest(
    @NotBlank(message = "关键词不能为空")
    String keyword,
    
    @Min(value = 1, message = "页码最小为 1")
    Integer page,
    
    @Min(value = 1, message = "每页数量最小为 1")
    @Max(value = 100, message = "每页数量最大为 100")
    Integer size
) {
    public StockSearchRequest {
        // 设置默认值
        if (page == null || page < 1) {
            page = 1;
        }
        if (size == null || size < 1) {
            size = 20;
        }
    }
}