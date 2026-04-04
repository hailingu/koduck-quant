package com.koduck.controller;

import java.time.Instant;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.koduck.dto.ApiResponse;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Data;

/**
 * 健康检查控制器，用于服务状态监控。
 *
 * @author Koduck Team
 */
@RestController
@RequestMapping("/api/v1/health")
@Tag(name = "健康检查", description = "服务健康状态检查接口")
public class HealthController {

    /** 服务启动时间戳。 */
    private final long startTime = Instant.now().toEpochMilli();

    /**
     * 获取服务健康状态。
     *
     * @return 包含状态、版本、运行时长的健康信息
     */
    @Operation(
        summary = "健康检查",
        description = "获取服务健康状态、版本信息和运行时长"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "服务正常",
            content = @Content(schema = @Schema(implementation = HealthInfo.class))
            )
    })
    @GetMapping
    public ApiResponse<HealthInfo> health() {
        HealthInfo info = new HealthInfo();
        info.setStatus("UP");
        info.setService("koduck-backend");
        info.setVersion("0.1.0");
        info.setUptime(System.currentTimeMillis() - startTime);
        info.setTimestamp(Instant.now().toString());
        return ApiResponse.success(info);
    }

    /**
     * 简单的连通性检查端点。
     *
     * @return pong 响应
     */
    @Operation(
        summary = "Ping测试",
        description = "简单的连通性测试接口"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "正常响应",
            content = @Content(schema = @Schema(implementation = String.class))
            )
    })
    @GetMapping("/ping")
    public ApiResponse<String> ping() {
        return ApiResponse.success("pong");
    }

    /**
     * 健康信息 DTO。
     */
    @Data
    @Schema(description = "健康状态信息")
    public static class HealthInfo {
        /** 服务状态。 */
        @Schema(description = "服务状态", example = "UP", allowableValues = {"UP", "DOWN"})
        private String status;

        /** 服务名称。 */
        @Schema(description = "服务名称", example = "koduck-backend")
        private String service;

        /** 版本号。 */
        @Schema(description = "版本号", example = "0.1.0")
        private String version;

        /** 运行时长（毫秒）。 */
        @Schema(description = "运行时长(毫秒)", example = "3600000")
        private long uptime;

        /** 当前时间戳。 */
        @Schema(description = "当前时间戳", example = "2024-01-15T09:30:00Z")
        private String timestamp;
    }
}
