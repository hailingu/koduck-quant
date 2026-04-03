package com.koduck.dto.market;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

/**
 * Stock search request DTO.
 *
 * @param keyword the search keyword
 * @param page    the page number (default 1)
 * @param size    the page size
 * @author Koduck Team
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
    /** Default page size. */
    private static final int DEFAULT_PAGE_SIZE = 20;

    public StockSearchRequest {
        // Set default values if null or invalid
        if (page == null || page < 1) {
            page = 1;
        }
        if (size == null || size < 1) {
            size = DEFAULT_PAGE_SIZE;
        }
    }
}
