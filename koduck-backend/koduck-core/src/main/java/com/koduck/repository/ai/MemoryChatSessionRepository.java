package com.koduck.repository.ai;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.koduck.entity.ai.MemoryChatSession;

/**
 * AI 聊天会话仓库，提供会话数据的数据库访问。
 *
 * @author Koduck Team
 */
@Repository
public interface MemoryChatSessionRepository
        extends JpaRepository<MemoryChatSession, Long> {

    /**
     * 根据用户 ID 和会话 ID 查询会话。
     *
     * @param userId 用户 ID
     * @param sessionId 会话 ID
     * @return 聊天会话
     */
    Optional<MemoryChatSession> findByUserIdAndSessionId(
            Long userId, String sessionId);

    /**
     * 根据用户 ID 查询会话列表，按最后消息时间降序排列。
     *
     * @param userId 用户 ID
     * @return 聊天会话列表
     */
    List<MemoryChatSession> findByUserIdOrderByLastMessageAtDesc(Long userId);

    /**
     * 根据用户 ID 和会话 ID 删除会话。
     *
     * @param userId 用户 ID
     * @param sessionId 会话 ID
     */
    void deleteByUserIdAndSessionId(Long userId, String sessionId);
}
