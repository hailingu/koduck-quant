package com.koduck.controller;

import com.koduck.dto.ApiResponse;
import lombok.Data;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

/**
 * 健康检查控制器。
 *
 * @author Koduck Team
 */
@RestController
@RequestMapping("/api/v1/health")
public class HealthController {

    private final long startTime = Instant.now().toEpochMilli();

    /**
     * 健康检查接口。
     *
     * @return 服务状态信息
     */
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
     * 简单的 Ping 接口。
     *
     * @return pong
     */
    @GetMapping("/ping")
    public ApiResponse<String> ping() {
        return ApiResponse.success("pong");
    }

    /**
     * 健康信息 DTO。
     */
    @Data
    public static class HealthInfo {
        private String status;
        private String service;
        private String version;
        private long uptime;
        private String timestamp;
    }
}
