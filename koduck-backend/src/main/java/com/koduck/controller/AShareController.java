package com.koduck.controller;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import com.koduck.dto.ApiResponse;
import com.koduck.dto.market.SymbolInfoDto;
import com.koduck.service.MarketService;

import java.util.List;

/**
 * A-Share market data controller.
 * <p>Provides search endpoints for A-share stocks. Routes requests to MarketService.</p>
 */
@RestController
@RequestMapping("/api/v1/a-share")
@RequiredArgsConstructor
@Tag(name = "A股数据", description = "A股股票搜索接口")
@Validated
@Slf4j
public class AShareController {

    private final MarketService marketService;

    /**
     * Search A-share stocks by keyword.
     * <p>This endpoint is used by frontend search components to find stocks by name or symbol.</p>
     *
     * @param keyword search keyword (stock name or symbol), must not be blank
     * @param page    page number (starts at 1, default 1)
     * @param size    page size (default 20, max 100)
     * @return list of matching stock symbols
     */
    @GetMapping("/search")
    public ApiResponse<List<SymbolInfoDto>> searchSymbols(
            @RequestParam @NotBlank(message = "关键词不能为空")
            @Size(max = 50, message = "关键词长度不能超过 50")
            String keyword,
            @RequestParam(defaultValue = "1")
            @Min(value = 1, message = "页码最小为 1")
            Integer page,
            @RequestParam(defaultValue = "20")
            @Min(value = 1, message = "每页数量最小为 1")
            @Max(value = 100, message = "每页数量最大为 100")
            Integer size) {

        log.info("GET /api/v1/a-share/search: keyword={}, page={}, size={}", keyword, page, size);

        List<SymbolInfoDto> results = marketService.searchSymbols(keyword, page, size);
        return ApiResponse.success(results);
    }
}
