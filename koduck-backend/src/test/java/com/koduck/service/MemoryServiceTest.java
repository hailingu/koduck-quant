package com.koduck.service;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

import com.koduck.entity.MemoryChatMessage;
import com.koduck.entity.MemoryChatSession;
import com.koduck.entity.UserMemoryProfile;
import com.koduck.repository.MemoryChatMessageRepository;
import com.koduck.repository.MemoryChatSessionRepository;
import com.koduck.repository.UserMemoryProfileRepository;
import com.koduck.shared.application.MemoryServiceImpl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class MemoryServiceTest {

    @Mock
    private MemoryChatSessionRepository chatSessionRepository;

    @Mock
    private MemoryChatMessageRepository chatMessageRepository;

    @Mock
    private UserMemoryProfileRepository memoryProfileRepository;

    private MemoryServiceImpl memoryService;

    @BeforeEach
    void setUp() {
        memoryService = new MemoryServiceImpl(
            chatSessionRepository,
            chatMessageRepository,
            memoryProfileRepository,
            true,
            20
        );
    }

    @Test
    void shouldGenerateSessionIdWhenInputBlank() {
        String sessionId = memoryService.resolveSessionId("   ");
        assertThat(sessionId).startsWith("sess_");
        assertThat(sessionId.length()).isGreaterThanOrEqualTo(10);
    }

    @Test
    void shouldReturnRecentMessagesInAscendingTimeOrder() {
        MemoryChatMessage latest = MemoryChatMessage.builder()
            .userId(1L)
            .sessionId("sess_1")
            .role("assistant")
            .content("second")
            .createdAt(LocalDateTime.of(2026, 3, 21, 10, 2))
            .build();
        MemoryChatMessage earlier = MemoryChatMessage.builder()
            .userId(1L)
            .sessionId("sess_1")
            .role("user")
            .content("first")
            .createdAt(LocalDateTime.of(2026, 3, 21, 10, 1))
            .build();

        when(chatMessageRepository.findByUserIdAndSessionIdOrderByCreatedAtDesc(
            eq(1L),
            eq("sess_1"),
            any(Pageable.class)
        )).thenReturn(List.of(latest, earlier));

        List<MemoryChatMessage> result = memoryService.getRecentMessages(1L, "sess_1", 2);

        assertThat(result).hasSize(2);
        assertThat(result.get(0).getContent()).isEqualTo("first");
        assertThat(result.get(1).getContent()).isEqualTo("second");
    }

    @Test
    void shouldAppendMessageAndTouchSession() {
        MemoryChatSession existing = MemoryChatSession.builder()
            .id(10L)
            .userId(1L)
            .sessionId("sess_1")
            .status("active")
            .lastMessageAt(LocalDateTime.now().minusMinutes(1))
            .build();

        when(chatSessionRepository.findByUserIdAndSessionId(1L, "sess_1"))
            .thenReturn(Optional.of(existing));
        when(chatSessionRepository.save(any(MemoryChatSession.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));
        when(chatMessageRepository.save(any(MemoryChatMessage.class)))
            .thenAnswer(invocation -> {
                MemoryChatMessage arg = invocation.getArgument(0);
                return MemoryChatMessage.builder()
                    .id(99L)
                    .userId(arg.getUserId())
                    .sessionId(arg.getSessionId())
                    .role(arg.getRole())
                    .content(arg.getContent())
                    .tokenCount(arg.getTokenCount())
                    .metadata(arg.getMetadata())
                    .createdAt(LocalDateTime.of(2026, 3, 21, 10, 10))
                    .build();
            });

        MemoryChatMessage saved = memoryService.appendMessage(
            1L,
            "sess_1",
            "user",
            "hello",
            null,
            Map.of("source", "test")
        );

        assertThat(saved.getId()).isEqualTo(99L);
        assertThat(saved.getRole()).isEqualTo("user");
        assertThat(saved.getContent()).isEqualTo("hello");
        verify(chatMessageRepository).save(any(MemoryChatMessage.class));
        verify(chatSessionRepository, times(2)).save(any(MemoryChatSession.class));
    }

    @Test
    void shouldClearSessionMessagesAndReturnDeletedCount() {
        when(chatMessageRepository.findByUserIdAndSessionIdOrderByCreatedAtDesc(
            eq(1L),
            eq("sess_1"),
            any(Pageable.class)
        )).thenReturn(List.of(
            MemoryChatMessage.builder().id(1L).build(),
            MemoryChatMessage.builder().id(2L).build()
        ));

        int deleted = memoryService.clearSessionMessages(1L, "sess_1");

        assertThat(deleted).isEqualTo(2);
        verify(chatMessageRepository).deleteByUserIdAndSessionId(1L, "sess_1");
    }

    @Test
    void shouldUpsertProfile() {
        when(memoryProfileRepository.findById(1L)).thenReturn(Optional.empty());
        when(memoryProfileRepository.save(any(UserMemoryProfile.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));

        UserMemoryProfile result = memoryService.upsertProfile(
            1L,
            "balanced",
            List.of("600519"),
            List.of("cls"),
            Map.of("likes", "value")
        );

        assertThat(result.getUserId()).isEqualTo(1L);
        assertThat(result.getRiskPreference()).isEqualTo("balanced");
        assertThat(result.getWatchSymbols()).containsExactly("600519");
        assertThat(result.getPreferredSources()).containsExactly("cls");
    }
}
