package com.koduck.controller.strategy;
import com.koduck.controller.strategy.StrategyController;

import java.lang.reflect.Method;
import java.util.Collections;
import java.util.List;

import jakarta.validation.constraints.Positive;

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
import com.koduck.dto.strategy.CreateStrategyRequest;
import com.koduck.dto.strategy.StrategyDto;
import com.koduck.dto.strategy.StrategyVersionDto;
import com.koduck.dto.strategy.UpdateStrategyRequest;
import com.koduck.entity.auth.User;
import com.koduck.security.UserPrincipal;
import com.koduck.service.StrategyService;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link StrategyController}.
 *
 * @author Koduck Team
 */
@ExtendWith(MockitoExtension.class)
class StrategyControllerTest {

    /** Test user ID constant. */
    private static final Long USER_ID = 1001L;

    /** Test strategy ID constant. */
    private static final Long STRATEGY_ID = 2001L;

    /** Test version ID constant. */
    private static final Long VERSION_ID = 3001L;

    /** Mock strategy service. */
    @Mock
    private StrategyService strategyService;

    /** Mock authenticated user resolver. */
    @Mock
    private AuthenticatedUserResolver authenticatedUserResolver;

    /** Controller under test. */
    @InjectMocks
    private StrategyController strategyController;

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
        lenient().when(authenticatedUserResolver.requireUserId(any(UserPrincipal.class))).thenReturn(USER_ID);
    }

    @Test
    @DisplayName("Get strategies should return data from service")
    void getStrategiesShouldReturnStrategies() {
        StrategyDto strategyDto = StrategyDto.builder().id(STRATEGY_ID).name("Momentum").build();
        when(strategyService.getStrategies(USER_ID)).thenReturn(List.of(strategyDto));

        ApiResponse<List<StrategyDto>> response = strategyController.getStrategies(userPrincipal);

        assertEquals(0, response.getCode());
        assertNotNull(response.getData());
        assertEquals(1, response.getData().size());
        assertEquals("Momentum", response.getData().get(0).name());
        verify(strategyService).getStrategies(USER_ID);
    }

    @Test
    @DisplayName("Get strategy should delegate to service")
    void getStrategyShouldReturnStrategy() {
        StrategyDto expected = StrategyDto.builder().id(STRATEGY_ID).name("Mean Reversion").build();
        when(strategyService.getStrategy(USER_ID, STRATEGY_ID)).thenReturn(expected);

        ApiResponse<StrategyDto> response = strategyController.getStrategy(userPrincipal, STRATEGY_ID);

        assertEquals(0, response.getCode());
        assertNotNull(response.getData());
        assertEquals("Mean Reversion", response.getData().name());
        verify(strategyService).getStrategy(USER_ID, STRATEGY_ID);
    }

    @Test
    @DisplayName("Create strategy should delegate to service")
    void createStrategyShouldReturnCreatedStrategy() {
        CreateStrategyRequest request = new CreateStrategyRequest("Breakout", "desc", "code", null);
        StrategyDto expected = StrategyDto.builder().id(STRATEGY_ID).name("Breakout").build();
        when(strategyService.createStrategy(USER_ID, request)).thenReturn(expected);

        ApiResponse<StrategyDto> response = strategyController.createStrategy(userPrincipal, request);

        assertEquals(0, response.getCode());
        assertNotNull(response.getData());
        assertEquals("Breakout", response.getData().name());
        verify(strategyService).createStrategy(USER_ID, request);
    }

    @Test
    @DisplayName("Update strategy should delegate to service")
    void updateStrategyShouldReturnUpdatedStrategy() {
        UpdateStrategyRequest request = new UpdateStrategyRequest("Updated", "new", null, null, null);
        StrategyDto expected = StrategyDto.builder().id(STRATEGY_ID).name("Updated").build();
        when(strategyService.updateStrategy(USER_ID, STRATEGY_ID, request)).thenReturn(expected);

        ApiResponse<StrategyDto> response = strategyController.updateStrategy(userPrincipal, STRATEGY_ID, request);

        assertEquals(0, response.getCode());
        assertNotNull(response.getData());
        assertEquals("Updated", response.getData().name());
        verify(strategyService).updateStrategy(USER_ID, STRATEGY_ID, request);
    }

    @Test
    @DisplayName("Get versions should delegate to service")
    void getVersionsShouldReturnVersions() {
        StrategyVersionDto versionDto = StrategyVersionDto.builder().id(1L).versionNumber(1).build();
        when(strategyService.getVersions(USER_ID, STRATEGY_ID)).thenReturn(List.of(versionDto));

        ApiResponse<List<StrategyVersionDto>> response = strategyController.getVersions(userPrincipal, STRATEGY_ID);

        assertEquals(0, response.getCode());
        assertNotNull(response.getData());
        assertEquals(1, response.getData().size());
        assertEquals(1, response.getData().get(0).versionNumber());
        verify(strategyService).getVersions(USER_ID, STRATEGY_ID);
    }

    @Test
    @DisplayName("Activate version should delegate to service")
    void activateVersionShouldReturnActivatedVersion() {
        Long versionId = VERSION_ID;
        StrategyVersionDto expected = StrategyVersionDto.builder()
                .id(versionId)
                .versionNumber(2)
                .isActive(true)
                .build();
        when(strategyService.activateVersion(USER_ID, STRATEGY_ID, versionId)).thenReturn(expected);

        ApiResponse<StrategyVersionDto> response = strategyController.activateVersion(
                userPrincipal,
                STRATEGY_ID,
                versionId
        );

        assertEquals(0, response.getCode());
        assertNotNull(response.getData());
        assertEquals(2, response.getData().versionNumber());
        verify(strategyService).activateVersion(USER_ID, STRATEGY_ID, versionId);
    }

    @Test
    @DisplayName("Controller should declare @Validated for method parameter validation")
    void controllerShouldDeclareValidatedAnnotation() {
        Validated validated = StrategyController.class.getAnnotation(Validated.class);

        assertNotNull(validated);
    }

    @Test
    @DisplayName("Get strategies should throw when user principal is null")
    void getStrategiesShouldThrowWhenUserPrincipalIsNull() {
        when(authenticatedUserResolver.requireUserId(null)).thenThrow(new NullPointerException());
        assertThrows(NullPointerException.class, () -> strategyController.getStrategies(null));
    }

    @Test
    @DisplayName("Path variables should declare positive constraints")
    void pathVariablesShouldDeclarePositiveConstraints() throws NoSuchMethodException {
        Method getStrategyMethod = StrategyController.class.getMethod(
            "getStrategy",
            UserPrincipal.class,
            Long.class
        );
        Method updateStrategyMethod = StrategyController.class.getMethod(
            "updateStrategy",
            UserPrincipal.class,
            Long.class,
            UpdateStrategyRequest.class
        );
        Method deleteStrategyMethod = StrategyController.class.getMethod(
            "deleteStrategy",
            UserPrincipal.class,
            Long.class
        );
        Method publishStrategyMethod = StrategyController.class.getMethod(
            "publishStrategy",
            UserPrincipal.class,
            Long.class
        );
        Method disableStrategyMethod = StrategyController.class.getMethod(
            "disableStrategy",
            UserPrincipal.class,
            Long.class
        );
        Method getVersionsMethod = StrategyController.class.getMethod(
            "getVersions",
            UserPrincipal.class,
            Long.class
        );
        Method getVersionMethod = StrategyController.class.getMethod(
            "getVersion",
            UserPrincipal.class,
            Long.class,
            Integer.class
        );
        Method activateVersionMethod = StrategyController.class.getMethod(
            "activateVersion",
            UserPrincipal.class,
            Long.class,
            Long.class
        );

        assertNotNull(getStrategyMethod.getParameters()[1].getAnnotation(Positive.class));
        assertNotNull(updateStrategyMethod.getParameters()[1].getAnnotation(Positive.class));
        assertNotNull(deleteStrategyMethod.getParameters()[1].getAnnotation(Positive.class));
        assertNotNull(publishStrategyMethod.getParameters()[1].getAnnotation(Positive.class));
        assertNotNull(disableStrategyMethod.getParameters()[1].getAnnotation(Positive.class));
        assertNotNull(getVersionsMethod.getParameters()[1].getAnnotation(Positive.class));
        assertNotNull(getVersionMethod.getParameters()[1].getAnnotation(Positive.class));
        assertNotNull(getVersionMethod.getParameters()[2].getAnnotation(Positive.class));
        assertNotNull(activateVersionMethod.getParameters()[1].getAnnotation(Positive.class));
        assertNotNull(activateVersionMethod.getParameters()[2].getAnnotation(Positive.class));
    }
}
