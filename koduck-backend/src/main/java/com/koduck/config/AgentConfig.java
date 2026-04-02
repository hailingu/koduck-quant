package com.koduck.config;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import lombok.Getter;
import lombok.Setter;

@Configuration
@ConfigurationProperties(prefix = "koduck.agent")
@Getter
@Setter
public class AgentConfig {
    private String url = "http://agent:8000";
}
