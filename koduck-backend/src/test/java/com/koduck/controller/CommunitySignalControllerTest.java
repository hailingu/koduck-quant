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
 * @author GitHub Copilot
 * @date 2026-03-05
 */
@ExtendWith(MockitoExtension.class)
class CommunitySignalControllerTest {

    private static final String USER_PRINCIPAL_REQUIRED_MESSAGE = "userPrincipal must not be null";
    private static final String CONTROLLER_REQUIRED_MESSAGE = "controller must not be null";

    @Mock
    private CommunitySignalService signalService;

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
        SignalListResponse response = SignalListResponse.builder().items(List.of()).total(0L).page(0).size(20).build();
        when(signalService.getSignals(null, "new", null, null, 0, 20)).thenReturn(response);

        ApiResponse<SignalListResponse> result = controller.getSignals(null, "new", null, null, 0, 20);

        assertEquals(0, result.getCode());
        verify(signalService).getSignals(null, "new", null, null, 0, 20);
    }

    @Test
    @DisplayName("shouldCreateSignalWhenUserIsAuthenticated")
    void shouldCreateSignalWhenUserIsAuthenticated() {
        UserPrincipal principal = buildUserPrincipal(1001L);
        CreateSignalRequest request = new CreateSignalRequest();
        request.setSymbol("AAPL");

        SignalResponse signalResponse = SignalResponse.builder().id(1L).symbol("AAPL").build();
        when(signalService.createSignal(1001L, request)).thenReturn(signalResponse);

        ApiResponse<SignalResponse> result = controller.createSignal(principal, request);

        assertEquals(0, result.getCode());
        assertEquals("AAPL", result.getData().getSymbol());
        verify(signalService).createSignal(1001L, request);
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
        UserPrincipal principal = buildUserPrincipal(2002L);
        SignalResponse signalResponse = SignalResponse.builder().id(11L).build();
        when(signalService.closeSignal(2002L, 11L, "HIT_TARGET", new BigDecimal("5.20")))
                .thenReturn(signalResponse);

        ApiResponse<SignalResponse> result = controller.closeSignal(
                principal,
                11L,
                "HIT_TARGET",
                new BigDecimal("5.20")
        );

        assertEquals(0, result.getCode());
        verify(signalService).closeSignal(2002L, 11L, "HIT_TARGET", new BigDecimal("5.20"));
    }

    @Test
    @DisplayName("shouldDeleteSignalWithEnglishSuccessMessage")
    void shouldDeleteSignalWithEnglishSuccessMessage() {
        UserPrincipal principal = buildUserPrincipal(3003L);

        ApiResponse<Void> result = controller.deleteSignal(principal, 15L);

        assertEquals(0, result.getCode());
        assertEquals("Deleted successfully", result.getMessage());
        verify(signalService).deleteSignal(3003L, 15L);
    }

    @Test
    @DisplayName("shouldGetCommentsBySignalIdAndPaging")
    void shouldGetCommentsBySignalIdAndPaging() {
        CommentResponse comment = CommentResponse.builder().id(21L).content("Good signal").build();
        when(signalService.getComments(9L, 0, 20)).thenReturn(List.of(comment));

        ApiResponse<List<CommentResponse>> result = controller.getComments(9L, 0, 20);

        assertEquals(0, result.getCode());
        assertEquals(1, result.getData().size());
        verify(signalService).getComments(9L, 0, 20);
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
