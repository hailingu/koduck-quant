package com.koduck.config.properties;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * WebSocket 配置属性
 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "koduck.websocket")
public class WebSocketProperties {

    /**
     * WebSocket 端点路径
     */
    private String endpoint = "/ws";

    /**
     * 应用目标前缀
     */
    private String applicationDestinationPrefix = "/app";

    /**
     * 允许的来源模式（用于 CORS）
     */
    private String[] allowedOrigins = {"*"};

    /**
     * 心跳间隔（秒）
     */
    private int heartbeatInterval = 25;

    /**
     * 消息代理配置
     */
    private Broker broker = new Broker();

    @Getter
    @Setter
    public static class Broker {
        /**
         * 主题前缀（广播）
         */
        private String topicPrefix = "/topic";

        /**
         * 队列前缀（私有）
         */
        private String queuePrefix = "/queue";
    }
}
