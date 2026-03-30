package com.koduck.controller;

import com.koduck.dto.community.CommentResponse;
import com.koduck.dto.community.SignalListResponse;
import com.koduck.dto.community.UserSignalStatsResponse;
import com.koduck.controller.support.AuthenticatedUserResolver;
import com.koduck.security.JwtAuthenticationFilter;
import com.koduck.service.CommunitySignalService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.math.BigDecimal;
import java.util.List;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.nullable;
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
 * @date 2026-03-05
 */
@WebMvcTest(controllers = CommunitySignalController.class)
@AutoConfigureMockMvc(addFilters = false)
@SuppressWarnings("null")
class CommunitySignalControllerValidationTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CommunitySignalService signalService;

    @MockitoBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @MockitoBean
    private AuthenticatedUserResolver authenticatedUserResolver;

    @Test
    @DisplayName("shouldReturnBadRequestWhenSortIsInvalid")
    void shouldReturnBadRequestWhenSortIsInvalid() throws Exception {
        mockMvc.perform(get("/api/v1/community/signals")
                        .param("sort", "invalid")
                        .param("page", "0")
                        .param("size", "20"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(signalService);
    }

    @Test
    @DisplayName("shouldReturnBadRequestWhenTypeIsInvalid")
    void shouldReturnBadRequestWhenTypeIsInvalid() throws Exception {
        mockMvc.perform(get("/api/v1/community/signals")
                        .param("type", "BUY_LONG")
                        .param("page", "0")
                        .param("size", "20"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(signalService);
    }

    @Test
    @DisplayName("shouldReturnBadRequestWhenPageIsNegative")
    void shouldReturnBadRequestWhenPageIsNegative() throws Exception {
        mockMvc.perform(get("/api/v1/community/signals")
                        .param("page", "-1")
                        .param("size", "20"))
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
            .page(0)
            .size(20)
            .totalPages(0)
            .build();
        when(signalService.getSignals(nullable(Long.class), eq("new"), isNull(), isNull(), eq(0), eq(20)))
            .thenReturn(response);

        mockMvc.perform(get("/api/v1/community/signals")
                .param("sort", "new")
                .param("page", "0")
                .param("size", "20"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(0))
            .andExpect(jsonPath("$.data.page").value(0))
            .andExpect(jsonPath("$.data.size").value(20));

        verify(signalService).getSignals(nullable(Long.class), eq("new"), isNull(), isNull(), eq(0), eq(20));
        }

        @Test
        @DisplayName("shouldReturnOkAndInvokeServiceWhenCommentsParamsAreValid")
        void shouldReturnOkAndInvokeServiceWhenCommentsParamsAreValid() throws Exception {
        CommentResponse response = CommentResponse.builder()
            .id(1L)
            .signalId(9L)
            .content("good signal")
            .build();
        when(signalService.getComments(9L, 0, 20)).thenReturn(List.of(response));

        mockMvc.perform(get("/api/v1/community/signals/9/comments")
                .param("page", "0")
                .param("size", "20"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(0))
            .andExpect(jsonPath("$.data[0].id").value(1))
            .andExpect(jsonPath("$.data[0].content").value("good signal"));

        verify(signalService).getComments(9L, 0, 20);
        }

        @Test
        @DisplayName("shouldReturnOkAndInvokeServiceWhenUserStatsIdIsValid")
        void shouldReturnOkAndInvokeServiceWhenUserStatsIdIsValid() throws Exception {
        UserSignalStatsResponse response = UserSignalStatsResponse.builder()
            .userId(1L)
            .totalSignals(10)
            .winRate(new BigDecimal("0.60"))
            .build();
        when(signalService.getUserStats(1L)).thenReturn(response);

        mockMvc.perform(get("/api/v1/community/users/1/stats"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(0))
            .andExpect(jsonPath("$.data.userId").value(1))
            .andExpect(jsonPath("$.data.totalSignals").value(10));

        verify(signalService).getUserStats(1L);
        }
}
