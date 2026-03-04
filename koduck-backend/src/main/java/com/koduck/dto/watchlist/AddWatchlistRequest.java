package com.koduck.dto.watchlist;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Request to add a stock to watchlist.
 */
public record AddWatchlistRequest(
    @NotBlank(message = "Market cannot be blank")
    String market,
    
    @NotBlank(message = "Symbol cannot be blank")
    @Size(max = 20, message = "Symbol too long")
    String symbol,
    
    @Size(max = 100, message = "Name too long")
    String name,
    
    @Size(max = 500, message = "Notes too long")
    String notes
) {}
