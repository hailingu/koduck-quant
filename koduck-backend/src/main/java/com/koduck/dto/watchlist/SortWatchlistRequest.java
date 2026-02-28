package com.koduck.dto.watchlist;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

/**
 * Request to reorder watchlist items.
 */
public record SortWatchlistRequest(
    @NotEmpty(message = "Items cannot be empty")
    @Valid
    List<SortItem> items
) {
    
    public record SortItem(
        @NotNull(message = "ID cannot be null")
        Long id,
        
        @NotNull(message = "Sort order cannot be null")
        Integer sortOrder
    ) {}
}
