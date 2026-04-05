package com.koduck.service;

import java.util.List;
import java.util.Map;

import com.koduck.acl.UserMemoryProfileQueryService.UserMemoryProfileDto;
import com.koduck.entity.ai.MemoryChatMessage;
import com.koduck.entity.ai.MemoryChatSession;

/**
 * 记忆操作服务接口。
 *
 * @author Koduck Team
 */
public interface MemoryService {

    /**
     * 检查记忆服务是否启用。
     *
     * @return 如果启用则返回true
     */
    boolean isEnabled();

    /**
     * 获取最大L1轮数。
     *
     * @return 最大轮数
     */
    int getL1MaxTurns();

    /**
     * 解析会话ID。
     *
     * @param input 输入
     * @return 解析后的会话ID
     */
    String resolveSessionId(String input);

    /**
     * 获取用户的会话列表。
     *
     * @param userId 用户ID
     * @return 会话列表
     */
    List<MemoryChatSession> getUserSessions(Long userId);

    /**
     * 确保会话存在。
     *
     * @param userId    用户ID
     * @param sessionId 会话ID
     * @param title     标题
     * @return 会话
     */
    MemoryChatSession ensureSession(Long userId, String sessionId, String title);

    /**
     * 向会话追加消息。
     *
     * @param userId     用户ID
     * @param sessionId  会话ID
     * @param role       角色
     * @param content    内容
     * @param tokenCount Token数量
     * @param metadata   元数据
     * @return 保存的消息
     */
    MemoryChatMessage appendMessage(
        Long userId,
        String sessionId,
        String role,
        String content,
        Integer tokenCount,
        Map<String, Object> metadata
    );

    /**
     * 获取最近的消息。
     *
     * @param userId    用户ID
     * @param sessionId 会话ID
     * @param maxTurns  最大轮数
     * @return 消息列表
     */
    List<MemoryChatMessage> getRecentMessages(Long userId, String sessionId, Integer maxTurns);

    /**
     * 获取或创建用户画像。
     *
     * @param userId 用户ID
     * @return 用户画像
     */
    UserMemoryProfileDto getOrCreateProfile(Long userId);

    /**
     * 更新用户画像。
     *
     * @param userId           用户ID
     * @param riskPreference   风险偏好
     * @param preferredSources 偏好数据源
     * @param profileFacts     画像事实
     * @return 更新后的用户画像
     */
    UserMemoryProfileDto upsertProfile(
        Long userId,
        String riskPreference,
        List<String> preferredSources,
        Map<String, Object> profileFacts
    );

    /**
     * 清除会话消息。
     *
     * @param userId    用户ID
     * @param sessionId 会话ID
     * @return 清除的消息数量
     */
    int clearSessionMessages(Long userId, String sessionId);

    /**
     * 删除会话。
     *
     * @param userId    用户ID
     * @param sessionId 会话ID
     */
    void deleteSession(Long userId, String sessionId);

    /**
     * 清除画像。
     *
     * @param userId 用户ID
     */
    void clearProfile(Long userId);
}
