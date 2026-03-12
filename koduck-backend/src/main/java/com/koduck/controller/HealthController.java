package com.koduck.controller;

import com.koduck.dto.ApiResponse;
import lombok.Data;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

/**
 * 
 *
 * @author Koduck Team
 */
@RestController
@RequestMapping("/api/v1/health")
public class HealthController {

    private final long startTime = Instant.now().toEpochMilli();

    /**
     * 
     *
     * @return 
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
     *  Ping 
     *
     * @return pong
     */
    @GetMapping("/ping")
    public ApiResponse<String> ping() {
        return ApiResponse.success("pong");
    }

    /**
     *  DTO
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
