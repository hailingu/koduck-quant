package com.koduck.controller.admin;

import com.koduck.dto.ApiResponse;
import com.koduck.service.KlineSyncService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;

/**
 * Unit tests for {@link KlineAdminController}.
 *
 * @author GitHub Copilot
 * @date 2026-03-05
 */
@ExtendWith(MockitoExtension.class)
class KlineAdminControllerTest {

    @Mock
    private KlineSyncService klineSyncService;

    @InjectMocks
    private KlineAdminController klineAdminController;

    @Test
    @DisplayName("shouldTriggerSyncWhenInputIsValid")
    void shouldTriggerSyncWhenInputIsValid() {
        ApiResponse<String> response = klineAdminController.syncSymbol("AShare", "600519", "1D");

        verify(klineSyncService).syncSymbolKline("AShare", "600519", "1D");
        assertEquals("Sync triggered for 600519", response.getData());
    }

    @Test
    @DisplayName("shouldTriggerBackfillWhenInputIsValid")
    void shouldTriggerBackfillWhenInputIsValid() {
        ApiResponse<String> response = klineAdminController.backfillSymbol("AShare", "600519", "1D", 365);

        verify(klineSyncService).backfillHistoricalData("AShare", "600519", "1D", 365);
        assertEquals("Backfill triggered for 600519", response.getData());
    }

    @Test
    @DisplayName("shouldTriggerBatchSyncWhenSymbolsAreValid")
    void shouldTriggerBatchSyncWhenSymbolsAreValid() {
        List<String> symbols = List.of("600519", "000001");

        ApiResponse<String> response = klineAdminController.syncBatch(symbols, "AShare", "1D");

        verify(klineSyncService).syncBatchSymbols("AShare", symbols, "1D");
        assertEquals("Batch sync triggered for 2 symbols", response.getData());
    }

    @Test
    @DisplayName("shouldThrowExceptionWhenSymbolsIsNull")
    void shouldThrowExceptionWhenSymbolsIsNull() {
        NullPointerException exception = assertThrows(
                NullPointerException.class,
                () -> klineAdminController.syncBatch(null, "AShare", "1D")
        );

        assertEquals("symbols must not be empty", exception.getMessage());
    }

    @Test
    @DisplayName("shouldThrowExceptionWhenSymbolsIsEmpty")
    void shouldThrowExceptionWhenSymbolsIsEmpty() {
        List<String> symbols = List.of();
        IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> klineAdminController.syncBatch(symbols, "AShare", "1D")
        );

        assertEquals("symbols must not be empty", exception.getMessage());
    }

    @Test
    @DisplayName("shouldThrowExceptionWhenSymbolsContainBlank")
    void shouldThrowExceptionWhenSymbolsContainBlank() {
        List<String> symbols = List.of("600519", " ");
        IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> klineAdminController.syncBatch(symbols, "AShare", "1D")
        );

        assertEquals("symbols must not contain blank values", exception.getMessage());
    }
}
