package com.koduck.service;

import com.koduck.market.dto.RealtimePriceEventMessage;

/**
 * 实时市场价格推送和缓存服务。
 *
 * <p>该服务支持接收实时事件、检查和推送价格更新，以及内存缓存管理。</p>
 *
 * @author koduck
 */
public interface PricePushService {

    /**
     * 检查待处理的价格更新并将其推送给订阅者。
     *
     * <p>此方法可以定期或按需触发。在调用下游通知路径之前，
     * 应验证有新的价格变化。</p>
     */
    void checkAndPushPriceUpdates();

    /**
     * 处理来自上游数据服务的实时价格事件（通过MQ）。
     *
     * @param event 实时价格事件负载，不能为null
     */
    void onRealtimePriceEvent(RealtimePriceEventMessage event);

    /**
     * 清除内存中所有缓存的实时价格记录。
     */
    void clearCache();

    /**
     * 获取缓存的实时价格记录数量。
     *
     * @return 缓存的价格条目数，非负数
     */
    int getCachedPriceCount();
}
