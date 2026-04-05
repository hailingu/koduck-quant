package com.koduck.market.service.support;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;

/**
 * Trading-session and holiday checks for Hong Kong stock market.
 *
 * @author GitHub Copilot
 */
public final class HKStockMarketCalendar {

    /** Pre-market session start hour. */
    private static final int PRE_MARKET_START_HOUR = 9;
    /** Pre-market session start minute. */
    private static final int PRE_MARKET_START_MINUTE = 0;
    /** Pre-market session end hour. */
    private static final int PRE_MARKET_END_HOUR = 9;
    /** Pre-market session end minute. */
    private static final int PRE_MARKET_END_MINUTE = 30;

    /** Morning session start hour. */
    private static final int MORNING_SESSION_START_HOUR = 9;
    /** Morning session start minute. */
    private static final int MORNING_SESSION_START_MINUTE = 30;
    /** Morning session end hour. */
    private static final int MORNING_SESSION_END_HOUR = 12;
    /** Morning session end minute. */
    private static final int MORNING_SESSION_END_MINUTE = 0;

    /** Lunch break start hour. */
    private static final int LUNCH_BREAK_START_HOUR = 12;
    /** Lunch break start minute. */
    private static final int LUNCH_BREAK_START_MINUTE = 0;
    /** Lunch break end hour. */
    private static final int LUNCH_BREAK_END_HOUR = 13;
    /** Lunch break end minute. */
    private static final int LUNCH_BREAK_END_MINUTE = 0;

    /** Afternoon session start hour. */
    private static final int AFTERNOON_SESSION_START_HOUR = 13;
    /** Afternoon session start minute. */
    private static final int AFTERNOON_SESSION_START_MINUTE = 0;
    /** Afternoon session end hour. */
    private static final int AFTERNOON_SESSION_END_HOUR = 16;
    /** Afternoon session end minute. */
    private static final int AFTERNOON_SESSION_END_MINUTE = 0;

    /** Closing auction start hour. */
    private static final int CLOSING_AUCTION_START_HOUR = 16;
    /** Closing auction start minute. */
    private static final int CLOSING_AUCTION_START_MINUTE = 0;
    /** Closing auction end hour. */
    private static final int CLOSING_AUCTION_END_HOUR = 16;
    /** Closing auction end minute. */
    private static final int CLOSING_AUCTION_END_MINUTE = 10;

    /** February month number. */
    private static final int FEBRUARY = 2;
    /** April month number. */
    private static final int APRIL = 4;
    /** May month number. */
    private static final int MAY = 5;
    /** September month number. */
    private static final int SEPTEMBER = 9;
    /** October month number. */
    private static final int OCTOBER = 10;
    /** December month number. */
    private static final int DECEMBER = 12;

    /** Chinese New Year start day (approximate). */
    private static final int CHINESE_NEW_YEAR_START_DAY = 10;
    /** Chinese New Year end day (approximate). */
    private static final int CHINESE_NEW_YEAR_END_DAY = 13;
    /** Ching Ming Festival day. */
    private static final int CHING_MING_DAY = 4;
    /** Labour Day. */
    private static final int LABOUR_DAY = 1;
    /** Mid-Autumn Festival start day (approximate). */
    private static final int MID_AUTUMN_START_DAY = 17;
    /** Mid-Autumn Festival end day (approximate). */
    private static final int MID_AUTUMN_END_DAY = 18;
    /** National Day. */
    private static final int NATIONAL_DAY = 1;
    /** Christmas Day. */
    private static final int CHRISTMAS_DAY = 25;
    /** Boxing Day. */
    private static final int BOXING_DAY = 26;

    private HKStockMarketCalendar() {
    }

    /**
     * Checks if the given day of week is a weekend.
     *
     * @param dayOfWeek the day of week to check
     * @return true if Saturday or Sunday, false otherwise
     */
    public static boolean isWeekend(DayOfWeek dayOfWeek) {
        return dayOfWeek == DayOfWeek.SATURDAY || dayOfWeek == DayOfWeek.SUNDAY;
    }

