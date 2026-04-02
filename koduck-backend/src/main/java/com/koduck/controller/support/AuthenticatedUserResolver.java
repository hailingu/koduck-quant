package com.koduck.controller.support;
import java.util.Objects;

import org.springframework.stereotype.Component;

import com.koduck.security.UserPrincipal;

/**
 * Resolver for extracting authenticated user information from security principal.
 *
 * @author Koduck Team
 * @date 2026-03-30
 */
@Component
public class AuthenticatedUserResolver {

    /**
     * Extracts required authenticated user id.
     *
     * @param userPrincipal authenticated principal
     * @return authenticated user id
     */
    public Long requireUserId(UserPrincipal userPrincipal) {
        Objects.requireNonNull(userPrincipal, "userPrincipal must not be null");
        return Objects.requireNonNull(userPrincipal.getUser().getId(), "authenticated user id must not be null");
    }

    /**
     * Extracts optional authenticated user id.
     *
     * @param userPrincipal optional principal
     * @return user id when present, otherwise null
     */
    public Long getOptionalUserId(UserPrincipal userPrincipal) {
        if (userPrincipal == null) {
            return null;
        }
        return userPrincipal.getUser().getId();
    }
}