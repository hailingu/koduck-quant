package com.koduck.service;

/**
 * 
 *
 * <p></p>
 * <p>：</p>
 * <ul>
 *   <li></li>
 *   <li></li>
 *   <li>（）</li>
 * </ul>
 */
public interface PricePushService {

    /**
     * 
     *  3 
     */
    void checkAndPushPriceUpdates();

    /**
     * （）
     */
    void clearCache();

    /**
     * 
     *
     * @return 
     */
    int getCachedPriceCount();
}
