package com.koduck.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Collections;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.validation.annotation.Validated;

import com.koduck.controller.support.AuthenticatedUserResolver;
import com.koduck.dto.ApiResponse;
import com.koduck.dto.settings.UpdateNotificationRequest;
import com.koduck.dto.settings.UpdateSettingsRequest;
import com.koduck.dto.settings.UpdateThemeRequest;
import com.koduck.dto.settings.UserSettingsDto;
import com.koduck.entity.User;
import com.koduck.security.UserPrincipal;
import com.koduck.service.UserSettingsService;

/**
 * Unit tests for {@link SettingsController}.
 *
 * @author GitHub Copilot
 */
@ExtendWith(MockitoExtension.class)
class SettingsControllerTest {

    /** Test user ID. */
    private static final Long USER_ID = 1001L;

    /** Mock service for user settings. */
    @Mock
    private UserSettingsService userSettingsService;

    /** Mock resolver for authenticated user. */
    @Mock
    private AuthenticatedUserResolver authenticatedUserResolver;

    /** Controller under test. */
    @InjectMocks
    private SettingsController settingsController;

    /** Test user principal. */
    private UserPrincipal userPrincipal;

    @BeforeEach
    void setUp() {
        User user = User.builder()
                .id(USER_ID)
                .username("tester")
                .email("tester@example.com")
                .passwordHash("hashed")
                .status(User.UserStatus.ACTIVE)
                .build();
        userPrincipal = new UserPrincipal(user, Collections.emptyList());
        lenient().when(authenticatedUserResolver.requireUserId(
            any(UserPrincipal.class))).thenReturn(USER_ID);
    }

    @Test
    @DisplayName("Get settings should return data from service")
    void getSettingsShouldReturnSettings() {
        UserSettingsDto expected = UserSettingsDto.builder()
                .userId(USER_ID)
                .theme("light")
                .language("zh-CN")
                .timezone("Asia/Shanghai")
                .build();
        when(userSettingsService.getSettings(USER_ID)).thenReturn(expected);

        ApiResponse<UserSettingsDto> response =
            settingsController.getSettings(userPrincipal);

        assertEquals(0, response.getCode());
        assertNotNull(response.getData());
        assertEquals("light", response.getData().getTheme());
        verify(userSettingsService).getSettings(USER_ID);
    }

    @Test
    @DisplayName("Update settings should delegate to service")
    void updateSettingsShouldReturnUpdatedSettings() {
        UpdateSettingsRequest request = UpdateSettingsRequest.builder()
                .theme("dark")
                .language("en-US")
                .build();
        UserSettingsDto expected = UserSettingsDto.builder()
                .userId(USER_ID)
                .theme("dark")
                .language("en-US")
                .build();
        when(userSettingsService.updateSettings(USER_ID, request))
            .thenReturn(expected);

        ApiResponse<UserSettingsDto> response =
            settingsController.updateSettings(userPrincipal, request);

        assertEquals(0, response.getCode());
        assertNotNull(response.getData());
        assertEquals("dark", response.getData().getTheme());
        verify(userSettingsService).updateSettings(USER_ID, request);
    }

    @Test
    @DisplayName("Update theme should delegate to service")
    void updateThemeShouldReturnUpdatedSettings() {
        UpdateThemeRequest request = UpdateThemeRequest.builder()
            .theme("auto").build();
        UserSettingsDto expected = UserSettingsDto.builder()
            .userId(USER_ID).theme("auto").build();
        when(userSettingsService.updateTheme(USER_ID, "auto"))
            .thenReturn(expected);

        ApiResponse<UserSettingsDto> response =
            settingsController.updateTheme(userPrincipal, request);

        assertEquals(0, response.getCode());
        assertNotNull(response.getData());
        assertEquals("auto", response.getData().getTheme());
        verify(userSettingsService).updateTheme(USER_ID, "auto");
    }

    @Test
    @DisplayName("Update notification should delegate to service")
    void updateNotificationShouldReturnUpdatedSettings() {
        UpdateNotificationRequest request = UpdateNotificationRequest.builder()
                .email(Boolean.TRUE)
                .browser(Boolean.FALSE)
                .build();
        UserSettingsDto expected = UserSettingsDto.builder()
            .userId(USER_ID).build();
        when(userSettingsService.updateNotification(USER_ID, request))
            .thenReturn(expected);

        ApiResponse<UserSettingsDto> response =
            settingsController.updateNotification(userPrincipal, request);

        assertEquals(0, response.getCode());
        assertNotNull(response.getData());
        assertEquals(USER_ID, response.getData().getUserId());
        verify(userSettingsService).updateNotification(USER_ID, request);
    }

    @Test
    @DisplayName("Controller should declare Validated for method parameter validation")
    void controllerShouldDeclareValidatedAnnotation() {
        Validated validated = SettingsController.class.getAnnotation(Validated.class);

        assertNotNull(validated);
    }

    @Test
    @DisplayName("Get settings should throw when user principal is null")
    void getSettingsShouldThrowWhenUserPrincipalIsNull() {
        when(authenticatedUserResolver.requireUserId(null))
            .thenThrow(new NullPointerException());
        assertThrows(NullPointerException.class,
            () -> settingsController.getSettings(null));
    }
}
