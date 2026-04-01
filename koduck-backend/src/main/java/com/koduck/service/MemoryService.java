package com.koduck.service;

import com.koduck.entity.MemoryChatMessage;
import com.koduck.entity.MemoryChatSession;
import com.koduck.entity.UserMemoryProfile;

import java.util.List;
import java.util.Map;

public interface MemoryService {

    boolean isEnabled();

    int getL1MaxTurns();

    String resolveSessionId(String input);

    List<MemoryChatSession> getUserSessions(Long userId);

    MemoryChatSession ensureSession(Long userId, String sessionId, String title);

    MemoryChatMessage appendMessage(
        Long userId,
        String sessionId,
        String role,
        String content,
        Integer tokenCount,
        Map<String, Object> metadata
    );

    List<MemoryChatMessage> getRecentMessages(Long userId, String sessionId, Integer maxTurns);

    UserMemoryProfile getOrCreateProfile(Long userId);

    UserMemoryProfile upsertProfile(
        Long userId,
        String riskPreference,
        List<String> watchSymbols,
        List<String> preferredSources,
        Map<String, Object> profileFacts
    );

    int clearSessionMessages(Long userId, String sessionId);

    void deleteSession(Long userId, String sessionId);

    void clearProfile(Long userId);
}
