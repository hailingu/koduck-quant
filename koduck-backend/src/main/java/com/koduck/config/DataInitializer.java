package com.koduck.config;

import com.koduck.entity.Role;
import com.koduck.entity.User;
import com.koduck.entity.UserCredential;
import com.koduck.repository.CredentialRepository;
import com.koduck.repository.RoleRepository;
import com.koduck.repository.UserRepository;
import com.koduck.repository.UserRoleRepository;
import com.koduck.util.CredentialEncryptionUtil;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import com.koduck.util.ReservedUsernameValidator;
import java.util.Map;
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

    /**
     * Role name assigned to regular users.  Used when creating demo account.
     */
    private static final String ROLE_USER = "USER";
    private static final String ROLE_USER_DESCRIPTION = "Default role for regular users";

    /**
     * Default email address for the demo account.
     */
    private static final String DEMO_EMAIL = "demo@koduck.local";

    /**
     * Default nickname stored on the demo user record.
     */
    private static final String DEMO_NICKNAME = "Demo User";

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final UserRoleRepository userRoleRepository;
    private final CredentialRepository credentialRepository;
    private final PasswordEncoder passwordEncoder;
    private final JdbcTemplate jdbcTemplate;

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
            CredentialRepository credentialRepository,
            PasswordEncoder passwordEncoder,
            JdbcTemplate jdbcTemplate) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.userRoleRepository = userRoleRepository;
        this.credentialRepository = credentialRepository;
        this.passwordEncoder = passwordEncoder;
        this.jdbcTemplate = jdbcTemplate;
    }

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
            log.error("Failed to initialize demo user", e);
            // do not abort startup on failure
        }

        // 初始化环境变量中的 LLM API Key 到 user_credentials 表
        try {
            initializeLlmCredentialsFromEnv();
        } catch (Exception e) {
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
            if (hasUserRolesTable()) {
                userRoleRepository.insertUserRole(demoUser.getId(), userRole.getId());
            } else {
                log.warn("Table 'user_roles' not found, skipping demo role mapping");
            }

            log.info("Successfully initialized demo user: {}", demoUsername);
        } catch (DataIntegrityViolationException e) {
            log.warn("Demo user may already exist (concurrent creation): {}", e.getMessage());
        }
    }

    private Role getOrCreateUserRole() {
        Optional<Role> existingRole = roleRepository.findByName(ROLE_USER);
        if (existingRole.isPresent()) {
            return existingRole.get();
        }

        try {
            Role created = Role.builder()
                .name(ROLE_USER)
                .description(ROLE_USER_DESCRIPTION)
                .build();
            created = roleRepository.save(created);
            log.info("Created missing role: {}", ROLE_USER);
            return created;
        } catch (DataIntegrityViolationException e) {
            // concurrent startup: another instance may have created it
            return roleRepository.findByName(ROLE_USER)
                .orElseThrow(() -> e);
        }
    }

    private boolean hasUserRolesTable() {
        Integer count = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_roles'",
            Integer.class
        );
        return count != null && count > 0;
    }

    /**
     * 将环境变量中的 LLM API Key 初始化到 user_credentials 表
     * <p>
     * 支持的环境变量:
     * - OPENAI_API_KEY / GPT_API_KEY
     * - MINIMAX_API_KEY
     * - DEEPSEEK_API_KEY
     * - LLM_API_KEY (通用 fallback)
     * <p>
     * 对应的 API Base 环境变量:
     * - OPENAI_API_BASE
     * - MINIMAX_API_BASE
     * - DEEPSEEK_API_BASE
     * - LLM_API_BASE
     */
    private void initializeLlmCredentialsFromEnv() {
        // 查找 demo 用户或第一个可用的用户
        Optional<User> targetUser = userRepository.findByUsername(demoUsername);
        if (targetUser.isEmpty()) {
            log.warn("No demo user found, skipping LLM credentials initialization");
            return;
        }
        Long userId = targetUser.get().getId();

        // 定义要检查的 provider 及其环境变量
        Map<String, ProviderEnvConfig> providerConfigs = Map.of(
            "openai", new ProviderEnvConfig(
                System.getenv("OPENAI_API_KEY"),
                System.getenv("GPT_API_KEY"),
                firstNonBlank(System.getenv("OPENAI_API_BASE"), System.getenv("LLM_API_BASE")),
                "https://api.openai.com/v1"
            ),
            "minimax", new ProviderEnvConfig(
                System.getenv("MINIMAX_API_KEY"),
                System.getenv("LLM_API_KEY"),
                firstNonBlank(System.getenv("MINIMAX_API_BASE"), System.getenv("LLM_API_BASE")),
                "https://api.minimax.chat/v1"
            ),
            "deepseek", new ProviderEnvConfig(
                System.getenv("DEEPSEEK_API_KEY"),
                System.getenv("LLM_API_KEY"),
                firstNonBlank(System.getenv("DEEPSEEK_API_BASE"), System.getenv("LLM_API_BASE")),
                "https://api.deepseek.com/v1"
            )
        );

        int initializedCount = 0;
        for (Map.Entry<String, ProviderEnvConfig> entry : providerConfigs.entrySet()) {
            String provider = entry.getKey();
            ProviderEnvConfig config = entry.getValue();
            
            // 获取实际的 API Key（优先特定 provider，其次通用）
            String apiKey = firstNonBlank(config.specificKey(), config.fallbackKey());
            if (!StringUtils.hasText(apiKey)) {
                log.debug("No API key found for provider: {}", provider);
                continue;
            }
            
            // 记录原始 API Key 信息（只打印长度和前 8 位，不打印完整 key）
            log.info("Found API key for provider: {}, length: {}, prefix: {}...", 
                provider, apiKey.length(), 
                apiKey.substring(0, Math.min(8, apiKey.length())));

            // 检查是否已存在该 provider 的凭证
            long count = credentialRepository.countByUserIdAndProvider(userId, provider);
            if (count > 0) {
                log.debug("Credential already exists for provider: {}, userId: {}", provider, userId);
                continue;
            }

            try {
                // 加密 API Key
                log.debug("Encrypting API key for provider: {}, original length: {}", provider, apiKey.length());
                String encryptedKey = CredentialEncryptionUtil.encrypt(apiKey);
                log.debug("Encrypted API key length: {}", encryptedKey.length());
                
                // 验证加密/解密一致性（测试用）
                String decryptedTest = CredentialEncryptionUtil.decrypt(encryptedKey);
                if (!apiKey.equals(decryptedTest)) {
                    log.error("Encryption verification failed for provider: {}. Original length: {}, Decrypted length: {}", 
                        provider, apiKey.length(), decryptedTest.length());
                    continue;
                }
                
                // 确定 API Base
                String apiBase = firstNonBlank(config.apiBase(), config.defaultBase());
                
                // 创建凭证实体
                UserCredential credential = UserCredential.builder()
                    .userId(userId)
                    .name(provider.toUpperCase() + " API Key (Auto)")
                    .type(UserCredential.CredentialType.AI_PROVIDER)
                    .provider(provider)
                    .apiKeyEncrypted(encryptedKey)
                    .environment(UserCredential.Environment.live)
                    .isActive(true)
                    .additionalConfig(apiBase != null ? Map.of("apiBase", apiBase) : Map.of())
                    .lastVerifiedStatus(UserCredential.VerificationStatus.PENDING)
                    .build();

                credentialRepository.save(credential);
                initializedCount++;
                log.info("Initialized LLM credential from environment: provider={}, userId={}", provider, userId);
            } catch (Exception e) {
                log.error("Failed to initialize credential for provider: {}", provider, e);
            }
        }

        if (initializedCount > 0) {
            log.info("Successfully initialized {} LLM credential(s) from environment variables", initializedCount);
        } else {
            log.debug("No new LLM credentials to initialize from environment");
        }
    }

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
     * Provider 环境变量配置记录
     */
    private record ProviderEnvConfig(
        String specificKey,    // 特定 provider 的 key，如 OPENAI_API_KEY
        String fallbackKey,    // fallback key，如 LLM_API_KEY
        String apiBase,        // API base URL
        String defaultBase     // 默认 base URL
    ) {}
}
