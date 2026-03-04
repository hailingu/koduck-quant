package com.koduck.util;

/**
 * Utility class for validating reserved usernames.
 * <p>
 * Reserved usernames are typically reserved for system use or administrative
 * purposes and should not be available for regular user registration.
 */
public final class ReservedUsernameValidator {

    // Reserved usernames list
    private static final String[] RESERVED_USERNAMES = {
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
    public static boolean isReserved(String username) {
        if (username == null || username.isBlank()) {
            return false;
        }
        String lowerUsername = username.toLowerCase();
        for (String reserved : RESERVED_USERNAMES) {
            if (reserved.equalsIgnoreCase(lowerUsername)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Returns the list of reserved usernames.
     *
     * @return array of reserved usernames
     */
    public static String[] getReservedUsernames() {
        return RESERVED_USERNAMES.clone();
    }
}
