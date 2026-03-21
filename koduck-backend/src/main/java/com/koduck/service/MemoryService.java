package com.koduck.service;

import com.koduck.entity.MemoryChatMessage;
import com.koduck.entity.MemoryChatSession;
import com.koduck.entity.UserMemoryProfile;
import com.koduck.repository.MemoryChatMessageRepository;
import com.koduck.repository.MemoryChatSessionRepository;
import com.koduck.repository.UserMemoryProfileRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class MemoryService {

    private final MemoryChatSessionRepository chatSessionRepository;
    private final MemoryChatMessageRepository chatMessageRepository;
    private final UserMemoryProfileRepository memoryProfileRepository;

    @Value("${memory.enabled:true}")
    private boolean memoryEnabled;

    @Value("${memory.l1.max-turns:20}")
    private int l1MaxTurns;

    public boolean isEnabled() {
        return memoryEnabled;
    }

    public int getL1MaxTurns() {
        return Math.max(1, l1MaxTurns);
    }

    public String resolveSessionId(String input) {
        if (input == null || input.isBlank()) {
            return "sess_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        }
        return input.trim();
    }

    @Transactional
    public MemoryChatSession ensureSession(Long userId, String sessionId, String title) {
        String normalizedSessionId = resolveSessionId(sessionId);
        Optional<MemoryChatSession> existing = chatSessionRepository.findByUserIdAndSessionId(userId, normalizedSessionId);
        if (existing.isPresent()) {
            MemoryChatSession session = existing.get();
            session.setLastMessageAt(LocalDateTime.now());
            if (title != null && !title.isBlank()) {
                session.setTitle(title.trim());
            }
            return chatSessionRepository.save(session);
        }
        MemoryChatSession created = MemoryChatSession.builder()
            .userId(userId)
            .sessionId(normalizedSessionId)
            .title(title)
            .status("active")
            .lastMessageAt(LocalDateTime.now())
            .build();
        return chatSessionRepository.save(created);
    }

    @Transactional
    public MemoryChatMessage appendMessage(
        Long userId,
        String sessionId,
        String role,
        String content,
        Integer tokenCount,
        Map<String, Object> metadata
    ) {
        if (!memoryEnabled) {
            throw new IllegalStateException("Memory is disabled");
        }
        MemoryChatSession session = ensureSession(userId, sessionId, null);
        MemoryChatMessage message = MemoryChatMessage.builder()
            .userId(userId)
            .sessionId(session.getSessionId())
            .role(role)
            .content(content)
            .tokenCount(tokenCount)
            .metadata(metadata != null ? metadata : Map.of())
            .build();
        MemoryChatMessage saved = chatMessageRepository.save(message);
        session.setLastMessageAt(saved.getCreatedAt() != null ? saved.getCreatedAt() : LocalDateTime.now());
        chatSessionRepository.save(session);
        return saved;
    }

    @Transactional(readOnly = true)
    public List<MemoryChatMessage> getRecentMessages(Long userId, String sessionId, Integer maxTurns) {
        int turns = maxTurns != null ? maxTurns : l1MaxTurns;
        int limit = Math.max(1, turns) * 2;
        List<MemoryChatMessage> descMessages = chatMessageRepository.findByUserIdAndSessionIdOrderByCreatedAtDesc(
            userId,
            sessionId,
            PageRequest.of(0, limit)
        );
        List<MemoryChatMessage> ascMessages = new ArrayList<>(descMessages);
        ascMessages.sort(Comparator.comparing(
            MemoryChatMessage::getCreatedAt,
            Comparator.nullsLast(Comparator.naturalOrder())
        ));
        return ascMessages;
    }

    @Transactional(readOnly = true)
    public UserMemoryProfile getOrCreateProfile(Long userId) {
        return memoryProfileRepository.findById(userId).orElseGet(() -> UserMemoryProfile.builder()
            .userId(userId)
            .watchSymbols(List.of())
            .preferredSources(List.of())
            .profileFacts(Map.of())
            .build());
    }

    @Transactional
    public UserMemoryProfile upsertProfile(
        Long userId,
        String riskPreference,
        List<String> watchSymbols,
        List<String> preferredSources,
        Map<String, Object> profileFacts
    ) {
        UserMemoryProfile profile = memoryProfileRepository.findById(userId).orElseGet(() -> UserMemoryProfile.builder()
            .userId(userId)
            .build());
        if (riskPreference != null) {
            profile.setRiskPreference(riskPreference);
        }
        if (watchSymbols != null) {
            profile.setWatchSymbols(watchSymbols);
        }
        if (preferredSources != null) {
            profile.setPreferredSources(preferredSources);
        }
        if (profileFacts != null) {
            profile.setProfileFacts(profileFacts);
        }
        UserMemoryProfile saved = memoryProfileRepository.save(profile);
        log.debug("Upserted user memory profile: user={}", userId);
        return saved;
    }

    @Transactional
    public int clearSessionMessages(Long userId, String sessionId) {
        List<MemoryChatMessage> existing = chatMessageRepository.findByUserIdAndSessionIdOrderByCreatedAtDesc(
            userId,
            sessionId,
            PageRequest.of(0, 10_000)
        );
        chatMessageRepository.deleteByUserIdAndSessionId(userId, sessionId);
        return existing.size();
    }

    @Transactional
    public void clearProfile(Long userId) {
        memoryProfileRepository.deleteById(userId);
    }
}