    /**
     * Checks if the given time is during the pre-market session.
     *
     * @param time the time to check
     * @return true if during pre-market hours (9:00-9:30), false otherwise
     */
    public static boolean isPreMarket(LocalTime time) {
        return time.isAfter(LocalTime.of(PRE_MARKET_START_HOUR, PRE_MARKET_START_MINUTE))
                && time.isBefore(LocalTime.of(PRE_MARKET_END_HOUR, PRE_MARKET_END_MINUTE));
    }

    /**
     * Checks if the given time is during the morning session.
     *
     * @param time the time to check
     * @return true if during morning session hours (9:30-12:00), false otherwise
     */
    public static boolean isMorningSession(LocalTime time) {
        return isAtOrAfter(time, LocalTime.of(MORNING_SESSION_START_HOUR, MORNING_SESSION_START_MINUTE))
                && time.isBefore(LocalTime.of(MORNING_SESSION_END_HOUR, MORNING_SESSION_END_MINUTE));
    }

    /**
     * Checks if the given time is during the lunch break.
     *
     * @param time the time to check
     * @return true if during lunch break hours (12:00-13:00), false otherwise
     */
    public static boolean isLunchBreak(LocalTime time) {
        return isAtOrAfter(time, LocalTime.of(LUNCH_BREAK_START_HOUR, LUNCH_BREAK_START_MINUTE))
                && time.isBefore(LocalTime.of(LUNCH_BREAK_END_HOUR, LUNCH_BREAK_END_MINUTE));
    }

    /**
     * Checks if the given time is during the afternoon session.
     *
     * @param time the time to check
     * @return true if during afternoon session hours (13:00-16:00), false otherwise
     */
    public static boolean isAfternoonSession(LocalTime time) {
        return isAtOrAfter(time, LocalTime.of(AFTERNOON_SESSION_START_HOUR, AFTERNOON_SESSION_START_MINUTE))
                && time.isBefore(LocalTime.of(AFTERNOON_SESSION_END_HOUR, AFTERNOON_SESSION_END_MINUTE));
    }

    /**
     * Checks if the given time is during the closing auction session.
     *
     * @param time the time to check
     * @return true if during closing auction hours (16:00-16:10), false otherwise
     */
    public static boolean isClosingAuction(LocalTime time) {
        return isAtOrAfter(time, LocalTime.of(CLOSING_AUCTION_START_HOUR, CLOSING_AUCTION_START_MINUTE))
                && time.isBefore(LocalTime.of(CLOSING_AUCTION_END_HOUR, CLOSING_AUCTION_END_MINUTE));
    }

    /**
     * Checks if the given date is a public holiday in Hong Kong.
     *
     * @param date the date to check
     * @return true if the date is a public holiday, false otherwise
     */
    public static boolean isPublicHoliday(LocalDate date) {
        int month = date.getMonthValue();
        int day = date.getDayOfMonth();
        if (month == FEBRUARY && day >= CHINESE_NEW_YEAR_START_DAY && day <= CHINESE_NEW_YEAR_END_DAY) {
            return true;
        }
        if (month == APRIL && day == CHING_MING_DAY) {
            return true;
        }
        if (month == MAY && day == LABOUR_DAY) {
            return true;
        }
        if (month == SEPTEMBER && day >= MID_AUTUMN_START_DAY && day <= MID_AUTUMN_END_DAY) {
            return true;
        }
        if (month == OCTOBER && day == NATIONAL_DAY) {
            return true;
        }
        return month == DECEMBER && (day == CHRISTMAS_DAY || day == BOXING_DAY);
    }

    /**
     * Checks if the given time is at or after the threshold time.
     *
     * @param time the time to check
     * @param threshold the threshold time
     * @return true if time equals or is after threshold, false otherwise
     */
    private static boolean isAtOrAfter(LocalTime time, LocalTime threshold) {
        return time.equals(threshold) || time.isAfter(threshold);
    }
}
