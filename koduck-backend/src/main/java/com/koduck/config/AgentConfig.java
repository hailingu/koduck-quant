package com.koduck.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import lombok.Getter;
import lombok.Setter;

/**
 * Configuration properties for agent service.
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
