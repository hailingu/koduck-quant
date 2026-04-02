package com.koduck.util;
import java.util.Locale;

/**
 * Utility class for validating reserved usernames.
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
public final class ReservedUsernameValidator {

    /**
     * Reserved usernames that cannot be used by normal accounts.
     */
    private static final String[] RESERVED_NAMES = {
        "admin", "administrator", "root", "system", "demo", "test", "api", "support", "info", "noreply"
    };

    private ReservedUsernameValidator() {
        // Utility class, no instantiation
    }

    /**
     * Checks if the given username is a reserved username.
     *
     * @param username the username to check
     * @return true if the username is reserved, false otherwise
     */
    public static boolean isReserved(final String username) {
        boolean reserved = false;
        if (username == null || username.isBlank()) {
            return reserved;
        }
        final String lowerUsername = username.toLowerCase(Locale.ROOT);
        for (final String reservedName : RESERVED_NAMES) {
            if (reservedName.equals(lowerUsername)) {
                reserved = true;
                break;
            }
        }
        return reserved;
    }

    /**
     * Returns the list of reserved usernames.
     *
     * @return array of reserved usernames
     */
    public static String[] getReservedUsernames() {
        return RESERVED_NAMES.clone();
    }
}
