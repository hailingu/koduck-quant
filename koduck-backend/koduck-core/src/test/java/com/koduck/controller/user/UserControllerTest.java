package com.koduck.controller.user;

import java.lang.reflect.Method;

import jakarta.validation.constraints.Positive;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.validation.annotation.Validated;

import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * Unit tests for {@link UserController} annotation contracts.
 *
 * @author GitHub Copilot
 */
class UserControllerTest {

    @Test
    @DisplayName("Controller should declare @Validated for method parameter validation")
    void controllerShouldDeclareValidatedAnnotation() {
        Validated validated = UserController.class.getAnnotation(Validated.class);

        assertNotNull(validated);
    }

    @Test
    @DisplayName("Admin methods should declare positive id constraint")
    void idParametersShouldDeclarePositiveConstraint() throws NoSuchMethodException {
        Method getMethod = UserController.class.getMethod("getUserById", Long.class);
        Method updateMethod = UserController.class.getMethod(
                "updateUser",
                Long.class,
                com.koduck.dto.user.UpdateUserRequest.class
        );
        Method deleteMethod = UserController.class.getMethod(
                "deleteUser",
                Long.class,
                com.koduck.security.UserPrincipal.class
        );

        Positive getIdPositive = getMethod.getParameters()[0].getAnnotation(Positive.class);
        Positive updateIdPositive = updateMethod.getParameters()[0].getAnnotation(Positive.class);
        Positive deleteIdPositive = deleteMethod.getParameters()[0].getAnnotation(Positive.class);

        assertNotNull(getIdPositive);
        assertNotNull(updateIdPositive);
        assertNotNull(deleteIdPositive);
    }
}
