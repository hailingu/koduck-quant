package com.koduck.config;

import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import jakarta.annotation.PostConstruct;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import com.koduck.common.constants.RoleConstants;
import com.koduck.entity.auth.Role;
import com.koduck.entity.auth.User;
import com.koduck.entity.auth.UserCredential;
import com.koduck.repository.credential.CredentialRepository;
import com.koduck.repository.auth.RoleRepository;
import com.koduck.repository.auth.UserRepository;
import com.koduck.repository.auth.UserRoleRepository;
import com.koduck.service.support.UserRolesTableChecker;
import com.koduck.util.CredentialEncryptionUtil;
import com.koduck.util.ReservedUsernameValidator;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Data initializer - creates a demo user when the application starts.
 * <p>
 * Demo user credentials are fully controlled via environment variables:
 * - APP_DEMO_ENABLED: Enable/disable demo user creation (default: false)
 * - APP_DEMO_USERNAME: Demo username (default: demo)
 * - APP_DEMO_PASSWORD: Demo password (required when enabled)
 *
 * @author GitHub Copilot
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {
    /**
     * Default email address for the demo account.
     */
    private static final String DEMO_EMAIL = "demo@koduck.local";
    /**
     * Default nickname stored on the demo user record.
     */
    private static final String DEMO_NICKNAME = "Demo User";

    /**
     * Environment variable name for LLM API base URL.
     */
    private static final String ENV_LLM_API_BASE = "LLM_API_BASE";

    /**
     * Repository for user operations.
     */
    private final UserRepository userRepository;

    /**
     * Repository for role operations.
     */
    private final RoleRepository roleRepository;

    /**
     * Repository for user role operations.
     */
    private final UserRoleRepository userRoleRepository;

    /**
     * Repository for credential operations.
     */
    private final CredentialRepository credentialRepository;

    /**
     * Password encoder for hashing passwords.
     */
    private final PasswordEncoder passwordEncoder;

    /**
     * Utility for credential encryption.
     */
    private final CredentialEncryptionUtil credentialEncryptionUtil;

    /**
     * Checker for user roles table existence.
     */
    private final UserRolesTableChecker userRolesTableChecker;

    /**
     * Flag to enable/disable demo mode.
     */
    @Value("${app.demo.enabled:false}")
    private boolean demoEnabled;

    /**
     * Demo username configuration.
     */
    @Value("${app.demo.username:demo}")
    private String demoUsername;

    /**
     * Demo password configuration.
     */
    @Value("${app.demo.password:}")
    private String demoPassword;

    /**
     * Validates configuration on startup. Fails fast if demo is enabled but password is not set.
     */
    @PostConstruct
    public void validate() {
        if (!demoEnabled) {
            log.debug("Demo mode is disabled, skipping demo user creation");
            return;
        }
        log.info("Demo mode is enabled, username: {}", demoUsername);
        if (!StringUtils.hasText(demoPassword)) {
            throw new IllegalStateException(
                "Demo mode is enabled but APP_DEMO_PASSWORD is not set. " +
                "Please set a secure password via environment variable 'app.demo.password' or 'APP_DEMO_PASSWORD'."
            );
        }
        if (ReservedUsernameValidator.isReserved(demoUsername)) {
            log.warn("Using reserved username '{}' for demo account is not recommended", demoUsername);
        }
    }

    /**
     * Callback executed during application startup.
     * <p>
     * When demo mode is enabled, attempts to create the demo user and initialize
     * LLM credentials from environment variables.
     * </p>
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
        }
        catch (Exception e) {
            log.error("Failed to initialize demo user", e);
            // do not abort startup on failure
        }
        // Initialize LLM API keys from environment variables into user_credentials table
        try {
            initializeLlmCredentialsFromEnv();
        }
        catch (Exception e) {
            log.error("Failed to initialize LLM credentials from environment", e);
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
        // fetch (or create) USER role
        Role userRole = getOrCreateUserRole();
        try {
            // create demo user
            User demoUser = new User();
            demoUser.setUsername(demoUsername);
            demoUser.setEmail(DEMO_EMAIL);
            demoUser.setPasswordHash(passwordEncoder.encode(demoPassword));
            demoUser.setNickname(DEMO_NICKNAME);
            demoUser.setStatus(User.UserStatus.ACTIVE);
            demoUser = userRepository.save(demoUser);
            log.info("Created demo user: {} with id={}", demoUsername, demoUser.getId());
            // assign USER role when join table exists
            if (userRolesTableChecker.hasUserRolesTable()) {
                userRoleRepository.insertUserRole(demoUser.getId(), userRole.getId());
            }
            else {
                log.warn("Table 'user_roles' not found, skipping demo role mapping");
            }
            log.info("Successfully initialized demo user: {}", demoUsername);
        }
        catch (DataIntegrityViolationException e) {
            log.warn("Demo user may already exist (concurrent creation): {}", e.getMessage());
        }
    }

    /**
     * Retrieves the "USER" role, creating it if missing.
     *
     * @return the user role entity
     */
    private Role getOrCreateUserRole() {
        Optional<Role> existingRole = roleRepository.findByName(RoleConstants.DEFAULT_USER_ROLE_NAME);
        if (existingRole.isPresent()) {
            return existingRole.get();
        }
        try {
            Role created = Objects.requireNonNull(
                Role.builder()
                    .name(RoleConstants.DEFAULT_USER_ROLE_NAME)
                    .description(RoleConstants.DEFAULT_USER_ROLE_DESCRIPTION)
                    .build(),
                "Role entity must not be null"
            );
            roleRepository.save(created);
            log.info("Created missing role: {}", RoleConstants.DEFAULT_USER_ROLE_NAME);
            return created;
        }
        catch (DataIntegrityViolationException e) {
            // concurrent startup: another instance may have created it
            return roleRepository.findByName(RoleConstants.DEFAULT_USER_ROLE_NAME)
                .orElseThrow(() -> e);
        }
    }

    /**
     * Initializes LLM provider credentials from environment variables.
     * <p>
     * Supports per-provider and fallback keys/base URLs. For each provider,
     * checks if an existing credential exists for demo user before creating.
     * </p>
     */
    private void initializeLlmCredentialsFromEnv() {
        // Find demo user or available user
        Optional<User> targetUser = userRepository.findByUsername(demoUsername);
        if (targetUser.isEmpty()) {
            log.warn("No demo user found, skipping LLM credentials initialization");
            return;
        }

        Long userId = targetUser.get().getId();

        // Define provider and its environment variables to check
        Map<String, ProviderEnvConfig> providerConfigs = buildProviderConfigs();
        int initializedCount = 0;
        for (Map.Entry<String, ProviderEnvConfig> entry : providerConfigs.entrySet()) {
            String provider = entry.getKey();
            ProviderEnvConfig config = entry.getValue();
            // Obtain effective API key (provider-specific first, fallback second)
            String apiKey = firstNonBlank(config.specificKey(), config.fallbackKey());
            if (!StringUtils.hasText(apiKey)) {
                log.debug("No API key found for provider: {}", provider);
                continue;
            }

            // Security note: only log length, do not reveal key material
            log.info("Found API key for provider: {}, length={}", provider, apiKey.length());

            // Check whether a credential already exists for this provider
            long count = credentialRepository.countByUserIdAndProvider(userId, provider);
            if (count > 0) {
                log.debug("Credential already exists for provider: {}, userId: {}", provider, userId);
            }
            else {
                initializedCount = createCredential(userId, provider, apiKey, config, initializedCount);
            }
        }

        if (initializedCount > 0) {
            log.info("Successfully initialized {} LLM credential(s) from environment variables", initializedCount);
        }
        else {
            log.debug("No new LLM credentials to initialize from environment");
        }
    }

    /**
     * Builds provider configurations map.
     *
     * @return map of provider name to environment configuration
     */
    private Map<String, ProviderEnvConfig> buildProviderConfigs() {
        return Map.of(
            "openai", new ProviderEnvConfig(
                System.getenv("OPENAI_API_KEY"),
                System.getenv("GPT_API_KEY"),
                firstNonBlank(System.getenv("OPENAI_API_BASE"), System.getenv(ENV_LLM_API_BASE)),
                "https://api.openai.com/v1"
            ),
            "minimax", new ProviderEnvConfig(
                System.getenv("MINIMAX_API_KEY"),
                System.getenv("LLM_API_KEY"),
                firstNonBlank(System.getenv("MINIMAX_API_BASE"), System.getenv(ENV_LLM_API_BASE)),
                "https://api.minimax.chat/v1"
            ),
            "deepseek", new ProviderEnvConfig(
                System.getenv("DEEPSEEK_API_KEY"),
                System.getenv("LLM_API_KEY"),
                firstNonBlank(System.getenv("DEEPSEEK_API_BASE"), System.getenv(ENV_LLM_API_BASE)),
                "https://api.deepseek.com/v1"
            )
        );
    }

    /**
     * Creates a credential for the specified provider.
     *
     * @param userId the user id
     * @param provider the provider name
     * @param apiKey the API key
     * @param config the provider environment configuration
     * @param currentCount current initialized count
     * @return updated initialized count
     */
    private int createCredential(Long userId, String provider, String apiKey,
                                  ProviderEnvConfig config, int currentCount) {
        try {
            // Encrypt API key
            log.debug("Encrypting API key for provider: {}, original length: {}", provider, apiKey.length());
            String encryptedKey = credentialEncryptionUtil.encrypt(apiKey);
            log.debug("Encrypted API key length: {}", encryptedKey.length());

            // Determine API base URL
            String apiBase = firstNonBlank(config.apiBase(), config.defaultBase());

            // Build credential entity
            UserCredential credential = Objects.requireNonNull(
                UserCredential.builder()
                    .userId(userId)
                    .name(provider.toUpperCase(Locale.ROOT) + " API Key (Auto)")
                    .type(UserCredential.CredentialType.AI_PROVIDER)
                    .provider(provider)
                    .apiKeyEncrypted(encryptedKey)
                    .environment(UserCredential.Environment.LIVE)
                    .isActive(true)
                    .additionalConfig(apiBase != null ? Map.of("apiBase", apiBase) : Map.of())
                    .lastVerifiedStatus(UserCredential.VerificationStatus.PENDING)
                    .build(),
                "UserCredential entity must not be null"
            );
            credentialRepository.save(credential);
            log.info("Initialized LLM credential from environment: provider={}, userId={}", provider, userId);
            return currentCount + 1;
        }
        catch (Exception e) {
            log.error("Failed to initialize credential for provider: {}", provider, e);
            return currentCount;
        }
    }

    /**
     * Returns the first non-blank value from the provided candidates.
     *
     * @param values candidate values
     * @return first trimmed non-blank value, or null when all values are blank/null
     */
    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (StringUtils.hasText(value)) {
                return value.trim();
            }
        }
        return null;
    }

    /**
     * Provider environment variable configuration holder.
     *
     * @param specificKey provider-specific API key from environment
     * @param fallbackKey fallback API key from environment
     * @param apiBase resolved API base URL from environment
     * @param defaultBase default API base URL for provider
     */
    private record ProviderEnvConfig(
        String specificKey,
        String fallbackKey,
        String apiBase,
        String defaultBase
    ) {}
}
