package com.koduck.dto.websocket;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * WebSocket 订阅请求消息
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SubscriptionMessage {

    /**
     * 消息类型 SUBSCRIBE / UNSUBSCRIBE
     */
    private String type;

    /**
     * 股票代码列表
     */
    private List<String> symbols;

    /**
     * 订阅结果
     */
    private List<String> success;

    /**
     * 失败的订阅
     */
    private Map<String, String> failed;

    /**
     * 用户当前订阅列表
     */
    private List<String> subscriptions;

    /**
     * 时间戳
     */
    private Long timestamp;
}
