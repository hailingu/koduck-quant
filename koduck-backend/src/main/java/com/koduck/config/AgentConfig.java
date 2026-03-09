package com.koduck.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "koduck.agent")
@Getter
@Setter
public class AgentConfig {
    private String url = "http://agent:8000";
}
