package com.koduck.dto.settings;

import com.koduck.util.CollectionCopyUtils;
import java.time.LocalDateTime;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 用户设置响应 DTO。
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
@Data
@NoArgsConstructor
public class UserSettingsDto {

    private Long id;

    private Long userId;

    private String theme;

    private String language;

    private String timezone;

    private NotificationConfigDto notification;

    private TradingConfigDto trading;

    private DisplayConfigDto display;

    private List<QuickLinkDto> quickLinks;

    private LlmConfigDto llmConfig;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    public static BuilderWrapper builder() {
        return new BuilderWrapper();
    }

    public NotificationConfigDto getNotification() {
        return copyNotification(notification);
    }

    public void setNotification(NotificationConfigDto notification) {
        this.notification = copyNotification(notification);
    }

    public TradingConfigDto getTrading() {
        return copyTrading(trading);
    }

    public void setTrading(TradingConfigDto trading) {
        this.trading = copyTrading(trading);
    }

    public DisplayConfigDto getDisplay() {
        return copyDisplay(display);
    }

    public void setDisplay(DisplayConfigDto display) {
        this.display = copyDisplay(display);
    }

    public List<QuickLinkDto> getQuickLinks() {
        return CollectionCopyUtils.copyList(quickLinks);
    }

    public void setQuickLinks(List<QuickLinkDto> quickLinks) {
        this.quickLinks = CollectionCopyUtils.copyList(quickLinks);
    }

    public LlmConfigDto getLlmConfig() {
        return copyLlmConfig(llmConfig);
    }

    public void setLlmConfig(LlmConfigDto llmConfig) {
        this.llmConfig = copyLlmConfig(llmConfig);
    }

    private static NotificationConfigDto copyNotification(NotificationConfigDto source) {
        if (source == null) {
            return null;
        }
        return source.toBuilder().build();
    }

    private static TradingConfigDto copyTrading(TradingConfigDto source) {
        if (source == null) {
            return null;
        }
        return source.toBuilder().build();
    }

    private static DisplayConfigDto copyDisplay(DisplayConfigDto source) {
        if (source == null) {
            return null;
        }
        return source.toBuilder().build();
    }

    private static LlmConfigDto copyLlmConfig(LlmConfigDto source) {
        if (source == null) {
            return null;
        }
        return LlmConfigDto.builder()
            .provider(source.getProvider())
            .apiKey(source.getApiKey())
            .apiBase(source.getApiBase())
            .minimax(copyProviderConfig(source.getMinimax()))
            .deepseek(copyProviderConfig(source.getDeepseek()))
            .openai(copyProviderConfig(source.getOpenai()))
            .memory(copyMemoryConfig(source.getMemory()))
            .build();
    }

    private static ProviderConfigDto copyProviderConfig(ProviderConfigDto source) {
        if (source == null) {
            return null;
        }
        return source.toBuilder().build();
    }

    private static MemoryConfigDto copyMemoryConfig(MemoryConfigDto source) {
        if (source == null) {
            return null;
        }
        return source.toBuilder().build();
    }

    public static final class BuilderWrapper {

        private Long id;
        private Long userId;
        private String theme;
        private String language;
        private String timezone;
        private NotificationConfigDto notification;
        private TradingConfigDto trading;
        private DisplayConfigDto display;
        private List<QuickLinkDto> quickLinks;
        private LlmConfigDto llmConfig;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;

        public BuilderWrapper id(Long id) {
            this.id = id;
            return this;
        }

        public BuilderWrapper userId(Long userId) {
            this.userId = userId;
            return this;
        }

        public BuilderWrapper theme(String theme) {
            this.theme = theme;
            return this;
        }

        public BuilderWrapper language(String language) {
            this.language = language;
            return this;
        }

        public BuilderWrapper timezone(String timezone) {
            this.timezone = timezone;
            return this;
        }

        public BuilderWrapper notification(NotificationConfigDto notification) {
            this.notification = copyNotification(notification);
            return this;
        }

        public BuilderWrapper trading(TradingConfigDto trading) {
            this.trading = copyTrading(trading);
            return this;
        }

        public BuilderWrapper display(DisplayConfigDto display) {
            this.display = copyDisplay(display);
            return this;
        }

        public BuilderWrapper quickLinks(List<QuickLinkDto> quickLinks) {
            this.quickLinks = CollectionCopyUtils.copyList(quickLinks);
            return this;
        }

        public BuilderWrapper llmConfig(LlmConfigDto llmConfig) {
            this.llmConfig = copyLlmConfig(llmConfig);
            return this;
        }

        public BuilderWrapper createdAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        public BuilderWrapper updatedAt(LocalDateTime updatedAt) {
            this.updatedAt = updatedAt;
            return this;
        }

        public UserSettingsDto build() {
            UserSettingsDto dto = new UserSettingsDto();
            dto.setId(id);
            dto.setUserId(userId);
            dto.setTheme(theme);
            dto.setLanguage(language);
            dto.setTimezone(timezone);
            dto.setNotification(notification);
            dto.setTrading(trading);
            dto.setDisplay(display);
            dto.setQuickLinks(quickLinks);
            dto.setLlmConfig(llmConfig);
            dto.setCreatedAt(createdAt);
            dto.setUpdatedAt(updatedAt);
            return dto;
        }
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder(toBuilder = true)
    public static class NotificationConfigDto {

        private Boolean email;

        private Boolean browser;

        private Boolean priceAlert;

        private Boolean tradeAlert;

        private Boolean strategyAlert;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder(toBuilder = true)
    public static class TradingConfigDto {

        private String defaultMarket;

        private Double commissionRate;

        private Double minCommission;

        private Boolean enableConfirmation;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder(toBuilder = true)
    public static class DisplayConfigDto {

        private String currency;

        private String dateFormat;

        private String numberFormat;

        private Boolean compactMode;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder(toBuilder = true)
    public static class QuickLinkDto {

        private Long id;

        private String name;

        private String icon;

        private String path;

        private Integer sortOrder;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder(toBuilder = true)
    public static class LlmConfigDto {

        private String provider;

        private String apiKey;

        private String apiBase;

        private ProviderConfigDto minimax;

        private ProviderConfigDto deepseek;

        private ProviderConfigDto openai;

        private MemoryConfigDto memory;

        public ProviderConfigDto getMinimax() {
            return copyProviderConfig(minimax);
        }

        public void setMinimax(ProviderConfigDto minimax) {
            this.minimax = copyProviderConfig(minimax);
        }

        public ProviderConfigDto getDeepseek() {
            return copyProviderConfig(deepseek);
        }

        public void setDeepseek(ProviderConfigDto deepseek) {
            this.deepseek = copyProviderConfig(deepseek);
        }

        public ProviderConfigDto getOpenai() {
            return copyProviderConfig(openai);
        }

        public void setOpenai(ProviderConfigDto openai) {
            this.openai = copyProviderConfig(openai);
        }

        public MemoryConfigDto getMemory() {
            return copyMemoryConfig(memory);
        }

        public void setMemory(MemoryConfigDto memory) {
            this.memory = copyMemoryConfig(memory);
        }
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder(toBuilder = true)
    public static class ProviderConfigDto {

        private String apiKey;

        private String apiBase;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder(toBuilder = true)
    public static class MemoryConfigDto {

        private Boolean enabled;

        private String mode;

        private Boolean enableL1;

        private Boolean enableL2;

        private Boolean enableL3;
    }
}