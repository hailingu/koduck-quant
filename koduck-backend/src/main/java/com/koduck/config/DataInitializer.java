package com.koduck.config;

import com.koduck.entity.Role;
import com.koduck.entity.User;
import com.koduck.repository.RoleRepository;
import com.koduck.repository.UserRepository;
import com.koduck.repository.UserRoleRepository;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.koduck.util.ReservedUsernameValidator;
import java.util.Optional;

/**
 * Data initializer - creates a demo user when the application starts.
 * <p>
 * Demo user credentials are fully controlled via environment variables:
 * - APP_DEMO_ENABLED: Enable/disable demo user creation (default: false)
 * - APP_DEMO_USERNAME: Demo username (default: demo)
 * - APP_DEMO_PASSWORD: Demo password (required when enabled)
 */
@Slf4j
@Component
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final UserRoleRepository userRoleRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.demo.enabled:false}")
    private boolean demoEnabled;

    @Value("${app.demo.username:demo}")
    private String demoUsername;

    @Value("${app.demo.password:}")
    private String demoPassword;

    public DataInitializer(
            UserRepository userRepository,
            RoleRepository roleRepository,
            UserRoleRepository userRoleRepository,
            PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.userRoleRepository = userRoleRepository;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * Validates configuration on startup. Fails fast if demo is enabled but password is not set.
     */
    @PostConstruct
    public void validate() {
        if (demoEnabled) {
            log.info("Demo mode is enabled, username: {}", demoUsername);
            if (demoPassword == null || demoPassword.isBlank()) {
                throw new IllegalStateException(
                    "Demo mode is enabled but APP_DEMO_PASSWORD is not set. " +
                    "Please set a secure password via environment variable 'app.demo.password' or 'APP_DEMO_PASSWORD'."
                );
            }
            if (ReservedUsernameValidator.isReserved(demoUsername)) {
                log.warn("Using reserved username '{}' for demo account is not recommended", demoUsername);
            }
        } else {
            log.debug("Demo mode is disabled, skipping demo user creation");
        }
    }

    /**
     * Callback executed during application startup.
     *
     * @param args command-line arguments (ignored)
     */
    @Override
    @Transactional
    public void run(String... args) {
        if (!demoEnabled) {
            log.debug("Demo mode is disabled, skipping demo user creation");
            return;
        }

        try {
            createDemoUserIfNotExists();
        } catch (Exception e) {
            log.error("Failed to initialize demo user: {}", e.getMessage(), e);
            // do not abort startup on failure
        }
    }

    /**
     * Creates a demo user account if none exists.
     * <p>
     * The demo username and password are configurable via environment
     * variables. This method is idempotent and safe to call multiple times.
     */
    private void createDemoUserIfNotExists() {
        // check if demo user already exists
        if (userRepository.findByUsername(demoUsername).isPresent()) {
            log.debug("Demo user '{}' already exists, skipping creation", demoUsername);
            return;
        }

        // fetch USER role
        Optional<Role> userRoleOpt = roleRepository.findByName("USER");
        if (userRoleOpt.isEmpty()) {
            log.warn("USER role not found, cannot create demo user");
            return;
        }

        try {
            // create demo user
            User demoUser = new User();
            demoUser.setUsername(demoUsername);
            demoUser.setEmail("demo@koduck.local");
            demoUser.setPasswordHash(passwordEncoder.encode(demoPassword));
            demoUser.setNickname("Demo User");
            demoUser.setStatus(User.UserStatus.ACTIVE);

            demoUser = userRepository.save(demoUser);
            log.info("Created demo user: {} with id={}", demoUsername, demoUser.getId());

            // assign USER role
            userRoleRepository.insertUserRole(demoUser.getId(), userRoleOpt.get().getId());

            log.info("Successfully initialized demo user: {}", demoUsername);
        } catch (DataIntegrityViolationException e) {
            log.warn("Demo user may already exist (concurrent creation): {}", e.getMessage());
        }
    }
}
