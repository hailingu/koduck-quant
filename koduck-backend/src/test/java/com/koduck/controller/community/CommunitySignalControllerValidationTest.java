package com.koduck.controller.community;
import com.koduck.controller.community.CommunitySignalController;

import java.math.BigDecimal;
import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.TestConstructor;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.koduck.controller.support.AuthenticatedUserResolver;
import com.koduck.dto.community.CommentResponse;
import com.koduck.dto.community.SignalListResponse;
import com.koduck.dto.community.UserSignalStatsResponse;
import com.koduck.security.JwtAuthenticationFilter;
import com.koduck.service.CommunitySignalService;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * MockMvc validation tests for {@link CommunitySignalController}.
 *
 * <p>These tests verify that invalid request parameters are rejected at HTTP
 * boundary with status 400 before entering service logic.</p>
 *
 * @author GitHub Copilot
 */
@WebMvcTest(controllers = CommunitySignalController.class)
@AutoConfigureMockMvc(addFilters = false)
@TestConstructor(autowireMode = TestConstructor.AutowireMode.ALL)
class CommunitySignalControllerValidationTest {

    /** Default page size for signals list. */
    private static final int DEFAULT_PAGE_SIZE = 20;

    /** Default page number. */
    private static final int DEFAULT_PAGE_NUMBER = 0;

    /** Signal ID for testing comments. */
    private static final long TEST_SIGNAL_ID = 9L;

    /** Default total signals count. */
    private static final int DEFAULT_TOTAL_SIGNALS = 10;

    /** Mock MVC for testing HTTP requests. */
    private final MockMvc mockMvc;

    /** Mock service for community signals. */
    @MockitoBean
    private CommunitySignalService signalService;

    /** Mock JWT authentication filter. */
    @MockitoBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    /** Mock authenticated user resolver. */
    @MockitoBean
    private AuthenticatedUserResolver authenticatedUserResolver;

    /**
     * Constructs a new test instance.
     *
     * @param mockMvc the mock MVC
     */
    CommunitySignalControllerValidationTest(MockMvc mockMvc) {
        this.mockMvc = mockMvc;
    }

    @Test
    @DisplayName("shouldReturnBadRequestWhenSortIsInvalid")
    void shouldReturnBadRequestWhenSortIsInvalid() throws Exception {
        mockMvc.perform(get("/api/v1/community/signals")
                        .param("sort", "invalid")
                        .param("page", "0")
                        .param("size", String.valueOf(DEFAULT_PAGE_SIZE)))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(signalService);
    }

    @Test
    @DisplayName("shouldReturnBadRequestWhenTypeIsInvalid")
    void shouldReturnBadRequestWhenTypeIsInvalid() throws Exception {
        mockMvc.perform(get("/api/v1/community/signals")
                        .param("type", "BUY_LONG")
                        .param("page", "0")
                        .param("size", String.valueOf(DEFAULT_PAGE_SIZE)))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(signalService);
    }

    @Test
    @DisplayName("shouldReturnBadRequestWhenPageIsNegative")
    void shouldReturnBadRequestWhenPageIsNegative() throws Exception {
        mockMvc.perform(get("/api/v1/community/signals")
                        .param("page", "-1")
                        .param("size", String.valueOf(DEFAULT_PAGE_SIZE)))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(signalService);
    }

    @Test
    @DisplayName("shouldReturnBadRequestWhenSizeIsOutOfRange")
    void shouldReturnBadRequestWhenSizeIsOutOfRange() throws Exception {
        mockMvc.perform(get("/api/v1/community/signals")
                        .param("page", "0")
                        .param("size", "101"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(signalService);
    }

    @Test
    @DisplayName("shouldReturnBadRequestWhenSignalIdIsNotPositive")
    void shouldReturnBadRequestWhenSignalIdIsNotPositive() throws Exception {
        mockMvc.perform(get("/api/v1/community/signals/0"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(signalService);
    }

    @Test
    @DisplayName("shouldReturnBadRequestWhenCommentsPageSizeIsInvalid")
    void shouldReturnBadRequestWhenCommentsPageSizeIsInvalid() throws Exception {
        mockMvc.perform(get("/api/v1/community/signals/1/comments")
                        .param("page", "0")
                        .param("size", "0"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(signalService);
    }

    @Test
    @DisplayName("shouldReturnBadRequestWhenUserIdIsNotPositive")
    void shouldReturnBadRequestWhenUserIdIsNotPositive() throws Exception {
        mockMvc.perform(get("/api/v1/community/users/0/stats"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(signalService);
    }

    @Test
    @DisplayName("shouldReturnOkAndInvokeServiceWhenSignalsParamsAreValid")
    void shouldReturnOkAndInvokeServiceWhenSignalsParamsAreValid() throws Exception {
        SignalListResponse response = SignalListResponse.builder()
                .items(List.of())
                .total(0L)
                .page(DEFAULT_PAGE_NUMBER)
                .size(DEFAULT_PAGE_SIZE)
                .totalPages(0)
                .build();
        when(signalService.getSignals(nullable(Long.class), eq("new"), isNull(),
            isNull(), eq(DEFAULT_PAGE_NUMBER), eq(DEFAULT_PAGE_SIZE)))
                .thenReturn(response);

        mockMvc.perform(get("/api/v1/community/signals")
                        .param("sort", "new")
                        .param("page", String.valueOf(DEFAULT_PAGE_NUMBER))
                        .param("size", String.valueOf(DEFAULT_PAGE_SIZE)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.page").value(DEFAULT_PAGE_NUMBER))
                .andExpect(jsonPath("$.data.size").value(DEFAULT_PAGE_SIZE));

        verify(signalService).getSignals(nullable(Long.class), eq("new"), isNull(),
            isNull(), eq(DEFAULT_PAGE_NUMBER), eq(DEFAULT_PAGE_SIZE));
    }

    @Test
    @DisplayName("shouldReturnOkAndInvokeServiceWhenCommentsParamsAreValid")
    void shouldReturnOkAndInvokeServiceWhenCommentsParamsAreValid() throws Exception {
        CommentResponse response = CommentResponse.builder()
                .id(1L)
                .signalId(TEST_SIGNAL_ID)
                .content("good signal")
                .build();
        when(signalService.getComments(TEST_SIGNAL_ID, DEFAULT_PAGE_NUMBER, DEFAULT_PAGE_SIZE))
            .thenReturn(List.of(response));

        mockMvc.perform(get("/api/v1/community/signals/9/comments")
                        .param("page", String.valueOf(DEFAULT_PAGE_NUMBER))
                        .param("size", String.valueOf(DEFAULT_PAGE_SIZE)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data[0].id").value(1))
                .andExpect(jsonPath("$.data[0].content").value("good signal"));

        verify(signalService).getComments(TEST_SIGNAL_ID, DEFAULT_PAGE_NUMBER, DEFAULT_PAGE_SIZE);
    }

    @Test
    @DisplayName("shouldReturnOkAndInvokeServiceWhenUserStatsIdIsValid")
    void shouldReturnOkAndInvokeServiceWhenUserStatsIdIsValid() throws Exception {
        UserSignalStatsResponse response = UserSignalStatsResponse.builder()
                .userId(1L)
                .totalSignals(DEFAULT_TOTAL_SIGNALS)
                .winRate(new BigDecimal("0.60"))
                .build();
        when(signalService.getUserStats(1L)).thenReturn(response);

        mockMvc.perform(get("/api/v1/community/users/1/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.userId").value(1))
                .andExpect(jsonPath("$.data.totalSignals").value(DEFAULT_TOTAL_SIGNALS));

        verify(signalService).getUserStats(1L);
    }
}
