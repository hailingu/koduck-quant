package com.koduck.config;

import java.lang.reflect.Field;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.lang.NonNull;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.koduck.entity.Role;
import com.koduck.entity.User;
import com.koduck.repository.credential.CredentialRepository;
import com.koduck.repository.auth.RoleRepository;
import com.koduck.repository.auth.UserRepository;
import com.koduck.repository.auth.UserRoleRepository;
import com.koduck.service.support.UserRolesTableChecker;
import com.koduck.util.CredentialEncryptionUtil;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link DataInitializer}.
 *
 * <p>The tests focus on startup control-flow branches for demo user creation,
 * including disabled mode, configuration validation, idempotent behavior when
 * the demo user already exists, and concurrent creation conflicts.</p>
 *
 * @author GitHub Copilot
 */
@ExtendWith(MockitoExtension.class)
class DataInitializerTest {

    /** Mock repository for users. */
    @Mock
    private UserRepository userRepository;

    /** Mock repository for roles. */
    @Mock
    private RoleRepository roleRepository;

    /** Mock repository for user roles. */
    @Mock
    private UserRoleRepository userRoleRepository;

    /** Mock repository for credentials. */
    @Mock
    private CredentialRepository credentialRepository;

    /** Mock password encoder. */
    @Mock
    private PasswordEncoder passwordEncoder;

    /** Mock utility for credential encryption. */
    @Mock
    private CredentialEncryptionUtil credentialEncryptionUtil;

    /** Mock checker for user roles table. */
    @Mock
    private UserRolesTableChecker userRolesTableChecker;

    /** Service under test. */
    private DataInitializer dataInitializer;

    @BeforeEach
    void setUp() {
        dataInitializer = new DataInitializer(
                userRepository,
                roleRepository,
                userRoleRepository,
                credentialRepository,
                passwordEncoder,
                credentialEncryptionUtil,
                userRolesTableChecker
        );
    }

    /**
     * Verifies that no repository operation is triggered when demo mode is disabled.
     */
    @Test
    @DisplayName("shouldSkipCreationWhenDemoDisabled")
    void shouldSkipCreationWhenDemoDisabled() {
        setField("demoEnabled", false);

        dataInitializer.run();

        verifyNoInteractions(userRepository, roleRepository,
            userRoleRepository, credentialRepository, passwordEncoder);
    }

    /**
     * Verifies that validation fails fast when demo mode is enabled but password is missing.
     */
    @Test
    @DisplayName("shouldThrowWhenDemoEnabledAndPasswordMissing")
    void shouldThrowWhenDemoEnabledAndPasswordMissing() {
        setField("demoEnabled", true);
        setField("demoUsername", "demoUser");
        setField("demoPassword", "   ");

        assertThrows(IllegalStateException.class, () -> dataInitializer.validate());
    }

    /**
     * Verifies idempotency when the demo user already exists.
     */
    @Test
    @DisplayName("shouldSkipWhenDemoUserAlreadyExists")
    void shouldSkipWhenDemoUserAlreadyExists() {
        setField("demoEnabled", true);
        setField("demoUsername", "demoUser");
        setField("demoPassword", "secure-password");

        when(userRepository.findByUsername("demoUser"))
            .thenReturn(Optional.of(new User()));

        dataInitializer.run();

        verify(userRepository, times(2)).findByUsername("demoUser");
        verify(roleRepository, never()).findByName("USER");
        verify(userRoleRepository, never()).insertUserRole(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.anyInt());
        verifyNoInteractions(credentialRepository);
        verifyNoMoreInteractions(userRepository, roleRepository,
            userRoleRepository, credentialRepository);
    }

    /**
     * Verifies concurrent creation conflicts are swallowed and startup flow does not fail.
     */
    @Test
    @DisplayName("shouldSwallowDataIntegrityViolationDuringConcurrentCreation")
    void shouldSwallowDataIntegrityViolationDuringConcurrentCreation() {
        setField("demoEnabled", true);
        setField("demoUsername", "demoUser");
        setField("demoPassword", "secure-password");

        Role role = Role.builder()
                .id(1)
                .name("USER")
                .build();

        when(userRepository.findByUsername("demoUser"))
            .thenReturn(Optional.empty());
        when(roleRepository.findByName("USER"))
            .thenReturn(Optional.of(role));
        when(passwordEncoder.encode("secure-password"))
            .thenReturn("encoded-password");
        when(userRepository.save(anyNonNullUser()))
                .thenThrow(new DataIntegrityViolationException("duplicate key"));

        assertDoesNotThrow(() -> dataInitializer.run());

        verify(userRepository, times(2)).findByUsername("demoUser");
        verify(roleRepository).findByName("USER");
        verify(userRepository).save(anyNonNullUser());
        verify(userRoleRepository, never()).insertUserRole(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.anyInt());
        verifyNoInteractions(credentialRepository);
    }

    private @NonNull User anyNonNullUser() {
        org.mockito.ArgumentMatchers.any(User.class);
        return new User();
    }

    /**
     * Reflection helper for setting private field values in the test target.
     *
     * @param fieldName field name to update
     * @param value field value
     */
    private void setField(String fieldName, Object value) {
        try {
            Field field = DataInitializer.class.getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(dataInitializer, value);
        }
        catch (ReflectiveOperationException ex) {
            throw new IllegalStateException("Failed to set field: " + fieldName, ex);
        }
    }
}
