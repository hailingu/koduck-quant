package com.koduck.dto.watchlist;
import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

/**
 * Request to reorder watchlist items.
 */
public record SortWatchlistRequest(
    @NotEmpty(message = "Items cannot be empty")
    @Valid
    List<SortItem> items
) {
    public SortWatchlistRequest {
        items = items == null ? null : List.copyOf(items);
    }
    
    public record SortItem(
        @NotNull(message = "ID cannot be null")
        Long id,
        
        @NotNull(message = "Sort order cannot be null")
        Integer sortOrder
    ) {}
}
