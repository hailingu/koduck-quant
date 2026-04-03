package com.koduck.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.koduck.entity.MemoryChatSession;

/**
 * Repository for MemoryChatSession entity.
 *
 * @author Koduck Team
 */
@Repository
public interface MemoryChatSessionRepository
        extends JpaRepository<MemoryChatSession, Long> {

    /**
     * Find session by user ID and session ID.
     *
     * @param userId    the user ID
     * @param sessionId the session ID
     * @return optional of memory chat session
     */
    Optional<MemoryChatSession> findByUserIdAndSessionId(
            Long userId, String sessionId);

    /**
     * Find sessions by user ID, ordered by last message time.
     *
     * @param userId the user ID
     * @return list of memory chat sessions
     */
    List<MemoryChatSession> findByUserIdOrderByLastMessageAtDesc(Long userId);

    /**
     * Delete session by user ID and session ID.
     *
     * @param userId    the user ID
     * @param sessionId the session ID
     */
    void deleteByUserIdAndSessionId(Long userId, String sessionId);
}
