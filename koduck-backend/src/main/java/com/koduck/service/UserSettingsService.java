package com.koduck.service;

import com.koduck.dto.settings.*;
import com.koduck.entity.UserCredential;
import com.koduck.entity.UserSettings;
import com.koduck.repository.CredentialRepository;
import com.koduck.repository.UserSettingsRepository;
import com.koduck.util.CredentialEncryptionUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class UserSettingsService {

    private static final Set<String> SUPPORTED_LLM_PROVIDERS = Set.of("minimax", "deepseek", "openai");
    private static final Set<String> SUPPORTED_MEMORY_MODES = Set.of("L0", "L1", "L2", "L3");
    private final UserSettingsRepository settingsRepository;
    private final CredentialRepository credentialRepository;
    private final Environment environment;

    /**
     * 
     */
    @Transactional
    public UserSettingsDto getSettings(Long userId) {
        log.debug("Getting settings for user: {}", userId);

        UserSettings settings = settingsRepository.findByUserId(userId)
            .orElseGet(() -> createDefaultSettings(userId));

        return convertToDto(settings);
    }

    /**
     * 
     */
    @Transactional
    public UserSettingsDto updateSettings(Long userId, UpdateSettingsRequest request) {
        log.debug("Updating settings for user: {}", userId);

        UserSettings settings = settingsRepository.findByUserId(userId)
            .orElseGet(() -> createDefaultSettings(userId));

        // 
        if (request.getTheme() != null) {
            settings.setTheme(request.getTheme());
        }
        if (request.getLanguage() != null) {
            settings.setLanguage(request.getLanguage());
        }
        if (request.getTimezone() != null) {
            settings.setTimezone(request.getTimezone());
        }

        // 
        if (request.getNotification() != null) {
            UserSettings.NotificationConfig config = new UserSettings.NotificationConfig();
            config.setEmail(request.getNotification().getEmail());
            config.setBrowser(request.getNotification().getBrowser());
            config.setPriceAlert(request.getNotification().getPriceAlert());
            config.setTradeAlert(request.getNotification().getTradeAlert());
            config.setStrategyAlert(request.getNotification().getStrategyAlert());
            settings.setNotificationConfig(config);
        }

        // 
        if (request.getTrading() != null) {
            UserSettings.TradingConfig config = new UserSettings.TradingConfig();
            config.setDefaultMarket(request.getTrading().getDefaultMarket());
            config.setCommissionRate(request.getTrading().getCommissionRate());
            config.setMinCommission(request.getTrading().getMinCommission());
            config.setEnableConfirmation(request.getTrading().getEnableConfirmation());
            settings.setTradingConfig(config);
        }

        // 
        if (request.getDisplay() != null) {
            UserSettings.DisplayConfig config = new UserSettings.DisplayConfig();
            config.setCurrency(request.getDisplay().getCurrency());
            config.setDateFormat(request.getDisplay().getDateFormat());
            config.setNumberFormat(request.getDisplay().getNumberFormat());
            config.setCompactMode(request.getDisplay().getCompactMode());
            settings.setDisplayConfig(config);
        }

        // 
        if (request.getLlmConfig() != null) {
            UserSettings.LlmConfig current = settings.getLlmConfig() != null
                ? settings.getLlmConfig()
                : new UserSettings.LlmConfig();
            UpdateSettingsRequest.LlmConfigDto req = request.getLlmConfig();

            String activeProvider = normalizeLlmProvider(firstNonBlank(req.getProvider(), current.getProvider()));
            current.setProvider(activeProvider);

            current.setMinimax(mergeProviderConfig(current.getMinimax(), req.getMinimax()));
            current.setDeepseek(mergeProviderConfig(current.getDeepseek(), req.getDeepseek()));
            current.setOpenai(mergeProviderConfig(current.getOpenai(), req.getOpenai()));
            current.setMemory(mergeMemoryConfig(current.getMemory(), req.getMemory()));

            // ： apiKey/apiBase  provider
            if (req.getApiKey() != null || req.getApiBase() != null) {
                UserSettings.ProviderConfig existing = getProviderConfig(current, activeProvider);
                UserSettings.ProviderConfig legacyMerged = UserSettings.ProviderConfig.builder()
                    .apiKey(req.getApiKey() != null ? normalizeBlank(req.getApiKey()) : normalizeBlank(existing != null ? existing.getApiKey() : null))
                    .apiBase(req.getApiBase() != null ? normalizeBlank(req.getApiBase()) : normalizeBlank(existing != null ? existing.getApiBase() : null))
                    .build();
                setProviderConfig(current, activeProvider, legacyMerged);
            }

            // legacy  provider，
            UserSettings.ProviderConfig activeConfig = getProviderConfig(current, activeProvider);
            current.setApiKey(activeConfig != null ? normalizeBlank(activeConfig.getApiKey()) : null);
            current.setApiBase(activeConfig != null ? normalizeBlank(activeConfig.getApiBase()) : null);

            settings.setLlmConfig(current);
        }

        // 
        if (request.getQuickLinks() != null) {
            List<UserSettings.QuickLink> links = request.getQuickLinks().stream()
                .map(dto -> UserSettings.QuickLink.builder()
                    .id(dto.getId())
                    .name(dto.getName())
                    .icon(dto.getIcon())
                    .path(dto.getPath())
                    .sortOrder(dto.getSortOrder())
                    .build())
                .collect(Collectors.toList());
            settings.setQuickLinks(links);
        }

        UserSettings saved = settingsRepository.save(settings);
        return convertToDto(saved);
    }

    /**
     * 
     */
    @Transactional
    public UserSettingsDto updateTheme(Long userId, String theme) {
        log.debug("Updating theme for user: {}, theme: {}", userId, theme);

        UserSettings settings = settingsRepository.findByUserId(userId)
            .orElseGet(() -> createDefaultSettings(userId));

        settings.setTheme(theme);
        UserSettings saved = settingsRepository.save(settings);
        return convertToDto(saved);
    }

    /**
     * 
     */
    @Transactional
    public UserSettingsDto updateNotification(Long userId, UpdateNotificationRequest request) {
        log.debug("Updating notification settings for user: {}", userId);

        UserSettings settings = settingsRepository.findByUserId(userId)
            .orElseGet(() -> createDefaultSettings(userId));

        UserSettings.NotificationConfig config = settings.getNotificationConfig();
        if (config == null) {
            config = new UserSettings.NotificationConfig();
        }

        if (request.getEmail() != null) config.setEmail(request.getEmail());
        if (request.getBrowser() != null) config.setBrowser(request.getBrowser());
        if (request.getPriceAlert() != null) config.setPriceAlert(request.getPriceAlert());
        if (request.getTradeAlert() != null) config.setTradeAlert(request.getTradeAlert());
        if (request.getStrategyAlert() != null) config.setStrategyAlert(request.getStrategyAlert());

        settings.setNotificationConfig(config);
        UserSettings saved = settingsRepository.save(settings);
        return convertToDto(saved);
    }

    /**
     * 
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
                .provider("minimax")
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

        return settingsRepository.save(settings);
    }

    /**
     *  DTO
     */
    private UserSettingsDto convertToDto(UserSettings settings) {
        return UserSettingsDto.builder()
            .id(settings.getId())
            .userId(settings.getUserId())
            .theme(settings.getTheme())
            .language(settings.getLanguage())
            .timezone(settings.getTimezone())
            .notification(convertNotificationToDto(settings.getNotificationConfig()))
            .trading(convertTradingToDto(settings.getTradingConfig()))
            .display(convertDisplayToDto(settings.getDisplayConfig()))
            .quickLinks(convertQuickLinksToDto(settings.getQuickLinks()))
            .llmConfig(resolveLlmConfig(settings.getLlmConfig()))
            .createdAt(settings.getCreatedAt())
            .updatedAt(settings.getUpdatedAt())
            .build();
    }

    @Transactional
    public UserSettingsDto.LlmConfigDto getEffectiveLlmConfig(Long userId, String provider) {
        UserSettings settings = settingsRepository.findByUserId(userId)
            .orElseGet(() -> createDefaultSettings(userId));
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
        if ("minimax".equals(activeProvider)) {
            apiKeyResolved = pickFirstNonBlank(
                resolved("credentials", credentialsApiKey), // 优先：user_credentials 表（加密存储）
                resolved("user_settings", settingsApiKey),  // 其次：user_settings 表
                resolved("env:MINIMAX_API_KEY", environment.getProperty("MINIMAX_API_KEY")),
                resolved("env:LLM_API_KEY", environment.getProperty("LLM_API_KEY"))
            );
            apiBaseResolved = pickFirstNonBlank(
                resolved("credentials", credentialsApiBase), // 优先：user_credentials 表
                resolved("user_settings", settingsApiBase),  // 其次：user_settings 表
                resolved("env:MINIMAX_API_BASE", environment.getProperty("MINIMAX_API_BASE")),
                resolved("env:LLM_API_BASE", environment.getProperty("LLM_API_BASE")),
                resolved("default", defaultApiBaseForProvider(activeProvider))
            );
        } else if ("openai".equals(activeProvider)) {
            apiKeyResolved = pickFirstNonBlank(
                resolved("credentials", credentialsApiKey), // 优先：user_credentials 表
                resolved("user_settings", settingsApiKey),  // 其次：user_settings 表
                resolved("env:OPENAI_API_KEY", environment.getProperty("OPENAI_API_KEY")),
                resolved("env:GPT_API_KEY", environment.getProperty("GPT_API_KEY")),
                resolved("env:LLM_API_KEY", environment.getProperty("LLM_API_KEY"))
            );
            apiBaseResolved = pickFirstNonBlank(
                resolved("credentials", credentialsApiBase), // 优先：user_credentials 表
                resolved("user_settings", settingsApiBase),  // 其次：user_settings 表
                resolved("env:OPENAI_API_BASE", environment.getProperty("OPENAI_API_BASE")),
                resolved("env:LLM_API_BASE", environment.getProperty("LLM_API_BASE")),
                resolved("default", defaultApiBaseForProvider(activeProvider))
            );
        } else if ("deepseek".equals(activeProvider)) {
            apiKeyResolved = pickFirstNonBlank(
                resolved("credentials", credentialsApiKey), // 优先：user_credentials 表
                resolved("user_settings", settingsApiKey),  // 其次：user_settings 表
                resolved("env:DEEPSEEK_API_KEY", environment.getProperty("DEEPSEEK_API_KEY")),
                resolved("env:LLM_API_KEY", environment.getProperty("LLM_API_KEY"))
            );
            apiBaseResolved = pickFirstNonBlank(
                resolved("credentials", credentialsApiBase), // 优先：user_credentials 表
                resolved("user_settings", settingsApiBase),  // 其次：user_settings 表
                resolved("env:DEEPSEEK_API_BASE", environment.getProperty("DEEPSEEK_API_BASE")),
                resolved("env:LLM_API_BASE", environment.getProperty("LLM_API_BASE")),
                resolved("default", defaultApiBaseForProvider(activeProvider))
            );
        } else {
            // 其他 provider，使用通用 fallback
            apiKeyResolved = pickFirstNonBlank(
                resolved("credentials", credentialsApiKey),
                resolved("user_settings", settingsApiKey),
                resolved("env:LLM_API_KEY", environment.getProperty("LLM_API_KEY"))
            );
            apiBaseResolved = pickFirstNonBlank(
                resolved("credentials", credentialsApiBase),
                resolved("user_settings", settingsApiBase),
                resolved("env:LLM_API_BASE", environment.getProperty("LLM_API_BASE")),
                resolved("default", defaultApiBaseForProvider(activeProvider))
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
            .minimax(resolveProviderConfig("minimax", llmConfig))
            .deepseek(resolveProviderConfig("deepseek", llmConfig))
            .openai(resolveProviderConfig("openai", llmConfig))
            .memory(resolveMemoryConfig(llmConfig.getMemory()))
            .build();
    }

    private UserSettingsDto.NotificationConfigDto convertNotificationToDto(
            UserSettings.NotificationConfig config) {
        if (config == null) return null;
        return UserSettingsDto.NotificationConfigDto.builder()
            .email(config.getEmail())
            .browser(config.getBrowser())
            .priceAlert(config.getPriceAlert())
            .tradeAlert(config.getTradeAlert())
            .strategyAlert(config.getStrategyAlert())
            .build();
    }

    private UserSettingsDto.TradingConfigDto convertTradingToDto(
            UserSettings.TradingConfig config) {
        if (config == null) return null;
        return UserSettingsDto.TradingConfigDto.builder()
            .defaultMarket(config.getDefaultMarket())
            .commissionRate(config.getCommissionRate())
            .minCommission(config.getMinCommission())
            .enableConfirmation(config.getEnableConfirmation())
            .build();
    }

    private UserSettingsDto.DisplayConfigDto convertDisplayToDto(
            UserSettings.DisplayConfig config) {
        if (config == null) return null;
        return UserSettingsDto.DisplayConfigDto.builder()
            .currency(config.getCurrency())
            .dateFormat(config.getDateFormat())
            .numberFormat(config.getNumberFormat())
            .compactMode(config.getCompactMode())
            .build();
    }

    private List<UserSettingsDto.QuickLinkDto> convertQuickLinksToDto(
            List<UserSettings.QuickLink> links) {
        if (links == null) return List.of();
        return links.stream()
            .map(link -> UserSettingsDto.QuickLinkDto.builder()
                .id(link.getId())
                .name(link.getName())
                .icon(link.getIcon())
                .path(link.getPath())
                .sortOrder(link.getSortOrder())
                .build())
            .collect(Collectors.toList());
    }

    private UserSettingsDto.LlmConfigDto resolveLlmConfig(UserSettings.LlmConfig config) {
        UserSettings.LlmConfig source = config == null ? new UserSettings.LlmConfig() : config;
        String provider = normalizeLlmProvider(source.getProvider());

        UserSettingsDto.ProviderConfigDto minimax = resolveProviderConfig("minimax", source);
        UserSettingsDto.ProviderConfigDto deepseek = resolveProviderConfig("deepseek", source);
        UserSettingsDto.ProviderConfigDto openai = resolveProviderConfig("openai", source);

        UserSettingsDto.ProviderConfigDto active = switch (provider) {
            case "deepseek" -> deepseek;
            case "openai" -> openai;
            case "minimax" -> minimax;
            default -> minimax;
        };

        return UserSettingsDto.LlmConfigDto.builder()
            .provider(provider)
            .apiKey(active != null ? active.getApiKey() : null)
            .apiBase(active != null ? active.getApiBase() : null)
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
            case "deepseek" -> config.getDeepseek();
            case "openai" -> config.getOpenai();
            case "minimax" -> config.getMinimax();
            default -> config.getMinimax();
        };
    }

    private void setProviderConfig(UserSettings.LlmConfig config, String provider, UserSettings.ProviderConfig value) {
        if (config == null) {
            return;
        }
        switch (provider) {
            case "deepseek" -> config.setDeepseek(value);
            case "openai" -> config.setOpenai(value);
            case "minimax" -> config.setMinimax(value);
            default -> config.setMinimax(value);
        }
    }

    private UserSettingsDto.ProviderConfigDto resolveProviderConfig(String provider, UserSettings.LlmConfig config) {
        UserSettings.ProviderConfig settingsProviderConfig = getProviderConfig(config, provider);

        //  provider ：provider ， apiKey/apiBase  provider 
        String legacyProvider = normalizeLlmProvider(config != null ? config.getProvider() : null);
        String legacyApiKey = legacyProvider.equals(provider) ? normalizeBlank(config != null ? config.getApiKey() : null) : null;
        String legacyApiBase = legacyProvider.equals(provider) ? normalizeBlank(config != null ? config.getApiBase() : null) : null;

        String settingsApiKey = normalizeBlank(settingsProviderConfig != null ? settingsProviderConfig.getApiKey() : null);
        String settingsApiBase = normalizeBlank(settingsProviderConfig != null ? settingsProviderConfig.getApiBase() : null);

        String apiKey;
        String apiBase;
        switch (provider) {
            case "openai":
                apiKey = firstNonBlank(
                    settingsApiKey,
                    legacyApiKey,
                    environment.getProperty("OPENAI_API_KEY"),
                    environment.getProperty("GPT_API_KEY"),
                    environment.getProperty("LLM_API_KEY")
                );
                apiBase = firstNonBlank(
                    settingsApiBase,
                    legacyApiBase,
                    environment.getProperty("OPENAI_API_BASE"),
                    environment.getProperty("LLM_API_BASE"),
                    "https://api.openai.com/v1"
                );
                break;
            case "deepseek":
                apiKey = firstNonBlank(
                    settingsApiKey,
                    legacyApiKey,
                    environment.getProperty("DEEPSEEK_API_KEY"),
                    environment.getProperty("LLM_API_KEY")
                );
                apiBase = firstNonBlank(
                    settingsApiBase,
                    legacyApiBase,
                    environment.getProperty("DEEPSEEK_API_BASE"),
                    environment.getProperty("LLM_API_BASE"),
                    "https://api.deepseek.com/v1"
                );
                break;
            case "minimax":
            default:
                apiKey = firstNonBlank(
                    settingsApiKey,
                    legacyApiKey,
                    environment.getProperty("MINIMAX_API_KEY"),
                    environment.getProperty("LLM_API_KEY")
                );
                apiBase = firstNonBlank(
                    settingsApiBase,
                    legacyApiBase,
                    environment.getProperty("MINIMAX_API_BASE"),
                    environment.getProperty("LLM_API_BASE"),
                    "https://api.minimax.chat/v1"
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
            "minimax"
        );
        if (provider == null || provider.isBlank()) {
            return normalizeProviderOrDefault(fallback);
        }
        return normalizeProviderOrDefault(provider);
    }

    private String normalizeProviderOrDefault(String value) {
        String normalized = value == null ? "minimax" : value.trim().toLowerCase(Locale.ROOT);
        return SUPPORTED_LLM_PROVIDERS.contains(normalized) ? normalized : "minimax";
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
            case "openai" -> "https://api.openai.com/v1";
            case "deepseek" -> "https://api.deepseek.com/v1";
            case "minimax" -> "https://api.minimax.chat/v1";
            default -> "https://api.minimax.chat/v1";
        };
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
                String decryptedKey = CredentialEncryptionUtil.decrypt(credential.getApiKeyEncrypted());
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
