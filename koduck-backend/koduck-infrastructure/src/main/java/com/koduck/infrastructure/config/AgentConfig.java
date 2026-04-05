package com.koduck.infrastructure.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import lombok.Getter;
import lombok.Setter;

/**
 * Agent 服务的配置属性。
 *
 * @author GitHub Copilot
 */
@Configuration
@ConfigurationProperties(prefix = "koduck.agent")
@Getter
@Setter
public class AgentConfig {

    /**
     * URL of the agent service.
     */
    private String url = "http://agent:8000";
}
