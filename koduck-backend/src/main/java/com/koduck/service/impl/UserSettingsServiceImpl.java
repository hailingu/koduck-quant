package com.koduck.service.impl;

import com.koduck.dto.settings.UpdateNotificationRequest;
import com.koduck.dto.settings.UpdateSettingsRequest;
import com.koduck.dto.settings.UserSettingsDto;
import com.koduck.entity.UserCredential;
import com.koduck.entity.UserSettings;
import com.koduck.mapper.UserSettingsMapper;
import com.koduck.repository.CredentialRepository;
import com.koduck.repository.UserSettingsRepository;
import com.koduck.service.UserSettingsService;
import com.koduck.util.CredentialEncryptionUtil;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 用户设置服务实现类
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class UserSettingsServiceImpl implements UserSettingsService {

    private static final String PROVIDER_MINIMAX = "minimax";
    private static final String PROVIDER_DEEPSEEK = "deepseek";
    private static final String PROVIDER_OPENAI = "openai";
    private static final String SOURCE_CREDENTIALS = "credentials";
    private static final String SOURCE_USER_SETTINGS = "user_settings";
    private static final String SOURCE_DEFAULT = "default";
    private static final String SOURCE_ENV_LLM_API_KEY = "env:LLM_API_KEY";
    private static final String SOURCE_ENV_LLM_API_BASE = "env:LLM_API_BASE";
    private static final String ENV_LLM_API_KEY = "LLM_API_KEY";
    private static final String ENV_LLM_API_BASE = "LLM_API_BASE";
    private static final String DEFAULT_API_BASE_MINIMAX = "https://api.minimax.chat/v1";
    private static final Set<String> SUPPORTED_LLM_PROVIDERS =
        Set.of(PROVIDER_MINIMAX, PROVIDER_DEEPSEEK, PROVIDER_OPENAI);
    private static final Set<String> SUPPORTED_MEMORY_MODES = Set.of("L0", "L1", "L2", "L3");

    private final UserSettingsRepository settingsRepository;

    private final CredentialRepository credentialRepository;

    private final Environment environment;

    private final CredentialEncryptionUtil credentialEncryptionUtil;

    private final UserSettingsMapper userSettingsMapper;

    /**
     * 获取用户设置
     */
    @Override
    @Transactional
    public UserSettingsDto getSettings(Long userId) {
        log.debug("Getting settings for user: {}", userId);
        UserSettings settings = findOrCreateSettings(userId);
        return convertToDto(settings);
    }
    /**
     * 更新用户设置
     */
    @Override
    @Transactional
    public UserSettingsDto updateSettings(Long userId, UpdateSettingsRequest request) {
        log.debug("Updating settings for user: {}", userId);
        UserSettings settings = findOrCreateSettings(userId);
        userSettingsMapper.updateBasicFields(request, settings);
        applyNotificationConfig(settings, request);
        applyTradingConfig(settings, request);
        applyDisplayConfig(settings, request);
        applyLlmConfig(settings, request.getLlmConfig());
        applyQuickLinks(settings, request);

        UserSettings saved = settingsRepository.save(Objects.requireNonNull(settings, "settings must not be null"));
        return convertToDto(saved);
    }

    private void applyNotificationConfig(UserSettings settings, UpdateSettingsRequest request) {
        if (request.getNotification() != null) {
            settings.setNotificationConfig(userSettingsMapper.toNotificationConfig(request.getNotification()));
        }
    }

    private void applyTradingConfig(UserSettings settings, UpdateSettingsRequest request) {
        if (request.getTrading() != null) {
            settings.setTradingConfig(userSettingsMapper.toTradingConfig(request.getTrading()));
        }
    }

    private void applyDisplayConfig(UserSettings settings, UpdateSettingsRequest request) {
        if (request.getDisplay() != null) {
            settings.setDisplayConfig(userSettingsMapper.toDisplayConfig(request.getDisplay()));
        }
    }

    private void applyQuickLinks(UserSettings settings, UpdateSettingsRequest request) {
        if (request.getQuickLinks() != null) {
            settings.setQuickLinks(userSettingsMapper.toQuickLinks(request.getQuickLinks()));
        }
    }

    private void applyLlmConfig(UserSettings settings, UpdateSettingsRequest.LlmConfigDto requestConfig) {
        if (requestConfig == null) {
            return;
        }
        UserSettings.LlmConfig current = settings.getLlmConfig() != null
            ? settings.getLlmConfig()
            : new UserSettings.LlmConfig();
        String activeProvider = normalizeLlmProvider(firstNonBlank(requestConfig.getProvider(), current.getProvider()));
        current.setProvider(activeProvider);
        current.setMinimax(mergeProviderConfig(current.getMinimax(), requestConfig.getMinimax()));
        current.setDeepseek(mergeProviderConfig(current.getDeepseek(), requestConfig.getDeepseek()));
        current.setOpenai(mergeProviderConfig(current.getOpenai(), requestConfig.getOpenai()));
        current.setMemory(mergeMemoryConfig(current.getMemory(), requestConfig.getMemory()));
        if (requestConfig.getApiKey() != null || requestConfig.getApiBase() != null) {
            UserSettings.ProviderConfig existing = getProviderConfig(current, activeProvider);
            UserSettings.ProviderConfig legacyMerged = mergeLegacyProviderConfig(requestConfig, existing);
            setProviderConfig(current, activeProvider, legacyMerged);
        }
        UserSettings.ProviderConfig activeConfig = getProviderConfig(current, activeProvider);
        current.setApiKey(normalizeBlank(activeConfig == null ? null : activeConfig.getApiKey()));
        current.setApiBase(normalizeBlank(activeConfig == null ? null : activeConfig.getApiBase()));
        settings.setLlmConfig(current);
    }

    private UserSettings.ProviderConfig mergeLegacyProviderConfig(
        UpdateSettingsRequest.LlmConfigDto requestConfig,
        UserSettings.ProviderConfig existingConfig) {
        String existingApiKey = normalizeBlank(existingConfig == null ? null : existingConfig.getApiKey());
        String existingApiBase = normalizeBlank(existingConfig == null ? null : existingConfig.getApiBase());
        String mergedApiKey = requestConfig.getApiKey() != null
            ? normalizeBlank(requestConfig.getApiKey())
            : existingApiKey;
        String mergedApiBase = requestConfig.getApiBase() != null
            ? normalizeBlank(requestConfig.getApiBase())
            : existingApiBase;
        return UserSettings.ProviderConfig.builder()
            .apiKey(mergedApiKey)
            .apiBase(mergedApiBase)
            .build();
    }
    /**
     * 更新主题设置
     */
    @Override
    @Transactional
    public UserSettingsDto updateTheme(Long userId, String theme) {
        log.debug("Updating theme for user: {}, theme: {}", userId, theme);
        UserSettings settings = findOrCreateSettings(userId);
        settings.setTheme(theme);
        UserSettings saved = settingsRepository.save(settings);
        return convertToDto(saved);
    }
    /**
     * 更新通知设置
     */
    @Override
    @Transactional
    public UserSettingsDto updateNotification(Long userId, UpdateNotificationRequest request) {
        log.debug("Updating notification settings for user: {}", userId);
        UserSettings settings = findOrCreateSettings(userId);
        UserSettings.NotificationConfig config = settings.getNotificationConfig();
        if (config == null) {
            config = new UserSettings.NotificationConfig();
        }
        userSettingsMapper.updateNotificationConfig(request, config);
        settings.setNotificationConfig(config);
        UserSettings saved = settingsRepository.save(settings);
        return convertToDto(saved);
    }
    /**
     * 创建默认设置
     */
    private UserSettings createDefaultSettings(Long userId) {
        log.debug("Creating default settings for user: {}", userId);
        UserSettings settings = UserSettings.builder()
            .userId(userId)
            .theme("light")
            .language("zh-CN")
            .timezone("Asia/Shanghai")
            .notificationConfig(new UserSettings.NotificationConfig())
            .tradingConfig(new UserSettings.TradingConfig())
            .displayConfig(new UserSettings.DisplayConfig())
            .llmConfig(UserSettings.LlmConfig.builder()
                .provider(PROVIDER_MINIMAX)
                .minimax(new UserSettings.ProviderConfig())
                .deepseek(new UserSettings.ProviderConfig())
                .openai(new UserSettings.ProviderConfig())
                .memory(UserSettings.MemoryConfig.builder()
                    .enabled(true)
                    .mode("L0")
                    .enableL1(true)
                    .enableL2(true)
                    .enableL3(true)
                    .build())
                .build())
            .quickLinks(List.of(
                UserSettings.QuickLink.builder()
                    .id(1L)
                    .name("自选股")
                    .icon("Star")
                    .path("/watchlist")
                    .sortOrder(1)
                    .build(),
                UserSettings.QuickLink.builder()
                    .id(2L)
                    .name("投资组合")
                    .icon("PieChart")
                    .path("/portfolio")
                    .sortOrder(2)
                    .build()
            ))
            .build();
        return settingsRepository.save(Objects.requireNonNull(settings, "settings must not be null"));
    }
    /**
     * 转换为 DTO
     */
    private UserSettingsDto convertToDto(UserSettings settings) {
        UserSettingsDto dto = userSettingsMapper.toDto(settings);
        dto.setLlmConfig(resolveLlmConfig(settings.getLlmConfig()));
        return dto;
    }
    @Override
    @Transactional
    public UserSettingsDto.LlmConfigDto getEffectiveLlmConfig(Long userId, String provider) {
        UserSettings settings = findOrCreateSettings(userId);
        UserSettings.LlmConfig llmConfig = settings.getLlmConfig();
        if (llmConfig == null) {
            llmConfig = new UserSettings.LlmConfig();
        }
        String activeProvider = normalizeLlmProvider(firstNonBlank(provider, llmConfig.getProvider()));
        llmConfig.setProvider(activeProvider);
        // 1. 优先从 user_credentials 表读取加密的 LLM API Key
        String credentialsApiKey = getLlmApiKeyFromCredentials(userId, activeProvider);
        String credentialsApiBase = getLlmApiBaseFromCredentials(userId, activeProvider);
        UserSettings.ProviderConfig providerConfig = getProviderConfig(llmConfig, activeProvider);
        String legacyProvider = normalizeLlmProvider(llmConfig.getProvider());
        String legacyApiKey = legacyProvider.equals(activeProvider) ? normalizeBlank(llmConfig.getApiKey()) : null;
        String legacyApiBase = legacyProvider.equals(activeProvider) ? normalizeBlank(llmConfig.getApiBase()) : null;
        // 2. 从 user_settings 表读取（作为 fallback）
        String settingsApiKey = firstNonBlank(
            normalizeBlank(providerConfig != null ? providerConfig.getApiKey() : null),
            legacyApiKey
        );
        String settingsApiBase = firstNonBlank(
            normalizeBlank(providerConfig != null ? providerConfig.getApiBase() : null),
            legacyApiBase
        );
        // 3. 优先级：credentials > user_settings > 环境变量
        ResolvedValue apiKeyResolved;
        ResolvedValue apiBaseResolved;
        if (PROVIDER_MINIMAX.equals(activeProvider)) {
            apiKeyResolved = pickFirstNonBlank(
                resolved(SOURCE_CREDENTIALS, credentialsApiKey), // 优先：user_credentials 表（加密存储）
                resolved(SOURCE_USER_SETTINGS, settingsApiKey),  // 其次：user_settings 表
                resolved("env:MINIMAX_API_KEY", environment.getProperty("MINIMAX_API_KEY")),
                resolved(SOURCE_ENV_LLM_API_KEY, environment.getProperty(ENV_LLM_API_KEY))
            );
            apiBaseResolved = pickFirstNonBlank(
                resolved(SOURCE_CREDENTIALS, credentialsApiBase), // 优先：user_credentials 表
                resolved(SOURCE_USER_SETTINGS, settingsApiBase),  // 其次：user_settings 表
                resolved("env:MINIMAX_API_BASE", environment.getProperty("MINIMAX_API_BASE")),
                resolved(SOURCE_ENV_LLM_API_BASE, environment.getProperty(ENV_LLM_API_BASE)),
                resolved(SOURCE_DEFAULT, defaultApiBaseForProvider(activeProvider))
            );
        } else if (PROVIDER_OPENAI.equals(activeProvider)) {
            apiKeyResolved = pickFirstNonBlank(
                resolved(SOURCE_CREDENTIALS, credentialsApiKey), // 优先：user_credentials 表
                resolved(SOURCE_USER_SETTINGS, settingsApiKey),  // 其次：user_settings 表
                resolved("env:OPENAI_API_KEY", environment.getProperty("OPENAI_API_KEY")),
                resolved("env:GPT_API_KEY", environment.getProperty("GPT_API_KEY")),
                resolved(SOURCE_ENV_LLM_API_KEY, environment.getProperty(ENV_LLM_API_KEY))
            );
            apiBaseResolved = pickFirstNonBlank(
                resolved(SOURCE_CREDENTIALS, credentialsApiBase), // 优先：user_credentials 表
                resolved(SOURCE_USER_SETTINGS, settingsApiBase),  // 其次：user_settings 表
                resolved("env:OPENAI_API_BASE", environment.getProperty("OPENAI_API_BASE")),
                resolved(SOURCE_ENV_LLM_API_BASE, environment.getProperty(ENV_LLM_API_BASE)),
                resolved(SOURCE_DEFAULT, defaultApiBaseForProvider(activeProvider))
            );
        } else if (PROVIDER_DEEPSEEK.equals(activeProvider)) {
            apiKeyResolved = pickFirstNonBlank(
                resolved(SOURCE_CREDENTIALS, credentialsApiKey), // 优先：user_credentials 表
                resolved(SOURCE_USER_SETTINGS, settingsApiKey),  // 其次：user_settings 表
                resolved("env:DEEPSEEK_API_KEY", environment.getProperty("DEEPSEEK_API_KEY")),
                resolved(SOURCE_ENV_LLM_API_KEY, environment.getProperty(ENV_LLM_API_KEY))
            );
            apiBaseResolved = pickFirstNonBlank(
                resolved(SOURCE_CREDENTIALS, credentialsApiBase), // 优先：user_credentials 表
                resolved(SOURCE_USER_SETTINGS, settingsApiBase),  // 其次：user_settings 表
                resolved("env:DEEPSEEK_API_BASE", environment.getProperty("DEEPSEEK_API_BASE")),
                resolved(SOURCE_ENV_LLM_API_BASE, environment.getProperty(ENV_LLM_API_BASE)),
                resolved(SOURCE_DEFAULT, defaultApiBaseForProvider(activeProvider))
            );
        } else {
            // 其他 provider，使用通用 fallback
            apiKeyResolved = pickFirstNonBlank(
                resolved(SOURCE_CREDENTIALS, credentialsApiKey),
                resolved(SOURCE_USER_SETTINGS, settingsApiKey),
                resolved(SOURCE_ENV_LLM_API_KEY, environment.getProperty(ENV_LLM_API_KEY))
            );
            apiBaseResolved = pickFirstNonBlank(
                resolved(SOURCE_CREDENTIALS, credentialsApiBase),
                resolved(SOURCE_USER_SETTINGS, settingsApiBase),
                resolved(SOURCE_ENV_LLM_API_BASE, environment.getProperty(ENV_LLM_API_BASE)),
                resolved(SOURCE_DEFAULT, defaultApiBaseForProvider(activeProvider))
            );
        }
        log.info(
            "Resolved LLM config: userId={}, provider={}, apiKeySource={}, apiKeyMasked={}, apiBaseSource={}, apiBase={}",
            userId,
            activeProvider,
            apiKeyResolved.source(),
            CredentialEncryptionUtil.maskApiKey(apiKeyResolved.value()),
            apiBaseResolved.source(),
            apiBaseResolved.value() == null ? "" : apiBaseResolved.value()
        );
        return UserSettingsDto.LlmConfigDto.builder()
            .provider(activeProvider)
            .apiKey(apiKeyResolved.value())
            .apiBase(apiBaseResolved.value())
            .minimax(resolveProviderConfig(PROVIDER_MINIMAX, llmConfig))
            .deepseek(resolveProviderConfig(PROVIDER_DEEPSEEK, llmConfig))
            .openai(resolveProviderConfig(PROVIDER_OPENAI, llmConfig))
            .memory(resolveMemoryConfig(llmConfig.getMemory()))
            .build();
    }
    private UserSettingsDto.LlmConfigDto resolveLlmConfig(UserSettings.LlmConfig config) {
        UserSettings.LlmConfig source = config == null ? new UserSettings.LlmConfig() : config;
        String provider = normalizeLlmProvider(source.getProvider());
        UserSettingsDto.ProviderConfigDto minimax = resolveProviderConfig(PROVIDER_MINIMAX, source);
        UserSettingsDto.ProviderConfigDto deepseek = resolveProviderConfig(PROVIDER_DEEPSEEK, source);
        UserSettingsDto.ProviderConfigDto openai = resolveProviderConfig(PROVIDER_OPENAI, source);
        UserSettingsDto.ProviderConfigDto active = switch (provider) {
            case PROVIDER_DEEPSEEK -> deepseek;
            case PROVIDER_OPENAI -> openai;
            case PROVIDER_MINIMAX -> minimax;
            default -> minimax;
        };
        return UserSettingsDto.LlmConfigDto.builder()
            .provider(provider)
            .apiKey(active.getApiKey())
            .apiBase(active.getApiBase())
            .minimax(minimax)
            .deepseek(deepseek)
            .openai(openai)
            .memory(resolveMemoryConfig(source.getMemory()))
            .build();
    }
    private UserSettings.ProviderConfig mergeProviderConfig(
            UserSettings.ProviderConfig existing,
            UpdateSettingsRequest.ProviderConfigDto incoming) {
        UserSettings.ProviderConfig base = existing != null ? existing : new UserSettings.ProviderConfig();
        if (incoming == null) {
            return base;
        }
        return UserSettings.ProviderConfig.builder()
            .apiKey(incoming.getApiKey() != null ? normalizeBlank(incoming.getApiKey()) : normalizeBlank(base.getApiKey()))
            .apiBase(incoming.getApiBase() != null ? normalizeBlank(incoming.getApiBase()) : normalizeBlank(base.getApiBase()))
            .build();
    }
    private UserSettings.MemoryConfig mergeMemoryConfig(
            UserSettings.MemoryConfig existing,
            UpdateSettingsRequest.MemoryConfigDto incoming) {
        UserSettings.MemoryConfig base = existing != null
            ? existing
            : UserSettings.MemoryConfig.builder()
                .enabled(true)
                .mode("L0")
                .enableL1(true)
                .enableL2(true)
                .enableL3(true)
                .build();
        if (incoming == null) {
            return base;
        }
        String mode = incoming.getMode() != null ? normalizeMemoryMode(incoming.getMode()) : normalizeMemoryMode(base.getMode());
        Boolean modeEnableL1 = base.getEnableL1();
        Boolean modeEnableL2 = base.getEnableL2();
        Boolean modeEnableL3 = base.getEnableL3();
        if (incoming.getMode() != null) {
            modeEnableL1 = true;
            modeEnableL2 = !"L1".equals(mode);
            modeEnableL3 = "L0".equals(mode) || "L3".equals(mode);
        }
        return UserSettings.MemoryConfig.builder()
            .enabled(incoming.getEnabled() != null ? incoming.getEnabled() : defaultBoolean(base.getEnabled(), true))
            .mode(mode)
            .enableL1(incoming.getEnableL1() != null ? incoming.getEnableL1() : defaultBoolean(modeEnableL1, true))
            .enableL2(incoming.getEnableL2() != null ? incoming.getEnableL2() : defaultBoolean(modeEnableL2, true))
            .enableL3(incoming.getEnableL3() != null ? incoming.getEnableL3() : defaultBoolean(modeEnableL3, true))
            .build();
    }
    private UserSettings.ProviderConfig getProviderConfig(UserSettings.LlmConfig config, String provider) {
        if (config == null) {
            return null;
        }
        return switch (provider) {
            case PROVIDER_DEEPSEEK -> config.getDeepseek();
            case PROVIDER_OPENAI -> config.getOpenai();
            case PROVIDER_MINIMAX -> config.getMinimax();
            default -> config.getMinimax();
        };
    }
    private void setProviderConfig(UserSettings.LlmConfig config, String provider, UserSettings.ProviderConfig value) {
        if (config == null) {
            return;
        }
        switch (provider) {
            case PROVIDER_DEEPSEEK -> config.setDeepseek(value);
            case PROVIDER_OPENAI -> config.setOpenai(value);
            case PROVIDER_MINIMAX -> config.setMinimax(value);
            default -> config.setMinimax(value);
        }
    }
    private UserSettingsDto.ProviderConfigDto resolveProviderConfig(String provider, UserSettings.LlmConfig config) {
        UserSettings.ProviderConfig settingsProviderConfig = getProviderConfig(config, provider);
        // 兼容旧 provider 配置：如果 provider 匹配，从 apiKey/apiBase 字段读取到对应 provider
        String legacyProvider = normalizeLlmProvider(config != null ? config.getProvider() : null);
        String legacyApiKey = resolveLegacyValue(config, legacyProvider.equals(provider), true);
        String legacyApiBase = resolveLegacyValue(config, legacyProvider.equals(provider), false);
        String settingsApiKey = normalizeBlank(settingsProviderConfig != null ? settingsProviderConfig.getApiKey() : null);
        String settingsApiBase = normalizeBlank(settingsProviderConfig != null ? settingsProviderConfig.getApiBase() : null);
        String apiKey;
        String apiBase;
        switch (provider) {
            case PROVIDER_OPENAI:
                apiKey = firstNonBlank(
                    settingsApiKey,
                    legacyApiKey,
                    environment.getProperty("OPENAI_API_KEY"),
                    environment.getProperty("GPT_API_KEY"),
                    environment.getProperty(ENV_LLM_API_KEY)
                );
                apiBase = firstNonBlank(
                    settingsApiBase,
                    legacyApiBase,
                    environment.getProperty("OPENAI_API_BASE"),
                    environment.getProperty(ENV_LLM_API_BASE),
                    "https://api.openai.com/v1"
                );
                break;
            case PROVIDER_DEEPSEEK:
                apiKey = firstNonBlank(
                    settingsApiKey,
                    legacyApiKey,
                    environment.getProperty("DEEPSEEK_API_KEY"),
                    environment.getProperty(ENV_LLM_API_KEY)
                );
                apiBase = firstNonBlank(
                    settingsApiBase,
                    legacyApiBase,
                    environment.getProperty("DEEPSEEK_API_BASE"),
                    environment.getProperty(ENV_LLM_API_BASE),
                    "https://api.deepseek.com/v1"
                );
                break;
            case PROVIDER_MINIMAX:
            default:
                apiKey = firstNonBlank(
                    settingsApiKey,
                    legacyApiKey,
                    environment.getProperty("MINIMAX_API_KEY"),
                    environment.getProperty(ENV_LLM_API_KEY)
                );
                apiBase = firstNonBlank(
                    settingsApiBase,
                    legacyApiBase,
                    environment.getProperty("MINIMAX_API_BASE"),
                    environment.getProperty(ENV_LLM_API_BASE),
                    DEFAULT_API_BASE_MINIMAX
                );
                break;
        }
        return UserSettingsDto.ProviderConfigDto.builder()
            .apiKey(apiKey)
            .apiBase(apiBase)
            .build();
    }
    private UserSettingsDto.MemoryConfigDto resolveMemoryConfig(UserSettings.MemoryConfig config) {
        UserSettings.MemoryConfig source = config != null
            ? config
            : UserSettings.MemoryConfig.builder()
                .enabled(true)
                .mode("L0")
                .enableL1(true)
                .enableL2(true)
                .enableL3(true)
                .build();
        return UserSettingsDto.MemoryConfigDto.builder()
            .enabled(defaultBoolean(source.getEnabled(), true))
            .mode(normalizeMemoryMode(source.getMode()))
            .enableL1(defaultBoolean(source.getEnableL1(), true))
            .enableL2(defaultBoolean(source.getEnableL2(), true))
            .enableL3(defaultBoolean(source.getEnableL3(), true))
            .build();
    }
    private String normalizeLlmProvider(String provider) {
        String fallback = firstNonBlank(
            environment.getProperty("DEFAULT_LLM_PROVIDER"),
            environment.getProperty("LLM_PROVIDER"),
            PROVIDER_MINIMAX
        );
        if (provider == null || provider.isBlank()) {
            return normalizeProviderOrDefault(fallback);
        }
        return normalizeProviderOrDefault(provider);
    }
    private String normalizeProviderOrDefault(String value) {
        String normalized = value == null ? PROVIDER_MINIMAX : value.trim().toLowerCase(Locale.ROOT);
        return SUPPORTED_LLM_PROVIDERS.contains(normalized) ? normalized : PROVIDER_MINIMAX;
    }
    private String normalizeMemoryMode(String value) {
        if (value == null || value.isBlank()) {
            return "L0";
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        return SUPPORTED_MEMORY_MODES.contains(normalized) ? normalized : "L0";
    }
    private boolean defaultBoolean(Boolean value, boolean defaultValue) {
        return value != null ? value : defaultValue;
    }
    private String normalizeBlank(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.trim().isEmpty()) {
                return value.trim();
            }
        }
        return null;
    }
    private ResolvedValue pickFirstNonBlank(ResolvedValue... values) {
        if (values == null || values.length == 0) {
            return new ResolvedValue("none", null);
        }
        for (ResolvedValue value : values) {
            if (value != null && value.value() != null && !value.value().trim().isEmpty()) {
                return new ResolvedValue(value.source(), value.value().trim());
            }
        }
        return new ResolvedValue("none", null);
    }
    private ResolvedValue resolved(String source, String value) {
        return new ResolvedValue(source, value);
    }
    private record ResolvedValue(String source, String value) {}
    private String defaultApiBaseForProvider(String provider) {
        return switch (provider) {
            case PROVIDER_OPENAI -> "https://api.openai.com/v1";
            case PROVIDER_DEEPSEEK -> "https://api.deepseek.com/v1";
            case PROVIDER_MINIMAX -> DEFAULT_API_BASE_MINIMAX;
            default -> DEFAULT_API_BASE_MINIMAX;
        };
    }

    private String resolveLegacyValue(UserSettings.LlmConfig config, boolean providerMatch, boolean apiKey) {
        if (!providerMatch || config == null) {
            return null;
        }
        return apiKey ? normalizeBlank(config.getApiKey()) : normalizeBlank(config.getApiBase());
    }

    private UserSettings findOrCreateSettings(Long userId) {
        return settingsRepository.findByUserId(userId)
            .orElseGet(() -> createDefaultSettings(userId));
    }

    /**
     * 从 user_credentials 表读取指定用户的 LLM API Key
     * 
     * @param userId 用户ID
     * @param provider LLM 提供商 (minimax/deepseek/openai)
     * @return 解密后的 API Key，如果未找到则返回 null
     */
    private String getLlmApiKeyFromCredentials(Long userId, String provider) {
        try {
            List<UserCredential> credentials = credentialRepository.findByUserIdAndType(
                userId, 
                UserCredential.CredentialType.AI_PROVIDER
            );
            Optional<UserCredential> matchedCredential = credentials.stream()
                .filter(c -> c.getProvider().equalsIgnoreCase(provider))
                .filter(c -> Boolean.TRUE.equals(c.getIsActive()))
                .findFirst();
            if (matchedCredential.isPresent()) {
                UserCredential credential = matchedCredential.get();
                String decryptedKey = credentialEncryptionUtil.decrypt(credential.getApiKeyEncrypted());
                log.debug("Loaded LLM API key from user_credentials: userId={}, provider={}", userId, provider);
                return decryptedKey;
            }
        } catch (Exception e) {
            log.warn("Failed to get LLM API key from credentials for user {}: {}", userId, e.getMessage());
        }
        return null;
    }
    /**
     * 从 user_credentials 表读取指定用户的 LLM API Base URL
     * 
     * @param userId 用户ID
     * @param provider LLM 提供商 (minimax/deepseek/openai)
     * @return API Base URL，如果未找到则返回 null
     */
    private String getLlmApiBaseFromCredentials(Long userId, String provider) {
        try {
            List<UserCredential> credentials = credentialRepository.findByUserIdAndType(
                userId, 
                UserCredential.CredentialType.AI_PROVIDER
            );
            Optional<UserCredential> matchedCredential = credentials.stream()
                .filter(c -> c.getProvider().equalsIgnoreCase(provider))
                .filter(c -> Boolean.TRUE.equals(c.getIsActive()))
                .findFirst();
            if (matchedCredential.isPresent()) {
                UserCredential credential = matchedCredential.get();
                // 从 additional_config JSON 字段中读取 apiBase
                if (credential.getAdditionalConfig() != null) {
                    Object apiBase = credential.getAdditionalConfig().get("apiBase");
                    if (apiBase != null && !apiBase.toString().isBlank()) {
                        return apiBase.toString();
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Failed to get LLM API base from credentials for user {}: {}", userId, e.getMessage());
        }
        return null;
    }
}
