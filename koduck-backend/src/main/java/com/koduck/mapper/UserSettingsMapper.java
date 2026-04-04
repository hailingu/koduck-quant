package com.koduck.mapper;

import java.util.List;

import org.mapstruct.BeanMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.NullValuePropertyMappingStrategy;
import org.mapstruct.ReportingPolicy;

import com.koduck.dto.settings.DisplayConfigDto;
import com.koduck.dto.settings.NotificationConfigDto;
import com.koduck.dto.settings.QuickLinkDto;
import com.koduck.dto.settings.TradingConfigDto;
import com.koduck.dto.settings.UpdateNotificationRequest;
import com.koduck.dto.settings.UpdateSettingsRequest;
import com.koduck.dto.settings.UserSettingsDto;
import com.koduck.entity.user.UserSettings;

/**
 * Mapper for user settings update/request and DTO conversions.
 *
 * @author GitHub Copilot
 */
@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.IGNORE)
public interface UserSettingsMapper {

    /**
     * Converts user settings entity to response DTO.
     *
     * @param source user settings entity
     * @return response DTO
     */
    UserSettingsDto toDto(UserSettings source);

    /**
     * Applies basic nullable fields from update request to target entity.
     *
     * @param source update request
     * @param target target settings entity
     */
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "userId", ignore = true)
    @Mapping(target = "notificationConfig", ignore = true)
    @Mapping(target = "tradingConfig", ignore = true)
    @Mapping(target = "displayConfig", ignore = true)
    @Mapping(target = "quickLinks", ignore = true)
    @Mapping(target = "llmConfig", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    void updateBasicFields(UpdateSettingsRequest source, @MappingTarget UserSettings target);

    /**
     * Maps notification config update DTO to entity JSON object.
     *
     * @param source source notification config DTO
     * @return mapped notification config
     */
    UserSettings.NotificationConfig toNotificationConfig(NotificationConfigDto source);

    /**
     * Maps trading config update DTO to entity JSON object.
     *
     * @param source source trading config DTO
     * @return mapped trading config
     */
    UserSettings.TradingConfig toTradingConfig(TradingConfigDto source);

    /**
     * Maps display config update DTO to entity JSON object.
     *
     * @param source source display config DTO
     * @return mapped display config
     */
    UserSettings.DisplayConfig toDisplayConfig(DisplayConfigDto source);

    /**
     * Maps quick link update DTO list to entity JSON list.
     *
     * @param source source quick link DTO list
     * @return mapped quick link list
     */
    List<UserSettings.QuickLink> toQuickLinks(List<QuickLinkDto> source);

    /**
     * Applies notification patch request to existing config, preserving unspecified fields.
     *
     * @param source update notification request
     * @param target existing notification config
     */
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    void updateNotificationConfig(UpdateNotificationRequest source,
                                  @MappingTarget UserSettings.NotificationConfig target);
}
