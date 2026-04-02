package com.koduck.service.market.support;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;

/**
 * Trading-session and holiday checks for Hong Kong stock market.
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
public final class HKStockMarketCalendar {

    private HKStockMarketCalendar() {
    }

    public static boolean isWeekend(DayOfWeek dayOfWeek) {
        return dayOfWeek == DayOfWeek.SATURDAY || dayOfWeek == DayOfWeek.SUNDAY;
    }

    public static boolean isPreMarket(LocalTime time) {
        return time.isAfter(LocalTime.of(9, 0)) && time.isBefore(LocalTime.of(9, 30));
    }

    public static boolean isMorningSession(LocalTime time) {
        return isAtOrAfter(time, LocalTime.of(9, 30)) && time.isBefore(LocalTime.of(12, 0));
    }

    public static boolean isLunchBreak(LocalTime time) {
        return isAtOrAfter(time, LocalTime.of(12, 0)) && time.isBefore(LocalTime.of(13, 0));
    }

    public static boolean isAfternoonSession(LocalTime time) {
        return isAtOrAfter(time, LocalTime.of(13, 0)) && time.isBefore(LocalTime.of(16, 0));
    }

    public static boolean isClosingAuction(LocalTime time) {
        return isAtOrAfter(time, LocalTime.of(16, 0)) && time.isBefore(LocalTime.of(16, 10));
    }

    public static boolean isPublicHoliday(LocalDate date) {
        int month = date.getMonthValue();
        int day = date.getDayOfMonth();
        if (month == 2 && day >= 10 && day <= 13) {
            return true;
        }
        if (month == 4 && day == 4) {
            return true;
        }
        if (month == 5 && day == 1) {
            return true;
        }
        if (month == 9 && day >= 17 && day <= 18) {
            return true;
        }
        if (month == 10 && day == 1) {
            return true;
        }
        return month == 12 && (day == 25 || day == 26);
    }

    private static boolean isAtOrAfter(LocalTime time, LocalTime threshold) {
        return time.equals(threshold) || time.isAfter(threshold);
    }
}
