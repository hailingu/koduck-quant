package com.koduck.service;

/**
 * 限流服务接口。
 *
 * <p>基于 Redis 的限流器，用于控制密码重置请求频率。</p>
 *
 * @author Koduck Team
 */
public interface RateLimiterService {

    /**
     * 检查是否允许登录尝试。
     *
     * @param loginIdentifier 登录标识（用户名或邮箱）
     * @param ip              IP 地址
     * @return true 允许尝试，false 已被临时锁定
     */
    boolean allowLoginAttempt(String loginIdentifier, String ip);

    /**
     * 记录登录失败。
     *
     * @param loginIdentifier 登录标识（用户名或邮箱）
     * @param ip              IP 地址
     */
    void recordLoginFailure(String loginIdentifier, String ip);

    /**
     * 记录登录成功并清理失败计数。
     *
     * @param loginIdentifier 登录标识（用户名或邮箱）
     * @param ip              IP 地址
     */
    void recordLoginSuccess(String loginIdentifier, String ip);

    /**
     * 检查是否允许密码重置请求。
     *
     * @param userId 用户ID（可为空）
     * @param email  邮箱
     * @param ip     IP 地址
     * @return true 允许请求，false 拒绝请求
     */
    boolean allowPasswordResetRequest(String userId, String email, String ip);

    /**
     * 获取当前计数（用于调试）。
     *
     * @param key Redis key
     * @return 当前计数
     */
    long getCurrentCount(String key);

    /**
     * 重置限流计数（用于测试或手动解锁）。
     *
     * @param userId 用户ID
     * @param email  邮箱
     * @param ip     IP 地址
     */
    void resetRateLimit(String userId, String email, String ip);
}
