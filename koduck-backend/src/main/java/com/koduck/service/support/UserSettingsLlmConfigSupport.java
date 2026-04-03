package com.koduck.service.support;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import com.koduck.dto.settings.LlmConfigDto;
import com.koduck.dto.settings.MemoryConfigDto;
import com.koduck.dto.settings.ProviderConfigDto;
import com.koduck.entity.UserCredential;
import com.koduck.entity.UserSettings;
import com.koduck.repository.CredentialRepository;
import com.koduck.util.CredentialEncryptionUtil;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 封装用户设置中的 LLM 配置合并与解析逻辑。
 *
 * @author GitHub Copilot
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class UserSettingsLlmConfigSupport {

    /** Provider: minimax. */
    private static final String PROVIDER_MINIMAX = "minimax";
    /** Provider: deepseek. */
    private static final String PROVIDER_DEEPSEEK = "deepseek";
    /** Provider: openai. */
    private static final String PROVIDER_OPENAI = "openai";
    /** Source: credentials. */
    private static final String SOURCE_CREDENTIALS = "credentials";
    /** Source: user settings. */
    private static final String SOURCE_USER_SETTINGS = "user_settings";
    /** Source: default. */
    private static final String SOURCE_DEFAULT = "default";
    /** Source env: LLM_API_KEY. */
    private static final String SOURCE_ENV_LLM_API_KEY = "env:LLM_API_KEY";
    /** Source env: LLM_API_BASE. */
    private static final String SOURCE_ENV_LLM_API_BASE = "env:LLM_API_BASE";
    /** Env key: LLM_API_KEY. */
    private static final String ENV_LLM_API_KEY = "LLM_API_KEY";
    /** Env key: LLM_API_BASE. */
    private static final String ENV_LLM_API_BASE = "LLM_API_BASE";
    /** Default API base for minimax. */
    private static final String DEFAULT_API_BASE_MINIMAX = "https://api.minimax.chat/v1";
    /** Default memory mode. */
    private static final String DEFAULT_MEMORY_MODE = "L0";
    /** OpenAI API base. */
    private static final String OPENAI_API_BASE = "https://api.openai.com/v1";
    /** Deepseek API base. */
    private static final String DEEPSEEK_API_BASE = "https://api.deepseek.com/v1";
    /** Supported LLM providers. */
    private static final Set<String> SUPPORTED_LLM_PROVIDERS =
        Set.of(PROVIDER_MINIMAX, PROVIDER_DEEPSEEK, PROVIDER_OPENAI);
    /** Supported memory modes. */
    private static final Set<String> SUPPORTED_MEMORY_MODES = Set.of("L0", "L1", "L2", "L3");

    /** Credential repository. */
    private final CredentialRepository credentialRepository;

    /** Environment. */
    private final Environment environment;

    /** Credential encryption utility. */
    private final CredentialEncryptionUtil credentialEncryptionUtil;

    /**
     * Applies LLM configuration from request to user settings.
     *
     * @param settings the user settings entity
     * @param requestConfig the LLM config from request
     */
    public void applyLlmConfig(UserSettings settings, LlmConfigDto requestConfig) {
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
            setProviderConfig(current, activeProvider, mergeLegacyProviderConfig(requestConfig, existing));
        }
        UserSettings.ProviderConfig activeConfig = getProviderConfig(current, activeProvider);
        current.setApiKey(normalizeBlank(activeConfig == null ? null : activeConfig.getApiKey()));
        current.setApiBase(normalizeBlank(activeConfig == null ? null : activeConfig.getApiBase()));
        settings.setLlmConfig(current);
    }

    /**
     * Gets effective LLM configuration for user and provider.
     *
     * @param userId the user ID
     * @param provider the LLM provider
     * @param llmConfig the stored LLM config
     * @return the effective LLM config DTO
     */
    public LlmConfigDto getEffectiveLlmConfig(
            Long userId,
            String provider,
            UserSettings.LlmConfig llmConfig) {
        UserSettings.LlmConfig source = llmConfig == null ? new UserSettings.LlmConfig() : llmConfig;
        String activeProvider = normalizeLlmProvider(firstNonBlank(provider, source.getProvider()));
        source.setProvider(activeProvider);

        String credentialsApiKey = getLlmApiKeyFromCredentials(userId, activeProvider);
        String credentialsApiBase = getLlmApiBaseFromCredentials(userId, activeProvider);
        UserSettings.ProviderConfig providerConfig = getProviderConfig(source, activeProvider);
        String legacyProvider = normalizeLlmProvider(source.getProvider());
        String legacyApiKey = legacyProvider.equals(activeProvider) ? normalizeBlank(source.getApiKey()) : null;
        String legacyApiBase = legacyProvider.equals(activeProvider) ? normalizeBlank(source.getApiBase()) : null;
        String settingsApiKey = firstNonBlank(
            normalizeBlank(providerConfig != null ? providerConfig.getApiKey() : null),
            legacyApiKey
        );
        String settingsApiBase = firstNonBlank(
            normalizeBlank(providerConfig != null ? providerConfig.getApiBase() : null),
            legacyApiBase
        );

        ResolvedValue apiKeyResolved = resolveApiKey(activeProvider, credentialsApiKey, settingsApiKey);
        ResolvedValue apiBaseResolved = resolveApiBase(activeProvider, credentialsApiBase, settingsApiBase);

        log.info(
            "Resolved LLM config: userId={}, provider={}, apiKeySource={}, "
                + "apiKeyMasked={}, apiBaseSource={}, apiBase={}",
            userId,
            activeProvider,
            apiKeyResolved.source(),
            CredentialEncryptionUtil.maskApiKey(apiKeyResolved.value()),
            apiBaseResolved.source(),
            apiBaseResolved.value() == null ? "" : apiBaseResolved.value()
        );

        return LlmConfigDto.builder()
            .provider(activeProvider)
            .apiKey(apiKeyResolved.value())
            .apiBase(apiBaseResolved.value())
            .minimax(resolveProviderConfig(PROVIDER_MINIMAX, source))
            .deepseek(resolveProviderConfig(PROVIDER_DEEPSEEK, source))
            .openai(resolveProviderConfig(PROVIDER_OPENAI, source))
            .memory(resolveMemoryConfig(source.getMemory()))
            .build();
    }

    /**
     * Resolves LLM configuration from stored entity.
     *
     * @param config the stored LLM config
     * @return the resolved LLM config DTO
     */
    public LlmConfigDto resolveLlmConfig(UserSettings.LlmConfig config) {
        UserSettings.LlmConfig source = config == null ? new UserSettings.LlmConfig() : config;
        String provider = normalizeLlmProvider(source.getProvider());
        ProviderConfigDto minimax = resolveProviderConfig(PROVIDER_MINIMAX, source);
        ProviderConfigDto deepseek = resolveProviderConfig(PROVIDER_DEEPSEEK, source);
        ProviderConfigDto openai = resolveProviderConfig(PROVIDER_OPENAI, source);
        ProviderConfigDto active = switch (provider) {
            case PROVIDER_DEEPSEEK -> deepseek;
            case PROVIDER_OPENAI -> openai;
            case PROVIDER_MINIMAX -> minimax;
            default -> minimax;
        };
        return LlmConfigDto.builder()
            .provider(provider)
            .apiKey(active.getApiKey())
            .apiBase(active.getApiBase())
            .minimax(minimax)
            .deepseek(deepseek)
            .openai(openai)
            .memory(resolveMemoryConfig(source.getMemory()))
            .build();
    }

    private ResolvedValue resolveApiKey(String provider, String credentialsApiKey, String settingsApiKey) {
        return switch (provider) {
            case PROVIDER_OPENAI -> pickFirstNonBlank(
                resolved(SOURCE_CREDENTIALS, credentialsApiKey),
                resolved(SOURCE_USER_SETTINGS, settingsApiKey),
                resolved("env:OPENAI_API_KEY", environment.getProperty("OPENAI_API_KEY")),
                resolved("env:GPT_API_KEY", environment.getProperty("GPT_API_KEY")),
                resolved(SOURCE_ENV_LLM_API_KEY, environment.getProperty(ENV_LLM_API_KEY))
            );
            case PROVIDER_DEEPSEEK -> pickFirstNonBlank(
                resolved(SOURCE_CREDENTIALS, credentialsApiKey),
                resolved(SOURCE_USER_SETTINGS, settingsApiKey),
                resolved("env:DEEPSEEK_API_KEY", environment.getProperty("DEEPSEEK_API_KEY")),
                resolved(SOURCE_ENV_LLM_API_KEY, environment.getProperty(ENV_LLM_API_KEY))
            );
            case PROVIDER_MINIMAX -> pickFirstNonBlank(
                resolved(SOURCE_CREDENTIALS, credentialsApiKey),
                resolved(SOURCE_USER_SETTINGS, settingsApiKey),
                resolved("env:MINIMAX_API_KEY", environment.getProperty("MINIMAX_API_KEY")),
                resolved(SOURCE_ENV_LLM_API_KEY, environment.getProperty(ENV_LLM_API_KEY))
            );
            default -> pickFirstNonBlank(
                resolved(SOURCE_CREDENTIALS, credentialsApiKey),
                resolved(SOURCE_USER_SETTINGS, settingsApiKey),
                resolved(SOURCE_ENV_LLM_API_KEY, environment.getProperty(ENV_LLM_API_KEY))
            );
        };
    }

    private ResolvedValue resolveApiBase(String provider, String credentialsApiBase, String settingsApiBase) {
        return switch (provider) {
            case PROVIDER_OPENAI -> pickFirstNonBlank(
                resolved(SOURCE_CREDENTIALS, credentialsApiBase),
                resolved(SOURCE_USER_SETTINGS, settingsApiBase),
                resolved("env:OPENAI_API_BASE", environment.getProperty("OPENAI_API_BASE")),
                resolved(SOURCE_ENV_LLM_API_BASE, environment.getProperty(ENV_LLM_API_BASE)),
                resolved(SOURCE_DEFAULT, OPENAI_API_BASE)
            );
            case PROVIDER_DEEPSEEK -> pickFirstNonBlank(
                resolved(SOURCE_CREDENTIALS, credentialsApiBase),
                resolved(SOURCE_USER_SETTINGS, settingsApiBase),
                resolved("env:DEEPSEEK_API_BASE", environment.getProperty("DEEPSEEK_API_BASE")),
                resolved(SOURCE_ENV_LLM_API_BASE, environment.getProperty(ENV_LLM_API_BASE)),
                resolved(SOURCE_DEFAULT, DEEPSEEK_API_BASE)
            );
            case PROVIDER_MINIMAX -> pickFirstNonBlank(
                resolved(SOURCE_CREDENTIALS, credentialsApiBase),
                resolved(SOURCE_USER_SETTINGS, settingsApiBase),
                resolved("env:MINIMAX_API_BASE", environment.getProperty("MINIMAX_API_BASE")),
                resolved(SOURCE_ENV_LLM_API_BASE, environment.getProperty(ENV_LLM_API_BASE)),
                resolved(SOURCE_DEFAULT, DEFAULT_API_BASE_MINIMAX)
            );
            default -> pickFirstNonBlank(
                resolved(SOURCE_CREDENTIALS, credentialsApiBase),
                resolved(SOURCE_USER_SETTINGS, settingsApiBase),
                resolved(SOURCE_ENV_LLM_API_BASE, environment.getProperty(ENV_LLM_API_BASE)),
                resolved(SOURCE_DEFAULT, defaultApiBaseForProvider(provider))
            );
        };
    }

    private UserSettings.ProviderConfig mergeProviderConfig(
            UserSettings.ProviderConfig existing,
            ProviderConfigDto incoming) {
        UserSettings.ProviderConfig base = existing != null ? existing : new UserSettings.ProviderConfig();
        if (incoming == null) {
            return base;
        }
        return UserSettings.ProviderConfig.builder()
            .apiKey(incoming.getApiKey() != null
                ? normalizeBlank(incoming.getApiKey())
                : normalizeBlank(base.getApiKey()))
            .apiBase(incoming.getApiBase() != null
                ? normalizeBlank(incoming.getApiBase())
                : normalizeBlank(base.getApiBase()))
            .build();
    }

    private UserSettings.ProviderConfig mergeLegacyProviderConfig(
            LlmConfigDto requestConfig,
            UserSettings.ProviderConfig existingConfig) {
        String existingApiKey = normalizeBlank(existingConfig == null ? null : existingConfig.getApiKey());
        String existingApiBase = normalizeBlank(existingConfig == null ? null : existingConfig.getApiBase());
        return UserSettings.ProviderConfig.builder()
            .apiKey(requestConfig.getApiKey() != null ? normalizeBlank(requestConfig.getApiKey()) : existingApiKey)
            .apiBase(requestConfig.getApiBase() != null ? normalizeBlank(requestConfig.getApiBase()) : existingApiBase)
            .build();
    }

    private UserSettings.MemoryConfig mergeMemoryConfig(
            UserSettings.MemoryConfig existing,
            MemoryConfigDto incoming) {
        UserSettings.MemoryConfig base = existing != null
            ? existing
            : UserSettings.MemoryConfig.builder()
                .enabled(true)
                .mode(DEFAULT_MEMORY_MODE)
                .enableL1(true)
                .enableL2(true)
                .enableL3(true)
                .build();
        if (incoming == null) {
            return base;
        }
        String mode = incoming.getMode() != null
            ? normalizeMemoryMode(incoming.getMode())
            : normalizeMemoryMode(base.getMode());
        Boolean modeEnableL1 = base.getEnableL1();
        Boolean modeEnableL2 = base.getEnableL2();
        Boolean modeEnableL3 = base.getEnableL3();
        if (incoming.getMode() != null) {
            modeEnableL1 = true;
            modeEnableL2 = !"L1".equals(mode);
            modeEnableL3 = DEFAULT_MEMORY_MODE.equals(mode) || "L3".equals(mode);
        }
        return UserSettings.MemoryConfig.builder()
            .enabled(incoming.getEnabled() != null ? incoming.getEnabled() : defaultBoolean(modeEnableL1, true))
            .mode(mode)
            .enableL1(incoming.getEnableL1() != null ? incoming.getEnableL1() : defaultBoolean(modeEnableL1, true))
            .enableL2(incoming.getEnableL2() != null ? incoming.getEnableL2() : defaultBoolean(modeEnableL2, true))
            .enableL3(incoming.getEnableL3() != null ? incoming.getEnableL3() : defaultBoolean(modeEnableL3, true))
            .build();
    }

    private ProviderConfigDto resolveProviderConfig(String provider, UserSettings.LlmConfig config) {
        UserSettings.ProviderConfig settingsProviderConfig = getProviderConfig(config, provider);
        String legacyProvider = normalizeLlmProvider(config != null ? config.getProvider() : null);
        String legacyApiKey = resolveLegacyValue(config, legacyProvider.equals(provider), true);
        String legacyApiBase = resolveLegacyValue(config, legacyProvider.equals(provider), false);
        String settingsApiKey = normalizeBlank(
            settingsProviderConfig != null ? settingsProviderConfig.getApiKey() : null
        );
        String settingsApiBase = normalizeBlank(
            settingsProviderConfig != null ? settingsProviderConfig.getApiBase() : null
        );
        String apiKey = switch (provider) {
            case PROVIDER_OPENAI -> firstNonBlank(
                settingsApiKey,
                legacyApiKey,
                environment.getProperty("OPENAI_API_KEY"),
                environment.getProperty("GPT_API_KEY"),
                environment.getProperty(ENV_LLM_API_KEY)
            );
            case PROVIDER_DEEPSEEK -> firstNonBlank(
                settingsApiKey,
                legacyApiKey,
                environment.getProperty("DEEPSEEK_API_KEY"),
                environment.getProperty(ENV_LLM_API_KEY)
            );
            case PROVIDER_MINIMAX -> firstNonBlank(
                settingsApiKey,
                legacyApiKey,
                environment.getProperty("MINIMAX_API_KEY"),
                environment.getProperty(ENV_LLM_API_KEY)
            );
            default -> firstNonBlank(settingsApiKey, legacyApiKey, environment.getProperty(ENV_LLM_API_KEY));
        };
        String apiBase = switch (provider) {
            case PROVIDER_OPENAI -> firstNonBlank(
                settingsApiBase,
                legacyApiBase,
                environment.getProperty("OPENAI_API_BASE"),
                environment.getProperty(ENV_LLM_API_BASE),
                OPENAI_API_BASE
            );
            case PROVIDER_DEEPSEEK -> firstNonBlank(
                settingsApiBase,
                legacyApiBase,
                environment.getProperty("DEEPSEEK_API_BASE"),
                environment.getProperty(ENV_LLM_API_BASE),
                DEEPSEEK_API_BASE
            );
            case PROVIDER_MINIMAX -> firstNonBlank(
                settingsApiBase,
                legacyApiBase,
                environment.getProperty("MINIMAX_API_BASE"),
                environment.getProperty(ENV_LLM_API_BASE),
                DEFAULT_API_BASE_MINIMAX
            );
            default -> firstNonBlank(
                settingsApiBase,
                legacyApiBase,
                environment.getProperty(ENV_LLM_API_BASE),
                defaultApiBaseForProvider(provider)
            );
        };
        return ProviderConfigDto.builder()
            .apiKey(apiKey)
            .apiBase(apiBase)
            .build();
    }

    private MemoryConfigDto resolveMemoryConfig(UserSettings.MemoryConfig config) {
        UserSettings.MemoryConfig source = config != null
            ? config
            : UserSettings.MemoryConfig.builder()
                .enabled(true)
                .mode(DEFAULT_MEMORY_MODE)
                .enableL1(true)
                .enableL2(true)
                .enableL3(true)
                .build();
        return MemoryConfigDto.builder()
            .enabled(defaultBoolean(source.getEnabled(), true))
            .mode(normalizeMemoryMode(source.getMode()))
            .enableL1(defaultBoolean(source.getEnableL1(), true))
            .enableL2(defaultBoolean(source.getEnableL2(), true))
            .enableL3(defaultBoolean(source.getEnableL3(), true))
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

    private String normalizeLlmProvider(String provider) {
        String fallback = firstNonBlank(
            environment.getProperty("DEFAULT_LLM_PROVIDER"),
            environment.getProperty("LLM_PROVIDER"),
            PROVIDER_MINIMAX
        );
        return provider == null || provider.isBlank()
            ? normalizeProviderOrDefault(fallback)
            : normalizeProviderOrDefault(provider);
    }

    private String normalizeProviderOrDefault(String value) {
        String normalized = value == null ? PROVIDER_MINIMAX : value.trim().toLowerCase(Locale.ROOT);
        return SUPPORTED_LLM_PROVIDERS.contains(normalized) ? normalized : PROVIDER_MINIMAX;
    }

    private String normalizeMemoryMode(String value) {
        if (value == null || value.isBlank()) {
            return DEFAULT_MEMORY_MODE;
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        return SUPPORTED_MEMORY_MODES.contains(normalized) ? normalized : DEFAULT_MEMORY_MODE;
    }

    private String defaultApiBaseForProvider(String provider) {
        return switch (provider) {
            case PROVIDER_OPENAI -> OPENAI_API_BASE;
            case PROVIDER_DEEPSEEK -> DEEPSEEK_API_BASE;
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

    private String getLlmApiKeyFromCredentials(Long userId, String provider) {
        try {
            List<UserCredential> credentials = credentialRepository.findByUserIdAndType(
                userId,
                UserCredential.CredentialType.AI_PROVIDER
            );
            Optional<UserCredential> matchedCredential = credentials.stream()
                .filter(credential -> credential.getProvider().equalsIgnoreCase(provider))
                .filter(credential -> Boolean.TRUE.equals(credential.getIsActive()))
                .findFirst();
            if (matchedCredential.isPresent()) {
                UserCredential credential = matchedCredential.get();
                String decryptedKey = credentialEncryptionUtil.decrypt(credential.getApiKeyEncrypted());
                log.debug("Loaded LLM API key from user_credentials: userId={}, provider={}", userId, provider);
                return decryptedKey;
            }
        }
        catch (Exception exception) {
            log.warn("Failed to get LLM API key from credentials for user {}: {}", userId, exception.getMessage());
        }
        return null;
    }

    private String getLlmApiBaseFromCredentials(Long userId, String provider) {
        try {
            List<UserCredential> credentials = credentialRepository.findByUserIdAndType(
                userId,
                UserCredential.CredentialType.AI_PROVIDER
            );
            Optional<UserCredential> matchedCredential = credentials.stream()
                .filter(credential -> credential.getProvider().equalsIgnoreCase(provider))
                .filter(credential -> Boolean.TRUE.equals(credential.getIsActive()))
                .findFirst();
            if (matchedCredential.isPresent()) {
                UserCredential credential = matchedCredential.get();
                if (credential.getAdditionalConfig() != null) {
                    Object apiBase = credential.getAdditionalConfig().get("apiBase");
                    if (apiBase != null && !apiBase.toString().isBlank()) {
                        return apiBase.toString();
                    }
                }
            }
        }
        catch (Exception exception) {
            log.warn("Failed to get LLM API base from credentials for user {}: {}", userId, exception.getMessage());
        }
        return null;
    }

    private record ResolvedValue(String source, String value) {
    }
}
