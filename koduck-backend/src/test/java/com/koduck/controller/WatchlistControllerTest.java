package com.koduck.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Method;
import java.util.Collections;
import java.util.List;

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
import com.koduck.dto.watchlist.AddWatchlistRequest;
import com.koduck.dto.watchlist.SortWatchlistRequest;
import com.koduck.dto.watchlist.WatchlistItemDto;
import com.koduck.entity.User;
import com.koduck.security.UserPrincipal;
import com.koduck.service.WatchlistService;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/**
 * Unit tests for {@link WatchlistController}.
 *
 * @author Koduck Team
 */
@ExtendWith(MockitoExtension.class)
class WatchlistControllerTest {

    /** Test user ID constant. */
    private static final Long USER_ID = 1001L;

    /** Test watchlist item ID for remove operation. */
    private static final Long REMOVE_ITEM_ID = 3L;

    /** Test watchlist item ID for update operation. */
    private static final Long UPDATE_ITEM_ID = 4L;

    /** Test sort order for update operation. */
    private static final int UPDATE_SORT_ORDER = 4;

    /** Maximum notes length constant. */
    private static final int MAX_NOTES_LENGTH = 500;

    /** Mock watchlist service. */
    @Mock
    private WatchlistService watchlistService;

    /** Mock authenticated user resolver. */
    @Mock
    private AuthenticatedUserResolver authenticatedUserResolver;

    /** Controller under test. */
    @InjectMocks
    private WatchlistController watchlistController;

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
    @DisplayName("Get watchlist should return data from service")
    void getWatchlistShouldReturnWatchlist() {
        WatchlistItemDto item = WatchlistItemDto.builder()
                .id(1L)
                .market("AShare")
                .symbol("000001")
                .name("Ping An Bank")
                .sortOrder(1)
                .notes("Core holding")
                .build();
        when(watchlistService.getWatchlist(USER_ID)).thenReturn(List.of(item));

        ApiResponse<List<WatchlistItemDto>> response = watchlistController.getWatchlist(userPrincipal);

        assertEquals(0, response.getCode());
        assertNotNull(response.getData());
        assertEquals(1, response.getData().size());
        assertEquals("000001", response.getData().getFirst().symbol());
        verify(watchlistService).getWatchlist(USER_ID);
    }

    @Test
    @DisplayName("Add watchlist item should delegate to service")
    void addToWatchlistShouldReturnItem() {
        AddWatchlistRequest request = new AddWatchlistRequest(
                "AShare",
                "600000",
                "PF Bank",
                "Value watch"
        );
        WatchlistItemDto item = WatchlistItemDto.builder()
                .id(2L)
                .market("AShare")
                .symbol("600000")
                .name("PF Bank")
                .sortOrder(2)
                .notes("Value watch")
                .build();
        when(watchlistService.addToWatchlist(USER_ID, request)).thenReturn(item);

        ApiResponse<WatchlistItemDto> response = watchlistController.addToWatchlist(userPrincipal, request);

        assertEquals(0, response.getCode());
        assertNotNull(response.getData());
        assertEquals(2L, response.getData().id());
        verify(watchlistService).addToWatchlist(USER_ID, request);
    }

    @Test
    @DisplayName("Remove watchlist item should return empty success response")
    void removeFromWatchlistShouldReturnSuccess() {
        ApiResponse<Void> response = watchlistController.removeFromWatchlist(
                userPrincipal,
                REMOVE_ITEM_ID
        );

        assertEquals(0, response.getCode());
        assertNull(response.getData());
        verify(watchlistService).removeFromWatchlist(USER_ID, REMOVE_ITEM_ID);
    }

    @Test
    @DisplayName("Sort watchlist should delegate to service")
    void sortWatchlistShouldReturnSuccess() {
        SortWatchlistRequest request = new SortWatchlistRequest(
                List.of(
                        new SortWatchlistRequest.SortItem(1L, 1),
                        new SortWatchlistRequest.SortItem(2L, 2)
                )
        );

        ApiResponse<Void> response = watchlistController.sortWatchlist(userPrincipal, request);

        assertEquals(0, response.getCode());
        assertNull(response.getData());
        verify(watchlistService).sortWatchlist(USER_ID, request);
    }

    @Test
    @DisplayName("Update notes should delegate to service")
    void updateNotesShouldReturnUpdatedItem() {
        WatchlistItemDto item = WatchlistItemDto.builder()
                .id(UPDATE_ITEM_ID)
                .market("AShare")
                .symbol("300750")
                .name("CATL")
                .sortOrder(UPDATE_SORT_ORDER)
                .notes("Momentum watch")
                .build();
        when(watchlistService.updateNotes(USER_ID, UPDATE_ITEM_ID, "Momentum watch"))
                .thenReturn(item);

        ApiResponse<WatchlistItemDto> response = watchlistController.updateNotes(
                userPrincipal,
                UPDATE_ITEM_ID,
                "Momentum watch"
        );

        assertEquals(0, response.getCode());
        assertNotNull(response.getData());
        assertEquals("Momentum watch", response.getData().notes());
        verify(watchlistService).updateNotes(USER_ID, UPDATE_ITEM_ID, "Momentum watch");
    }

    @Test
    @DisplayName("Controller should declare @Validated for method parameter validation")
    void controllerShouldDeclareValidatedAnnotation() {
        Validated validated = WatchlistController.class.getAnnotation(Validated.class);

        assertNotNull(validated);
    }

    @Test
    @DisplayName("ID parameters should declare positive constraint")
    void idParametersShouldDeclarePositiveConstraint() throws NoSuchMethodException {
        Method removeMethod = WatchlistController.class.getMethod(
                "removeFromWatchlist",
                UserPrincipal.class,
                Long.class
        );
        Method updateMethod = WatchlistController.class.getMethod(
                "updateNotes",
                UserPrincipal.class,
                Long.class,
                String.class
        );

        Positive removeIdPositive = removeMethod.getParameters()[1].getAnnotation(Positive.class);
        Positive updateIdPositive = updateMethod.getParameters()[1].getAnnotation(Positive.class);

        assertNotNull(removeIdPositive);
        assertNotNull(updateIdPositive);
    }

    @Test
    @DisplayName("Notes parameter should declare null and length constraints")
    void notesParameterShouldDeclareValidationConstraints() throws NoSuchMethodException {
        Method updateMethod = WatchlistController.class.getMethod(
                "updateNotes",
                UserPrincipal.class,
                Long.class,
                String.class
        );

        NotNull notNull = updateMethod.getParameters()[2].getAnnotation(NotNull.class);
        Size size = updateMethod.getParameters()[2].getAnnotation(Size.class);

        assertNotNull(notNull);
        assertNotNull(size);
        assertEquals(MAX_NOTES_LENGTH, size.max());
    }
}
