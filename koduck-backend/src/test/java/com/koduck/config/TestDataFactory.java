package com.koduck.config;

import java.time.LocalDateTime;

import com.koduck.entity.User;

/**
 * Test data factory for creating test entities.
 * Provides unified test data construction methods.
 *
 * @author GitHub Copilot
 */
public final class TestDataFactory {

    /**
     * Counter for generating unique test IDs.
     */
    private static long idCounter = 1;

    /**
     * Private constructor to prevent instantiation.
     */
    private TestDataFactory() {
        // Utility class
    }

    // ========== Generic ==========

    /**
     * Generate next test ID.
     *
     * @return next test ID
     */
    public static long nextTestId() {
        return nextId();
    }

    /**
     * Generate next name with prefix.
     *
     * @param prefix name prefix
     * @return generated name
     */
    public static String nextName(String prefix) {
        return prefix + nextId();
    }

    // ========== Entity ==========

    /**
     * Create a test user with default values.
     *
     * @return test user
     */
    public static User createUser() {
        long id = nextId();
        return User.builder()
                .id(id)
                .username("testuser" + id)
                .email("test" + id + "@example.com")
                .passwordHash("encoded_password_hash")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
    }

    /**
     * Create a test user with specified username.
     *
     * @param username username
     * @return test user
     */
    public static User createUser(String username) {
        User user = createUser();
        user.setUsername(username);
        user.setEmail(username + "@example.com");
        return user;
    }

    // ========== Helper ==========

    /**
     * Generate next unique ID.
     *
     * @return next ID
     */
    private static synchronized long nextId() {
        return idCounter++;
    }

    /**
     * Reset ID counter (call at the beginning of each test method).
     */
    public static void resetIdCounter() {
        idCounter = 1;
    }
}
