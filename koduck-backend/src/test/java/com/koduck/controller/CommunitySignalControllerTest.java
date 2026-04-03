package com.koduck.controller;

import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.util.ReflectionTestUtils;

import com.koduck.controller.support.AuthenticatedUserResolver;
import com.koduck.dto.ApiResponse;
import com.koduck.dto.community.CommentResponse;
import com.koduck.dto.community.CreateSignalRequest;
import com.koduck.dto.community.SignalListResponse;
import com.koduck.dto.community.SignalResponse;
import com.koduck.entity.User;
import com.koduck.security.UserPrincipal;
import com.koduck.service.CommunitySignalService;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link CommunitySignalController}.
 *
 * @author Koduck Team
 */
@ExtendWith(MockitoExtension.class)
class CommunitySignalControllerTest {

    /** User principal required message. */
    private static final String USER_PRINCIPAL_REQUIRED_MESSAGE = "userPrincipal must not be null";
    /** Controller required message. */
    private static final String CONTROLLER_REQUIRED_MESSAGE = "controller must not be null";
    /** Default page size. */
    private static final int DEFAULT_PAGE_SIZE = 20;
    /** Test user ID 1. */
    private static final Long TEST_USER_ID_1 = 1001L;
    /** Test user ID 2. */
    private static final Long TEST_USER_ID_2 = 2002L;
    /** Test user ID 3. */
    private static final Long TEST_USER_ID_3 = 3003L;
    /** Test signal ID 1. */
    private static final Long TEST_SIGNAL_ID_1 = 11L;
    /** Test signal ID 2. */
    private static final Long TEST_SIGNAL_ID_2 = 15L;
    /** Test comment ID. */
    private static final Long TEST_COMMENT_ID = 21L;
    /** Test signal ID for comments. */
    private static final Long TEST_SIGNAL_ID_FOR_COMMENTS = 9L;
    /** Test close price. */
    private static final BigDecimal TEST_CLOSE_PRICE = new BigDecimal("5.20");

    /** The signal service. */
    @Mock
    private CommunitySignalService signalService;

    /** The controller under test. */
    @InjectMocks
    private CommunitySignalController controller;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(
                Objects.requireNonNull(controller, CONTROLLER_REQUIRED_MESSAGE),
                "authenticatedUserResolver",
                new AuthenticatedUserResolver());
    }

    @Test
    @DisplayName("shouldGetSignalsWithAnonymousUser")
    void shouldGetSignalsWithAnonymousUser() {
        SignalListResponse response = SignalListResponse.builder()
                .items(List.of()).total(0L).page(0).size(DEFAULT_PAGE_SIZE).build();
        when(signalService.getSignals(null, "new", null, null, 0, DEFAULT_PAGE_SIZE)).thenReturn(response);

        ApiResponse<SignalListResponse> result = controller.getSignals(null, "new", null, null, 0, DEFAULT_PAGE_SIZE);

        assertEquals(0, result.getCode());
        verify(signalService).getSignals(null, "new", null, null, 0, DEFAULT_PAGE_SIZE);
    }

    @Test
    @DisplayName("shouldCreateSignalWhenUserIsAuthenticated")
    void shouldCreateSignalWhenUserIsAuthenticated() {
        UserPrincipal principal = buildUserPrincipal(TEST_USER_ID_1);
        CreateSignalRequest request = new CreateSignalRequest();
        request.setSymbol("AAPL");

        SignalResponse signalResponse = SignalResponse.builder().id(1L).symbol("AAPL").build();
        when(signalService.createSignal(TEST_USER_ID_1, request)).thenReturn(signalResponse);

        ApiResponse<SignalResponse> result = controller.createSignal(principal, request);

        assertEquals(0, result.getCode());
        assertEquals("AAPL", result.getData().getSymbol());
        verify(signalService).createSignal(TEST_USER_ID_1, request);
    }

    @Test
    @DisplayName("shouldRejectCreateSignalWhenUserIsMissing")
    void shouldRejectCreateSignalWhenUserIsMissing() {
        CreateSignalRequest request = new CreateSignalRequest();
        request.setSymbol("AAPL");

        NullPointerException exception = assertThrows(
                NullPointerException.class,
                () -> controller.createSignal(null, request)
        );

        assertEquals(USER_PRINCIPAL_REQUIRED_MESSAGE, exception.getMessage());
    }

    @Test
    @DisplayName("shouldCloseSignalWhenUserIsAuthenticated")
    void shouldCloseSignalWhenUserIsAuthenticated() {
        UserPrincipal principal = buildUserPrincipal(TEST_USER_ID_2);
        SignalResponse signalResponse = SignalResponse.builder().id(TEST_SIGNAL_ID_1).build();
        when(signalService.closeSignal(TEST_USER_ID_2, TEST_SIGNAL_ID_1, "HIT_TARGET", TEST_CLOSE_PRICE))
                .thenReturn(signalResponse);

        ApiResponse<SignalResponse> result = controller.closeSignal(
                principal,
                TEST_SIGNAL_ID_1,
                "HIT_TARGET",
                TEST_CLOSE_PRICE
        );

        assertEquals(0, result.getCode());
        verify(signalService).closeSignal(TEST_USER_ID_2, TEST_SIGNAL_ID_1, "HIT_TARGET", TEST_CLOSE_PRICE);
    }

    @Test
    @DisplayName("shouldDeleteSignalWithEnglishSuccessMessage")
    void shouldDeleteSignalWithEnglishSuccessMessage() {
        UserPrincipal principal = buildUserPrincipal(TEST_USER_ID_3);

        ApiResponse<Void> result = controller.deleteSignal(principal, TEST_SIGNAL_ID_2);

        assertEquals(0, result.getCode());
        assertEquals("Deleted successfully", result.getMessage());
        verify(signalService).deleteSignal(TEST_USER_ID_3, TEST_SIGNAL_ID_2);
    }

    @Test
    @DisplayName("shouldGetCommentsBySignalIdAndPaging")
    void shouldGetCommentsBySignalIdAndPaging() {
        CommentResponse comment = CommentResponse.builder().id(TEST_COMMENT_ID).content("Good signal").build();
        when(signalService.getComments(TEST_SIGNAL_ID_FOR_COMMENTS, 0, DEFAULT_PAGE_SIZE)).thenReturn(List.of(comment));

        ApiResponse<List<CommentResponse>> result =
                controller.getComments(TEST_SIGNAL_ID_FOR_COMMENTS, 0, DEFAULT_PAGE_SIZE);

        assertEquals(0, result.getCode());
        assertEquals(1, result.getData().size());
        verify(signalService).getComments(TEST_SIGNAL_ID_FOR_COMMENTS, 0, DEFAULT_PAGE_SIZE);
    }

    private UserPrincipal buildUserPrincipal(Long userId) {
        User user = User.builder()
                .id(userId)
                .username("community-user")
                .email("community@koduck.dev")
                .passwordHash("$2a$10$abcdefghijklmnopqrstuv")
                .status(User.UserStatus.ACTIVE)
                .build();
        return new UserPrincipal(user, List.of(new SimpleGrantedAuthority("ROLE_USER")));
    }
}
