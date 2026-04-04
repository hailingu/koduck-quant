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

import com.koduck.entity.ai.MemoryChatMessage;
import com.koduck.entity.ai.MemoryChatSession;
import com.koduck.entity.user.UserMemoryProfile;
import com.koduck.repository.ai.MemoryChatMessageRepository;
import com.koduck.repository.ai.MemoryChatSessionRepository;
import com.koduck.repository.user.UserMemoryProfileRepository;
import com.koduck.service.impl.ai.MemoryServiceImpl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for MemoryServiceImpl.
 *
 * @author Koduck Team
 */
@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class MemoryServiceTest {

    /** Default context limit for memory service. */
    private static final int DEFAULT_CONTEXT_LIMIT = 20;

    /** Minimum expected session ID length. */
    private static final int MIN_SESSION_ID_LENGTH = 10;

    /** Test session ID. */
    private static final String TEST_SESSION_ID = "sess_1";

    /** Test user ID. */
    private static final long TEST_USER_ID = 1L;

    /** Test session database ID. */
    private static final long TEST_SESSION_DB_ID = 10L;

    /** Test message database ID. */
    private static final long TEST_MESSAGE_DB_ID = 99L;

    /** Test year for date/time values. */
    private static final int TEST_YEAR = 2026;

    /** Test month for date/time values. */
    private static final int TEST_MONTH = 3;

    /** Test day for date/time values. */
    private static final int TEST_DAY = 21;

    /** Test hour for date/time values. */
    private static final int TEST_HOUR = 10;

    /** Test minute for first message. */
    private static final int TEST_MINUTE_FIRST = 1;

    /** Test minute for second message. */
    private static final int TEST_MINUTE_SECOND = 2;

    /** Test minute for saved message. */
    private static final int TEST_MINUTE_SAVED = 10;

    /** Mock repository for chat sessions. */
    @Mock
    private MemoryChatSessionRepository chatSessionRepository;

    /** Mock repository for chat messages. */
    @Mock
    private MemoryChatMessageRepository chatMessageRepository;

    /** Mock repository for user memory profiles. */
    @Mock
    private UserMemoryProfileRepository memoryProfileRepository;

    /** Service under test. */
    private MemoryServiceImpl memoryService;

    /**
     * Sets up the test environment before each test.
     */
    @BeforeEach
    void setUp() {
        memoryService = new MemoryServiceImpl(
            chatSessionRepository,
            chatMessageRepository,
            memoryProfileRepository,
            true,
            DEFAULT_CONTEXT_LIMIT
        );
    }

    /**
     * Tests that a session ID is generated when input is blank.
     */
    @Test
    void shouldGenerateSessionIdWhenInputBlank() {
        String sessionId = memoryService.resolveSessionId("   ");
        assertThat(sessionId).startsWith("sess_");
        assertThat(sessionId.length()).isGreaterThanOrEqualTo(MIN_SESSION_ID_LENGTH);
    }

    /**
     * Tests that recent messages are returned in ascending time order.
     */
    @Test
    void shouldReturnRecentMessagesInAscendingTimeOrder() {
        MemoryChatMessage latest = MemoryChatMessage.builder()
            .userId(TEST_USER_ID)
            .sessionId(TEST_SESSION_ID)
            .role("assistant")
            .content("second")
            .createdAt(LocalDateTime.of(TEST_YEAR, TEST_MONTH, TEST_DAY, TEST_HOUR, TEST_MINUTE_SECOND))
            .build();
        MemoryChatMessage earlier = MemoryChatMessage.builder()
            .userId(TEST_USER_ID)
            .sessionId(TEST_SESSION_ID)
            .role("user")
            .content("first")
            .createdAt(LocalDateTime.of(TEST_YEAR, TEST_MONTH, TEST_DAY, TEST_HOUR, TEST_MINUTE_FIRST))
            .build();

        when(chatMessageRepository.findByUserIdAndSessionIdOrderByCreatedAtDesc(
            eq(TEST_USER_ID),
            eq(TEST_SESSION_ID),
            any(Pageable.class)
        )).thenReturn(List.of(latest, earlier));

        List<MemoryChatMessage> result = memoryService.getRecentMessages(TEST_USER_ID, TEST_SESSION_ID, 2);

        assertThat(result).hasSize(2);
        assertThat(result.get(0).getContent()).isEqualTo("first");
        assertThat(result.get(1).getContent()).isEqualTo("second");
    }

    /**
     * Tests that appending a message updates the session.
     */
    @Test
    void shouldAppendMessageAndTouchSession() {
        MemoryChatSession existing = MemoryChatSession.builder()
            .id(TEST_SESSION_DB_ID)
            .userId(TEST_USER_ID)
            .sessionId(TEST_SESSION_ID)
            .status("active")
            .lastMessageAt(LocalDateTime.now().minusMinutes(1))
            .build();

        when(chatSessionRepository.findByUserIdAndSessionId(TEST_USER_ID, TEST_SESSION_ID))
            .thenReturn(Optional.of(existing));
        when(chatSessionRepository.save(any(MemoryChatSession.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));
        when(chatMessageRepository.save(any(MemoryChatMessage.class)))
            .thenAnswer(invocation -> {
                MemoryChatMessage arg = invocation.getArgument(0);
                return MemoryChatMessage.builder()
                    .id(TEST_MESSAGE_DB_ID)
                    .userId(arg.getUserId())
                    .sessionId(arg.getSessionId())
                    .role(arg.getRole())
                    .content(arg.getContent())
                    .tokenCount(arg.getTokenCount())
                    .metadata(arg.getMetadata())
                    .createdAt(LocalDateTime.of(TEST_YEAR, TEST_MONTH, TEST_DAY, TEST_HOUR, TEST_MINUTE_SAVED))
                    .build();
            });

        MemoryChatMessage saved = memoryService.appendMessage(
            TEST_USER_ID,
            TEST_SESSION_ID,
            "user",
            "hello",
            null,
            Map.of("source", "test")
        );

        assertThat(saved.getId()).isEqualTo(TEST_MESSAGE_DB_ID);
        assertThat(saved.getRole()).isEqualTo("user");
        assertThat(saved.getContent()).isEqualTo("hello");
        verify(chatMessageRepository).save(any(MemoryChatMessage.class));
        verify(chatSessionRepository, times(2)).save(any(MemoryChatSession.class));
    }

    /**
     * Tests clearing session messages and verifying deleted count.
     */
    @Test
    void shouldClearSessionMessagesAndReturnDeletedCount() {
        when(chatMessageRepository.findByUserIdAndSessionIdOrderByCreatedAtDesc(
            eq(TEST_USER_ID),
            eq(TEST_SESSION_ID),
            any(Pageable.class)
        )).thenReturn(List.of(
            MemoryChatMessage.builder().id(1L).build(),
            MemoryChatMessage.builder().id(2L).build()
        ));

        int deleted = memoryService.clearSessionMessages(TEST_USER_ID, TEST_SESSION_ID);

        assertThat(deleted).isEqualTo(2);
        verify(chatMessageRepository).deleteByUserIdAndSessionId(TEST_USER_ID, TEST_SESSION_ID);
    }

    /**
     * Tests upserting a user memory profile.
     */
    @Test
    void shouldUpsertProfile() {
        when(memoryProfileRepository.findById(TEST_USER_ID)).thenReturn(Optional.empty());
        when(memoryProfileRepository.save(any(UserMemoryProfile.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));

        UserMemoryProfile result = memoryService.upsertProfile(
            TEST_USER_ID,
            "balanced",
            List.of("cls"),
            Map.of("likes", "value")
        );

        assertThat(result.getUserId()).isEqualTo(TEST_USER_ID);
        assertThat(result.getRiskPreference()).isEqualTo("balanced");
        assertThat(result.getPreferredSources()).containsExactly("cls");
    }
}
