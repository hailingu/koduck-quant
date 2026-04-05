package com.koduck.service.impl.ai;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.koduck.acl.UserMemoryProfileQueryService;
import com.koduck.acl.UserMemoryProfileQueryService.UserMemoryProfileDto;
import com.koduck.entity.ai.MemoryChatMessage;
import com.koduck.entity.ai.MemoryChatSession;
import com.koduck.exception.StateException;
import com.koduck.repository.ai.MemoryChatMessageRepository;
import com.koduck.repository.ai.MemoryChatSessionRepository;
import com.koduck.service.MemoryService;

import lombok.extern.slf4j.Slf4j;

/**
 * Implementation of memory session and profile service.
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
@Service
@Slf4j
public class MemoryServiceImpl implements MemoryService {

    private static final String USER_ID_NULL_MESSAGE = "userId must not be null";
    private static final String SESSION_ID_NULL_MESSAGE = "sessionId must not be null";

    private final MemoryChatSessionRepository chatSessionRepository;
    private final MemoryChatMessageRepository chatMessageRepository;
    private final UserMemoryProfileQueryService userMemoryProfileQueryService;
    private final boolean memoryEnabled;
    private final int l1MaxTurns;

    public MemoryServiceImpl(MemoryChatSessionRepository chatSessionRepository,
                             MemoryChatMessageRepository chatMessageRepository,
                             UserMemoryProfileQueryService userMemoryProfileQueryService,
                             @Value("${memory.enabled:true}") boolean memoryEnabled,
                             @Value("${memory.l1.max-turns:20}") int l1MaxTurns) {
        this.chatSessionRepository = Objects.requireNonNull(chatSessionRepository,
            "chatSessionRepository must not be null");
        this.chatMessageRepository = Objects.requireNonNull(chatMessageRepository,
            "chatMessageRepository must not be null");
        this.userMemoryProfileQueryService = Objects.requireNonNull(userMemoryProfileQueryService,
            "userMemoryProfileQueryService must not be null");
        this.memoryEnabled = memoryEnabled;
        this.l1MaxTurns = l1MaxTurns;
    }

    @Override
    public boolean isEnabled() {
        return memoryEnabled;
    }
    @Override
    public int getL1MaxTurns() {
        return Math.max(1, l1MaxTurns);
    }
    @Override
    public String resolveSessionId(String input) {
        if (input == null || input.isBlank()) {
            return "sess_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        }
        return input.trim();
    }
    @Override
    @Transactional(readOnly = true)
    public List<MemoryChatSession> getUserSessions(Long userId) {
        Long nonNullUserId = Objects.requireNonNull(userId, USER_ID_NULL_MESSAGE);
        return chatSessionRepository.findByUserIdOrderByLastMessageAtDesc(nonNullUserId);
    }
    @Override
    @Transactional
    public MemoryChatSession ensureSession(Long userId, String sessionId, String title) {
        Long nonNullUserId = Objects.requireNonNull(userId, USER_ID_NULL_MESSAGE);
        String normalizedSessionId = resolveSessionId(sessionId);
        return ensureSessionInternal(nonNullUserId, normalizedSessionId, title);
    }

    private MemoryChatSession ensureSessionInternal(Long userId, String sessionId, String title) {
        Optional<MemoryChatSession> existing =
                chatSessionRepository.findByUserIdAndSessionId(userId, sessionId);
        if (existing.isPresent()) {
            MemoryChatSession session = existing.get();
            session.setLastMessageAt(LocalDateTime.now());
            if (title != null && !title.isBlank()) {
                session.setTitle(title.trim());
            }
            return chatSessionRepository.save(Objects.requireNonNull(session, "session must not be null"));
        }
        MemoryChatSession created = MemoryChatSession.builder()
            .userId(userId)
            .sessionId(sessionId)
            .title(title)
            .status("active")
            .lastMessageAt(LocalDateTime.now())
            .build();
        return chatSessionRepository.save(Objects.requireNonNull(created, "created must not be null"));
    }
    @Override
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
            throw new StateException("Memory is disabled");
        }
        Long nonNullUserId = Objects.requireNonNull(userId, USER_ID_NULL_MESSAGE);
        String nonNullRole = Objects.requireNonNull(role, "role must not be null");
        String nonNullContent = Objects.requireNonNull(content, "content must not be null");
        String normalizedSessionId = resolveSessionId(sessionId);
        MemoryChatSession session = ensureSessionInternal(nonNullUserId, normalizedSessionId, null);
        MemoryChatMessage message = MemoryChatMessage.builder()
            .userId(nonNullUserId)
            .sessionId(session.getSessionId())
            .role(nonNullRole)
            .content(nonNullContent)
            .tokenCount(tokenCount)
            .metadata(metadata != null ? metadata : Map.of())
            .build();
        MemoryChatMessage saved = chatMessageRepository.save(
                Objects.requireNonNull(message, "message must not be null"));
        session.setLastMessageAt(saved.getCreatedAt() != null ? saved.getCreatedAt() : LocalDateTime.now());
        chatSessionRepository.save(Objects.requireNonNull(session, "session must not be null"));
        return saved;
    }
    @Override
    @Transactional(readOnly = true)
    public List<MemoryChatMessage> getRecentMessages(Long userId, String sessionId, Integer maxTurns) {
        Long nonNullUserId = Objects.requireNonNull(userId, USER_ID_NULL_MESSAGE);
        String nonNullSessionId = Objects.requireNonNull(sessionId, SESSION_ID_NULL_MESSAGE);
        int turns = maxTurns != null ? maxTurns : l1MaxTurns;
        int limit = Math.max(1, turns) * 2;
        List<MemoryChatMessage> descMessages = chatMessageRepository.findByUserIdAndSessionIdOrderByCreatedAtDesc(
            nonNullUserId,
            nonNullSessionId,
            PageRequest.of(0, limit)
        );
        List<MemoryChatMessage> ascMessages = new ArrayList<>(descMessages);
        ascMessages.sort(Comparator.comparing(
            MemoryChatMessage::getCreatedAt,
            Comparator.nullsLast(Comparator.naturalOrder())
        ));
        return ascMessages;
    }
    @Override
    @Transactional(readOnly = true)
    public UserMemoryProfileDto getOrCreateProfile(Long userId) {
        Long nonNullUserId = Objects.requireNonNull(userId, USER_ID_NULL_MESSAGE);
        return userMemoryProfileQueryService.findByUserId(nonNullUserId).orElseGet(() -> new UserMemoryProfileDto(
            nonNullUserId,
            null,
            null,
            Map.of()
        ));
    }
    @Override
    @Transactional
    public UserMemoryProfileDto upsertProfile(
        Long userId,
        String riskPreference,
        List<String> preferredSources,
        Map<String, Object> profileFacts
    ) {
        Long nonNullUserId = Objects.requireNonNull(userId, USER_ID_NULL_MESSAGE);
        // Build new profile with updated values (UserMemoryProfileDto is immutable record)
        UserMemoryProfileDto existingProfile = userMemoryProfileQueryService.findByUserId(nonNullUserId).orElse(null);
        String finalRiskTolerance = riskPreference != null ? riskPreference : existingProfile != null ? existingProfile.getRiskTolerance() : null;
        String finalPreferredStyle = preferredSources != null && !preferredSources.isEmpty() ? preferredSources.get(0) : existingProfile != null ? existingProfile.getPreferredStyle() : null;
        Map<String, Object> finalPreferences = profileFacts != null ? profileFacts : existingProfile != null ? existingProfile.getPreferences() : Map.of();
        
        UserMemoryProfileDto profile = new UserMemoryProfileDto(
            nonNullUserId,
            finalPreferredStyle,
            finalRiskTolerance,
            finalPreferences
        );
        userMemoryProfileQueryService.updateProfile(nonNullUserId, profile);
        log.debug("Upserted user memory profile: user={}", nonNullUserId);
        return profile;
    }
    @Override
    @Transactional
    public int clearSessionMessages(Long userId, String sessionId) {
        Long nonNullUserId = Objects.requireNonNull(userId, USER_ID_NULL_MESSAGE);
        String nonNullSessionId = Objects.requireNonNull(sessionId, SESSION_ID_NULL_MESSAGE);
        List<MemoryChatMessage> existing = chatMessageRepository.findByUserIdAndSessionIdOrderByCreatedAtDesc(
            nonNullUserId,
            nonNullSessionId,
            PageRequest.of(0, 10_000)
        );
        chatMessageRepository.deleteByUserIdAndSessionId(nonNullUserId, nonNullSessionId);
        return existing.size();
    }
    @Override
    @Transactional
    public void deleteSession(Long userId, String sessionId) {
        Long nonNullUserId = Objects.requireNonNull(userId, USER_ID_NULL_MESSAGE);
        String nonNullSessionId = Objects.requireNonNull(sessionId, SESSION_ID_NULL_MESSAGE);
        // Delete messages first, then delete session
        chatMessageRepository.deleteByUserIdAndSessionId(nonNullUserId, nonNullSessionId);
        chatSessionRepository.deleteByUserIdAndSessionId(nonNullUserId, nonNullSessionId);
        log.debug("Deleted session: user={}, sessionId={}", nonNullUserId, nonNullSessionId);
    }
    @Override
    @Transactional
    public void clearProfile(Long userId) {
        Long nonNullUserId = Objects.requireNonNull(userId, USER_ID_NULL_MESSAGE);
        log.warn("Delete profile operation is not supported via ACL interface for userId={}", nonNullUserId);
        throw new UnsupportedOperationException("Delete profile operation is not supported via ACL interface");
    }
}
