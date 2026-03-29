package com.koduck.config;

import com.koduck.entity.Role;
import com.koduck.entity.User;
import com.koduck.repository.RoleRepository;
import com.koduck.repository.UserRepository;
import com.koduck.repository.UserRoleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.lang.reflect.Field;
import java.util.Objects;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
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
 */
@ExtendWith(MockitoExtension.class)
class DataInitializerTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private RoleRepository roleRepository;

    @Mock
    private UserRoleRepository userRoleRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JdbcTemplate jdbcTemplate;

    private DataInitializer dataInitializer;

    @BeforeEach
    void setUp() {
        dataInitializer = new DataInitializer(
                userRepository,
                roleRepository,
                userRoleRepository,
            passwordEncoder,
            jdbcTemplate
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

        verifyNoInteractions(userRepository, roleRepository, userRoleRepository, passwordEncoder);
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

        when(userRepository.findByUsername("demoUser")).thenReturn(Optional.of(new User()));

        dataInitializer.run();

        verify(userRepository).findByUsername("demoUser");
        verify(roleRepository, never()).findByName("USER");
        verify(userRoleRepository, never()).insertUserRole(org.mockito.ArgumentMatchers.anyLong(), org.mockito.ArgumentMatchers.anyInt());
        verifyNoMoreInteractions(userRepository);
    }

    /**
     * Verifies concurrent creation conflicts are swallowed and startup flow does not fail.
     */
    @Test
    @DisplayName("shouldSwallowDataIntegrityViolationDuringConcurrentCreation")
    @SuppressWarnings("null")
    void shouldSwallowDataIntegrityViolationDuringConcurrentCreation() {
        setField("demoEnabled", true);
        setField("demoUsername", "demoUser");
        setField("demoPassword", "secure-password");

        Role role = new Role();
        role.setId(1);
        role.setName("USER");

        when(userRepository.findByUsername("demoUser")).thenReturn(Optional.empty());
        when(roleRepository.findByName("USER")).thenReturn(Optional.of(role));
        when(passwordEncoder.encode("secure-password")).thenReturn("encoded-password");
        when(userRepository.save(org.mockito.ArgumentMatchers.argThat(Objects::nonNull)))
                .thenThrow(new DataIntegrityViolationException("duplicate key"));

        assertDoesNotThrow(() -> dataInitializer.run());

        verify(userRepository).findByUsername("demoUser");
        verify(roleRepository).findByName("USER");
        verify(userRepository).save(org.mockito.ArgumentMatchers.argThat(Objects::nonNull));
        verify(userRoleRepository, never()).insertUserRole(org.mockito.ArgumentMatchers.anyLong(), org.mockito.ArgumentMatchers.anyInt());
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
        } catch (ReflectiveOperationException ex) {
            throw new IllegalStateException("Failed to set field: " + fieldName, ex);
        }
    }
}