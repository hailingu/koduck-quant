package com.koduck.util;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for SymbolUtils.
 * Tests the symbol normalization functionality used to fix Issue #132.
 */
@DisplayName("SymbolUtils")
class SymbolUtilsTest {

    @Nested
    @DisplayName("normalize()")
    class Normalize {

        @Test
        @DisplayName("should return same 6-digit symbol unchanged")
        void shouldReturnSame6DigitSymbol() {
            assertThat(SymbolUtils.normalize("601012")).isEqualTo("601012");
            assertThat(SymbolUtils.normalize("000001")).isEqualTo("000001");
            assertThat(SymbolUtils.normalize("999999")).isEqualTo("999999");
        }

        @Test
        @DisplayName("should remove SH prefix")
        void shouldRemoveSHPrefix() {
            assertThat(SymbolUtils.normalize("SH601012")).isEqualTo("601012");
            assertThat(SymbolUtils.normalize("sh601012")).isEqualTo("601012");
            assertThat(SymbolUtils.normalize("Sh601012")).isEqualTo("601012");
        }

        @Test
        @DisplayName("should remove SZ prefix")
        void shouldRemoveSZPrefix() {
            assertThat(SymbolUtils.normalize("SZ000001")).isEqualTo("000001");
            assertThat(SymbolUtils.normalize("sz000001")).isEqualTo("000001");
        }

        @Test
        @DisplayName("should remove BJ prefix")
        void shouldRemoveBJPrefix() {
            assertThat(SymbolUtils.normalize("BJ888888")).isEqualTo("888888");
            assertThat(SymbolUtils.normalize("bj888888")).isEqualTo("888888");
        }

        @Test
        @DisplayName("should remove .SH suffix")
        void shouldRemoveSHSuffix() {
            assertThat(SymbolUtils.normalize("601012.SH")).isEqualTo("601012");
            assertThat(SymbolUtils.normalize("601012.sh")).isEqualTo("601012");
        }

        @Test
        @DisplayName("should remove .SZ suffix")
        void shouldRemoveSZSuffix() {
            assertThat(SymbolUtils.normalize("000001.SZ")).isEqualTo("000001");
            assertThat(SymbolUtils.normalize("000001.sz")).isEqualTo("000001");
        }

        @Test
        @DisplayName("should handle mixed case prefixes")
        void shouldHandleMixedCasePrefixes() {
            assertThat(SymbolUtils.normalize("Sh601012")).isEqualTo("601012");
            assertThat(SymbolUtils.normalize("sH601012")).isEqualTo("601012");
            assertThat(SymbolUtils.normalize("601012.Sh")).isEqualTo("601012");
            assertThat(SymbolUtils.normalize("601012.sH")).isEqualTo("601012");
        }

        @Test
        @DisplayName("should return original for null input")
        void shouldReturnOriginalForNull() {
            assertThat(SymbolUtils.normalize(null)).isNull();
        }

        @Test
        @DisplayName("should return original for blank input")
        void shouldReturnOriginalForBlank() {
            assertThat(SymbolUtils.normalize("   ")).isEqualTo("   ");
            assertThat(SymbolUtils.normalize("")).isEqualTo("");
        }

        @Test
        @DisplayName("should left-pad symbols shorter than 6 digits")
        void shouldLeftPadShortSymbols() {
            assertThat(SymbolUtils.normalize("6012")).isEqualTo("006012");
            assertThat(SymbolUtils.normalize("SH601")).isEqualTo("000601");
        }

        @Test
        @DisplayName("should return original for invalid format (more than 6 digits)")
        void shouldReturnOriginalForInvalidFormatTooManyDigits() {
            // More than 6 digits
            assertThat(SymbolUtils.normalize("6010127")).isEqualTo("6010127");
        }

        @Test
        @DisplayName("should handle symbols with special characters")
        void shouldHandleSymbolsWithSpecialCharacters() {
            // Symbols with spaces or other characters
            assertThat(SymbolUtils.normalize("  SH601012  ")).isEqualTo("601012");
            assertThat(SymbolUtils.normalize("SH 601012")).isEqualTo("601012");
        }
    }

    @Nested
    @DisplayName("matches()")
    class Matches {

        @Test
        @DisplayName("should match identical symbols")
        void shouldMatchIdentical() {
            assertThat(SymbolUtils.matches("601012", "601012")).isTrue();
        }

        @Test
        @DisplayName("should match symbols with SH prefix")
        void shouldMatchWithSHPrefix() {
            assertThat(SymbolUtils.matches("SH601012", "601012")).isTrue();
            assertThat(SymbolUtils.matches("601012", "SH601012")).isTrue();
            assertThat(SymbolUtils.matches("SH601012", "SH601012")).isTrue();
        }

        @Test
        @DisplayName("should match symbols with SZ prefix")
        void shouldMatchWithSZPrefix() {
            assertThat(SymbolUtils.matches("SZ000001", "000001")).isTrue();
            assertThat(SymbolUtils.matches("000001", "SZ000001")).isTrue();
        }

        @Test
        @DisplayName("should match with .SH suffix")
        void shouldMatchWithSHSuffix() {
            assertThat(SymbolUtils.matches("601012.SH", "601012")).isTrue();
            assertThat(SymbolUtils.matches("601012", "601012.SH")).isTrue();
        }

        @Test
        @DisplayName("should not match different symbols")
        void shouldNotMatchDifferentSymbols() {
            assertThat(SymbolUtils.matches("601012", "601013")).isFalse();
            // Note: SH601012 and SZ601012 are the same stock (601012),
            // just different markets (Shanghai vs Shenzhen), so they should match
            assertThat(SymbolUtils.matches("SH601012", "SZ601012")).isTrue();
        }

        @Test
        @DisplayName("should handle null values")
        void shouldHandleNull() {
            assertThat(SymbolUtils.matches(null, null)).isTrue();
            assertThat(SymbolUtils.matches("601012", null)).isFalse();
            assertThat(SymbolUtils.matches(null, "601012")).isFalse();
        }

        @Test
        @DisplayName("should be case insensitive")
        void shouldBeCaseInsensitive() {
            assertThat(SymbolUtils.matches("sh601012", "SH601012")).isTrue();
            assertThat(SymbolUtils.matches("SH601012", "sh601012")).isTrue();
        }
    }

    @Nested
    @DisplayName("getMarketPrefix()")
    class GetMarketPrefix {

        @Test
        @DisplayName("should return SH for SH prefix")
        void shouldReturnSH() {
            assertThat(SymbolUtils.getMarketPrefix("SH601012")).isEqualTo("SH");
            assertThat(SymbolUtils.getMarketPrefix("sh601012")).isEqualTo("SH");
        }

        @Test
        @DisplayName("should return SZ for SZ prefix")
        void shouldReturnSZ() {
            assertThat(SymbolUtils.getMarketPrefix("SZ000001")).isEqualTo("SZ");
        }

        @Test
        @DisplayName("should return BJ for BJ prefix")
        void shouldReturnBJ() {
            assertThat(SymbolUtils.getMarketPrefix("BJ888888")).isEqualTo("BJ");
        }

        @Test
        @DisplayName("should return null for no prefix")
        void shouldReturnNullForNoPrefix() {
            assertThat(SymbolUtils.getMarketPrefix("601012")).isNull();
        }

        @Test
        @DisplayName("should return null for short input")
        void shouldReturnNullForShortInput() {
            assertThat(SymbolUtils.getMarketPrefix("S")).isNull();
            assertThat(SymbolUtils.getMarketPrefix("")).isNull();
            assertThat(SymbolUtils.getMarketPrefix(null)).isNull();
        }
    }
}
