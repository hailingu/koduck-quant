package com.koduck.service;

import java.util.List;
import java.util.Map;

import com.koduck.entity.MemoryChatMessage;
import com.koduck.entity.MemoryChatSession;
import com.koduck.entity.UserMemoryProfile;

/**
 * Service interface for memory operations.
 *
 * @author Koduck Team
 */
public interface MemoryService {

    /**
     * Check if memory service is enabled.
     *
     * @return true if enabled
     */
    boolean isEnabled();

    /**
     * Get max L1 turns.
     *
     * @return max turns
     */
    int getL1MaxTurns();

    /**
     * Resolve session ID.
     *
     * @param input the input
     * @return the resolved session ID
     */
    String resolveSessionId(String input);

    /**
     * Get user sessions.
     *
     * @param userId the user ID
     * @return list of sessions
     */
    List<MemoryChatSession> getUserSessions(Long userId);

    /**
     * Ensure session exists.
     *
     * @param userId  the user ID
     * @param sessionId the session ID
     * @param title   the title
     * @return the session
     */
    MemoryChatSession ensureSession(Long userId, String sessionId, String title);

    /**
     * Append message to session.
     *
     * @param userId    the user ID
     * @param sessionId the session ID
     * @param role      the role
     * @param content   the content
     * @param tokenCount the token count
     * @param metadata  the metadata
     * @return the saved message
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
     * Get recent messages.
     *
     * @param userId    the user ID
     * @param sessionId the session ID
     * @param maxTurns  the max turns
     * @return list of messages
     */
    List<MemoryChatMessage> getRecentMessages(Long userId, String sessionId, Integer maxTurns);

    /**
     * Get or create user profile.
     *
     * @param userId the user ID
     * @return the profile
     */
    UserMemoryProfile getOrCreateProfile(Long userId);

    /**
     * Upsert user profile.
     *
     * @param userId          the user ID
     * @param riskPreference  the risk preference
     * @param preferredSources the preferred sources
     * @param profileFacts    the profile facts
     * @return the updated profile
     */
    UserMemoryProfile upsertProfile(
        Long userId,
        String riskPreference,
        List<String> preferredSources,
        Map<String, Object> profileFacts
    );

    /**
     * Clear session messages.
     *
     * @param userId    the user ID
     * @param sessionId the session ID
     * @return number of cleared messages
     */
    int clearSessionMessages(Long userId, String sessionId);

    /**
     * Delete session.
     *
     * @param userId    the user ID
     * @param sessionId the session ID
     */
    void deleteSession(Long userId, String sessionId);

    /**
     * Clear profile.
     *
     * @param userId the user ID
     */
    void clearProfile(Long userId);
}
