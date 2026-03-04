package com.koduck.dto.user;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Data;

/**
 * 用户分页查询请求 DTO
 */
@Data
public class UserPageRequest {

    @Min(value = 1, message = "页码必须大于等于1")
    private Integer page = 1;

    @Min(value = 1, message = "每页大小必须大于等于1")
    @Max(value = 100, message = "每页大小不能超过100")
    private Integer size = 20;

    private String keyword;

    private String status;
}
