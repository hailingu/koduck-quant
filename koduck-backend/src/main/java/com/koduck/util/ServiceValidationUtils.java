package com.koduck.util;

import java.util.Objects;
import java.util.Optional;
import java.util.function.Supplier;

/**
 * Shared validation helpers for service-layer operations.
 */
public final class ServiceValidationUtils {

    private ServiceValidationUtils() {
        // Utility class.
    }

    /**
     * Returns the value from Optional or throws the provided exception.
     *
     * @param candidate value candidate
     * @param exceptionSupplier exception supplier when value is absent
     * @param <T> value type
     * @return existing value
     */
    public static <T> T requireFound(
            final Optional<T> candidate,
            final Supplier<? extends RuntimeException> exceptionSupplier) {
        Objects.requireNonNull(candidate, "candidate must not be null");
        Objects.requireNonNull(exceptionSupplier, "exceptionSupplier must not be null");
        return candidate.orElseThrow(exceptionSupplier);
    }

    /**
     * Ensures current user is owner of a resource.
     *
     * @param ownerUserId owner user id on resource
     * @param currentUserId current request user id
     * @param message exception message when ownership check fails
     */
    public static void assertOwner(final Long ownerUserId, final Long currentUserId, final String message) {
        if (!Objects.equals(ownerUserId, currentUserId)) {
            throw new IllegalArgumentException(message);
        }
    }
}
